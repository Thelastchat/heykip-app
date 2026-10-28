import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Chip, KipSays, RadioCard, SetupScreen, Title } from '@/components/setup/kit';
import { Button } from '@/components/ui';
import { useSetup, type MoneyStyle } from '@/lib/setup/draft';
import { LEAKS } from '@/lib/setup/plan';
import { colors, fonts } from '@/theme';

const STYLES: { key: MoneyStyle; label: string; sub: string }[] = [
  { key: 'treat', label: 'Treat myself — I earned it', sub: 'Fair. We’ll make room for that' },
  { key: 'bills', label: 'Pay the bills, then see', sub: 'Solid start' },
  { key: 'save', label: 'Save some straight away', sub: 'Love that' },
  { key: 'disappears', label: 'Honestly? It just… disappears', sub: 'Same here sometimes' },
];

// Setup 2/6 · Payday hits. What happens first?
export default function SetupStyle() {
  const { draft, update } = useSetup();

  return (
    <SetupScreen step={2} footer={<Button label="Next" disabled={!draft.moneyStyle} onPress={() => router.push('/setup/goal')} />}>
      <KipSays>No judging — this just helps me know when to nudge you.</KipSays>
      <Title>Payday hits. What happens first?</Title>

      <View style={{ gap: 8 }} accessibilityRole="radiogroup">
        {STYLES.map((s) => (
          <RadioCard key={s.key} label={s.label} sub={s.sub} on={draft.moneyStyle === s.key} onPress={() => update({ moneyStyle: s.key })} />
        ))}
      </View>

      <View style={{ gap: 10 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>
          Where does money sneak away? <Text style={{ fontFamily: fonts.regular, color: colors.muted }}>Pick any</Text>
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {LEAKS.map((l) => {
            const on = draft.leaks.includes(l.key);
            return (
              <Chip
                key={l.key}
                label={l.label}
                on={on}
                onPress={() => update({ leaks: on ? draft.leaks.filter((k) => k !== l.key) : [...draft.leaks, l.key] })}
              />
            );
          })}
        </View>
      </View>
    </SetupScreen>
  );
}
