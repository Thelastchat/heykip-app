// What the Plus sheet says for each locked feature — built from the person's own month, so it's the same
// wherever they tap it (Home, Your month, + screen).
import type { ReactNode } from 'react';
import { Text } from 'react-native';

import { ChatPeek, GoalSlots, LockPeek, PaySplit, Race, type PlusFeature } from '@/components/PlusSheet';
import { plan as splitMonth, type Style } from '@/lib/brain';
import { billsTotal, dailyOf, savingTotal, spendingTotal, STYLES, type MonthBudget } from '@/lib/budget';
import { rich, t } from '@/lib/i18n';
import { baht } from '@/lib/money';
import { monthYear, monthsFromNow, ordinal } from '@/lib/setup/plan';
import { colors, fonts, whiteA } from '@/theme';

export type Pitch = { title: string; sub: string; body?: ReactNode };

/** The fastest other money style, and how much sooner it reaches the goal. */
export function fasterStyle(month: MonthBudget) {
  const cur = splitMonth(month.inputs, month.style as Style, month.goalPerMonth);
  const all = STYLES.map((s) => ({ s, r: splitMonth(month.inputs, s.key as Style) })).filter((x) => x.s.key !== month.style);
  const best = all.reduce((a, b) => ((b.r.goalMonths ?? 999) < (a.r.goalMonths ?? 999) ? b : a), all[0]);
  const sooner = (cur.goalMonths ?? 0) - (best.r.goalMonths ?? 0);
  const curName = STYLES.find((s) => s.key === month.style)?.name ?? t('Kip’s plan');
  return { cur, best, sooner, curName };
}

export function plusPitch(month: MonthBudget | null, goalShort: string, funLeft: number): Record<PlusFeature, Pitch> {
  const saving = month ? savingTotal(month) : 0;
  const when = (m: number | null | undefined) => (m && month ? monthYear(monthsFromNow(m, { incomeType: month.payday ? 'regular' : 'changes', payday: month.payday } as never)) : '—');
  const f = month ? fasterStyle(month) : null;
  const faster = f && f.sooner > 0;
  const lessSpend = f ? Math.max(0, f.best.r.goal - f.cur.goal) : 0;

  return {
    styles: {
      title: faster ? t('Try {name}?', { name: f.best.s.name }) : t('Try another money style'),
      sub: faster
        ? f.sooner > 1
          ? t('Same pay — {goal} {n} months sooner.', { goal: goalShort, n: f.sooner })
          : t('Same pay — {goal} {n} month sooner.', { goal: goalShort, n: f.sooner })
        : t('Same pay, four ways to run it — switch any time.'),
      body:
        f && faster ? (
          <Race
            now={{ label: t('Now · {name} · {amt}/mo', { name: f.curName, amt: baht(f.cur.goal) }), when: when(f.cur.goalMonths) }}
            faster={{
              label: t('{name} · {amt}/mo', { name: f.best.s.name, amt: baht(f.best.r.goal) }),
              when: when(f.best.r.goalMonths),
              share: (f.best.r.goalMonths ?? 1) / Math.max(1, f.cur.goalMonths ?? 1),
            }}
            tradeOff={
              lessSpend > 0
                ? t('Trade-off: {less} less to spend each month — {daily} a day instead of {was}.', { less: baht(lessSpend), daily: baht(f.best.r.daily), was: baht(f.cur.daily) })
                : undefined
            }
          />
        ) : undefined,
    },
    automove: {
      title: t('Let me move it for you'),
      // {day} is "25th" in English; Thai uses the plain number {n}.
      sub: month?.payday
        ? t('On the {day}, your pay sorts itself — before you can spend it.', { day: ordinal(month.payday), n: month.payday })
        : t('On payday, your pay sorts itself — before you can spend it.'),
      body: month ? (
        <PaySplit
          parts={[
            { label: t('Bills'), amount: billsTotal(month), color: '#3A3A3A' },
            { label: goalShort, amount: month.goal.amount + month.goalExtra, color: colors.limeDeep, light: true },
            { label: t('Safety net'), amount: month.safety.amount, color: colors.sage, light: true },
            { label: t('To spend'), amount: spendingTotal(month), color: whiteA(0.88), light: true },
          ]}
          note={
            month.payday
              ? t('{amt} saved on the {day}, automatically. You get a nudge when it’s done.', { amt: baht(saving), day: ordinal(month.payday), n: month.payday })
              : t('{amt} saved on payday, automatically. You get a nudge when it’s done.', { amt: baht(saving) })
          }
        />
      ) : undefined,
    },
    talk: {
      title: t('Ask Kip anything'),
      sub: t('A friend who knows your numbers — in Thai or English.'),
      body: (
        <ChatPeek
          ask={t('Can I afford hotpot on Friday?')}
          answer={
            <>
              {rich('Yes — ฿300 fits. Fun still has **{left}**, and {goal} stays on track.', { left: baht(funLeft), goal: goalShort }, (s) => (
                <Text style={{ fontFamily: fonts.semibold }}>{s}</Text>
              ))}
            </>
          }
        />
      ),
    },
    customize: {
      title: t('Make the plan yours'),
      sub: t('Lock {goal}, move food & fun your way — I rebalance the rest.', { goal: goalShort }),
      body: month ? (
        <LockPeek
          rows={[
            { label: goalShort, amount: month.goal.amount + month.goalExtra, share: 0.36, locked: true, icon: 'plane' },
            { label: t('Food'), amount: month.spend.find((s) => s.key === 'food')?.amount ?? dailyOf(month) * 12, share: 0.7, icon: 'bowl' },
            { label: t('Fun'), amount: month.spend.find((s) => s.key === 'fun')?.amount ?? 0, share: 0.3, icon: 'fun' },
          ]}
        />
      ) : undefined,
    },
    goals: { title: t('Pin 2 more goals'), sub: t('Up to 3 goals, each with its own date — I plan them together.'), body: <GoalSlots first={goalShort} /> },
  };
}
