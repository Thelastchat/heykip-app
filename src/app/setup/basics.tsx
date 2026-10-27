import { router } from 'expo-router';
import { useRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { KipSays, MoneyTile, PrivacyNote, Segmented, SetupScreen, Title, ToggleRow } from '@/components/setup/kit';
import { Button } from '@/components/ui';
import { basicsDone, useSetup, type IncomeType } from '@/lib/setup/draft';
import { ordinal } from '@/lib/setup/plan';
import { colors, fonts } from '@/theme';

// Setup 1/5 · How does money come in?
export default function SetupBasics() {
  const { draft, update } = useSetup();
  const regular = draft.incomeType === 'regular';
  const payday = draft.payday;
  const cycle = payday ? `${ordinal(payday)} to ${ordinal(payday === 1 ? 31 : payday - 1)}` : 'Payday to the day before';

  return (
    <SetupScreen step={1} footer={<Button label="Next" disabled={!basicsDone(draft)} onPress={() => router.push('/setup/style')} />}>
      <KipSays>
        {regular
          ? 'A few rough numbers so I can plan your days. Guesses are fine!'
          : 'Freelance money comes in waves. I’ll plan around a slow month, so good months become a bonus.'}
      </KipSays>
      <Title>How does money come in?</Title>

      <Segmented<IncomeType>
        options={[
          { key: 'regular', label: 'Same every month' },
          { key: 'changes', label: 'It changes' },
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

      <MoneyTile
        label={
          <>
            Rent or home payment <Text style={{ color: '#A9A9A1' }}>· optional</Text>
          </>
        }
        value={draft.rent}
        onChange={(rent) => update({ rent })}
        placeholder="6,500"
        right={<Text style={styles.aside}>Your biggest bill, so your daily budget is right from day one</Text>}
      />
      <Text style={styles.hint}>Other bills? I’ll spot them as you go and ask once.</Text>
      <PrivacyNote />
    </SetupScreen>
  );
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
  big: { fontFamily: fonts.regular, fontSize: 26, letterSpacing: -0.6, color: colors.ink, fontVariant: ['tabular-nums'] },
  aside: { maxWidth: 130, textAlign: 'right', fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.muted },
  hint: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, paddingHorizontal: 4 },
});
