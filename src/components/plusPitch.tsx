// What the Plus sheet says for each locked feature — built from the person's own month, so it's the same
// wherever they tap it (Home, Your month, + screen).
import type { ReactNode } from 'react';
import { Text } from 'react-native';

import { ChatPeek, GoalSlots, LockPeek, PaySplit, Race, type PlusFeature } from '@/components/PlusSheet';
import { plan as splitMonth, type Style } from '@/lib/brain';
import { billsTotal, dailyOf, savingTotal, spendingTotal, STYLES, type MonthBudget } from '@/lib/budget';
import { baht } from '@/lib/money';
import { monthYear, monthsFromNow, ordinal } from '@/lib/setup/plan';
import { colors, fonts } from '@/theme';

export type Pitch = { title: string; sub: string; body?: ReactNode };

/** The fastest other money style, and how much sooner it reaches the goal. */
export function fasterStyle(month: MonthBudget) {
  const cur = splitMonth(month.inputs, month.style as Style, month.goalPerMonth);
  const all = STYLES.map((s) => ({ s, r: splitMonth(month.inputs, s.key as Style) })).filter((x) => x.s.key !== month.style);
  const best = all.reduce((a, b) => ((b.r.goalMonths ?? 999) < (a.r.goalMonths ?? 999) ? b : a), all[0]);
  const sooner = (cur.goalMonths ?? 0) - (best.r.goalMonths ?? 0);
  const curName = STYLES.find((s) => s.key === month.style)?.name ?? 'Kip’s plan';
  return { cur, best, sooner, curName };
}

export function plusPitch(month: MonthBudget | null, goalShort: string, funLeft: number): Record<PlusFeature, Pitch> {
  const saving = month ? savingTotal(month) : 0;
  const onPayday = month?.payday ? `on the ${ordinal(month.payday)}` : 'on payday';
  const when = (m: number | null | undefined) => (m && month ? monthYear(monthsFromNow(m, { incomeType: month.payday ? 'regular' : 'changes', payday: month.payday } as never)) : '—');
  const f = month ? fasterStyle(month) : null;
  const faster = f && f.sooner > 0;
  const lessSpend = f ? Math.max(0, f.best.r.goal - f.cur.goal) : 0;

  return {
    styles: {
      title: faster ? `Try ${f.best.s.name}?` : 'Try another money style',
      sub: faster ? `Same pay — ${goalShort} ${f.sooner} month${f.sooner > 1 ? 's' : ''} sooner.` : 'Same pay, four ways to run it — switch any time.',
      body:
        f && faster ? (
          <Race
            now={{ label: `Now · ${f.curName} · ${baht(f.cur.goal)}/mo`, when: when(f.cur.goalMonths) }}
            faster={{ label: `${f.best.s.name} · ${baht(f.best.r.goal)}/mo`, when: when(f.best.r.goalMonths), share: (f.best.r.goalMonths ?? 1) / Math.max(1, f.cur.goalMonths ?? 1) }}
            tradeOff={lessSpend > 0 ? `Trade-off: ${baht(lessSpend)} less to spend each month — ${baht(f.best.r.daily)} a day instead of ${baht(f.cur.daily)}.` : undefined}
          />
        ) : undefined,
    },
    automove: {
      title: 'Let me move it for you',
      sub: `${onPayday[0].toUpperCase()}${onPayday.slice(1)}, your pay sorts itself — before you can spend it.`,
      body: month ? (
        <PaySplit
          parts={[
            { label: 'Bills', amount: billsTotal(month), color: '#3A3A3A' },
            { label: goalShort, amount: month.goal.amount + month.goalExtra, color: colors.limeDeep, light: true },
            { label: 'Safety net', amount: month.safety.amount, color: colors.sage, light: true },
            { label: 'To spend', amount: spendingTotal(month), color: 'rgba(255,255,255,0.88)', light: true },
          ]}
          note={`${baht(saving)} saved ${onPayday}, automatically. You get a nudge when it’s done.`}
        />
      ) : undefined,
    },
    talk: {
      title: 'Ask Kip anything',
      sub: 'A friend who knows your numbers — in Thai or English.',
      body: (
        <ChatPeek
          ask="Can I afford hotpot on Friday?"
          answer={
            <>
              Yes — ฿300 fits. Fun still has <Text style={{ fontFamily: fonts.semibold }}>{baht(funLeft)}</Text>, and {goalShort} stays on track.
            </>
          }
        />
      ),
    },
    customize: {
      title: 'Make the plan yours',
      sub: `Lock ${goalShort}, move food & fun your way — I rebalance the rest.`,
      body: month ? (
        <LockPeek
          rows={[
            { label: goalShort, amount: month.goal.amount + month.goalExtra, share: 0.36, locked: true, icon: 'plane' },
            { label: 'Food', amount: month.spend.find((s) => s.key === 'food')?.amount ?? dailyOf(month) * 12, share: 0.7, icon: 'bowl' },
            { label: 'Fun', amount: month.spend.find((s) => s.key === 'fun')?.amount ?? 0, share: 0.3, icon: 'fun' },
          ]}
        />
      ) : undefined,
    },
    goals: { title: 'Pin 2 more goals', sub: 'Up to 3 goals, each with its own date — I plan them together.', body: <GoalSlots first={goalShort} /> },
  };
}
