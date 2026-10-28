import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CatIcon } from '@/components/CatIcon';
import { KipSays, SetupScreen, Title } from '@/components/setup/kit';
import { StyleBar } from '@/components/StyleBar';
import { Button } from '@/components/ui';
import { STYLES, styleBar } from '@/lib/budget';
import { baht } from '@/lib/money';
import { useSetup } from '@/lib/setup/draft';
import { makePlan } from '@/lib/setup/plan';
import { colors, fonts, radius, shadow } from '@/theme';

// Setup 4/6 · Pick your money style. The goal and the safety net always come first;
// the style only decides how the rest is split.
export default function SetupMoney() {
  const { draft, update } = useSetup();
  const plan = makePlan({ ...draft, budgetStyle: 'kip' }); // the bar on "Kip's plan" shows Kip's own split
  const first = plan.mode === 'noRoom' ? 0 : plan.monthlySave;
  const toSplit = Math.max(0, Math.round(plan.income) - first - plan.safetyMonthly);
  const safetyIsGoal = draft.goalKind === 'safety_net';

  return (
    <SetupScreen step={4} footer={<Button label="Next" onPress={() => router.push('/setup/plan')} />}>
      <KipSays>
        {safetyIsGoal
          ? 'Your safety net comes first, whatever you pick. How should I split the rest?'
          : `${plan.short} and a little safety net come first, whatever you pick. How should I split the rest?`}
      </KipSays>
      <Title>Pick your money style</Title>

      <View style={styles.first}>
        <View style={styles.pin} />
        <View style={{ flex: 1 }}>
          <Text style={styles.firstLabel}>Always first</Text>
          <Text style={styles.firstMain} numberOfLines={1}>
            {baht(first)} → {plan.short}
          </Text>
          {!safetyIsGoal && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.firstSub}>{baht(plan.safetyMonthly)} → Safety net</Text>
              <CatIcon name="shield" size={13} />
            </View>
          )}
        </View>
        <Text style={styles.firstRight}>{`then ${baht(toSplit)}\nto split`}</Text>
      </View>

      <View style={{ gap: 10 }} accessibilityRole="radiogroup">
        {STYLES.map((s) => {
          const on = draft.budgetStyle === s.key;
          return (
            <Pressable
              key={s.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${s.name}. ${s.desc}`}
              onPress={() => update({ budgetStyle: s.key })}
              style={[styles.card, on && styles.cardOn]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[styles.radio, on && { borderWidth: 7, borderColor: colors.ink }]} />
                <Text style={styles.name}>{s.name}</Text>
                <View style={[styles.tag, { backgroundColor: s.tagColor }]}>
                  <Text style={styles.tagText}>{s.tag}</Text>
                </View>
              </View>
              <Text style={styles.desc}>{s.desc}</Text>
              <StyleBar parts={styleBar(s.key, plan)} />
              <Text style={styles.source}>From: {s.source}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.note}>
        Your goal and safety net always come first. If they need more than your style saves, I take it from the fun part — never from bills. Switch styles any time in Your month.
      </Text>
    </SetupScreen>
  );
}

const styles = StyleSheet.create({
  first: { borderRadius: 18, backgroundColor: colors.peach, paddingVertical: 11, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pin: { width: 14, height: 14, borderRadius: radius.pill, backgroundColor: colors.orange, boxShadow: 'inset 0 -1.5px 2px rgba(0,0,0,0.18), 0 2px 3px rgba(0,0,0,0.2)' },
  firstLabel: { fontFamily: fonts.regular, fontSize: 12, color: 'rgba(17,17,17,0.6)' },
  firstMain: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  firstSub: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  firstRight: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: 'rgba(17,17,17,0.6)', textAlign: 'right' },

  card: { borderRadius: 20, borderWidth: 2, borderColor: 'transparent', backgroundColor: '#F8F6F4', paddingVertical: 14, paddingHorizontal: 16, gap: 9 },
  cardOn: { borderColor: colors.ink, backgroundColor: '#FFFFFF', ...shadow.card },
  radio: { width: 22, height: 22, borderRadius: radius.pill, borderWidth: 2, borderColor: '#C9C9C2' },
  name: { flex: 1, fontFamily: fonts.semibold, fontSize: 17, color: colors.ink },
  tag: { height: 22, paddingHorizontal: 9, borderRadius: radius.pill, justifyContent: 'center' },
  tagText: { fontFamily: fonts.bold, fontSize: 11, color: colors.ink },
  desc: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: '#2E2E2A' },
  source: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 15, color: '#8A8A83' },
  note: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted, paddingHorizontal: 4 },
});
