import { router, useLocalSearchParams } from 'expo-router';
import { useRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { KipSays, MoneyTile, PrivacyNote, Segmented, SetupScreen, Title, ToggleRow } from '@/components/setup/kit';
import { Button } from '@/components/ui';
import { billsGuess, living, livingTotal } from '@/lib/brain';
import { baht } from '@/lib/money';
import { basicsDone, plannedIncome, useSetup, type IncomeType, type SetupDraft } from '@/lib/setup/draft';
import { ordinal } from '@/lib/setup/plan';
import { colors, fonts } from '@/theme';

// Setup 1/6 · How does money come in?
export default function SetupBasics() {
  const { draft, update } = useSetup();
  const editing = Boolean(useLocalSearchParams<{ edit?: string }>().edit);
  const regular = draft.incomeType === 'regular';
  const payday = draft.payday;
  const income = plannedIncome(draft);
  const L = living(income);
  const guess = billsGuess(income);
  const cycle = payday ? `${ordinal(payday)} to ${ordinal(payday === 1 ? 31 : payday - 1)}` : 'Payday to the day before';

  return (
    <SetupScreen
      step={1}
      footer={<Button label={editing ? 'Update my plan' : 'Next'} disabled={!basicsDone(draft)} onPress={() => (editing ? router.back() : router.push('/setup/style'))} />}>
      <KipSays>
        {regular
          ? 'A few rough numbers so I can plan your days. Guesses are fine!'
          : 'Freelance money comes in waves. I’ll plan around a slow month, so good months become a bonus.'}
      </KipSays>
      <Title>How does money come in?</Title>

      <Segmented<IncomeType>
        options={[
          { key: 'regular', label: 'Same every month', color: colors.lime },
          { key: 'changes', label: 'It changes', color: colors.sky },
        ]}
        value={draft.incomeType}
        onChange={(incomeType) => update({ incomeType })}
      />

      {regular ? (
        <View style={styles.row}>
          <MoneyTile
            label="Income a month"
            value={draft.monthlyIncome}
            onChange={(monthlyIncome) => update({ monthlyIncome })}
            placeholder="25,000"
            style={{ flex: 1.35 }}
          />
          <PaydayTile value={payday} onChange={(p) => update({ payday: p })} />
        </View>
      ) : (
        <View style={styles.row}>
          <MoneyTile label="In a slow month" value={draft.slowMonth} onChange={(slowMonth) => update({ slowMonth })} placeholder="15,000" style={{ flex: 1 }} />
          <MoneyTile label="In a good month" value={draft.goodMonth} onChange={(goodMonth) => update({ goodMonth })} placeholder="40,000" style={{ flex: 1 }} />
        </View>
      )}

      {regular ? (
        <ToggleRow
          title="Start my month on payday"
          sub={`${cycle}, so your budget matches your salary`}
          on={draft.monthStartsOnPayday}
          onToggle={() => update({ monthStartsOnPayday: !draft.monthStartsOnPayday })}
        />
      ) : (
        <ToggleRow
          title="Split it when money lands"
          sub="Bills first, 20% to your safety net, the rest spread until the next job"
          on={draft.splitWhenPaid}
          onToggle={() => update({ splitWhenPaid: !draft.splitWhenPaid })}
        />
      )}

      <View style={styles.row}>
        <MoneyTile label="Rent or home loan" value={draft.rent} onChange={(rent) => update({ rent })} placeholder="8,500" size={22} style={{ flex: 1 }} />
        <MoneyTile
          label="Other bills"
          value={draft.bills}
          onChange={(bills) => update({ bills })}
          placeholder={income ? guess.toLocaleString('en-US') : '1,500'}
          size={22}
          style={{ flex: 1 }}
        />
      </View>
      {rentWarning(draft) && <Text style={[styles.hint, { color: colors.orange }]}>{rentWarning(draft)}</Text>}
      <Text style={styles.hint}>
        Other bills = phone, internet, electricity, water, subscriptions (Netflix, YouTube, Spotify…) and instalments.{draft.bills === null && income ? ` Not sure? I’ll use ${baht(guess)} and learn the real number from your slips.` : ''}
      </Text>

      {income > 0 && (
        <View style={styles.living}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>Kip adds real living costs too</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: '#2E2E2A' }}>
            Food {baht(L.food)} ({baht(Math.round(L.food / 30))}/day) · transport {baht(L.transport)} · health {baht(L.health)} · household {baht(L.household)} ={' '}
            <Text style={{ fontFamily: fonts.semibold }}>{baht(livingTotal(L))}</Text>. So I never plan a month you can’t actually live. These are starting numbers — once you log for a few weeks, I’ll swap them for your real ones.
          </Text>
        </View>
      )}
      <PrivacyNote />
    </SetupScreen>
  );
}

function rentWarning(d: SetupDraft): string | null {
  if (!d.rent) return null;
  if (d.incomeType === 'regular') return d.monthlyIncome && d.rent >= d.monthlyIncome ? 'That’s more than your monthly income — double-check the numbers?' : null;
  if (d.slowMonth && d.rent >= d.slowMonth) return d.goodMonth ? 'That’s more than a slow month, so I’ll plan on an average month instead.' : 'That’s more than a slow month — add a good month too, so I can plan on an average.';
  return null;
}

function PaydayTile({ value, onChange }: { value: number | null; onChange: (n: number | null) => void }) {
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  return (
    <Pressable onPress={() => input.current?.focus()} style={[styles.payday]}>
      <Text style={styles.label}>Payday</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <TextInput
          ref={input}
          value={value ? String(value) : ''}
          onChangeText={(t) => {
            const n = Number(t.replace(/[^\d]/g, '').slice(0, 2));
            onChange(n >= 1 && n <= 31 ? n : null);
          }}
          placeholder="25"
          placeholderTextColor={colors.faint}
          keyboardType="number-pad"
          maxLength={2}
          style={[styles.big, { padding: 0, textAlign: 'right', width: (value ? String(value).length : 2) * 16 }]}
          accessibilityLabel="Payday, day of the month"
        />
        <Text style={[styles.big, !value && { color: colors.faint }]}>{value ? ordinal(value).replace(String(value), '') : 'th'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  payday: { flex: 1, borderRadius: 18, backgroundColor: colors.roseBeige, paddingVertical: 12, paddingHorizontal: 16 },
  label: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  big: { fontFamily: fonts.bold, fontSize: 26, letterSpacing: -0.6, color: colors.ink, fontVariant: ['tabular-nums'] },
  hint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted, paddingHorizontal: 4 },
  living: { borderRadius: 18, backgroundColor: '#F8F6F4', paddingVertical: 12, paddingHorizontal: 16, gap: 6 },
});
