import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { CaretDown, Check, Lock, Plus, X } from 'phosphor-react-native';
import { useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CatBadge } from '@/components/CatIcon';
import { Kip } from '@/components/Kip';
import { Glass } from '@/components/glow/Glass';
import { GlowBackground } from '@/components/glow/GlowBackground';
import { RiseIn, Ring, Squish } from '@/components/glow/motion';
import { BillGlyph, glyphFor } from '@/components/home/BillStack';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui';
import {
  CATEGORY,
  STYLES,
  billsTotal,
  dailyOf,
  addBill,
  lowerBudget,
  removeBill,
  raiseBudget,
  savingTotal,
  spendingTotal,
  takePlan,
  withStyle,
  type CatKey,
  type FreedTo,
  type MonthBudget,
} from '@/lib/budget';
import { CAT_ICON3D, ICON3D, type Icon3D } from '@/lib/icons3d';
import { baht } from '@/lib/money';
import { shortDate } from '@/lib/setup/plan';
import { colors, fonts, glow, money, radius } from '@/theme';

/** This pay cycle: payday → the day before next payday (or the calendar month). */
function period(payday: number | null, now = new Date()) {
  const last = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const at = (y: number, m: number, d: number) => new Date(y, m, Math.min(d, last(y, m)));
  if (!payday) return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 0)] as const;
  const back = now.getDate() < Math.min(payday, last(now.getFullYear(), now.getMonth())) ? 1 : 0;
  const start = at(now.getFullYear(), now.getMonth() - back, payday);
  const next = at(start.getFullYear(), start.getMonth() + 1, payday);
  return [start, new Date(next.getFullYear(), next.getMonth(), next.getDate() - 1)] as const;
}

type Sheet = null | { stage: 'addBill' } | { stage: 'style' } | { stage: 'edit'; key: CatKey } | { stage: 'freed'; key: CatKey; to: number } | { stage: 'take'; key: CatKey; to: number };

export function MonthScreen({
  month,
  loading,
  error,
  save,
  spent,
  isPlus = true,
  onLocked,
}: {
  month: MonthBudget | null;
  loading: boolean;
  error: string | null;
  save: (m: MonthBudget) => void;
  /** Spent so far this month by category — shows what's left on each ring. */
  spent?: Partial<Record<CatKey, number>>;
  /** Free users: changing amounts and money styles are Plus. Bills are facts, so adding one stays free. */
  isPlus?: boolean;
  onLocked?: (f: 'styles' | 'customize') => void;
}) {
  const insets = useSafeAreaInsets();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (loading || !month) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <GlowBackground />
        {loading ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.muted}>{error ?? 'Finish Setup to see your month.'}</Text>}
      </View>
    );
  }

  const [from, to] = period(month.payday);
  const style = STYLES.find((s) => s.key === month.style)!;
  const spending = spendingTotal(month);
  const saving = savingTotal(month);
  const bills = billsTotal(month);
  const goalAmount = month.goal.amount + month.goalExtra;

  const change = (key: CatKey, amount: number) => {
    const cur = month.spend.find((s) => s.key === key)?.amount ?? 0;
    if (amount === cur) return setSheet(null);
    if (amount < cur) {
      if (month.alwaysFreedTo) {
        save(lowerBudget(month, key, amount, month.alwaysFreedTo));
        return setSheet(null);
      }
      return setSheet({ stage: 'freed', key, to: amount });
    }
    setSheet({ stage: 'take', key, to: amount });
  };
  const edit = (key: CatKey) => (isPlus ? setSheet({ stage: 'edit', key }) : onLocked?.('customize'));

  return (
    <View style={{ flex: 1 }}>
      <GlowBackground />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) + 100 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 18 }}>
          <ScreenHeader
            title="Your month"
            right={
              <Squish onPress={() => (isPlus ? setSheet({ stage: 'style' }) : onLocked?.('styles'))} accessibilityRole="button" accessibilityLabel={`Money style: ${style.name}. Change`}>
                <Glass radius={999} innerStyle={styles.stylePill}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.ink }}>{style.name}</Text>
                  {isPlus ? <CaretDown size={11} color={colors.ink} weight="bold" /> : <MiniLock />}
                </Glass>
              </Squish>
            }
          />
        </View>

        <RiseIn delay={40} style={{ paddingHorizontal: 22, paddingTop: 22 }}>
          <Text style={styles.heroLabel}>
            {shortDate(from)} – {shortDate(to)} · your pay
          </Text>
          <Text style={styles.big}>
            <Text style={{ fontSize: 26, fontFamily: fonts.regular }}>฿</Text>
            {month.income.toLocaleString('en-US')}
          </Text>
        </RiseIn>

        {/* where every baht goes */}
        <RiseIn delay={90} style={styles.flowBar}>
          <FlowPart flex={saving} color={colors.limeDeep} label="Saving" amount={saving} delay={0} />
          <FlowPart flex={bills} color={colors.ink} label="Bills" amount={bills} delay={100} light />
          <FlowPart flex={spending} color="rgba(255,255,255,0.78)" label="To spend" amount={spending} delay={200} />
        </RiseIn>
        <Text style={styles.note}>Every baht has a job: saving goes first, then bills, then what’s left is yours to spend.</Text>

        {/* 1 · Saving first */}
        <Section n={1} title="Saving first" right={`${baht(saving)} · on payday`} />
        <RiseIn delay={140} style={styles.cardWrap}>
          <Glass radius={26} innerStyle={styles.card}>
            <Row
              icon={month.goal.isSafetyNet ? 'shield' : 'plane'}
              title={month.goal.title}
              sub={month.goalExtra > 0 ? `Includes ${baht(month.goalExtra)} moved from your budgets` : 'Goes out first, every payday'}
              amount={baht(goalAmount)}
              amountSub="a month"
            />
            {!month.goal.isSafetyNet && (
              <Row icon="shield" title="Safety net" sub={`Until you have ${baht(month.safety.target)} — 3 months of basics`} amount={baht(month.safety.amount)} amountSub="a month" divider />
            )}
          </Glass>
        </RiseIn>

        {/* 2 · Bills */}
        <Section n={2} title="Bills" right={baht(bills)} />
        <RiseIn delay={180} style={styles.cardWrap}>
          <Glass radius={26} innerStyle={styles.card}>
            <Row glyph={{ name: 'Rent', tint: colors.lavender }} title="Rent" sub="You told me" amount={baht(month.bills.rent)} />
            {(month.bills.items ?? []).map((b, i) => (
              <Row
                key={`${b.name}-${i}`}
                glyph={{ name: b.name, tint: tintFor(b.name) }}
                title={b.name}
                sub="Monthly"
                amount={baht(b.amount)}
                divider
                right={
                  <Pressable onPress={() => save(removeBill(month, i))} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${b.name}`} style={styles.xBtn}>
                    <X size={12} color={colors.muted} weight="bold" />
                  </Pressable>
                }
              />
            ))}
            <Row glyph={{ name: 'Other bills', tint: colors.sand }} title="Other bills" sub="Kip’s guess — shrinks as you add real ones" amount={`~${baht(month.bills.guess)}`} divider />
            <Pressable onPress={() => setSheet({ stage: 'addBill' })} style={styles.addRow} accessibilityRole="button">
              <View style={styles.addDot}>
                <Plus size={13} color="#FFFFFF" weight="bold" />
              </View>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.muted }}>Add a bill · Netflix, phone, gym…</Text>
            </Pressable>
          </Glass>
        </RiseIn>
        {notice ? <Text style={[styles.note, { color: colors.ink }]}>{notice}</Text> : null}

        {/* 3 · Spending */}
        <Section n={3} title="Spending" right={`${baht(spending)} · ${baht(dailyOf(month))} a day`} />
        <RiseIn delay={220} style={styles.cardWrap}>
          <Glass radius={26} innerStyle={styles.card}>
            {month.spend.map((s, i) => {
              const c = CATEGORY[s.key];
              const used = spent?.[s.key] ?? 0;
              const left = Math.max(0, s.amount - used);
              return (
                <Pressable
                  key={s.key}
                  onPress={() => edit(s.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.name}, ${baht(s.amount)}, ${baht(left)} left. Change`}
                  style={[styles.row, i > 0 && styles.divider]}>
                  <View style={{ width: 48, height: 48 }}>
                    <Ring pct={s.amount ? left / s.amount : 0} size={48} stroke={4.5} color={colors.limeDeep} delay={300 + i * 60} />
                    <Image source={ICON3D[CAT_ICON3D[s.key]]} style={{ position: 'absolute', left: 9, top: 9, width: 30, height: 30 }} contentFit="contain" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.rowName}>{c.name}</Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {HINT[s.key]}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.amount}>{baht(s.amount)}</Text>
                    {spent ? <Text style={styles.sub}>{baht(left)} left</Text> : null}
                  </View>
                  <View style={styles.editPill}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.ink }}>Edit</Text>
                    {!isPlus && <MiniLock />}
                  </View>
                </Pressable>
              );
            })}
          </Glass>
        </RiseIn>

        <Text style={styles.note}>Changing a number? Kip rebalances the rest so your month still adds up.{!isPlus ? ' Changing amounts and money styles is ✦ Plus.' : ''}</Text>
        <RiseIn delay={260} style={styles.cardWrap}>
          <Glass radius={22} innerStyle={styles.leftovers}>
            <Image source={ICON3D.shield} style={{ width: 40, height: 40 }} contentFit="contain" />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.ink }}>Leftovers go to your safety net</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.muted }}>
                Daily money you didn’t spend, and any of my bill guess you didn’t need — moved on payday.
              </Text>
            </View>
          </Glass>
        </RiseIn>
        <Text style={styles.note}>
          Starting split based on what Thai households spend (Ministry of Commerce, 2025), adjusted for one person. After your first month, I’ll match it to how you really spend.
        </Text>
        {error ? <Text style={[styles.note, { color: colors.orange }]}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <Button label="Looks good" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
      <BottomSheet open={sheet !== null} onClose={() => setSheet(null)}>
        {sheet?.stage === 'style' && (
          <StylePicker
            current={month.style}
            onPick={(k) => {
              save(withStyle(month, k));
              setSheet(null);
            }}
          />
        )}
        {sheet?.stage === 'addBill' && (
          <AddBill
            month={month}
            onAdd={(name, amount) => {
              const r = addBill(month, name, amount);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              save(r.month);
              setNotice(
                r.fromFun === 0 && r.fromGoal === 0
                  ? `${name} added — it fits inside my bill guess, so nothing else changed.`
                  : `${name} added: ${[r.fromGuess ? `${baht(r.fromGuess)} from my bill guess` : '', r.fromFun ? `${baht(r.fromFun)} from fun money` : '', r.fromGoal ? `${baht(r.fromGoal)} from ${month.goal.title}` : ''].filter(Boolean).join(', ')}.`,
              );
              setSheet(null);
            }}
          />
        )}
        {sheet?.stage === 'edit' && <EditAmount month={month} cat={sheet.key} onDone={(amount) => change(sheet.key, amount)} />}
        {sheet?.stage === 'freed' && (
          <Freed
            month={month}
            cat={sheet.key}
            to={sheet.to}
            onDone={(dest, always) => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              save({ ...lowerBudget(month, sheet.key, sheet.to, dest), alwaysFreedTo: always ? dest : null });
              setSheet(null);
            }}
          />
        )}
        {sheet?.stage === 'take' && (
          <Take
            month={month}
            cat={sheet.key}
            to={sheet.to}
            onYes={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              save(raiseBudget(month, sheet.key, sheet.to));
              setSheet(null);
            }}
            onChoose={() => setSheet({ stage: 'edit', key: sheet.key })}
          />
        )}
      </BottomSheet>
    </View>
  );
}

const HINT: Record<CatKey, string> = {
  food: '฿150 a day at least',
  transport: 'BTS/MRT, bus or bike taxi',
  shopping: 'Clothes, gadgets, online',
  fun: 'Going out, treats, hobbies',
  health_beauty: 'Pharmacy, haircut, toiletries',
  learning: 'Courses, books',
  giving: 'Family, merit, gifts',
  other: 'Laundry, small things',
  spend_freely: 'One pot for everything day to day',
};

function tintFor(name: string) {
  const g = glyphFor(name);
  return ({ house: colors.lavender, bolt: colors.lime, drop: colors.sky, phone: colors.peach, wifi: colors.sage, play: colors.pink, receipt: colors.sand } as const)[g];
}

function FlowPart({ flex, color, label, amount, delay, light }: { flex: number; color: string; label: string; amount: number; delay: number; light?: boolean }) {
  if (flex <= 0) return null;
  return (
    <Animated.View
      entering={FadeInLeft.delay(300 + delay).duration(700)}
      style={{ flex, backgroundColor: color, justifyContent: 'flex-end', paddingHorizontal: 8, paddingVertical: 7, overflow: 'hidden' }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: light ? '#FFFFFF' : colors.ink }} numberOfLines={1}>
        {label}
      </Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: light ? 'rgba(255,255,255,0.7)' : 'rgba(17,17,17,0.6)' }} numberOfLines={1}>
        {baht(amount)}
      </Text>
    </Animated.View>
  );
}

function Row({
  icon,
  glyph,
  title,
  sub,
  amount,
  amountSub,
  divider,
  right,
}: {
  icon?: Icon3D;
  glyph?: { name: string; tint: string };
  title: string;
  sub: string;
  amount: string;
  amountSub?: string;
  divider?: boolean;
  right?: ReactNode;
}) {
  return (
    <View style={[styles.row, divider && styles.divider]}>
      {icon ? (
        <Image source={ICON3D[icon]} style={{ width: 44, height: 44 }} contentFit="contain" />
      ) : glyph ? (
        <View style={[styles.gico, { backgroundColor: glyph.tint }]}>
          <BillGlyph name={glyph.name} />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowName} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.amount}>{amount}</Text>
        {amountSub ? <Text style={styles.sub}>{amountSub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

function MiniLock() {
  return (
    <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
      <Lock size={9} color="#FFFFFF" weight="fill" />
    </View>
  );
}

function Section({ n, title, right }: { n: number; title: string; right: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 28, paddingBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={styles.nDot}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: '#FFFFFF' }}>{n}</Text>
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.muted }}>{right}</Text>
    </View>
  );
}

// ---------- sheets ----------

function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 10 }]}>
          <View style={styles.grabber} />
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SheetTitle({ mood, title, sub }: { mood: 'happy' | 'think' | 'idle'; title: string; sub: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
      <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Kip mood={mood} size={42} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 20, letterSpacing: -0.3, color: colors.ink }}>{title}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.muted }}>{sub}</Text>
      </View>
    </View>
  );
}

function StylePicker({ current, onPick }: { current: MonthBudget['style']; onPick: (k: MonthBudget['style']) => void }) {
  return (
    <>
      <SheetTitle mood="idle" title="Money style" sub="Your goal, safety net and bills stay the same. This only changes how spending is split." />
      <View style={{ gap: 8 }}>
        {STYLES.map((s) => (
          <Option key={s.key} title={s.name} sub={s.desc} color={s.tagColor} on={s.key === current} tag={s.key === 'kip' ? 'RECOMMENDED' : undefined} onPress={() => onPick(s.key)} />
        ))}
      </View>
    </>
  );
}

function EditAmount({ month, cat, onDone }: { month: MonthBudget; cat: CatKey; onDone: (amount: number) => void }) {
  const cur = month.spend.find((s) => s.key === cat)?.amount ?? 0;
  const max = spendingTotal(month);
  const [value, setValue] = useState<number | null>(cur);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const c = CATEGORY[cat];
  const v = Math.min(value ?? 0, max);
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <CatBadge name={c.icon} color={c.color} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 20, color: colors.ink }}>{c.name}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.muted }}>Now {baht(cur)} a month</Text>
        </View>
      </View>
      <Pressable onPress={() => input.current?.focus()} style={styles.moneyField}>
        <Text style={[styles.moneyText, value === null && { color: colors.faint }]}>฿</Text>
        <TextInput
          ref={input}
          autoFocus
          value={value === null ? '' : value.toLocaleString('en-US')}
          onChangeText={(t) => {
            const d = t.replace(/[^\d]/g, '');
            setValue(d ? Math.min(Number(d), 9_999_999) : null);
          }}
          keyboardType="number-pad"
          selectTextOnFocus
          style={[styles.moneyText, { flex: 1, padding: 0 }]}
          accessibilityLabel={`${c.name} budget`}
        />
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[-500, -100, 100, 500].map((d) => (
          <Pressable key={d} onPress={() => setValue(Math.max(0, (value ?? 0) + d))} style={styles.step} accessibilityRole="button">
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>{d > 0 ? `+${d}` : `−${-d}`}</Text>
          </Pressable>
        ))}
      </View>
      {cat === 'food' && v < 4500 && (
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.orange }}>That’s {baht(Math.round(v / 30))} a day — below ฿150 a day is very hard to keep.</Text>
      )}
      {(value ?? 0) > max && <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.orange }}>That’s all your spending money — {baht(max)} at most.</Text>}
      <Button label={v === cur ? 'Done' : `Set to ${baht(v)}`} onPress={() => onDone(Math.round(v / 10) * 10)} />
    </>
  );
}

function Freed({ month, cat, to, onDone }: { month: MonthBudget; cat: CatKey; to: number; onDone: (dest: FreedTo, always: boolean) => void }) {
  const cur = month.spend.find((s) => s.key === cat)?.amount ?? 0;
  const freed = cur - to;
  const [dest, setDest] = useState<FreedTo>('goal');
  const [always, setAlways] = useState(false);
  const goalName = month.goal.isSafetyNet ? 'Safety net' : month.goal.title;
  const amt = (k: CatKey) => month.spend.find((s) => s.key === k)?.amount ?? 0;
  const funKey: CatKey = month.spend.some((s) => s.key === 'fun') ? 'fun' : 'spend_freely';
  const options: { key: FreedTo; title: string; sub: string; tag?: string; color: string }[] = [
    {
      key: 'goal',
      title: goalName,
      sub: `${baht(month.goal.amount + month.goalExtra)} → ${baht(month.goal.amount + month.goalExtra + freed)} a month · get there sooner`,
      tag: 'KIP’S PICK',
      color: money.goalChoice,
    },
    ...(cat !== 'food' && month.spend.some((s) => s.key === 'food')
      ? [{ key: 'food' as const, title: 'Food & drinks', sub: `${baht(amt('food'))} → ${baht(amt('food') + freed)} a month`, color: colors.lime }]
      : []),
    ...(cat !== 'transport' && month.spend.some((s) => s.key === 'transport')
      ? [{ key: 'transport' as const, title: 'Transport', sub: `${baht(amt('transport'))} → ${baht(amt('transport') + freed)} a month`, color: colors.sky }]
      : []),
    ...(cat !== funKey ? [{ key: 'fun' as const, title: 'Fun money', sub: `${baht(amt(funKey))} → ${baht(amt(funKey) + freed)} a month`, color: money.fun }] : []),
  ];
  const label = options.find((o) => o.key === dest)?.title ?? goalName;
  return (
    <>
      <SheetTitle mood="happy" title={`Nice — ${baht(freed)} freed up`} sub={`${CATEGORY[cat].name} ${baht(cur)} → ${baht(to)}. Where should it go? (Bills stay as they are.)`} />
      <View style={{ gap: 8 }}>
        {options.map((o) => (
          <Option key={o.key} title={o.title} sub={o.sub} tag={o.tag} color={o.color} on={dest === o.key} onPress={() => setDest(o.key)} />
        ))}
      </View>
      <Pressable onPress={() => setAlways(!always)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityRole="checkbox" accessibilityState={{ checked: always }}>
        <View style={[styles.check, always && { backgroundColor: colors.lime, borderColor: colors.ink }]}>{always && <Check size={12} color={colors.ink} weight="bold" />}</View>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.muted }}>Do this every time I lower a budget</Text>
      </Pressable>
      <Button label={`Move ${baht(freed)} to ${label}`} onPress={() => onDone(dest, always)} />
    </>
  );
}

function AddBill({ month, onAdd }: { month: MonthBudget; onAdd: (name: string, amount: number) => void }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const preview = amount ? addBill(month, name || 'New bill', amount) : null;
  const goalName = month.goal.isSafetyNet ? 'your safety net' : month.goal.title;
  return (
    <>
      <SheetTitle mood="think" title="Add a bill" sub="Anything that comes every month: subscriptions, a gym, a phone instalment." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {['Netflix', 'YouTube Premium', 'Spotify', 'iCloud', 'Gym', 'Phone instalment'].map((n) => (
          <Pressable key={n} onPress={() => setName(n)} style={[styles.quickChip, name === n && { backgroundColor: colors.sky, borderColor: colors.ink }]} accessibilityRole="button">
            <Text style={{ fontFamily: name === n ? fonts.semibold : fonts.medium, fontSize: 13, color: colors.ink }}>{n}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput value={name} onChangeText={setName} placeholder="Name" placeholderTextColor={colors.faint} style={[styles.field, { flex: 1.4 }]} accessibilityLabel="Bill name" />
        <View style={[styles.field, { flex: 1, flexDirection: 'row', alignItems: 'center' }]}>
          <Text style={styles.fieldText}>฿</Text>
          <TextInput
            value={amount === null ? '' : amount.toLocaleString('en-US')}
            onChangeText={(t) => {
              const d = t.replace(/[^\d]/g, '');
              setAmount(d ? Math.min(Number(d), 999_999) : null);
            }}
            placeholder="179"
            placeholderTextColor={colors.faint}
            keyboardType="number-pad"
            style={[styles.fieldText, { flex: 1, padding: 0 }]}
            accessibilityLabel="Amount a month"
          />
        </View>
      </View>
      {preview && (
        <View style={styles.takeBox}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink, paddingVertical: 6 }}>What it does to your month</Text>
          {preview.fromGuess > 0 && <Text style={styles.impact}>✓ {baht(preview.fromGuess)} fits inside my bill guess — that’s what the guess is for.</Text>}
          {preview.fromFun > 0 && <Text style={styles.impact}>• {baht(preview.fromFun)} less fun money a month.</Text>}
          {preview.fromGoal > 0 && (
            <Text style={styles.impact}>
              • {baht(preview.fromGoal)} less for {goalName} a month — it’ll take a little longer.
            </Text>
          )}
          {preview.short > 0 && <Text style={[styles.impact, { color: colors.orange }]}>• {baht(preview.short)} more than your month can carry. Something else has to go.</Text>}
          {preview.fromFun === 0 && preview.fromGoal === 0 && preview.short === 0 && <Text style={styles.impact}>Nothing else changes.</Text>}
          <Text style={[styles.impact, { color: colors.muted, paddingBottom: 6 }]}>{baht((amount ?? 0) * 12)} a year. Worth it? Only you can say — I just make sure you see it.</Text>
        </View>
      )}
      <Button label={amount ? `Add ${name || 'bill'} · ${baht(amount)} a month` : 'Add bill'} disabled={!amount || !name.trim()} onPress={() => amount && onAdd(name.trim(), amount)} />
    </>
  );
}

function Take({ month, cat, to, onYes, onChoose }: { month: MonthBudget; cat: CatKey; to: number; onYes: () => void; onChoose: () => void }) {
  const cur = month.spend.find((s) => s.key === cat)?.amount ?? 0;
  const cuts = useMemo(() => takePlan(month, cat, to), [month, cat, to]);
  const got = cuts.reduce((a, c) => a + c.was - c.now, 0);
  return (
    <>
      <SheetTitle mood="think" title={`${CATEGORY[cat].name.split(' &')[0]} gets ${baht(got)} more`} sub={`${baht(cur)} → ${baht(cur + got)}. I’ll take a little from each of these:`} />
      <View style={styles.takeBox}>
        {cuts
          .filter((c) => c.was !== c.now)
          .map((c) => (
            <View key={c.from} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
              <CatBadge name={CATEGORY[c.from].icon} color={CATEGORY[c.from].color} size={30} />
              <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.ink }}>{CATEGORY[c.from].name}</Text>
              <Text style={styles.was}>{baht(c.was)}</Text>
              <Text style={[styles.amount, { width: 64, textAlign: 'right', fontSize: 14 }]}>{baht(c.now)}</Text>
              <Text style={{ width: 44, textAlign: 'right', fontFamily: fonts.regular, fontSize: 12, color: colors.orange }}>−{c.was - c.now}</Text>
            </View>
          ))}
      </View>
      {got < to - cur && <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.orange }}>That’s everything the other categories can give.</Text>}
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.muted }}>
        {month.goal.isSafetyNet ? 'Your safety net' : `${month.goal.title}, your safety net`} and bills stay exactly the same.
      </Text>
      <Button label="Yes, do it" onPress={onYes} />
      <Pressable onPress={onChoose} hitSlop={8} style={{ alignSelf: 'center' }} accessibilityRole="button">
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.ink, textDecorationLine: 'underline' }}>Let me choose</Text>
      </Pressable>
    </>
  );
}

function Option({ title, sub, on, tag, onPress, color = colors.lime }: { title: string; sub: string; on: boolean; tag?: string; onPress: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.option, on && [styles.optionOn, { backgroundColor: color }]]}>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>{title}</Text>
          {tag ? (
            <View style={[styles.tag, on && { backgroundColor: '#FFFFFF' }]}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: colors.ink }}>{tag}</Text>
            </View>
          ) : null}
        </View>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: on ? 'rgba(17,17,17,0.7)' : colors.muted }} numberOfLines={3}>
          {sub}
        </Text>
      </View>
      <View style={[styles.radio, on && { borderWidth: 7, borderColor: colors.ink }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: 'center' },
  stylePill: { height: 36, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  big: { fontFamily: fonts.medium, fontSize: 46, letterSpacing: -2, lineHeight: 52, color: colors.ink, fontVariant: ['tabular-nums'], marginTop: 4 },
  flowBar: { flexDirection: 'row', gap: 3, height: 54, marginHorizontal: 18, marginTop: 18, borderRadius: 18, overflow: 'hidden' },
  note: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted, paddingHorizontal: 22, marginTop: 10 },
  sectionTitle: { fontFamily: fonts.medium, fontSize: 17, color: colors.ink },
  nDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  cardWrap: { paddingHorizontal: 18 },
  card: { paddingVertical: 4, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: 'rgba(17,17,17,0.06)' },
  rowName: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.muted },
  amount: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink, fontVariant: ['tabular-nums'] },
  gico: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  xBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: glow.control, alignItems: 'center', justifyContent: 'center' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(17,17,17,0.06)' },
  addDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  editPill: { height: 30, paddingHorizontal: 10, borderRadius: 999, backgroundColor: glow.control, flexDirection: 'row', alignItems: 'center', gap: 5 },
  leftovers: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: 'rgba(247,244,247,0.88)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.9)' },

  scrim: { flex: 1, backgroundColor: 'rgba(17,17,17,0.38)' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, paddingHorizontal: 20, gap: 14, boxShadow: '0 -8px 30px rgba(0,0,0,0.12)' },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: radius.pill, backgroundColor: 'rgba(17,17,17,0.15)' },
  option: {
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.grey,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionOn: { borderColor: colors.ink },
  radio: { width: 22, height: 22, borderRadius: radius.pill, borderWidth: 2, borderColor: '#C9C9C2' },
  tag: { height: 20, paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: colors.lime, justifyContent: 'center' },
  check: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: '#C9C9C2', alignItems: 'center', justifyContent: 'center' },
  moneyField: { borderRadius: 18, backgroundColor: colors.grey, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'baseline' },
  moneyText: { fontFamily: fonts.bold, fontSize: 34, letterSpacing: -1, color: colors.ink, fontVariant: ['tabular-nums'] },
  step: { flex: 1, height: 40, borderRadius: radius.pill, backgroundColor: colors.grey, alignItems: 'center', justifyContent: 'center' },
  takeBox: { borderRadius: 18, backgroundColor: colors.grey, paddingVertical: 6, paddingHorizontal: 14 },
  quickChip: { height: 32, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.grey, borderWidth: 1.5, borderColor: 'transparent', justifyContent: 'center' },
  field: { height: 50, borderRadius: 14, backgroundColor: colors.grey, paddingHorizontal: 14, fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  fieldText: { fontFamily: fonts.semibold, fontSize: 18, color: colors.ink, fontVariant: ['tabular-nums'] },
  impact: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.ink, paddingVertical: 2 },
  was: { fontFamily: fonts.regular, fontSize: 13, color: '#A9A9A1', textDecorationLine: 'line-through', fontVariant: ['tabular-nums'] },
});
