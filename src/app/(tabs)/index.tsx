import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { Eye, EyeSlash, Lock, Plus, UserCircle } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { CatBadge, CatIcon } from '@/components/CatIcon';
import { Kip } from '@/components/Kip';
import { Compare, PlusSheet, type PlusFeature } from '@/components/PlusSheet';
import { plan as splitMonth, type Style } from '@/lib/brain';
import { billsTotal, CATEGORY, savingTotal, STYLES, type CatKey, type IconKey } from '@/lib/budget';
import { useAuth } from '@/lib/auth';
import { monthNumbers, useHome, type HomeGoal } from '@/lib/home';
import { baht } from '@/lib/money';
import { useMonth } from '@/lib/month';
import { typeInfo } from '@/lib/setup/goalTypes';
import { fullDate, monthYear, monthsFromNow, ordinal, parseDay, shortName } from '@/lib/setup/plan';
import { supabase } from '@/lib/supabase';
import { colors, fonts, money, radius } from '@/theme';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return 'Good morning!';
  if (h < 17) return 'Good afternoon!';
  if (h < 21) return 'Get home safe!';
  return 'It’s late, get some rest';
}

// Home: your goal, what Kip thinks today, what's left to spend — and the Plus features, visible but locked.
export default function Home() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { profile, session, refreshProfile } = useAuth();
  const { month } = useMonth();
  const { goals, spent, reload } = useHome(month);
  const [hide, setHide] = useState(false);
  const [sheet, setSheet] = useState<PlusFeature | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const isPlus = profile ? profile.plan !== 'free' : false;

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const now = new Date();
  const goal = goals[0];
  const short = goal ? (goal.kind === 'monthly' ? goal.title : shortName(goal.title, goal.kind as never)) : 'your goal';

  // ---- the month in numbers ----
  const { P, leftMonth, dailyToday, leftToday, pace } = monthNumbers(month, spent, now);
  const saving = month ? savingTotal(month) : 0;
  const bills = month ? billsTotal(month) : 0;
  const goalDate = goal?.due ? parseDay(goal.due) : null;
  const daysToGoal = goalDate ? Math.max(0, Math.round((goalDate.getTime() - now.getTime()) / 86_400_000)) : null;
  const focus = focusCategory(month?.spend ?? [], spent.byCat);

  const [say, sayGrey] =
    spent.total === 0
      ? ['Your plan is running.', `Tell me what you spend — tap + — and I’ll keep ${short} on track. Today you can spend ${baht(leftToday)}.`]
      : pace <= 0
        ? [`You’re doing great — ${baht(-pace)} under pace this month.`, goalDate ? `${short} is on track for ${monthYear(goalDate)}.` : `${short} is on track.`]
        : [`A bit fast this month — ${baht(pace)} over pace.`, `Keep to ${baht(dailyToday)} a day and ${short} stays on ${goalDate ? monthYear(goalDate) : 'track'}.`];

  // ---- Plus ----
  function openFeature(f: PlusFeature) {
    Haptics.selectionAsync().catch(() => {});
    if (!isPlus) return setSheet(f);
    unlocked(f);
  }
  async function unlocked(f: PlusFeature) {
    if (f === 'styles' || f === 'customize') return router.push('/month');
    if (f === 'talk') return router.push('/talk');
    if (f === 'goals') return router.push('/goals');
    if (f === 'automove' && session) {
      await supabase.from('profiles').update({ split_when_paid: true }).eq('id', session.user.id);
      await refreshProfile();
      setToast(`On ✓ — ${baht(saving)} moves to ${short} ${month?.payday ? `on the ${ordinal(month.payday)}` : 'on payday'}.`);
      setTimeout(() => setToast(null), 3500);
    }
  }

  const styleCompare = (() => {
    if (!month) return null;
    const cur = splitMonth(month.inputs, month.style as Style, month.goalPerMonth);
    const all = STYLES.map((s) => ({ s, r: splitMonth(month.inputs, s.key as Style) })).filter((x) => x.s.key !== month.style);
    const best = all.reduce((a, b) => ((b.r.goalMonths ?? 999) < (a.r.goalMonths ?? 999) ? b : a), all[0]);
    const sooner = (cur.goalMonths ?? 0) - (best.r.goalMonths ?? 0);
    const curName = STYLES.find((s) => s.key === month.style)?.name ?? 'Kip’s plan';
    return { cur, best, sooner, curName };
  })();
  const funLeft = Math.max(0, (month?.spend.find((s) => s.key === 'fun')?.amount ?? 0) - (spent.byCat.fun ?? 0));

  const tiles: { f: PlusFeature; icon: IconKey; title: string; teaser: string }[] = [
    {
      f: 'styles',
      icon: 'cash',

      title: 'Money styles',
      teaser:
        styleCompare && styleCompare.sooner > 0
          ? `${styleCompare.best.s.name} gets ${short} ${styleCompare.sooner} month${styleCompare.sooner > 1 ? 's' : ''} sooner`
          : 'Try Save first, 50/30/20 or 6 Jars',
    },
    { f: 'talk', icon: 'fun', title: 'Talk to Kip', teaser: '“Can I afford hotpot on Friday?” — ask anything' },
    { f: 'customize', icon: 'rent', title: 'Customize & locks', teaser: `Lock ${short}, move food & fun your way` },
    {
      f: 'automove',
      icon: 'shield',

      title: 'Payday auto-move',
      teaser: profile?.split_when_paid ? `On — ${baht(saving)} moves itself` : `${baht(saving)} moves itself ${month?.payday ? `on the ${ordinal(month.payday)}` : 'on payday'}`,
    },
  ];

  const sheetContent: Record<PlusFeature, { title: string; sub: string; body?: React.ReactNode }> = {
    styles: {
      title: styleCompare && styleCompare.sooner > 0 ? `Try ${styleCompare.best.s.name}?` : 'Try another money style',
      sub: styleCompare && styleCompare.sooner > 0 ? `Same pay — ${short} ${styleCompare.sooner} month${styleCompare.sooner > 1 ? 's' : ''} sooner.` : 'Same pay, four ways to run it.',
      body:
        styleCompare && month ? (
          <Compare
            left={{
              k: `Now · ${styleCompare.curName}`,
              v: styleCompare.cur.goalMonths ? monthYear(monthsFromNow(styleCompare.cur.goalMonths, { incomeType: month.payday ? 'regular' : 'changes', payday: month.payday } as never)) : '—',
              sub: `saves ${baht(styleCompare.cur.goal)} a month`,
            }}
            right={{
              k: styleCompare.best.s.name,
              v: styleCompare.best.r.goalMonths ? monthYear(monthsFromNow(styleCompare.best.r.goalMonths, { incomeType: month.payday ? 'regular' : 'changes', payday: month.payday } as never)) : '—',
              sub: `saves ${baht(styleCompare.best.r.goal)} a month`,
              color: styleCompare.best.s.tagColor,
            }}
          />
        ) : undefined,
    },
    talk: {
      title: 'Ask Kip anything',
      sub: 'Like a friend who knows your numbers.',
      body: (
        <View style={{ gap: 6 }}>
          <View style={[styles.bubble, styles.bubbleMe]}>
            <Text style={styles.bubbleText}>Can I afford hotpot on Friday?</Text>
          </View>
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>
              Yes — ฿300 fits. You still have <Text style={{ fontFamily: fonts.semibold }}>{baht(funLeft)}</Text> fun money this month, and {short} stays on track.
            </Text>
          </View>
        </View>
      ),
    },
    customize: { title: 'Make the plan yours', sub: `Change food, fun or ${short} — lock what matters and I rebalance the rest.` },
    automove: {
      title: 'Let me move it for you',
      sub: `${baht(saving)} goes to ${short} and your safety net ${month?.payday ? `on the ${ordinal(month.payday)}` : 'on payday'} — before you can spend it.`,
    },
    goals: { title: 'Pin 2 more goals', sub: 'Up to 3 goals on your board, each with its own date — I plan them together.' },
  };

  const cardW = width - 36 - 28;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 18, paddingBottom: 200, gap: 14 }}>
        <View style={styles.topRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Profile and settings" onPress={() => router.push('/profile')} style={styles.avatar}>
            {profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={{ width: 46, height: 46 }} /> : <UserCircle size={46} color={colors.ink} weight="light" />}
          </Pressable>
          {isPlus && (
            <View style={styles.plusBadge}>
              <Text style={styles.plusBadgeText}>✦ {profile?.plan === 'trial' ? 'PLUS TRIAL' : 'PLUS'}</Text>
            </View>
          )}
        </View>

        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text style={styles.date}>
            ☀ {DAYS[now.getDay()]}, {MONTHS[now.getMonth()]} {now.getDate()} · {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </Text>
          <Text style={styles.greeting}>{greeting(now)}</Text>
        </View>

        {/* Goals */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardW + 10}
          decelerationRate="fast"
          style={{ marginHorizontal: -18 }}
          contentContainerStyle={{ paddingHorizontal: 18, gap: 10, paddingTop: 10 }}>
          {goals.map((g) => (
            <GoalCard key={g.id} g={g} width={cardW} name={profile?.display_name ?? null} />
          ))}
          {!isPlus && goals.length < 3 && (
            <Pressable onPress={() => openFeature('goals')} style={[styles.moreGoals, { width: cardW * 0.62 }]} accessibilityRole="button" accessibilityLabel="Pin more goals — Plus">
              <CatIcon name="plus" size={26} />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, textAlign: 'center' }}>Pin 2 more goals</Text>
              <LockDot />
            </Pressable>
          )}
        </ScrollView>
        {goals.length > 0 && <Text style={styles.caption}>Swipe for your other goals →</Text>}

        {/* Kip today */}
        <View style={styles.kipCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Kip mood="happy" size={28} />
            <Text style={styles.kipLabel}>Kip · Today</Text>
          </View>
          <Text style={styles.kipSay}>
            {say} <Text style={{ color: colors.muted }}>{sayGrey}</Text>
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <View style={[styles.chip, { backgroundColor: colors.ink }]}>
              <Text style={[styles.chipText, { color: '#FFFFFF' }]}>Focus: {focus}</Text>
            </View>
            {goal && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{daysToGoal !== null ? `${short} in ${daysToGoal} days` : `${baht(goal.monthly ?? 0)} a month to ${short}`}</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <Text style={styles.small}>Left this month</Text>
            <Pressable onPress={() => setHide((h) => !h)} hitSlop={8} accessibilityRole="button" accessibilityLabel={hide ? 'Show amounts' : 'Hide amounts'}>
              {hide ? <EyeSlash size={16} color={colors.muted} /> : <Eye size={16} color={colors.muted} />}
            </Pressable>
          </View>
          <Text style={styles.bigMoney}>{hide ? '฿ ••••' : baht(leftMonth)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={styles.pill}>
              <Text style={styles.chipText}>
                {P.daysLeft} day{P.daysLeft > 1 ? 's' : ''} left
              </Text>
            </View>
            <Pressable onPress={() => router.push('/month')} hitSlop={8}>
              <Text style={styles.link}>Your month</Text>
            </Pressable>
          </View>
          <View style={styles.today}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.small}>Left to spend today</Text>
              <Text style={styles.todayMoney}>{hide ? '฿ ••••' : baht(leftToday)}</Text>
              <Text style={styles.small}>
                Spent {baht(spent.today)} of {baht(dailyToday)}
              </Text>
            </View>
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Ring pct={dailyToday ? spent.today / dailyToday : 0} />
              <Pressable onPress={() => openFeature('talk')} style={styles.askKip} accessibilityRole="button" accessibilityLabel={isPlus ? 'Ask Kip' : 'Ask Kip — Plus'}>
                <Text style={styles.chipText}>Ask Kip</Text>
                {!isPlus && <LockDot size={20} />}
              </Pressable>
            </View>
          </View>
        </View>

        {/* Plus */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6 }}>
          <Text style={styles.h2}>{isPlus ? 'Kip is working for you' : 'Do more with Kip'}</Text>
          <View style={styles.plusBadge}>
            <Text style={styles.plusBadgeText}>✦ PLUS</Text>
          </View>
        </View>
        {!isPlus && <Text style={[styles.small, { marginTop: -8 }]}>Your plan works free. These make Kip do the work for you — tap any to try.</Text>}
        <View style={styles.grid}>
          {tiles.map((t) => (
            <Pressable key={t.f} onPress={() => openFeature(t.f)} style={styles.tile} accessibilityRole="button" accessibilityLabel={`${t.title}${isPlus ? '' : ' — Plus'}`}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={styles.tileIcon}>
                  <CatIcon name={t.icon} size={18} ink="#FFFFFF" />
                </View>
                {!isPlus && <LockDot />}
              </View>
              <Text style={styles.tileTitle}>{t.title}</Text>
              <Text style={styles.tileTeaser}>{t.teaser}</Text>
            </Pressable>
          ))}
        </View>
        {toast && (
          <View style={styles.toast}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.ink }}>{toast}</Text>
          </View>
        )}

        {/* Income / spending */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={[styles.flow, { backgroundColor: colors.lavender }]}>
            <Text style={styles.small2}>Income</Text>
            <Text style={styles.flowMoney}>{hide ? '••••' : baht(month?.income ?? 0)}</Text>
          </View>
          <View style={[styles.flow, { backgroundColor: colors.orange }]}>
            <Text style={styles.small2}>Spending</Text>
            <Text style={styles.flowMoney}>{hide ? '••••' : baht(spent.total)}</Text>
          </View>
        </View>
        <View style={styles.bar}>
          <View style={[styles.barPart, { flex: Math.max(spent.total, 1), backgroundColor: colors.ink }]}>
            <Text style={[styles.barK, { color: 'rgba(255,255,255,0.7)' }]}>Spent</Text>
            <Text style={[styles.barV, { color: '#FFFFFF' }]}>{baht(spent.total)}</Text>
          </View>
          <View style={[styles.barPart, { flex: Math.max(saving, 1), backgroundColor: colors.sky }]}>
            <Text style={styles.barK}>Savings</Text>
            <Text style={styles.barV}>{baht(saving)}</Text>
          </View>
          <View style={[styles.barPart, { flex: Math.max(leftMonth, 1), backgroundColor: '#F2F2EF' }]}>
            <Text style={styles.barK}>To spend</Text>
            <Text style={styles.barV}>{baht(leftMonth)}</Text>
          </View>
        </View>
        <Text style={styles.small}>Bills this month {baht(bills)}</Text>

        {/* Where it went */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={styles.h2}>Where it went</Text>
          <Pressable onPress={() => router.push('/month')} hitSlop={8}>
            <Text style={styles.link}>Details</Text>
          </Pressable>
        </View>
        {spent.total === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center' }}>
              Nothing logged yet. Tap + to add what you spend — I’ll show where it goes.
            </Text>
          </View>
        ) : (
          <View style={styles.whereCard}>
            {(month?.spend ?? [])
              .map((s) => ({ ...s, used: spent.byCat[s.key] ?? 0 }))
              .filter((s) => s.used > 0)
              .sort((a, b) => b.used - a.used)
              .slice(0, 5)
              .map((s) => (
                <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <CatBadge name={CATEGORY[s.key].icon} color={CATEGORY[s.key].color} size={30} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={styles.rowName}>{CATEGORY[s.key].name}</Text>
                      <Text style={styles.rowName}>
                        {baht(s.used)} <Text style={{ color: colors.muted }}>/ {baht(s.amount)}</Text>
                      </Text>
                    </View>
                    <View style={styles.track}>
                      <View
                        style={{ width: `${Math.min(100, (s.used / Math.max(s.amount, 1)) * 100)}%`, height: 6, borderRadius: 3, backgroundColor: s.used > s.amount ? colors.orange : colors.ink }}
                      />
                    </View>
                  </View>
                </View>
              ))}
          </View>
        )}

        {/* Bills */}
        <Text style={styles.h2}>Bills this month</Text>
        <View style={styles.whereCard}>
          {month && (
            <>
              <BillRow name="Rent" amount={month.bills.rent} />
              {(month.bills.items ?? []).map((b, i) => (
                <BillRow key={`${b.name}-${i}`} name={b.name} amount={b.amount} />
              ))}
              {month.bills.guess > 0 && <BillRow name="Other bills · Kip’s guess" amount={month.bills.guess} />}
            </>
          )}
        </View>
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add it yourself"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          router.push('/add');
        }}
        style={[styles.fab, { bottom: 116 + Math.max(insets.bottom, 12) - 12 }]}>
        <Plus size={28} color="#FFFFFF" weight="bold" />
      </Pressable>

      {sheet && (
        <PlusSheet open onClose={() => setSheet(null)} onUnlocked={() => unlocked(sheet)} title={sheetContent[sheet].title} sub={sheetContent[sheet].sub}>
          {sheetContent[sheet].body}
        </PlusSheet>
      )}
    </View>
  );
}

function focusCategory(spend: { key: CatKey; amount: number }[], byCat: Record<string, number | undefined>): string {
  let best: { key: CatKey; r: number } | null = null;
  for (const s of spend) {
    const r = (byCat[s.key] ?? 0) / Math.max(s.amount, 1);
    if (r > 0 && (!best || r > best.r)) best = { key: s.key, r };
  }
  return (best ? CATEGORY[best.key].name : 'Food & drinks').split(' &')[0];
}

function GoalCard({ g, width, name }: { g: HomeGoal; width: number; name: string | null }) {
  const t = typeInfo(g.goalType, g.kind as never);
  const short = g.kind === 'monthly' ? g.title : shortName(g.title, g.kind as never);
  const pct = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
  const days = g.due ? Math.max(0, Math.round((parseDay(g.due).getTime() - Date.now()) / 86_400_000)) : null;
  const line = (g.promise ?? '').split('\n')[0];
  const signed = g.signedAt ? new Date(g.signedAt) : null;
  return (
    <View style={[styles.goalCard, { width, backgroundColor: t.color }]}>
      {g.photo ? (
        <Image source={{ uri: g.photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <CatIcon name={t.icon} size={64} />
        </View>
      )}
      <View style={styles.goalTop}>
        <View style={styles.goalChip}>
          <CatIcon name={t.icon} size={14} />
          <Text style={styles.chipText} numberOfLines={1}>
            {short}
            {days !== null ? ` · ${days} days` : g.monthly ? ` · ${baht(g.monthly)}/mo` : ''}
          </Text>
        </View>
        {g.target > 0 && (
          <View style={[styles.goalChip, { backgroundColor: colors.ink }]}>
            <Text style={[styles.chipText, { color: '#FFFFFF' }]}>{pct}%</Text>
          </View>
        )}
      </View>
      {line ? (
        <View style={[styles.postIt, t.color === colors.lime && !g.photo && { backgroundColor: '#FFFFFF' }]}>
          <View style={styles.tape} />
          <Text style={styles.promiseHead}>MY PROMISE</Text>
          <Text style={styles.promise} numberOfLines={3}>
            {line}
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <Text style={styles.signedAt}>{signed ? `Signed ${MONTHS[signed.getMonth()]} ${signed.getDate()}` : ''}</Text>
            {g.signature ? <Image source={{ uri: g.signature }} style={{ width: 70, height: 30 }} contentFit="contain" /> : name ? <Text style={styles.sig}>{name}</Text> : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function BillRow({ name, amount }: { name: string; amount: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <CatBadge name="bill" color={money.fixed} size={30} />
      <Text style={[styles.rowName, { flex: 1 }]}>{name}</Text>
      <Text style={styles.rowName}>{baht(amount)}</Text>
    </View>
  );
}

function LockDot({ size = 24 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
      <Lock size={size * 0.5} color="#FFFFFF" weight="fill" />
    </View>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, pct));
  return (
    <Svg width={64} height={64} viewBox="0 0 64 64">
      <Circle cx={32} cy={32} r={r} stroke="rgba(17,17,17,0.12)" strokeWidth={9} fill="none" />
      <Circle cx={32} cy={32} r={r} stroke={colors.ink} strokeWidth={9} fill="none" strokeDasharray={`${c * p} ${c}`} strokeLinecap="round" rotation={-90} origin="32, 32" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avatar: { width: 46, height: 46, borderRadius: 999, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  plusBadge: { height: 24, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.ink, justifyContent: 'center' },
  plusBadgeText: { fontFamily: fonts.bold, fontSize: 11, color: '#FFFFFF' },
  date: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  greeting: { fontFamily: fonts.medium, fontSize: 32, letterSpacing: -0.6, color: colors.ink },
  caption: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: -6 },
  goalCard: { height: 260, borderRadius: 28, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 10px 24px rgba(0,0,0,0.10)' },
  goalTop: { position: 'absolute', left: 12, right: 12, top: 14, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  goalChip: { height: 32, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  postIt: {
    position: 'absolute',
    left: 14,
    bottom: 16,
    width: 206,
    paddingTop: 18,
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: colors.lime,
    transform: [{ rotate: '-2.5deg' }],
    gap: 3,
    boxShadow: '0 10px 20px rgba(0,0,0,0.20)',
  },
  tape: { position: 'absolute', top: -8, left: 79, width: 48, height: 16, backgroundColor: 'rgba(255,255,255,0.6)', transform: [{ rotate: '-5deg' }] },
  promiseHead: { fontFamily: fonts.regular, fontSize: 9, letterSpacing: 1.1, color: 'rgba(17,17,17,0.55)' },
  promise: { fontFamily: fonts.hand, fontSize: 21, lineHeight: 22, color: colors.ink },
  signedAt: { fontFamily: fonts.regular, fontSize: 10, color: 'rgba(17,17,17,0.5)', paddingBottom: 4 },
  sig: { fontFamily: fonts.signature, fontSize: 30, color: colors.ink },
  moreGoals: { height: 260, borderRadius: 28, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(17,17,17,0.25)', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 14 },
  kipCard: { borderRadius: 28, backgroundColor: colors.roseBeige, padding: 18, gap: 10 },
  kipLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  kipSay: { fontFamily: fonts.medium, fontSize: 21, lineHeight: 28, letterSpacing: -0.3, color: colors.ink },
  chip: { height: 30, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  chipText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.ink },
  small: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  small2: { fontFamily: fonts.regular, fontSize: 13, color: 'rgba(17,17,17,0.7)' },
  bigMoney: { fontFamily: fonts.medium, fontSize: 44, letterSpacing: -1.4, color: colors.ink, fontVariant: ['tabular-nums'] },
  pill: { height: 30, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  link: { fontFamily: fonts.regular, fontSize: 13, color: colors.ink, textDecorationLine: 'underline' },
  today: { borderRadius: 22, backgroundColor: colors.lime, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  todayMoney: { fontFamily: fonts.bold, fontSize: 32, letterSpacing: -0.8, color: colors.ink, fontVariant: ['tabular-nums'] },
  askKip: { height: 30, paddingLeft: 12, paddingRight: 5, borderRadius: radius.pill, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 6 },
  h2: { fontFamily: fonts.semibold, fontSize: 19, color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48.5%', minHeight: 128, borderRadius: 20, padding: 14, gap: 8, backgroundColor: '#F8F6F4' },
  tileIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  tileTeaser: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: 'rgba(17,17,17,0.72)' },
  toast: { borderRadius: 16, backgroundColor: colors.lime, padding: 12 },
  flow: { flex: 1, borderRadius: 22, padding: 16, gap: 18 },
  flowMoney: { fontFamily: fonts.medium, fontSize: 24, color: colors.ink, fontVariant: ['tabular-nums'] },
  bar: { flexDirection: 'row', height: 64, borderRadius: 16, overflow: 'hidden' },
  barPart: { justifyContent: 'center', paddingHorizontal: 10, minWidth: 70 },
  barK: { fontFamily: fonts.regular, fontSize: 11, color: 'rgba(17,17,17,0.7)' },
  barV: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
  empty: { borderRadius: 20, backgroundColor: '#F8F6F4', padding: 18 },
  whereCard: { borderRadius: 20, backgroundColor: '#F8F6F4', padding: 14, gap: 12 },
  rowName: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(17,17,17,0.08)' },
  bubble: { alignSelf: 'flex-start', maxWidth: '88%', borderRadius: 16, borderTopLeftRadius: 4, backgroundColor: colors.grey, paddingVertical: 9, paddingHorizontal: 12 },
  bubbleMe: { alignSelf: 'flex-end', borderTopLeftRadius: 16, borderTopRightRadius: 4, backgroundColor: colors.lime },
  bubbleText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.ink },
  fab: {
    position: 'absolute',
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 10px 24px rgba(17,17,17,0.28)',
  },
});
