import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { KipSays, SetupScreen, Title } from '@/components/setup/kit';
import { Button } from '@/components/ui';
import { plan as splitMonth } from '@/lib/brain';
import { STYLES } from '@/lib/budget';
import { baht } from '@/lib/money';
import { useSetup } from '@/lib/setup/draft';
import { inputsFrom, monthYear, monthsFromNow, monthsUntil, parseDay, shortName } from '@/lib/setup/plan';
import { colors, fonts, radius, shadow } from '@/theme';

// Setup 4/6 · Pick your money style — with the real result of each one, for this person's numbers.
export default function SetupMoney() {
  const { draft, update } = useSetup();
  const inputs = inputsFrom(draft);
  const monthly = draft.goalKind === 'monthly';
  const short = monthly ? draft.goalTitle.trim() || 'Savings' : shortName(draft.goalTitle, draft.goalKind);
  // What the person chose on the step before (a date for a goal, an amount for monthly saving) — every card is compared to it.
  const chosen = monthly ? null : draft.goalDue ? parseDay(draft.goalDue) : null;
  const chosenMonths = chosen ? monthsUntil(draft.goalDue as string) : null;

  return (
    <SetupScreen step={4} footer={<Button label="Next" onPress={() => router.push('/setup/yours')} />}>
      <KipSays>
        {chosen ? (
          <>
            You picked <Text style={{ fontFamily: fonts.semibold }}>{short} in {monthYear(chosen)}</Text>. Kip’s plan gets you there — here’s how the other styles compare, if you stick to them.
          </>
        ) : monthly ? (
          <>
            You want to save <Text style={{ fontFamily: fonts.semibold }}>{baht(draft.goalMonthly ?? 0)} a month</Text>. Here’s what each style does with your {baht(inputs.income)}, if you stick to it.
          </>
        ) : (
          <>
            Same {baht(inputs.income)}, four ways to split it. Here’s what each one means for <Text style={{ fontFamily: fonts.semibold }}>you</Text> — if you stick to it.
          </>
        )}
      </KipSays>
      <Title>Pick your money style</Title>

      <View style={{ gap: 10 }} accessibilityRole="radiogroup">
        {STYLES.map((s) => {
          const r = splitMonth(inputs, s.key);
          const on = draft.budgetStyle === s.key;
          const when = monthly ? `${baht(r.goal)}/mo` : r.goalMonths ? monthYear(monthsFromNow(r.goalMonths, draft)) : 'Not yet';
          const split = r.netIn12 > 0 ? `${short} ${baht(r.goalIn12)} + safety net ${baht(r.netIn12)}` : `all for ${short}`;
          const stats: [string, string, string?][] = [
            [short, when],
            ['Saved in 1 year', baht(r.savedIn12), split],
            ['Spend a day', baht(r.daily)],
            [s.key === 'savefirst' ? 'After saving' : 'Fun a month', s.key === 'savefirst' ? 'One pot' : baht(r.fun)],
          ];
          const vsPick =
            chosenMonths && r.goalMonths
              ? r.goalMonths > chosenMonths
                ? `${r.goalMonths - chosenMonths} month${r.goalMonths - chosenMonths > 1 ? 's' : ''} later than your pick (${monthYear(chosen as Date)}).`
                : r.goalMonths < chosenMonths
                  ? `${chosenMonths - r.goalMonths} month${chosenMonths - r.goalMonths > 1 ? 's' : ''} sooner than your pick — fun money is tighter.`
                  : `Matches your pick: ${monthYear(chosen as Date)}.`
              : monthly && r.goal < (draft.goalMonthly ?? 0)
                ? `Only ${baht(r.goal)} a month for ${short} — less than the ${baht(draft.goalMonthly ?? 0)} you wanted.`
                : '';
          const tight = r.fun <= inputs.income * 0.06 ? ' Fun money is tight — little room for surprises.' : '';
          const styleNote = r.notes.find((n) => !n.startsWith('No categories')) ?? '';
          const note = [vsPick + (vsPick ? tight : ''), styleNote].filter(Boolean).join(' ') || tight.trim();
          return (
            <Pressable
              key={s.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${s.name}. ${stats.map(([k, v]) => `${k} ${v}`).join(', ')}`}
              onPress={() => update({ budgetStyle: s.key, goalPerMonth: null })}
              style={[styles.card, on && [styles.cardOn, { backgroundColor: s.tagColor }]]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[styles.radio, on && { borderWidth: 7, borderColor: colors.ink }]} />
                <Text style={styles.name}>{s.name}</Text>
                <View style={[styles.tag, { backgroundColor: on ? '#FFFFFF' : s.tagColor }]}>
                  <Text style={styles.tagText}>{s.tag}</Text>
                </View>
              </View>
              <Text style={styles.desc}>{s.desc}</Text>
              <View style={[styles.grid, { backgroundColor: '#FFFFFF' }]}>
                {stats.map(([k, v, sub]) => (
                  <View key={k} style={{ width: '50%', paddingVertical: 4, paddingRight: 6 }}>
                    <Text style={styles.statLabel} numberOfLines={1}>
                      {k}
                    </Text>
                    <Text style={styles.statValue} numberOfLines={1}>
                      {v}
                    </Text>
                    {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
                  </View>
                ))}
              </View>
              {note ? <Text style={styles.note}>{note}</Text> : null}
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.foot}>
        “Saved in 1 year” is everything you put away: money for {short} plus your safety net. Every style keeps rent, bills and your living costs the same — only saving and fun change.
      </Text>
    </SetupScreen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 2, borderColor: 'transparent', backgroundColor: '#F8F6F4', paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  cardOn: { borderColor: colors.ink, ...shadow.card },
  radio: { width: 22, height: 22, borderRadius: radius.pill, borderWidth: 2, borderColor: '#C9C9C2' },
  name: { flex: 1, fontFamily: fonts.semibold, fontSize: 17, color: colors.ink },
  tag: { height: 22, paddingHorizontal: 9, borderRadius: radius.pill, justifyContent: 'center' },
  tagText: { fontFamily: fonts.bold, fontSize: 11, color: colors.ink },
  desc: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: '#2E2E2A' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12 },
  statLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  statSub: { fontFamily: fonts.regular, fontSize: 10, lineHeight: 13, color: colors.muted },
  statValue: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
  note: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: '#9A4A2E' },
  foot: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted, paddingHorizontal: 4 },
});
