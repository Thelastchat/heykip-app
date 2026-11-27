// What the Plus sheet says for each locked feature — built from the person's own month, so it's the same
// wherever they tap it (Home, Your month, + screen).
import type { ReactNode } from 'react';
import { Text } from 'react-native';

import { ChatPeek, GoalSlots, LockPeek, PaySplit, type PlusFeature } from '@/components/PlusSheet';
import { billsTotal, dailyOf, savingTotal, spendingTotal, type MonthBudget } from '@/lib/budget';
import { rich, t } from '@/lib/i18n';
import { baht } from '@/lib/money';
import { monthYear, monthsFromNow, ordinal } from '@/lib/setup/plan';
import { colors, fonts, whiteA } from '@/theme';

export type Pitch = { title: string; sub: string; body?: ReactNode };

export function plusPitch(month: MonthBudget | null, goalShort: string, funLeft: number): Record<PlusFeature, Pitch> {
  const saving = month ? savingTotal(month) : 0;

  return {
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
