import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { KipSays, SetupScreen } from '@/components/setup/kit';
import { Button } from '@/components/ui';
import { livingFor, plan as splitMonth, room, verdict } from '@/lib/brain';
import { baht } from '@/lib/money';
import { useSetup, type SetupDraft } from '@/lib/setup/draft';
import { funMinimum } from '@/lib/brain';
import { fullDate, inputsFrom, isoDay, monthYear, monthsFromNow, parseDay, shortName } from '@/lib/setup/plan';
import { colors, fonts, money, radius, shadow } from '@/theme';

type Choice = { key: string; per?: number; title: string; tag?: string; tagColor?: string; lines: string[]; apply: Partial<SetupDraft>; button: string };
const PICK: Record<string, string> = { comfy: colors.lime, anyway: colors.lime, tight: colors.peach, keep: colors.peach, most: colors.peach, smaller: colors.sky, numbers: colors.sky };

// Setup 3/6 · Is it realistic? Shown when the goal doesn't fit as asked. Kip never shows an impossible plan:
// it says so, shows where the money goes, and offers what does work.
export default function SetupCheck() {
  const { draft, update } = useSetup();
  const inputs = inputsFrom(draft);
  const v = verdict(inputs);
  const R = room(inputs);
  const L = livingFor(inputs);
  const short = draft.goalKind === 'monthly' ? draft.goalTitle.trim() || 'Savings' : shortName(draft.goalTitle, draft.goalKind);
  const at = (per: number) => splitMonth(inputs, 'kip', per);
  const fixed = inputs.rent + inputs.bills;
  const livingSum = L.food + L.transport + L.health + L.household;

  const choices: Choice[] = [];
  let say = '';
  if (v.kind === 'noRoom') {
    say = `Right now rent, bills and real living costs use ${baht(fixed + livingSum)} of your ${baht(inputs.income)} — there’s nothing spare to save yet. Let’s be honest about it, then find the room.`;
    choices.push(
      { key: 'anyway', title: `Pin ${short} anyway`, tag: 'KIP’S PICK', lines: ['Start with small wins: every day under budget goes to it', 'I’ll look for room as you log'], apply: { goalPerMonth: 0 }, button: `Pin ${short} anyway` },
      { key: 'numbers', title: 'Check my numbers', lines: ['Maybe rent or bills were too high, or income too low?'], apply: {}, button: 'Check my numbers' },
    );
  } else if (draft.goalKind === 'monthly') {
    const comfy = at(R.comfortable), most = at(R.most);
    say = `${baht(draft.goalMonthly ?? 0)} a month doesn’t fit. After rent, bills, living, a small safety net and the smallest fun budget (${baht(funMinimum(inputs.income))}), the most you can save is ${baht(R.most)}. Here’s what does work:`;
    choices.push(
      { key: 'comfy', per: R.comfortable, title: `Save ${baht(R.comfortable)} a month`, tag: 'KIP’S PICK', lines: [`${baht(R.comfortable * 12)} in a year · ${baht(comfy.daily)} a day to spend`, `Comfortable — fun money stays ${baht(comfy.fun)}`], apply: { goalMonthly: R.comfortable, goalPerMonth: null }, button: `Go with ${baht(R.comfortable)}` },
      { key: 'most', per: R.most, title: `Save ${baht(R.most)} a month`, tag: 'TIGHT', tagColor: colors.roseBeige, lines: [`${baht(R.most * 12)} in a year · ${baht(most.daily)} a day`, `Fun money drops to ${baht(most.fun)}`], apply: { goalMonthly: R.most, goalPerMonth: null }, button: `Go with ${baht(R.most)}` },
    );
  } else if (v.kind === 'notByThen' || v.kind === 'tight') {
    const asked = draft.goalDue ? parseDay(draft.goalDue) : null;
    const need = Math.max(0, inputs.goal.target - inputs.goal.saved);
    const comfyMonths = Math.ceil(need / Math.max(R.comfortable, 100));
    const tightMonths = Math.ceil(need / Math.max(R.most, 100));
    const comfyDate = monthsFromNow(comfyMonths, draft);
    const tightDate = monthsFromNow(tightMonths, draft);
    const comfy = at(R.comfortable), most = at(R.most);
    if (v.kind === 'notByThen') {
      say = `Honest answer: ${short}${asked ? ` by ${fullDate(asked)}` : ''} doesn’t fit. It needs ${baht(v.need)} a month. After rent, bills, living, a small safety net and the smallest fun budget (${baht(funMinimum(inputs.income))}), the most you can save is ${baht(R.most)}. Here’s what does work:`;
    } else {
      say = `${short}${asked ? ` by ${fullDate(asked)}` : ''} is possible — but tight. Fun money would drop to ${baht(v.funLeft)} a month. A little later is a lot easier:`;
    }
    choices.push({
      key: 'comfy',
      per: R.comfortable,
      title: `${short} in ${monthYear(comfyDate)}`,
      tag: 'KIP’S PICK',
      lines: [`Save ${baht(R.comfortable)} a month · ${baht(comfy.daily)} a day to spend`, `Comfortable — fun money stays ${baht(comfy.fun)}`],
      apply: { goalDue: isoDay(comfyDate), goalPerMonth: null },
      button: `Go with ${monthYear(comfyDate)}`,
    });
    if (v.kind === 'notByThen' && tightMonths < comfyMonths) {
      choices.push({
        key: 'tight',
        per: R.most,
        title: asked && Math.abs(tightDate.getTime() - asked.getTime()) < 45 * 86_400_000 ? `Just after your date: ${fullDate(tightDate)}` : `Faster: ${monthYear(tightDate)}`,
        tag: 'TIGHT',
        tagColor: colors.roseBeige,
        lines: [`Save ${baht(R.most)} a month · ${baht(most.daily)} a day`, `Fun money drops to ${baht(most.fun)}`],
        apply: { goalDue: isoDay(tightDate), goalPerMonth: null },
        button: `Go with ${asked && Math.abs(tightDate.getTime() - asked.getTime()) < 45 * 86_400_000 ? fullDate(tightDate) : monthYear(tightDate)}`,
      });
    }
    if (v.kind === 'tight' && asked) {
      choices.push({ key: 'keep', per: v.perMonth, title: `Keep ${fullDate(asked)}`, tag: 'TIGHT', tagColor: colors.roseBeige, lines: [`Save ${baht(v.perMonth)} a month`, `Fun money drops to ${baht(v.funLeft)}`], apply: { goalPerMonth: null }, button: `Keep ${fullDate(asked)}` });
    }
    if (v.kind === 'notByThen' && asked && v.byThen > 0) {
      choices.push({
        key: 'smaller',
        per: R.comfortable,
        title: `Keep ${fullDate(asked)}, ${draft.goalKind === 'trip' ? 'spend less on the trip' : 'aim for less'}`,
        lines: [
          `Save ${baht(R.comfortable)} a month instead of ${baht(v.need)} — fits comfortably`,
          `${draft.goalKind === 'trip' ? 'Trip budget' : 'Total'} ${baht(inputs.goal.saved + v.byThen)} instead of ${baht(inputs.goal.target)}${draft.goalKind === 'trip' ? ' — a shorter trip, or somewhere closer' : ''}`,
        ],
        apply: { goalTarget: inputs.goal.saved + v.byThen, goalPerMonth: null },
        button: `Make it ${baht(inputs.goal.saved + v.byThen)} in total`,
      });
    }
  }

  const [picked, setPicked] = useState(choices[0]?.key);
  const choice = choices.find((c) => c.key === picked) ?? choices[0];

  const comfyPlan = splitMonth(inputs, 'kip', choice?.per ?? R.comfortable); // the bar shows the option you picked
  const parts: [number, string, string][] = [
    [fixed, money.fixed, `Rent & bills ${baht(fixed)}`],
    [livingSum, money.living, `Living ${baht(livingSum)}`],
    [comfyPlan.net, money.safetyNet, `Safety net ${baht(comfyPlan.net)}`],
    [comfyPlan.goal, money.goal, `${short} ${baht(comfyPlan.goal)}`],
    [comfyPlan.fun + comfyPlan.learn + comfyPlan.give, money.fun, `Fun ${baht(comfyPlan.fun + comfyPlan.learn + comfyPlan.give)}`],
  ].filter(([n]) => (n as number) > 0) as [number, string, string][];

  function go() {
    if (!choice) return;
    if (choice.key === 'numbers') return router.push('/setup/basics');
    update(choice.apply);
    router.push('/setup/thinking');
  }

  return (
    <SetupScreen step={3} footer={<Button label={choice?.button ?? 'Next'} onPress={go} />}>
      <KipSays mood="careful">{say}</KipSays>

      <View style={styles.where}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>Where your {baht(inputs.income)} goes</Text>
          <Text style={styles.small}>every month</Text>
        </View>
        <View style={styles.bar}>
          {parts.map(([n, c], i) => (
            <View key={i} style={{ flex: n, backgroundColor: c, borderRightWidth: i < parts.length - 1 ? 2 : 0, borderRightColor: '#FFFFFF' }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, columnGap: 12 }}>
          {parts.map(([, c, l]) => (
            <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: c }} />
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.ink }}>{l}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.small}>
          Living = food {baht(L.food)} ({baht(Math.round(L.food / 30))}/day) · transport {baht(L.transport)} · health {baht(L.health)} · household {baht(L.household)}. Based on what one person in Thailand really spends.
        </Text>
      </View>

      <View style={{ gap: 8 }} accessibilityRole="radiogroup">
        {choices.map((c) => {
          const on = c.key === choice?.key;
          return (
            <Pressable key={c.key} onPress={() => setPicked(c.key)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.option, on && [styles.optionOn, { backgroundColor: PICK[c.key] ?? colors.lime }]]}>
              <View style={[styles.radio, on && { borderWidth: 7, borderColor: colors.ink }]} />
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>{c.title}</Text>
                  {c.tag ? (
                    <View style={[styles.tag, { backgroundColor: on ? '#FFFFFF' : (c.tagColor ?? colors.lime) }]}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: colors.ink }}>{c.tag}</Text>
                    </View>
                  ) : null}
                </View>
                {c.lines.map((l) => (
                  <Text key={l} style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: '#2E2E2A' }}>
                    {l}
                  </Text>
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.small, { paddingHorizontal: 4 }]}>Bonus, raise or a good month? Put it in and the date moves closer — I’ll show you.</Text>
    </SetupScreen>
  );
}

const styles = StyleSheet.create({
  where: { borderRadius: 20, backgroundColor: '#F8F6F4', paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  small: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted },
  bar: { flexDirection: 'row', height: 14, borderRadius: radius.pill, overflow: 'hidden', boxShadow: 'inset 0 0 0 1px rgba(17,17,17,0.08)' },
  option: { borderRadius: 18, borderWidth: 2, borderColor: 'transparent', backgroundColor: '#F8F6F4', paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  optionOn: { borderColor: 'transparent' },
  radio: { width: 22, height: 22, marginTop: 1, borderRadius: radius.pill, borderWidth: 2, borderColor: '#C9C9C2' },
  tag: { height: 20, paddingHorizontal: 8, borderRadius: radius.pill, justifyContent: 'center' },
});
