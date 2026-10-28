import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { CatBadge } from '@/components/CatIcon';
import { SetupScreen, Title } from '@/components/setup/kit';
import { Slider } from '@/components/Slider';
import { Button } from '@/components/ui';
import { LIVING_FLOOR, livingFor, room, safetyNet, type Living } from '@/lib/brain';
import type { IconKey } from '@/lib/budget';
import { baht } from '@/lib/money';
import { useSetup } from '@/lib/setup/draft';
import { makePlan, monthYear } from '@/lib/setup/plan';
import { colors, fonts, radius, shadow } from '@/theme';

// Setup 5/6 · Make it yours. Every number can change; Kip re-checks the whole month as you go.
export default function SetupYours() {
  const { draft, update } = useSetup();
  const plan = makePlan(draft);
  const { inputs, result: r, short } = plan;
  const R = room(inputs);
  const L = livingFor(inputs);
  const S = safetyNet(inputs);
  const monthly = draft.goalKind === 'monthly';
  const emergency = draft.goalKind === 'safety_net';
  const max = Math.max(0, Math.floor(R.left / 100) * 100);
  const goalNow = r.goal;
  const tight = goalNow > R.most;

  const setLiving = (k: keyof Living, v: number) => update({ living: { ...draft.living, [k]: v } });
  const setGoal = (v: number) => (monthly ? update({ goalMonthly: v, goalPerMonth: null }) : update({ goalPerMonth: v }));
  const perDay = (n: number) => Math.round(n / 30);
  const lowFood = L.food < LIVING_FLOOR.food;
  const lowTransport = L.transport < LIVING_FLOOR.transport;
  const kipFood = livingFor({ ...inputs, living: {} }).food;

  const when = monthly ? null : r.goalMonths ? monthYear(plan.due) : null;
  const result = monthly
    ? `→ ${baht(goalNow * 12)} saved in a year · ${baht(r.daily)} a day to spend`
    : when
      ? `→ ${short} in ${when} · ${baht(r.daily)} a day to spend`
      : `→ Nothing goes to ${short} yet · ${baht(r.daily)} a day to spend`;

  return (
    <SetupScreen step={5} footer={<Button label="Looks good — write my promise" disabled={goalNow <= 0 && R.most > 0} onPress={() => router.push('/setup/sign')} />}>
      <Title>Make it yours</Title>
      <Text style={styles.sub}>Change any number — Kip re-checks everything as you go.</Text>

      <View style={styles.goalBox}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>For {short} each month</Text>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 22, letterSpacing: -0.4, color: colors.ink, fontVariant: ['tabular-nums'] }}>{baht(goalNow)}</Text>
        </View>
        <Slider value={goalNow} max={max} onChange={setGoal} label={`For ${short} each month`} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.tiny}>฿0</Text>
          <Text style={styles.tiny}>comfortable {baht(R.comfortable)} · most {baht(Math.max(0, R.most))}</Text>
        </View>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.ink }}>{result}</Text>
        {tight && <Text style={[styles.tiny, { color: '#9A4A2E' }]}>That’s more than Kip would plan — fun money is down to {baht(r.fun)}.</Text>}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 4 }}>
        <Text style={styles.section}>YOUR MONTH</Text>
        <Text style={styles.tiny}>{baht(inputs.income)} in</Text>
      </View>
      <View style={styles.card}>
        <Row icon="rent" color={colors.clay} name="Rent" hint="You told me" value={inputs.rent} onChange={(rent) => update({ rent })} />
        <Row icon="bill" color={colors.sand} name="Other bills" hint="Phone, internet, electricity, water" value={inputs.bills} onChange={(bills) => update({ bills })} />
        <Row
          icon="food"
          color={colors.lime}
          name="Food"
          hint={lowFood ? `${baht(perDay(L.food))} a day — below ฿150 is very hard to keep` : `${baht(perDay(L.food))} a day`}
          warn={lowFood}
          value={L.food}
          onChange={(v) => setLiving('food', v)}
        />
        <Row icon="travel" color={colors.sky} name="Transport" hint={lowTransport ? 'Below ฿1,000 is hard unless you walk everywhere' : 'BTS/MRT, bus or bike fuel'} warn={lowTransport} value={L.transport} onChange={(v) => setLiving('transport', v)} />
        <Row icon="health" color={colors.lilac} name="Health & personal" hint="Pharmacy, haircut, toiletries" value={L.health} onChange={(v) => setLiving('health', v)} />
        <Row icon="more" color={colors.grey} name="Household" hint="Laundry, small things" value={L.household} onChange={(v) => setLiving('household', v)} />
        {!emergency && <Row icon="shield" color={colors.sage} name="Safety net" hint={`Full at ${baht(S.target)}${r.net > 0 ? ` · in about ${Math.ceil(r.netMonths / 12)} year${r.netMonths > 12 ? 's' : ''}` : ''}`} value={r.net} />}
        {r.learn > 0 && <Row icon="book" color={colors.roseBeige} name="Learning" hint="6 Jars: courses, books" value={r.learn} />}
        {r.give > 0 && <Row icon="gift" color={colors.pink} name="Giving" hint="6 Jars: family, merit, gifts" value={r.give} />}
        <Row icon="fun" color={colors.lavender} name="Fun & shopping" hint="What’s left — nights out, treats, shopping" value={r.fun} last />
      </View>

      <View style={styles.result}>
        <Text style={styles.section}>IF YOU STICK TO THIS</Text>
        <Text style={styles.resultLine}>
          {monthly
            ? `💰 ${baht(goalNow * 12)} saved for ${short} in a year`
            : when
              ? emergency
                ? `🛟 Emergency fund full in ${when}`
                : `✈︎ ${short} in ${when} — fully paid, no credit card`
              : `📌 ${short} is pinned — every day under budget goes to it`}
        </Text>
        {!emergency && r.net > 0 && <Text style={styles.resultLine}>🛟 Safety net: {baht(r.net * 12)} by this time next year</Text>}
        <Text style={styles.resultLine}>💰 {baht(r.savedIn12)} saved in 12 months</Text>
      </View>
      {(lowFood || L.food !== kipFood) && (
        <Text style={styles.note}>
          {lowFood
            ? `Food is below a realistic level, so the difference went to fun instead of cutting real life. Kip’s number is ${baht(kipFood)}.`
            : `Kip’s number for food is ${baht(kipFood)}.`}
        </Text>
      )}
    </SetupScreen>
  );
}

function Row({ icon, color, name, hint, value, onChange, warn, last }: { icon: IconKey; color: string; name: string; hint: string; value: number; onChange?: (v: number) => void; warn?: boolean; last?: boolean }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <View style={[styles.row, !last && styles.divider]}>
      <CatBadge name={icon} color={color} size={34} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.ink }}>{name}</Text>
        <Text style={[styles.tiny, warn && { color: '#C0502E' }]}>{hint}</Text>
      </View>
      {onChange ? (
        <View style={[styles.amount, warn && { borderColor: '#C0502E' }]}>
          <Text style={styles.amountText}>฿</Text>
          <TextInput
            value={text ?? value.toLocaleString('en-US')}
            onFocus={() => setText(String(value))}
            onChangeText={(t) => setText(t.replace(/[^\d]/g, ''))}
            onEndEditing={() => {
              if (text !== null) onChange(Math.min(Number(text || 0), 9_999_999));
              setText(null);
            }}
            keyboardType="number-pad"
            selectTextOnFocus
            style={[styles.amountText, styles.amountInput]}
            accessibilityLabel={name}
          />
        </View>
      ) : (
        <Text style={[styles.amountText, { paddingHorizontal: 12 }]}>{baht(value)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sub: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted, marginTop: -8 },
  goalBox: { borderRadius: 20, backgroundColor: colors.peach, paddingVertical: 14, paddingHorizontal: 16, gap: 6 },
  tiny: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 15, color: colors.muted },
  section: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.5, color: colors.muted },
  card: { borderRadius: 18, backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 2, ...shadow.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  divider: { borderBottomWidth: 1, borderBottomColor: 'rgba(17,17,17,0.06)' },
  amountInput: { flex: 1, minWidth: 0, width: '100%', textAlign: 'right', padding: 0 },
  amount: { height: 36, width: 104, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.grey, borderWidth: 1.5, borderColor: 'transparent', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  amountText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
  result: { borderRadius: 18, backgroundColor: colors.lime, borderWidth: 1, borderColor: colors.ink, paddingVertical: 14, paddingHorizontal: 16, gap: 6 },
  resultLine: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.ink },
  note: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted, paddingHorizontal: 4 },
});
