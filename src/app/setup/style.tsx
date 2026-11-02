import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { CatBadge } from '@/components/CatIcon';
import { Chip, KipSays, RadioCard, SetupScreen, Title } from '@/components/setup/kit';
import { Button } from '@/components/ui';
import { rich, t } from '@/lib/i18n';
import { useSetup, type MoneyStyle } from '@/lib/setup/draft';
import { inputsFrom, LEAKS } from '@/lib/setup/plan';
import { LEAK_COLOR, leakRules, PAYDAY } from '@/lib/setup/rules';
import { colors, fonts, themed } from '@/theme';

const ANSWERS: { key: MoneyStyle; color: string }[] = [
  { key: 'treat', color: colors.lavender },
  { key: 'bills', color: colors.sky },
  { key: 'save', color: colors.lime },
  { key: 'disappears', color: colors.peach },
];

// Setup 2/6 · Payday hits. What happens first? Each answer shows what Kip will actually do with it.
export default function SetupStyle() {
  const { draft, update } = useSetup();
  const editing = Boolean(useLocalSearchParams<{ edit?: string }>().edit);
  const rules = leakRules(draft.leaks, inputsFrom(draft));

  return (
    <SetupScreen step={2} footer={<Button label={editing ? t('Update my plan') : t('Next')} disabled={!draft.moneyStyle} onPress={() => (editing ? router.back() : router.push('/setup/goal'))} />}>
      <KipSays>
        {rich('No judging — this decides **when** I move your saving and **where** I nudge you.', undefined, (s) => (
          <Text style={{ fontFamily: fonts.semibold }}>{s}</Text>
        ))}
      </KipSays>
      <Title>{t('Payday hits. What happens first?')}</Title>

      <View style={{ gap: 8 }} accessibilityRole="radiogroup">
        {ANSWERS.map((a) => (
          <RadioCard key={a.key} label={PAYDAY[a.key].label} sub={`→ ${PAYDAY[a.key].does}`} color={a.color} on={draft.moneyStyle === a.key} onPress={() => update({ moneyStyle: a.key })} />
        ))}
      </View>

      <View style={{ gap: 10 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>
          {rich('Where does money sneak away? **Pick any**', undefined, (s) => (
            <Text style={{ fontFamily: fonts.regular, color: colors.muted }}>{s}</Text>
          ))}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {LEAKS.map((l, i) => {
            const on = draft.leaks.includes(l.key);
            return <Chip key={l.key} label={l.label} color={LEAK_COLOR[l.key]} on={on} onPress={() => update({ leaks: on ? draft.leaks.filter((k) => k !== l.key) : [...draft.leaks, l.key] })} />;
          })}
        </View>
      </View>

      {rules.length > 0 && (
        <View style={styles.rules}>
          <Text style={styles.rulesHead}>{t('What I’ll do about it')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: -2 }}>{t('Colour = the budget it comes from')}</Text>
          {rules.map((r) => (
            <View key={r.key} style={styles.rule}>
              <CatBadge name={r.icon} color={r.color} size={30} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>{r.title}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: '#2E2E2A' }}>{r.rule}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </SetupScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    rules: { borderRadius: 18, backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: 4 },
    rulesHead: { paddingTop: 10, fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
    rule: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 8 },
  }),
);
