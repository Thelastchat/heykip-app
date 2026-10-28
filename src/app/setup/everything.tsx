import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CatBadge } from '@/components/CatIcon';
import { Kip } from '@/components/Kip';
import { BackButton, SetupScreen } from '@/components/setup/kit';
import { Button } from '@/components/ui';
import { livingFor, room, safetyNet, verdict } from '@/lib/brain';
import type { IconKey } from '@/lib/budget';
import { CATEGORY } from '@/lib/budget';
import { baht } from '@/lib/money';
import { useSetup, type SetupDraft } from '@/lib/setup/draft';
import { typeInfo } from '@/lib/setup/goalTypes';
import { fullDate, LEAKS, makePlan, monthYear, monthsFromNow, ordinal, parseDay } from '@/lib/setup/plan';
import { PAYDAY } from '@/lib/setup/rules';
import { colors, fonts, money } from '@/theme';

// Everything the person told Kip, what Kip found in it, and an Edit on each part.
// Coming back from an edit, Kip redoes the plan (a short "updating" moment) and says so.
const snapshot = (d: SetupDraft) =>
  JSON.stringify([
    d.monthlyIncome,
    d.slowMonth,
    d.goodMonth,
    d.payday,
    d.rent,
    d.bills,
    d.living,
    d.moneyStyle,
    d.leaks,
    d.goalTitle,
    d.goalKind,
    d.goalTarget,
    d.goalSaved,
    d.goalDue,
    d.goalMonthly,
    d.sideIncome,
  ]);

export default function SetupEverything() {
  const { draft } = useSetup();
  const seen = useRef(snapshot(draft));
  const [updating, setUpdating] = useState(false);
  const [updated, setUpdated] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const now = snapshot(draft);
      if (now === seen.current) return;
      seen.current = now;
      setUpdating(true);
      setUpdated(false);
      const t = setTimeout(() => {
        setUpdating(false);
        setUpdated(true);
      }, 1400);
      return () => clearTimeout(t);
    }, [draft]),
  );

  const plan = makePlan(draft);
  const i = plan.inputs;
  const L = livingFor(i);
  const fixed = i.rent + i.bills;
  const share = i.income ? Math.round((fixed / i.income) * 100) : 0;
  const t = typeInfo(draft.goalType, draft.goalKind);
  const monthly = draft.goalKind === 'monthly';
  const emergency = draft.goalKind === 'safety_net';
  const v = verdict(i);
  const comfy = verdict({ ...i, goal: { ...i.goal, months: null } });
  const R = room(i);
  const leaks = LEAKS.filter((l) => draft.leaks.includes(l.key)).map((l) => l.label);

  const findings: { icon: IconKey; color: string; title: string; sub: string }[] = [
    {
      icon: 'rent',
      color: money.fixed,
      title: `Rent & bills are ${share}% of your pay`,
      sub: share <= 30 ? 'Healthy — under 30% is the usual guide.' : 'Above the usual 30% guide — that’s why fun money is tighter.',
    },
    {
      icon: 'food',
      color: CATEGORY.food.color,
      title: 'Food is your biggest daily cost',
      sub: `${baht(Math.round(L.food / 30))} a day.${draft.leaks.includes('delivery') ? ' Delivery is where I’ll watch.' : ''}`,
    },
    ...(emergency
      ? []
      : [{ icon: 'shield' as IconKey, color: money.safetyNet, title: 'A safety net from day one', sub: `${baht(plan.safetyMonthly)} a month — full at ${baht(safetyNet(i).target)}.` }]),
    monthly
      ? {
          icon: t.icon,
          color: t.color,
          title: v.kind === 'doable' ? `${plan.short} fits comfortably` : `${plan.short} is a stretch`,
          sub:
            v.kind === 'doable'
              ? `${baht(plan.monthlySave)} a month = ${baht(plan.monthlySave * 12)} in a year.`
              : `${baht(R.comfortable)} a month is comfortable — ${baht(plan.monthlySave)} is planned.`,
        }
      : {
          icon: t.icon,
          color: t.color,
          title: v.kind === 'doable' ? `${plan.short} fits at a comfortable pace` : `${plan.short} needs a longer runway`,
          sub:
            v.kind === 'doable'
              ? `${monthYear(plan.due)} — ${baht(plan.monthlySave)} a month.`
              : comfy.kind === 'doable'
                ? `${monthYear(monthsFromNow(comfy.months, draft))} at a comfortable pace${plan.due ? ` — planned for ${monthYear(plan.due)}` : ''}.`
                : `Planned for ${monthYear(plan.due)}.`,
        },
  ];

  const edit = (href: string) => router.push(`${href}?edit=1` as Href);

  return (
    <SetupScreen step={undefined} footer={<Button label="See my plans" disabled={updating} onPress={() => router.push('/setup/plan')} />}>
      <BackButton />
      <View style={{ gap: 6 }}>
        <Text style={styles.h1} accessibilityRole="header">
          Here’s everything
        </Text>
        <Text style={styles.sub}>This is what I used. Change anything and I’ll redo the plan in a few seconds.</Text>
      </View>

      {updating ? (
        <View style={[styles.banner, { backgroundColor: '#F8F6F4' }]}>
          <Kip mood="think" size={40} />
          <Text style={styles.bannerText}>Updating your plan with the new numbers…</Text>
        </View>
      ) : updated ? (
        <View style={[styles.banner, { backgroundColor: colors.lime }]}>
          <Kip mood="happy" size={40} />
          <Text style={styles.bannerText}>
            <Text style={{ fontFamily: fonts.semibold }}>Updated.</Text> Everything below is your new plan.
          </Text>
        </View>
      ) : null}

      <View style={[styles.card, { opacity: updating ? 0.4 : 1 }]}>
        <Text style={styles.head}>WHAT I FOUND</Text>
        {findings.map((f) => (
          <View key={f.title} style={styles.finding}>
            <CatBadge name={f.icon} color={f.color} size={30} />
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={styles.fTitle}>{f.title}</Text>
              <Text style={styles.fSub}>{f.sub}</Text>
            </View>
          </View>
        ))}
      </View>

      <Section title="MONEY IN" onEdit={() => edit('/setup/basics')}>
        <Row k={draft.incomeType === 'regular' ? 'Take-home pay' : 'A slow month'} v={baht(i.income)} />
        <Row k="Payday" v={draft.incomeType === 'regular' && draft.payday ? `${ordinal(draft.payday)}${draft.monthStartsOnPayday ? ' · month starts on payday' : ''}` : 'Changes'} />
      </Section>
      <Section title="FIXED COSTS" onEdit={() => edit('/setup/basics')}>
        <Row k="Rent" v={baht(i.rent)} />
        <Row k="Other bills" v={`${baht(i.bills)}${draft.bills === null ? ' · Kip’s guess' : ''}`} />
      </Section>
      <Section title="LIVING (KIP’S REALISTIC NUMBERS)" onEdit={() => edit('/setup/yours')}>
        <Row k="Food" v={`${baht(L.food)} · ${baht(Math.round(L.food / 30))}/day`} />
        <Row k="Transport" v={baht(L.transport)} />
        <Row k="Health & personal" v={baht(L.health)} />
        <Row k="Household" v={baht(L.household)} />
      </Section>
      <Section title="YOUR HABITS" onEdit={() => edit('/setup/style')}>
        <Row k="On payday" v={draft.moneyStyle ? PAYDAY[draft.moneyStyle].label.replace('Honestly? ', '') : '—'} />
        <Row k="Money leaks" v={leaks.length ? leaks.join(', ') : 'None picked'} />
      </Section>
      <Section title="YOUR GOAL" onEdit={() => edit('/setup/goal')}>
        <Row k={plan.short} v={monthly ? `${baht(draft.goalMonthly ?? 0)} a month` : baht(i.goal.target)} />
        {!monthly && <Row k="Saved so far" v={baht(i.goal.saved)} />}
        {!monthly && draft.sideIncome && (
          <Row
            k="Extra money"
            v={
              draft.sideIncome.kind === 'once'
                ? `${baht(draft.sideIncome.amount)} bonus`
                : `${baht(draft.sideIncome.amount)}/mo side work${draft.sideIncome.months ? ` × ${draft.sideIncome.months}` : ''}`
            }
          />
        )}
        {!monthly && !emergency && draft.goalDue && (
          <Row k="You asked for" v={`${fullDate(parseDay(draft.goalDue))}${monthYear(plan.due) !== monthYear(parseDay(draft.goalDue)) ? ` → planned ${monthYear(plan.due)}` : ''}`} />
        )}
      </Section>
    </SetupScreen>
  );
}

function Section({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.head}>{title}</Text>
        <Pressable onPress={onEdit} hitSlop={10} style={styles.edit} accessibilityRole="button" accessibilityLabel={`Edit ${title.toLowerCase()}`}>
          <Text style={styles.editText}>Edit</Text>
        </Pressable>
      </View>
      {children}
    </View>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.k}>{k}</Text>
      <Text style={styles.v}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.semibold, fontSize: 30, letterSpacing: -0.7, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
  banner: { borderRadius: 18, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  bannerText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.ink },
  card: { borderRadius: 18, backgroundColor: '#F8F6F4', paddingHorizontal: 14, paddingVertical: 10, gap: 2 },
  head: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.5, color: colors.muted, paddingVertical: 4 },
  edit: { height: 28, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  editText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  finding: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 7 },
  fTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  fSub: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: '#2E2E2A' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, paddingVertical: 6 },
  k: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  v: { flexShrink: 1, textAlign: 'right', fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, fontVariant: ['tabular-nums'] },
});
