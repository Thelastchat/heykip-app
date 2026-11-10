// Old slips catching up a past month (approved mockup): shown once, right after Save, when the older slips made a
// past pay month go over. Take it from the main goal, or leave it — nothing is taken unless tapped.
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Kip } from '@/components/Kip';
import { liteOf } from '@/components/goals/bits';
import { Squish } from '@/components/glow/motion';
import type { MonthBudget } from '@/lib/budget';
import type { CatchRow } from '@/lib/catchup';
import { arrivals, splitOf } from '@/lib/goals';
import type { HomeGoal } from '@/lib/home';
import { monthLong, t } from '@/lib/i18n';
import { baht } from '@/lib/money';
import { monthYear, shortName } from '@/lib/setup/plan';
import { colors, fonts, inkA, themed } from '@/theme';
import { DragSheet } from '@/components/DragSheet';

type Props = { rows: CatchRow[]; goal: HomeGoal; goals: HomeGoal[]; month: MonthBudget; onTake: (amount: number, note: string) => Promise<string | null>; onDone: () => void };

export function CatchUpSheet({ rows, goal, goals, month, onTake, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const total = rows.reduce((a, r) => a + r.over, 0);
  const take = Math.min(total, Math.round(goal.saved));
  const name = goal.kind === 'monthly' ? goal.title : shortName(goal.title, goal.kind as never);
  const one = rows.length === 1 ? rows[0] : null;
  const label = (r: CatchRow) => monthLong(r.month.getMonth());

  // Saved so far and the arrival date, now and after taking.
  const lites = goals.map(liteOf);
  const after = lites.map((g) => (g.id === goal.id ? { ...g, saved: g.saved - take } : g));
  const was = goal.kind !== 'monthly' ? arrivals(lites, splitOf(month, lites), month.payday).get(goal.id) : null;
  const will = goal.kind !== 'monthly' ? arrivals(after, splitOf(month, after), month.payday).get(goal.id) : null;

  async function takeIt() {
    setBusy(true);
    const err = await onTake(take, rows.map(label).join(', '));
    setBusy(false);
    if (err) return setProblem(t('Couldn’t save: {msg}', { msg: err }));
    onDone();
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onDone}>
      <Pressable style={styles.dim} onPress={onDone} accessibilityLabel={t('Close')} />
      <DragSheet onClose={onDone} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
        <View style={styles.grip} />
        <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ gap: 12 }} showsVerticalScrollIndicator={false} bounces={false}>
          <View style={styles.head}>
            <Kip mood="careful" size={44} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {one ? t('{month} went {amount} over', { month: label(one), amount: baht(one.over) }) : t('{n} past months went {amount} over', { n: rows.length, amount: baht(total) })}
              </Text>
              <Text style={styles.body}>
                {one
                  ? one.slips === 1
                    ? t('The older slip you just saved was from {month}’s pay month. With it, that month spent more than its money for spending, and its saving already went to {goal} on payday.', {
                        month: label(one),
                        goal: name,
                      })
                    : t(
                        'The {n} older slips you just saved were from {month}’s pay month. With them, that month spent more than its money for spending, and its saving already went to {goal} on payday.',
                        {
                          n: one.slips,
                          month: label(one),
                          goal: name,
                        },
                      )
                  : t(
                      'The older slips you just saved were from {n} past pay months. With them, those months spent more than their money for spending, and their saving already went to {goal} on payday.',
                      {
                        n: rows.length,
                        goal: name,
                      },
                    )}
              </Text>
            </View>
          </View>

          <View style={styles.box}>
            {one ? (
              <>
                <Row label={t('{month} spending money', { month: label(one) })} value={baht(one.budget)} />
                <Row label={t('Spent, with these slips')} value={baht(one.spent)} line />
                <Row label={t('Over')} value={baht(one.over)} over line />
              </>
            ) : (
              rows.map((r, i) => <Row key={r.key} label={label(r)} value={t('{amount} over', { amount: baht(r.over) })} over line={i > 0} />)
            )}
          </View>

          <View style={styles.goal}>
            <Text style={styles.gl}>{t('If you take it from {goal}', { goal: name })}</Text>
            <View style={styles.gr}>
              <Text style={styles.gk}>{t('Saved so far')}</Text>
              <Text style={styles.gv}>
                <Text style={styles.was}>{baht(goal.saved)}</Text> {baht(goal.saved - take)}
              </Text>
            </View>
            {was && will && was.getTime() !== will.getTime() ? (
              <View style={styles.gr}>
                <Text style={styles.gk}>{t('Arrives')}</Text>
                <Text style={styles.gv}>
                  <Text style={styles.was}>{monthYear(was)}</Text> {monthYear(will)}
                </Text>
              </View>
            ) : null}
            {take < total ? <Text style={styles.short}>{t('{goal} has {amount} saved, so that’s all I can take', { goal: name, amount: baht(goal.saved) })}</Text> : null}
          </View>

          {problem ? <Text style={[styles.fine, { color: colors.orangeText }]}>{problem}</Text> : null}
          <Squish style={[styles.btn, busy && { opacity: 0.5 }]} onPress={takeIt} disabled={busy} accessibilityRole="button">
            <Text style={styles.btnT}>{busy ? t('Saving…') : t('Take {amount} from {goal}', { amount: baht(take), goal: name })}</Text>
          </Squish>
          <Squish style={styles.btn2} onPress={onDone} disabled={busy} accessibilityRole="button">
            <Text style={styles.btn2T}>{t('Leave it')}</Text>
          </Squish>
          <Text style={styles.fine}>{t('Leave it if that money came from somewhere else, like a bonus or savings outside HeyKip')}</Text>
        </ScrollView>
      </DragSheet>
    </Modal>
  );
}

function Row({ label, value, over, line }: { label: string; value: string; over?: boolean; line?: boolean }) {
  return (
    <View style={[styles.row, line && styles.line]}>
      <Text style={styles.rk}>{label}</Text>
      <Text style={[styles.rv, over && { color: colors.orangeText }]}>{value}</Text>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    dim: { flex: 1, backgroundColor: inkA(0.38) },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: '92%',
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      backgroundColor: colors.sheet.replace(/,\s*[\d.]+\)$/, ',1)'),
      paddingTop: 10,
      paddingHorizontal: 20,
      gap: 16,
    },
    grip: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: inkA(0.15) },
    head: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    title: { fontFamily: fonts.semibold, fontSize: 22, letterSpacing: -0.3, lineHeight: 27, color: colors.ink },
    body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.ink, marginTop: 6 },
    box: { borderRadius: 18, backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: 2 },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, gap: 12 },
    line: { borderTopWidth: 1, borderTopColor: inkA(0.06) },
    rk: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, flexShrink: 1 },
    rv: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink, fontVariant: ['tabular-nums'] },
    goal: { borderRadius: 20, backgroundColor: colors.lime, paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
    gl: { fontFamily: fonts.medium, fontSize: 13, color: 'rgba(0,0,0,0.6)' },
    gr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    gk: { fontFamily: fonts.regular, fontSize: 14, color: 'rgba(0,0,0,0.6)' },
    gv: { fontFamily: fonts.semibold, fontSize: 14, color: '#111', fontVariant: ['tabular-nums'] },
    was: { fontFamily: fonts.regular, color: 'rgba(0,0,0,0.4)', textDecorationLine: 'line-through' },
    short: { fontFamily: fonts.regular, fontSize: 13, color: 'rgba(0,0,0,0.6)' },
    btn: { marginTop: 6, height: 56, borderRadius: 999, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
    btnT: { fontFamily: fonts.medium, fontSize: 16, color: colors.paper },
    btn2: { height: 48, alignItems: 'center', justifyContent: 'center' },
    btn2T: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    fine: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.muted, textAlign: 'center' },
  }),
);
