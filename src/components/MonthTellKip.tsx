// "Tell Kip…" on Your month (approved mockup): "move ฿500 from shopping to food, add Netflix ฿419". Kip turns it into
// changes; the app makes them with the same rules as tapping (a new bill comes out of Kip's bill guess first, then
// fun money, then the goal), shows every change, and only saves on "Do it". Plus only.
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { View } from 'react-native';

import { askKipDo, KipAnswer, kipProblem, TellKipBox, useTellKip, type ChangeRow } from '@/components/TellKip';
import { Sheet } from '@/components/profile/Sheet';
import { CATEGORY, dailyOf, type MonthBudget } from '@/lib/budget';
import { t } from '@/lib/i18n';
import { CAT_ICON3D } from '@/lib/icons3d';
import { baht } from '@/lib/money';
import { applyOps, type Op } from '@/lib/monthops';

export { applyOps };

/** Every number that changed, side by side. */
export function monthDiff(a: MonthBudget, b: MonthBudget): ChangeRow[] {
  const rows: ChangeRow[] = [];
  for (const s of b.spend) {
    const was = a.spend.find((x) => x.key === s.key)?.amount ?? 0;
    if (was !== s.amount)
      rows.push({
        icon: CAT_ICON3D[s.key],
        title: CATEGORY[s.key].name,
        sub: s.amount > was ? `+${baht(s.amount - was)}` : `−${baht(was - s.amount)}`,
        from: baht(was),
        to: baht(s.amount),
        warn: s.amount < was,
      });
  }
  const aBills = a.bills.items ?? [];
  const bBills = b.bills.items ?? [];
  for (const bill of bBills) if (!aBills.some((x) => x.name === bill.name)) rows.push({ icon: 'bill', title: bill.name, sub: t('New bill · every month'), to: baht(bill.amount) });
  for (const bill of aBills) if (!bBills.some((x) => x.name === bill.name)) rows.push({ icon: 'bill', title: bill.name, sub: t('Bill removed'), from: baht(bill.amount), to: baht(0) });
  if (a.bills.guess !== b.bills.guess)
    rows.push({ icon: null, title: t('Other bills'), sub: t('Kip’s guess shrinks as you add real ones'), from: `~${baht(a.bills.guess)}`, to: `~${baht(b.bills.guess)}` });
  const ga = a.goal.amount + a.goalExtra;
  const gb = b.goal.amount + b.goalExtra;
  if (ga !== gb) rows.push({ icon: 'plane', title: t('{goal} saving', { goal: b.goal.title }), sub: t('a month'), from: baht(ga), to: baht(gb), warn: gb < ga });
  const da = dailyOf(a);
  const db = dailyOf(b);
  rows.push({ icon: null, title: t('Each day'), sub: da === db ? t('No change') : undefined, from: da === db ? undefined : baht(da), to: da === db ? `${baht(db)} ✓` : baht(db), warn: db < da });
  return rows;
}

export function MonthTellKip({ month, save }: { month: MonthBudget; save: (m: MonthBudget) => void }) {
  const [open, setOpen] = useState(false);
  const tell = useTellKip<MonthBudget>(async (text) => {
    const r = await askKipDo<{ ops?: Op[] }>('month', text, {
      month: {
        categories: month.spend.map((s) => ({ key: s.key, amount: s.amount })),
        bills: (month.bills.items ?? []).map((b) => ({ name: b.name, amount: b.amount })),
        rent: month.bills.rent,
        bills_guess: month.bills.guess,
        goal: month.goal.title,
        goal_per_month: month.goal.amount + month.goalExtra,
      },
    });
    if (!r.ok) return { error: kipProblem(r.reason) };
    if (!r.out.ok || !r.out.ops?.length) return { reply: r.out.reply, plan: null, rows: null };
    const next = applyOps(month, r.out.ops);
    if (!next) return { reply: t('Hmm, that doesn’t fit this month’s plan. Try saying it another way?'), plan: null, rows: null };
    return { reply: r.out.reply, plan: next, rows: monthDiff(month, next) };
  });

  function ask(text: string) {
    setOpen(true);
    tell.ask(text);
  }

  return (
    <>
      <View style={{ marginBottom: 10 }}>
        <TellKipBox placeholder={t('Tell Kip… “move ฿500 to Food”')} onAsk={ask} disabled={tell.busy} />
      </View>
      {open && (tell.answer || tell.busy) && (
        <Sheet open onClose={() => (setOpen(false), tell.clear())} title={t('Change your month')}>
          {tell.answer ? (
            <KipAnswer
              said={tell.answer.said}
              reply={tell.answer.reply}
              rows={tell.answer.rows}
              onDo={() => {
                if (!tell.answer?.plan) return;
                save(tell.answer.plan);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                setOpen(false);
                tell.clear();
              }}
              onBack={() => (setOpen(false), tell.clear())}
              backLabel={t('Back')}
            />
          ) : (
            <TellKipBox placeholder={t('Kip is thinking…')} onAsk={() => {}} disabled />
          )}
        </Sheet>
      )}
      {tell.consentSheet}
    </>
  );
}
