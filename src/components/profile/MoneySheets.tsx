// Changing the basics. Kip shows the new month first (daily money, the goal, when it arrives), then you save.
import { Minus, Plus as PlusIcon } from 'phosphor-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Glass } from '@/components/glow/Glass';
import { billsTotal, savingTotal, spendingTotal, type MonthBudget } from '@/lib/budget';
import { baht } from '@/lib/money';
import { getLang, t } from '@/lib/i18n';
import { compare, replan, type Basics, type GoalNow } from '@/lib/replan';
import { colors, fonts, inkA, themed } from '@/theme';

import { AmountInput, Delta, Pill, SaveButton, Sheet, sheet } from './Sheet';

/** "25th" in English; Thai just uses the number (วันที่ 25). */
const ordinal = (n: number) => (getLang() === 'th' ? String(n) : `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`);

/** How much more the basics need than the pay brings in (0 when the month adds up). */
const shortBy = (m: MonthBudget) => Math.max(0, billsTotal(m) + savingTotal(m) + spendingTotal(m) - m.income);

function Short({ m }: { m: MonthBudget }) {
  const s = shortBy(m);
  if (!s) return null;
  return (
    <Text style={[sheet.sub, { color: colors.orangeText, textAlign: 'center' }]}>
      {t('Heads up: rent, bills and everyday basics need {amount} more than this each month. Kip keeps food and transport realistic, so your goal pauses until there’s room.', { amount: baht(s) })}
    </Text>
  );
}

/** Before → after, as rows. */
function deltaRows(before: MonthBudget, after: MonthBudget, goal: GoalNow, goalName: string) {
  const c = compare(before, after, goal);
  const rows: { label: string; was: string | null; now: string; warn?: boolean }[] = [{ label: t('Spending money a day'), was: baht(c.daily[0]), now: baht(c.daily[1]) }];
  rows.push({ label: t('{goal} each month', { goal: goalName }), was: baht(c.goal[0]), now: baht(c.goal[1]), warn: c.goal[1] === 0 && c.goal[0] > 0 });
  if (c.arrives[1] || c.arrives[0]) rows.push({ label: t('{goal} arrives', { goal: goalName }), was: c.arrives[0], now: c.arrives[1] ?? t('When there’s room'), warn: !c.arrives[1] });
  if (c.safety[0] !== c.safety[1]) rows.push({ label: t('Safety net each month'), was: baht(c.safety[0]), now: baht(c.safety[1]) });
  return rows;
}

export function PaySheet({
  open,
  onClose,
  month,
  basics,
  goal,
  goalName,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  month: MonthBudget;
  basics: Basics;
  goal: GoalNow;
  goalName: string;
  onSave: (b: Basics, next: MonthBudget) => Promise<void>;
}) {
  const [b, setB] = useState<Basics>(basics);
  const [editing, setEditing] = useState<'slow' | 'good'>('slow');
  const [busy, setBusy] = useState(false);
  const regular = b.incomeType === 'regular';
  const valid = regular ? (b.monthlyIncome ?? 0) > 0 && !!b.payday : (b.slowMonth ?? 0) > 0;
  const changed = JSON.stringify(b) !== JSON.stringify(basics);
  const next = useMemo(() => (valid ? replan(month, b, goal) : null), [valid, month, b, goal]);
  const set = (p: Partial<Basics>) => setB((x) => ({ ...x, ...p }));

  return (
    <Sheet open={open} onClose={onClose} title={t('Your usual pay')} sub={regular ? t('What lands in your account each month.') : t('Kip plans on a slow month — a good month is a bonus.')}>
      {regular ? (
        <AmountInput value={b.monthlyIncome} onChange={(v) => set({ monthlyIncome: v })} label={t('Usual pay')} />
      ) : (
        <AmountInput
          value={editing === 'slow' ? b.slowMonth : b.goodMonth}
          onChange={(v) => set(editing === 'slow' ? { slowMonth: v } : { goodMonth: v })}
          label={editing === 'slow' ? t('A slow month') : t('A good month')}
        />
      )}
      <View style={styles.pills}>
        <Pill label={t('Same every month')} on={regular} onPress={() => set({ incomeType: 'regular', monthlyIncome: b.monthlyIncome ?? b.slowMonth, payday: b.payday ?? 25 })} />
        <Pill label={t('It changes')} on={!regular} onPress={() => set({ incomeType: 'changes', slowMonth: b.slowMonth ?? b.monthlyIncome })} />
      </View>

      {regular ? (
        <Glass radius={20} innerStyle={styles.row}>
          <Text style={styles.rowLabel}>{t('Payday')}</Text>
          <View style={styles.stepper}>
            <Step icon="minus" onPress={() => set({ payday: Math.max(1, (b.payday ?? 25) - 1) })} label={t('Earlier payday')} />
            <Text style={styles.stepVal}>{b.payday ? t('{day} of the month', { day: ordinal(b.payday) }) : t('Pick a day')}</Text>
            <Step icon="plus" onPress={() => set({ payday: Math.min(31, (b.payday ?? 24) + 1) })} label={t('Later payday')} />
          </View>
        </Glass>
      ) : (
        <View style={styles.pills}>
          <Pill label={t('Slow month {amount}', { amount: b.slowMonth ? baht(b.slowMonth) : '—' })} on={editing === 'slow'} onPress={() => setEditing('slow')} />
          <Pill label={t('Good month {amount}', { amount: b.goodMonth ? baht(b.goodMonth) : '—' })} on={editing === 'good'} onPress={() => setEditing('good')} />
        </View>
      )}

      {changed && next && <Delta rows={deltaRows(month, next, goal, goalName)} />}
      {changed && next && <Short m={next} />}
      <SaveButton
        label={busy ? t('Saving…') : changed ? t('Save — use the new plan') : t('Save')}
        disabled={!valid || !changed || busy}
        onPress={async () => {
          if (!next) return;
          setBusy(true);
          await onSave(b, next);
          setBusy(false);
        }}
      />
    </Sheet>
  );
}

export function RentSheet({
  open,
  onClose,
  month,
  basics,
  goal,
  goalName,
  onSave,
  onBills,
}: {
  open: boolean;
  onClose: () => void;
  month: MonthBudget;
  basics: Basics;
  goal: GoalNow;
  goalName: string;
  onSave: (b: Basics, next: MonthBudget) => Promise<void>;
  onBills: () => void;
}) {
  const [rent, setRent] = useState<number | null>(basics.rent);
  const [busy, setBusy] = useState(false);
  const b = { ...basics, rent: rent ?? 0 };
  const changed = (rent ?? 0) !== basics.rent;
  const next = useMemo(() => (changed ? replan(month, { ...basics, rent: rent ?? 0 }, goal) : null), [changed, month, basics, rent, goal]);
  const otherBills = billsTotal(month) - month.bills.rent;

  return (
    <Sheet open={open} onClose={onClose} title={t('Your rent')} sub={t('Rent or a room — what you pay each month. Put 0 if you live with family.')}>
      <AmountInput value={rent} onChange={setRent} label={t('Rent')} />
      <Pressable onPress={onBills} accessibilityRole="button">
        <Glass radius={20} innerStyle={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>{t('Other bills · {amount}', { amount: baht(otherBills) })}</Text>
            <Text style={sheet.sub}>{t('Phone, internet, electricity — add or change them in Your month')}</Text>
          </View>
          <Text style={[styles.rowLabel, { color: colors.muted }]}>›</Text>
        </Glass>
      </Pressable>
      {next && <Delta rows={deltaRows(month, next, goal, goalName)} />}
      {next && <Short m={next} />}
      <SaveButton
        label={busy ? t('Saving…') : changed ? t('Save — use the new plan') : t('Save')}
        disabled={!changed || busy}
        onPress={async () => {
          if (!next) return;
          setBusy(true);
          await onSave(b, next);
          setBusy(false);
        }}
      />
    </Sheet>
  );
}

function Step({ icon, onPress, label }: { icon: 'minus' | 'plus'; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.step} accessibilityRole="button" accessibilityLabel={label}>
      {icon === 'minus' ? <Minus size={14} color={colors.ink} weight="bold" /> : <PlusIcon size={14} color={colors.ink} weight="bold" />}
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    pills: { flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap' },
    row: { minHeight: 56, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    rowLabel: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    stepVal: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink, minWidth: 118, textAlign: 'center' },
    step: { width: 30, height: 30, borderRadius: 15, backgroundColor: inkA(0.07), alignItems: 'center', justifyContent: 'center' },
  }),
);
