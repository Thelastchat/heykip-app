import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { pinColors } from '@/theme';

import type { SetupDraft } from './draft';
import { makePlan } from './plan';

export type PlanChoice = 'trial' | 'free';

async function photoBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') return (await fetch(uri)).arrayBuffer();
  return new File(uri).arrayBuffer();
}

/**
 * Saves everything from Setup in one go, right after the person has an account:
 * their basics, the first pinned goal (with its photo), the signed promise, and their plan.
 * Safe to run twice: the goal in pin 1 is updated rather than duplicated.
 */
export async function finishSetup(userId: string, draft: SetupDraft, choice: PlanChoice) {
  const plan = makePlan(draft);
  const stamp = Date.now();

  // 1. Goal photo → private bucket, stored by path (shown later through a signed link).
  let photoPath: string | null = null;
  if (draft.goalPhoto && !draft.goalPhoto.startsWith('http')) {
    const ext = (draft.goalPhoto.split('.').pop() ?? 'jpg').toLowerCase().replace('jpeg', 'jpg');
    const path = `${userId}/goal-${stamp}.${ext}`;
    const { error } = await supabase.storage.from('goal-photos').upload(path, await photoBytes(draft.goalPhoto), {
      contentType: ext === 'png' ? 'image/png' : ext === 'heic' ? 'image/heic' : 'image/jpeg',
      upsert: true,
    });
    if (error) throw new Error(`Couldn’t upload your photo: ${error.message}`);
    photoPath = `goal-photos/${path}`;
  }

  // 2. Signature → a tiny SVG.
  let signaturePath: string | null = null;
  if (draft.signature) {
    const path = `${userId}/promise-${stamp}.svg`;
    const { error } = await supabase.storage.from('signatures').upload(path, draft.signature, { contentType: 'image/svg+xml', upsert: true });
    if (error) throw new Error(`Couldn’t save your signature: ${error.message}`);
    signaturePath = `signatures/${path}`;
  }

  // 3. The first goal, pinned in spot 1 (always orange).
  const goal = {
    user_id: userId,
    title: draft.goalTitle.trim(),
    kind: draft.goalKind,
    target_amount: draft.goalTarget,
    saved_amount: draft.goalSaved ?? 0,
    due_date: draft.goalDue,
    pin_color: pinColors[0],
    position: 1,
    status: 'active',
    ...(photoPath ? { photo_url: photoPath } : {}),
  };
  const { data: existing } = await supabase.from('goals').select('id').eq('user_id', userId).eq('position', 1).eq('status', 'active').maybeSingle();
  const saved = existing
    ? await supabase.from('goals').update(goal).eq('id', existing.id).select('id').single()
    : await supabase.from('goals').insert(goal).select('id').single();
  if (saved.error) throw new Error(`Couldn’t pin your goal: ${saved.error.message}`);

  // 4. The promise.
  const { error: promiseError } = await supabase.from('promises').insert({
    user_id: userId,
    goal_id: saved.data.id,
    text: [draft.promiseMain ?? plan.promiseMain, draft.promiseBackup ?? plan.promiseBackup].join('\n'),
    signature_url: signaturePath,
    signed_at: draft.signedAt ?? new Date().toISOString(),
  });
  if (promiseError) throw new Error(`Couldn’t save your promise: ${promiseError.message}`);

  // 5. The basics, the plan, and "set up" — last, so a failure above can simply be retried.
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      income_type: draft.incomeType,
      monthly_income: draft.incomeType === 'regular' ? draft.monthlyIncome : null,
      slow_month_income: draft.incomeType === 'changes' ? draft.slowMonth : null,
      good_month_income: draft.incomeType === 'changes' ? draft.goodMonth : null,
      payday: draft.incomeType === 'regular' ? draft.payday : null,
      month_starts_on_payday: draft.monthStartsOnPayday,
      split_when_paid: draft.splitWhenPaid,
      rent: draft.rent,
      daily_budget: plan.dailySpend,
      money_style: draft.moneyStyle,
      money_leaks: draft.leaks,
      plan: choice,
      trial_ends_at: choice === 'trial' ? new Date(stamp + 7 * 86_400_000).toISOString() : null,
      onboarded: true,
    })
    .eq('id', userId);
  if (profileError) throw new Error(`Couldn’t finish setup: ${profileError.message}`);
}
