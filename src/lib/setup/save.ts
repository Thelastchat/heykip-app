import { t } from '@/lib/i18n';
import { forgetMonth } from '@/lib/month';
import { smallPhoto } from '@/lib/photos';
import { supabase } from '@/lib/supabase';
import { pinColors } from '@/theme';

import { safetyNet } from '@/lib/brain';
import { monthFrom } from '@/lib/budget';

import type { SetupDraft } from './draft';
import { isoDay, makePlan } from './plan';

export type PlanChoice = 'trial' | 'free';

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
    const photo = await smallPhoto(draft.goalPhoto, 1080);
    const path = `${userId}/goal-${stamp}.${photo.ext}`;
    const { error } = await supabase.storage.from('goal-photos').upload(path, photo.bytes, { contentType: photo.contentType, upsert: true });
    if (error) throw new Error(t('Couldn’t upload your photo: {reason}', { reason: error.message }));
    photoPath = `goal-photos/${path}`;
  }

  // 2. Signature → a tiny SVG.
  let signaturePath: string | null = null;
  if (draft.signature) {
    const path = `${userId}/promise-${stamp}.svg`;
    const { error } = await supabase.storage.from('signatures').upload(path, draft.signature, { contentType: 'image/svg+xml', upsert: true });
    if (error) throw new Error(t('Couldn’t save your signature: {reason}', { reason: error.message }));
    signaturePath = `signatures/${path}`;
  }

  // 3. The first goal, pinned in spot 1 (always orange).
  const monthly = draft.goalKind === 'monthly';
  const goal = {
    user_id: userId,
    title: draft.goalTitle.trim(),
    kind: draft.goalKind,
    goal_type: draft.goalType,
    target_amount: monthly ? (draft.goalMonthly ?? 0) * 12 : draft.goalTarget,
    monthly_amount: monthly ? draft.goalMonthly : null,
    saved_amount: monthly ? 0 : (draft.goalSaved ?? 0),
    due_date: monthly ? null : isoDay(plan.due),
    pin_color: pinColors[0],
    position: 1,
    status: 'active',
    ...(photoPath ? { photo_url: photoPath } : {}),
  };
  const { data: existing } = await supabase.from('goals').select('id').eq('user_id', userId).eq('position', 1).eq('status', 'active').maybeSingle();
  const saved = existing ? await supabase.from('goals').update(goal).eq('id', existing.id).select('id').single() : await supabase.from('goals').insert(goal).select('id').single();
  if (saved.error) throw new Error(t('Couldn’t pin your goal: {reason}', { reason: saved.error.message }));

  // 4. The promise.
  const { error: promiseError } = await supabase.from('promises').insert({
    user_id: userId,
    goal_id: saved.data.id,
    text: [draft.promiseMain ?? plan.promiseMain, draft.promiseBackup ?? plan.promiseBackup].join('\n'),
    signature_url: signaturePath,
    signed_at: draft.signedAt ?? new Date().toISOString(),
  });
  if (promiseError) throw new Error(t('Couldn’t save your promise: {reason}', { reason: promiseError.message }));

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
      rent: draft.rent ?? 0,
      daily_budget: plan.dailySpend,
      money_style: draft.moneyStyle,
      money_leaks: draft.leaks,
      budget_style: draft.budgetStyle,
      budget: monthFrom(plan.inputs, draft.budgetStyle, draft.goalPerMonth, draft.incomeType === 'regular' ? draft.payday : null, safetyNet(plan.inputs).target),
      onboarded: true,
    })
    .eq('id', userId);
  if (profileError) throw new Error(t('Couldn’t finish setup: {reason}', { reason: profileError.message }));
  // The free week is started by the server (once per person). If it's already used, setup still finishes on Free.
  if (choice === 'trial') await supabase.rpc('start_trial');
  forgetMonth(); // the plan was just written here — screens load the new one
}
