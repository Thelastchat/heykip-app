// Kip's bill guess, editable (approved mockup): the money set aside for bills not added yet. Lower it and the
// difference goes to the goal; raise it and it comes from fun money (then the goal), the same rule as a real bill.
// The app's maths (setGuess) decides; this only shows it and saves on Save.
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Kip } from '@/components/Kip';
import { AmountInput, Pill, SaveButton, Sheet } from '@/components/profile/Sheet';
import { setGuess, type MonthBudget } from '@/lib/budget';
import { t } from '@/lib/i18n';
import { baht } from '@/lib/money';
import { colors, fonts } from '@/theme';

const QUICK = [500, 1000, 1500, 2000];

export function GuessSheet({ month, onClose, onSave }: { month: MonthBudget; onClose: () => void; onSave: (m: MonthBudget, note: string) => void }) {
  const [v, setV] = useState<number | null>(month.bills.guess);
  const to = v ?? 0;
  const r = setGuess(month, to);
  const goal = month.goal.title;
  const same = to === month.bills.guess;
  const line = same
    ? t('Lower it and the difference goes to {goal}. Raise it and it comes from fun money, like a real bill.', { goal })
    : !r
      ? t('That’s more than this month can bend — try a smaller amount.')
      : r.freed > 0
        ? t('{amount} a month goes back to {goal}.', { amount: baht(r.freed), goal })
        : r.fromGoal > 0
          ? t('{fun} from fun money and {goal} from {name}.', { fun: baht(r.fromFun), goal: baht(r.fromGoal), name: goal })
          : t('{amount} comes from fun money.', { amount: baht(r.fromFun) });

  return (
    <Sheet open onClose={onClose} title={t('Other bills · Kip’s guess')} sub={t('Money set aside for bills you haven’t added yet. It shrinks by itself as you add real ones.')}>
      <AmountInput value={v} onChange={setV} label={t('About how much a month?')} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {QUICK.map((q) => (
          <Pill key={q} label={baht(q)} on={to === q} onPress={() => setV(q)} />
        ))}
        <Pill label={t('None')} on={to === 0} onPress={() => setV(0)} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: !same && !r ? '#FBE3DA' : colors.lime, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12 }}>
        <Kip size={30} />
        <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: '#111111' }}>{line}</Text>
      </View>
      <SaveButton
        label={t('Save')}
        disabled={same || !r}
        onPress={() => {
          if (!r) return;
          onSave(
            r.month,
            r.freed > 0
              ? t('Kip’s bill guess is now {amount} — {freed} back to {goal}.', { amount: baht(to), freed: baht(r.freed), goal })
              : t('Kip’s bill guess is now {amount}.', { amount: baht(to) }),
          );
        }}
      />
    </Sheet>
  );
}
