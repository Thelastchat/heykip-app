import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { KipSays, SetupScreen } from '@/components/setup/kit';
import { FindWhatWorks } from '@/components/setup/FindWhatWorks';
import { Button } from '@/components/ui';
import { livingFor, plan as splitMonth, room, verdict } from '@/lib/brain';
import { t } from '@/lib/i18n';
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
  const { draft } = useSetup();
  const v = verdict(inputsFrom(draft));
  if (draft.goalKind !== 'monthly' && (v.kind === 'notByThen' || v.kind === 'tight')) return <FindWhatWorks />;
  return <Choices />;
}

/** Monthly goals, and months where nothing is spare yet: a few clear options. */
function Choices() {
  const { draft, update } = useSetup();
  const inputs = inputsFrom(draft);
  const v = verdict(inputs);
  const R = room(inputs);
  const L = livingFor(inputs);
  const short = draft.goalKind === 'monthly' ? draft.goalTitle.trim() || t('Savings') : shortName(draft.goalTitle, draft.goalKind);
  const at = (per: number) => splitMonth(inputs, 'kip', per);
  const fixed = inputs.rent + inputs.bills;
  const livingSum = L.food + L.transport + L.health + L.household;

  const choices: Choice[] = [];
  let say = '';
  if (v.kind === 'noRoom') {
    say = t(
      'Let’s start small. Right now rent, bills and real living costs use {used} of your {income}, so there’s nothing spare yet — but every day under budget can go to {goal}. Here’s how we begin:',
      {
        used: baht(fixed + livingSum),
        income: baht(inputs.income),
        goal: short,
      },
    );
    choices.push(
      {
        key: 'anyway',
        title: t('Pin {goal} anyway', { goal: short }),
        tag: t('KIP’S PICK'),
        lines: [t('Start with small wins: every day under budget goes to it'), t('I’ll look for room as you log')],
        apply: { goalPerMonth: 0 },
        button: t('Pin {goal} anyway', { goal: short }),
      },
      { key: 'numbers', title: t('Check my numbers'), lines: [t('Maybe rent or bills were too high, or income too low?')], apply: {}, button: t('Check my numbers') },
    );
  } else if (draft.goalKind === 'monthly') {
    const comfy = at(R.comfortable),
      most = at(R.most);
    say = t(
      'You can save {comfy} a month comfortably — {year} in a year. {asked} is a stretch: after rent, bills, living, a safety net and the smallest fun budget ({fun}), the most is {most}. Pick what suits you:',
      { comfy: baht(R.comfortable), year: baht(R.comfortable * 12), asked: baht(draft.goalMonthly ?? 0), fun: baht(funMinimum(inputs.income)), most: baht(R.most) },
    );
    choices.push(
      {
        key: 'comfy',
        per: R.comfortable,
        title: t('Save {amount} a month', { amount: baht(R.comfortable) }),
        tag: t('KIP’S PICK'),
        lines: [t('{year} in a year · {daily} a day to spend', { year: baht(R.comfortable * 12), daily: baht(comfy.daily) }), t('Comfortable — fun money stays {fun}', { fun: baht(comfy.fun) })],
        apply: { goalMonthly: R.comfortable, goalPerMonth: null },
        button: t('Go with {choice}', { choice: baht(R.comfortable) }),
      },
      {
        key: 'most',
        per: R.most,
        title: t('Save {amount} a month', { amount: baht(R.most) }),
        tag: t('TIGHT'),
        tagColor: colors.roseBeige,
        lines: [t('{year} in a year · {daily} a day', { year: baht(R.most * 12), daily: baht(most.daily) }), t('Fun money drops to {fun}', { fun: baht(most.fun) })],
        apply: { goalMonthly: R.most, goalPerMonth: null },
        button: t('Go with {choice}', { choice: baht(R.most) }),
      },
    );
  } else if (v.kind === 'notByThen' || v.kind === 'tight') {
    const asked = draft.goalDue ? parseDay(draft.goalDue) : null;
    const need = Math.max(0, inputs.goal.target - inputs.goal.saved);
    const comfyMonths = Math.ceil(need / Math.max(R.comfortable, 100));
    const tightMonths = Math.ceil(need / Math.max(R.most, 100));
    const comfyDate = monthsFromNow(comfyMonths, draft);
    const tightDate = monthsFromNow(tightMonths, draft);
    const comfy = at(R.comfortable),
      most = at(R.most);
    if (v.kind === 'notByThen') {
      const vars = { goal: short, date: asked ? fullDate(asked) : '', need: baht(v.need), fun: baht(funMinimum(inputs.income)), most: baht(R.most) };
      say = asked
        ? t(
            'Honest answer: {goal} by {date} doesn’t fit. It needs {need} a month. After rent, bills, living, a small safety net and the smallest fun budget ({fun}), the most you can save is {most}. Here’s what does work:',
            vars,
          )
        : t(
            'Honest answer: {goal} doesn’t fit. It needs {need} a month. After rent, bills, living, a small safety net and the smallest fun budget ({fun}), the most you can save is {most}. Here’s what does work:',
            vars,
          );
    } else {
      const vars = { goal: short, date: asked ? fullDate(asked) : '', fun: baht(v.funLeft) };
      say = asked
        ? t('{goal} by {date} is possible — but tight. Fun money would drop to {fun} a month. A little later is a lot easier:', vars)
        : t('{goal} is possible — but tight. Fun money would drop to {fun} a month. A little later is a lot easier:', vars);
    }
    choices.push({
      key: 'comfy',
      per: R.comfortable,
      title: t('{goal} in {date}', { goal: short, date: monthYear(comfyDate) }),
      tag: t('KIP’S PICK'),
      lines: [t('Save {amount} a month · {daily} a day to spend', { amount: baht(R.comfortable), daily: baht(comfy.daily) }), t('Comfortable — fun money stays {fun}', { fun: baht(comfy.fun) })],
      apply: { goalDue: isoDay(comfyDate), goalPerMonth: null },
      button: t('Go with {choice}', { choice: monthYear(comfyDate) }),
    });
    if (v.kind === 'notByThen' && tightMonths < comfyMonths) {
      choices.push({
        key: 'tight',
        per: R.most,
        title:
          asked && Math.abs(tightDate.getTime() - asked.getTime()) < 45 * 86_400_000
            ? t('Just after your date: {date}', { date: fullDate(tightDate) })
            : t('Faster: {date}', { date: monthYear(tightDate) }),
        tag: t('TIGHT'),
        tagColor: colors.roseBeige,
        lines: [t('Save {amount} a month · {daily} a day', { amount: baht(R.most), daily: baht(most.daily) }), t('Fun money drops to {fun}', { fun: baht(most.fun) })],
        apply: { goalDue: isoDay(tightDate), goalPerMonth: null },
        button: t('Go with {choice}', { choice: asked && Math.abs(tightDate.getTime() - asked.getTime()) < 45 * 86_400_000 ? fullDate(tightDate) : monthYear(tightDate) }),
      });
    }
    if (v.kind === 'tight' && asked) {
      choices.push({
        key: 'keep',
        per: v.perMonth,
        title: t('Keep {date}', { date: fullDate(asked) }),
        tag: t('TIGHT'),
        tagColor: colors.roseBeige,
        lines: [t('Save {amount} a month', { amount: baht(v.perMonth) }), t('Fun money drops to {fun}', { fun: baht(v.funLeft) })],
        apply: { goalPerMonth: null },
        button: t('Keep {date}', { date: fullDate(asked) }),
      });
    }
    if (v.kind === 'notByThen' && asked && v.byThen > 0) {
      choices.push({
        key: 'smaller',
        per: R.comfortable,
        title: draft.goalKind === 'trip' ? t('Keep {date}, spend less on the trip', { date: fullDate(asked) }) : t('Keep {date}, aim for less', { date: fullDate(asked) }),
        lines: [
          t('Save {amount} a month instead of {need} — fits comfortably', { amount: baht(R.comfortable), need: baht(v.need) }),
          draft.goalKind === 'trip'
            ? t('Trip budget {amount} instead of {target} — a shorter trip, or somewhere closer', { amount: baht(inputs.goal.saved + v.byThen), target: baht(inputs.goal.target) })
            : t('Total {amount} instead of {target}', { amount: baht(inputs.goal.saved + v.byThen), target: baht(inputs.goal.target) }),
        ],
        apply: { goalTarget: inputs.goal.saved + v.byThen, goalPerMonth: null },
        button: t('Make it {amount} in total', { amount: baht(inputs.goal.saved + v.byThen) }),
      });
    }
  }

  const [picked, setPicked] = useState(choices[0]?.key);
  const choice = choices.find((c) => c.key === picked) ?? choices[0];

  const comfyPlan = splitMonth(inputs, 'kip', choice?.per ?? R.comfortable); // the bar shows the option you picked
  const parts: [number, string, string][] = [
    [fixed, money.fixed, t('Rent & bills {amount}', { amount: baht(fixed) })],
    [livingSum, money.living, t('Living {amount}', { amount: baht(livingSum) })],
    [comfyPlan.net, money.safetyNet, t('Safety net {amount}', { amount: baht(comfyPlan.net) })],
    [comfyPlan.goal, money.goal, `${short} ${baht(comfyPlan.goal)}`],
    [comfyPlan.fun + comfyPlan.learn + comfyPlan.give, money.fun, t('Fun {amount}', { amount: baht(comfyPlan.fun + comfyPlan.learn + comfyPlan.give) })],
  ].filter(([n]) => (n as number) > 0) as [number, string, string][];

  function go() {
    if (!choice) return;
    if (choice.key === 'numbers') return router.push('/setup/basics');
    update(choice.apply);
    router.push('/setup/thinking');
  }

  return (
    <SetupScreen step={3} footer={<Button label={choice?.button ?? t('Next')} onPress={go} />}>
      <KipSays mood={v.kind === 'noRoom' ? 'careful' : 'happy'}>{say}</KipSays>

      <View style={styles.where}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>{t('Where your {income} goes', { income: baht(inputs.income) })}</Text>
          <Text style={styles.small}>{t('every month')}</Text>
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
          {t('Living = food {food} ({perDay}/day) · transport {transport} · health {health} · household {household}. Based on what one person in Thailand really spends.', {
            food: baht(L.food),
            perDay: baht(Math.round(L.food / 30)),
            transport: baht(L.transport),
            health: baht(L.health),
            household: baht(L.household),
          })}
        </Text>
      </View>

      <View style={{ gap: 8 }} accessibilityRole="radiogroup">
        {choices.map((c) => {
          const on = c.key === choice?.key;
          return (
            <Pressable
              key={c.key}
              onPress={() => setPicked(c.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[styles.option, on && [styles.optionOn, { backgroundColor: PICK[c.key] ?? colors.lime }]]}>
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
      <Text style={[styles.small, { paddingHorizontal: 4 }]}>{t('Bonus, raise or a good month? Put it in and the date moves closer — I’ll show you.')}</Text>
    </SetupScreen>
  );
}

const styles = StyleSheet.create({
  where: { borderRadius: 20, backgroundColor: '#F8F6F4', paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  small: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted },
  bar: { flexDirection: 'row', height: 14, borderRadius: radius.pill, overflow: 'hidden', boxShadow: 'inset 0 0 0 1px rgba(17,17,17,0.08)' },
  option: {
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#F8F6F4',
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  optionOn: { borderColor: colors.ink },
  radio: { width: 22, height: 22, marginTop: 1, borderRadius: radius.pill, borderWidth: 2, borderColor: '#C9C9C2' },
  tag: { height: 20, paddingHorizontal: 8, borderRadius: radius.pill, justifyContent: 'center' },
});
