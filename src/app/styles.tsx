// Money styles (Plus): the four ways to run the same pay, worked out for this person today — the same picker as
// Setup's "Pick your plan". Opened from Home's Money styles card, Your month and Profile.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlanPicker } from '@/components/PlanPicker';
import { PlusSheet } from '@/components/PlusSheet';
import { plusPitch } from '@/components/plusPitch';
import { ScreenHeader } from '@/components/ScreenHeader';
import { GlowBackground } from '@/components/glow/GlowBackground';
import { Button } from '@/components/ui';
import type { Inputs, Style } from '@/lib/brain';
import { STYLES, withStyle } from '@/lib/budget';
import { useAuth } from '@/lib/auth';
import { useHome } from '@/lib/home';
import { t } from '@/lib/i18n';
import { useMonth } from '@/lib/month';
import { EMPTY_DRAFT, type GoalKind, type SetupDraft } from '@/lib/setup/draft';
import { monthsUntil } from '@/lib/setup/plan';

export default function MoneyStyles() {
  const insets = useSafeAreaInsets();
  const { month, save } = useMonth();
  const { goals } = useHome(month);
  const { profile } = useAuth();
  const isPlus = profile ? profile.plan !== 'free' : false;
  const [picked, setPicked] = useState<Style | null>(null);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (month && !picked) setPicked(month.style);
  }, [month, picked]);

  if (!month || !picked) return <GlowBackground />;
  const g = goals[0];
  const monthly = g?.kind === 'monthly';
  // Plan on today's numbers: what's saved now and the months left, not the day this plan was first made.
  const inputs: Inputs = g
    ? { ...month.inputs, goal: { ...month.inputs.goal, saved: g.saved, target: monthly ? month.inputs.goal.target : g.target, months: monthly || !g.due ? null : monthsUntil(g.due) } }
    : month.inputs;
  const draft: SetupDraft = {
    ...EMPTY_DRAFT,
    incomeType: month.payday ? 'regular' : 'changes',
    payday: month.payday,
    goalTitle: g?.title ?? month.goal.title,
    goalKind: (g?.kind ?? (month.goal.isSafetyNet ? 'safety_net' : 'trip')) as GoalKind,
    goalType: g?.goalType ?? null,
    goalPhoto: g?.photo ?? null,
    budgetStyle: picked,
  };
  const name = STYLES.find((x) => x.key === picked)?.name ?? '';
  const same = picked === month.style;
  // The goal amount someone chose stays with their current style; another style starts from Kip's amount — exactly what each row shows.
  const goalPerMonth = same ? month.goalPerMonth : null;
  const pitch = plusPitch(month, draft.goalTitle, 0);

  async function choose() {
    if (!month || !picked) return;
    if (!isPlus) return setLocked(true);
    if (!same) {
      setBusy(true);
      await save(withStyle({ ...month, inputs }, picked, goalPerMonth));
      setBusy(false);
    }
    router.canGoBack() ? router.back() : router.replace('/');
  }

  return (
    <View style={{ flex: 1 }}>
      <GlowBackground />
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + 8 }]} showsVerticalScrollIndicator={false}>
        <ScreenHeader />
        <PlanPicker draft={draft} inputs={inputs} style={picked} goalPerMonth={goalPerMonth} onPick={setPicked} />
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <Button label={same ? t('Keep {name}', { name }) : t('Switch to {name}', { name })} loading={busy} onPress={choose} />
      </View>
      {locked && (
        <PlusSheet open onClose={() => setLocked(false)} onUnlocked={() => setLocked(false)} title={pitch.styles.title} sub={pitch.styles.sub}>
          {pitch.styles.body}
        </PlusSheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 140, gap: 16 },
  footer: { position: 'absolute', left: 20, right: 20, bottom: 0 },
});
