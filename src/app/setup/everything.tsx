import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CatBadge } from '@/components/CatIcon';
import { Kip } from '@/components/Kip';
import { BackButton, nth, SetupScreen } from '@/components/setup/kit';
import { Button } from '@/components/ui';
import { livingFor, room, safetyNet, verdict } from '@/lib/brain';
import type { IconKey } from '@/lib/budget';
import { CATEGORY } from '@/lib/budget';
import { rich, t } from '@/lib/i18n';
import { baht } from '@/lib/money';
import { useSetup, type SetupDraft } from '@/lib/setup/draft';
import { typeInfo } from '@/lib/setup/goalTypes';
import { fullDate, LEAKS, makePlan, monthYear, monthsFromNow, parseDay } from '@/lib/setup/plan';
import { PAYDAY } from '@/lib/setup/rules';
import { colors, fonts, money, glassA, themed } from '@/theme';

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
      const timer = setTimeout(() => {
        setUpdating(false);
        setUpdated(true);
      }, 1400);
      return () => clearTimeout(timer);
    }, [draft]),
  );

  const plan = makePlan(draft);
  const i = plan.inputs;
  const L = livingFor(i);
  const fixed = i.rent + i.bills;
  const share = i.income ? Math.round((fixed / i.income) * 100) : 0;
  const kind = typeInfo(draft.goalType, draft.goalKind);
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
      title: t('Rent & bills are {share}% of your pay', { share }),
      sub: share <= 30 ? t('Healthy — under 30% is the usual guide.') : t('Above the usual 30% guide — that’s why fun money is tighter.'),
    },
    {
      icon: 'food',
      color: CATEGORY.food.color,
      title: t('Food is your biggest daily cost'),
      sub: draft.leaks.includes('delivery')
        ? t('{perDay} a day. Delivery is where I’ll watch.', { perDay: baht(Math.round(L.food / 30)) })
        : t('{perDay} a day.', { perDay: baht(Math.round(L.food / 30)) }),
    },
    ...(emergency
      ? []
      : [
          {
            icon: 'shield' as IconKey,
            color: money.safetyNet,
            title: t('A safety net from day one'),
            sub: t('{amount} a month — full at {target}.', { amount: baht(plan.safetyMonthly), target: baht(safetyNet(i).target) }),
          },
        ]),
    monthly
      ? {
          icon: kind.icon,
          color: kind.color,
          title: v.kind === 'doable' ? t('{goal} fits comfortably', { goal: plan.short }) : t('{goal} is a stretch', { goal: plan.short }),
          sub:
            v.kind === 'doable'
              ? t('{amount} a month = {year} in a year.', { amount: baht(plan.monthlySave), year: baht(plan.monthlySave * 12) })
              : t('{comfy} a month is comfortable — {amount} is planned.', { comfy: baht(R.comfortable), amount: baht(plan.monthlySave) }),
        }
      : {
          icon: kind.icon,
          color: kind.color,
          title: v.kind === 'doable' ? t('{goal} fits at a comfortable pace', { goal: plan.short }) : t('{goal} needs a longer runway', { goal: plan.short }),
          sub:
            v.kind === 'doable'
              ? t('{date} — {amount} a month.', { date: monthYear(plan.due), amount: baht(plan.monthlySave) })
              : comfy.kind === 'doable'
                ? plan.due
                  ? t('{date} at a comfortable pace — planned for {planned}.', { date: monthYear(monthsFromNow(comfy.months, draft)), planned: monthYear(plan.due) })
                  : t('{date} at a comfortable pace.', { date: monthYear(monthsFromNow(comfy.months, draft)) })
                : t('Planned for {date}.', { date: monthYear(plan.due) }),
        },
  ];

  const edit = (href: string) => router.push(`${href}?edit=1` as Href);

  return (
    <SetupScreen step={undefined} footer={<Button label={t('Done')} disabled={updating} onPress={() => router.back()} />}>
      <BackButton />
      <View style={{ gap: 6 }}>
        <Text style={styles.h1} accessibilityRole="header">
          {t('Here’s everything')}
        </Text>
        <Text style={styles.sub}>{t('This is what I used. Change anything and I’ll redo the plan in a few seconds.')}</Text>
      </View>

      {updating ? (
        <View style={[styles.banner, { backgroundColor: colors.card }]}>
          <Kip mood="think" size={40} />
          <Text style={styles.bannerText}>{t('Updating your plan with the new numbers…')}</Text>
        </View>
      ) : updated ? (
        <View style={[styles.banner, { backgroundColor: colors.lime }]}>
          <Kip mood="happy" size={40} />
          <Text style={styles.bannerText}>
            {rich('**Updated.** Everything below is your new plan.', undefined, (s) => (
              <Text style={{ fontFamily: fonts.semibold }}>{s}</Text>
            ))}
          </Text>
        </View>
      ) : null}

      <View style={[styles.card, { opacity: updating ? 0.4 : 1 }]}>
        <Text style={styles.head}>{t('What I found')}</Text>
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

      <Section title={t('Money in')} onEdit={() => edit('/setup/basics')}>
        <Row k={draft.incomeType === 'regular' ? t('Take-home pay') : t('A slow month')} v={baht(i.income)} />
        <Row
          k={t('Payday')}
          v={draft.incomeType === 'regular' && draft.payday ? (draft.monthStartsOnPayday ? t('{day} · month starts on payday', { day: nth(draft.payday) }) : nth(draft.payday)) : t('Changes')}
        />
      </Section>
      <Section title={t('Fixed costs')} onEdit={() => edit('/setup/basics')}>
        <Row k={t('Rent')} v={baht(i.rent)} />
        <Row k={t('Other bills')} v={draft.bills === null ? t('{amount} · Kip’s guess', { amount: baht(i.bills) }) : baht(i.bills)} />
      </Section>
      <Section title={t('Living (Kip’s real-life numbers)')} onEdit={() => edit('/setup/yours')}>
        <Row k={t('Food')} v={t('{amount} · {perDay}/day', { amount: baht(L.food), perDay: baht(Math.round(L.food / 30)) })} />
        <Row k={t('Transport')} v={baht(L.transport)} />
        <Row k={t('Health & personal')} v={baht(L.health)} />
        <Row k={t('Household')} v={baht(L.household)} />
      </Section>
      <Section title={t('Your habits')} onEdit={() => edit('/setup/style')}>
        <Row k={t('On payday')} v={draft.moneyStyle ? PAYDAY[draft.moneyStyle].label.replace('Honestly? ', '') : '—'} />
        <Row k={t('Money leaks')} v={leaks.length ? leaks.join(', ') : t('None picked')} />
      </Section>
      <Section title={t('Your goal')} onEdit={() => edit('/setup/goal')}>
        <Row k={plan.short} v={monthly ? t('{amount} a month', { amount: baht(draft.goalMonthly ?? 0) }) : baht(i.goal.target)} />
        {!monthly && <Row k={t('Saved so far')} v={baht(i.goal.saved)} />}
        {!monthly && draft.sideIncome && (
          <Row
            k={t('Extra money')}
            v={
              draft.sideIncome.kind === 'once'
                ? t('{amount} bonus', { amount: baht(draft.sideIncome.amount) })
                : draft.sideIncome.months
                  ? t('{amount}/mo side work × {months}', { amount: baht(draft.sideIncome.amount), months: draft.sideIncome.months })
                  : t('{amount}/mo side work', { amount: baht(draft.sideIncome.amount) })
            }
          />
        )}
        {!monthly && !emergency && draft.goalDue && (
          <Row
            k={t('You asked for')}
            v={
              monthYear(plan.due) !== monthYear(parseDay(draft.goalDue))
                ? t('{asked} → planned {planned}', { asked: fullDate(parseDay(draft.goalDue)), planned: monthYear(plan.due) })
                : fullDate(parseDay(draft.goalDue))
            }
          />
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
        <Pressable onPress={onEdit} hitSlop={10} style={styles.edit} accessibilityRole="button" accessibilityLabel={t('Edit {section}', { section: title.toLowerCase() })}>
          <Text style={styles.editText}>{t('Edit')}</Text>
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

const styles = themed(() =>
  StyleSheet.create({
    h1: { fontFamily: fonts.semibold, fontSize: 30, letterSpacing: -0.7, color: colors.ink },
    sub: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
    banner: { borderRadius: 18, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
    bannerText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.ink },
    card: { borderRadius: 18, backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: 10, gap: 2 },
    head: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, paddingVertical: 4 },
    edit: { height: 28, paddingHorizontal: 12, borderRadius: 999, backgroundColor: glassA(0.55), borderWidth: 1, borderColor: glassA(0.95), justifyContent: 'center' },
    editText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
    finding: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 7 },
    fTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
    fSub: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: '#2E2E2A' },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, paddingVertical: 6 },
    k: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
    v: { flexShrink: 1, textAlign: 'right', fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, fontVariant: ['tabular-nums'] },
  }),
);
