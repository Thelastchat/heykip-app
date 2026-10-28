// "Is it realistic?" for a goal with an amount and a date that doesn't fit as asked.
// 1 · Pick one: move the date (a month slider over comfort zones, Kip's pick marked) or keep the date (a smaller budget,
//     shown as a sum). 2 · Add-ons, tick any: money already saved, cutting delivery, a bonus — the card includes them.
// Money an add-on frees always goes to the goal. "No date, save every month" replaces the whole plan.
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Check } from 'phosphor-react-native';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { CatBadge } from '@/components/CatIcon';
import { KipSays, SetupScreen } from '@/components/setup/kit';
import { Button } from '@/components/ui';
import { livingFor, plan as splitMonth, room, verdict, type Inputs } from '@/lib/brain';
import type { IconKey } from '@/lib/budget';
import { baht } from '@/lib/money';
import { useSetup } from '@/lib/setup/draft';
import { typeInfo } from '@/lib/setup/goalTypes';
import { fullDate, inputsFrom, isoDay, monthYear, monthsFromNow, monthsUntil, parseDay, shortName } from '@/lib/setup/plan';
import { colors, fonts, radius } from '@/theme';

const ZONE = { too: colors.orange, tight: colors.peach, comfy: colors.lime } as const;
type Zone = keyof typeof ZONE;
type AddOn = 'saved' | 'delivery' | 'bonus';
type Mode = 'move' | 'keep' | 'nodate';

const r100 = (n: number) => Math.round(n / 100) * 100;
const comfyMonths = (i: Inputs) => Math.max(1, Math.ceil(Math.max(0, i.goal.target - i.goal.saved) / Math.max(room(i).comfortable, 100)));

export function FindWhatWorks() {
  const { draft, update } = useSetup();
  const base = inputsFrom(draft);
  const L = livingFor(base);
  const short = shortName(draft.goalTitle, draft.goalKind);
  const asked = draft.goalDue ? parseDay(draft.goalDue) : null;
  const askedMonths = draft.goalDue ? monthsUntil(draft.goalDue) : null;
  const v0 = verdict(base);
  const R0 = room(base);
  const t = typeInfo(draft.goalType, draft.goalKind);

  const [mode, setMode] = useState<Mode>('move');
  const [ticked, setTicked] = useState<Record<AddOn, boolean>>({ saved: false, delivery: false, bonus: false });
  const [savedExtra, setSavedExtra] = useState(10000);
  const [bonus, setBonus] = useState(10000);
  // A third less delivery (delivery ≈ 60% of food), never below the ฿150-a-day food floor.
  const deliveryCut = draft.leaks.includes('delivery') ? Math.max(0, Math.min(r100(L.food * 0.6 * 0.33), L.food - 4500)) : 0;
  const opts = { savedExtra, bonus, deliveryCut, L };

  const inputs = withAddOns(base, ticked, opts);
  const R = room(inputs);
  const need = Math.max(0, inputs.goal.target - inputs.goal.saved);
  const months = useMemo(() => {
    const fast = Math.max(1, Math.ceil(need / Math.max(R.most, 100)));
    const comfy = Math.max(1, Math.ceil(need / Math.max(R.comfortable, 100)));
    const lo = Math.max(1, Math.floor(fast * 0.6));
    const hi = Math.min(240, Math.max(comfy + Math.ceil(comfy * 0.4), fast + 6, askedMonths ?? 0));
    return { fast, comfy, lo, hi };
  }, [need, R.most, R.comfortable, askedMonths]);

  // Your own date if it now fits comfortably, otherwise Kip's pick. Re-snaps when add-ons change,
  // so money an add-on frees moves the goal closer instead of quietly becoming fun money.
  const snap = () => (askedMonths && askedMonths >= months.comfy ? askedMonths : months.comfy);
  const [pick, setPick] = useState<number>(snap);
  const tickKey = `${ticked.saved}${ticked.delivery}${ticked.bonus}${savedExtra}${bonus}`;
  useEffect(() => setPick(snap()), [tickKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep my date: the budget becomes what you'll really have by then (never more than the goal).
  const keepMonths = askedMonths ?? months.comfy;
  const keepBudget = Math.min(base.goal.target, inputs.goal.saved + R.comfortable * keepMonths);
  const keep = mode === 'keep' && askedMonths !== null;
  const m = keep ? keepMonths : Math.min(months.hi, Math.max(months.lo, pick));
  const effective: Inputs = keep ? { ...inputs, goal: { ...inputs.goal, target: keepBudget } } : inputs;
  const effNeed = Math.max(0, effective.goal.target - effective.goal.saved);
  const per = Math.ceil(effNeed / m / 100) * 100;
  const zone: Zone = per <= R.comfortable ? 'comfy' : per <= R.most ? 'tight' : 'too';
  const result = splitMonth({ ...effective, goal: { ...effective.goal, months: m } }, 'kip');
  const date = monthsFromNow(m, draft);
  const fullFits = keepBudget >= base.goal.target;
  const nTicked = (Object.keys(ticked) as AddOn[]).filter((k) => ticked[k]).length;

  const say =
    v0.kind === 'notByThen'
      ? `Honest answer: ${short}${asked ? ` by ${fullDate(asked)}` : ''} needs ${baht(v0.need)} a month — ${baht(v0.need - R0.most)} more than you can save. Pick how you’d like to fix it, then tick anything that helps.`
      : `${short}${asked ? ` by ${fullDate(asked)}` : ''} is possible, but tight — fun money drops to ${baht(v0.kind === 'tight' ? v0.funLeft : 0)}. Pick how you’d like to fix it, then tick anything that helps.`;

  function tick(k: AddOn) {
    Haptics.selectionAsync().catch(() => {});
    setTicked((o) => ({ ...o, [k]: !o[k] }));
  }
  function choose(next: Mode) {
    Haptics.selectionAsync().catch(() => {});
    setMode(next);
  }

  function go() {
    if (mode === 'nodate') {
      update({ goalType: draft.goalType ?? t.key, goalKind: 'monthly', goalMonthly: Math.max(500, R0.comfortable), goalTarget: null, goalDue: null, goalPerMonth: null });
    } else {
      update({
        goalDue: keep && draft.goalDue ? draft.goalDue : isoDay(date),
        goalSaved: effective.goal.saved,
        goalTarget: effective.goal.target,
        living: inputs.living ?? {},
        goalPerMonth: null,
      });
    }
    router.push('/setup/thinking');
  }

  // What an add-on does, measured against everything else you've ticked.
  const effect = (k: AddOn): string => {
    const without = withAddOns(base, { ...ticked, [k]: false }, opts);
    const withIt = withAddOns(base, { ...ticked, [k]: true }, opts);
    if (keep) {
      const gain = Math.min(base.goal.target, withIt.goal.saved + room(withIt).comfortable * keepMonths) - Math.min(base.goal.target, without.goal.saved + room(without).comfortable * keepMonths);
      return gain > 0 ? `+${baht(gain)} to your budget by ${asked ? fullDate(asked) : 'your date'}` : 'Your full budget already fits';
    }
    const sooner = comfyMonths(without) - comfyMonths(withIt);
    const lead = k === 'saved' ? 'Counts toward ' + short + ' from day one' : k === 'bonus' ? `A ${baht(bonus)} bonus` : `${baht(deliveryCut)} a month less delivery`;
    return sooner > 0 ? `${lead} · ${sooner} month${sooner > 1 ? 's' : ''} sooner` : lead;
  };

  const includes = [ticked.saved && `✓ ${baht(savedExtra)} saved`, ticked.delivery && `✓ Delivery −${baht(deliveryCut)}/mo`, ticked.bonus && `✓ ${baht(bonus)} bonus`].filter(Boolean) as string[];

  const button =
    mode === 'nodate'
      ? `Save ${baht(Math.max(500, R0.comfortable))} a month`
      : zone === 'too'
        ? 'Pick a later month'
        : keep && asked
          ? `Go with ${baht(effective.goal.target)} by ${monthYear(asked)}`
          : `Go with ${monthYear(date)}`;

  return (
    <SetupScreen step={3} footer={<Button label={button} disabled={mode !== 'nodate' && zone === 'too'} onPress={go} />}>
      <KipSays mood="careful">{say}</KipSays>
      <Text style={styles.h1} accessibilityRole="header">
        Find what works
      </Text>

      {mode !== 'nodate' ? (
        <>
          {askedMonths !== null && (
            <>
              <Text style={styles.section}>1 · PICK ONE</Text>
              <View style={styles.seg} accessibilityRole="radiogroup">
                {(
                  [
                    ['move', 'Move the date', `keep ${baht(base.goal.target)}`],
                    ['keep', 'Keep my date', draft.goalKind === 'trip' ? 'spend less' : 'aim for less'],
                  ] as const
                ).map(([k, title, sub]) => {
                  const sel = mode === k;
                  return (
                    <Pressable key={k} onPress={() => choose(k)} style={[styles.segItem, sel && styles.segOn]} accessibilityRole="radio" accessibilityState={{ selected: sel }}>
                      <Text style={[styles.segTitle, sel && { fontFamily: fonts.bold, color: colors.ink }]}>{title}</Text>
                      <Text style={styles.segSub}>{sub}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {keep && asked ? (
            <View style={[styles.dial, { backgroundColor: fullFits ? ZONE.comfy : colors.peach }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>By {fullDate(asked)} you’ll have</Text>
                <View style={styles.zoneTag}>
                  <Text style={styles.zoneTagText}>{fullFits ? 'FULL AMOUNT' : draft.goalKind === 'trip' ? 'SMALLER TRIP' : 'SMALLER GOAL'}</Text>
                </View>
              </View>
              <Text style={styles.date}>
                {baht(keepBudget)} <Text style={{ fontFamily: fonts.medium, fontSize: 14, letterSpacing: 0, color: 'rgba(17,17,17,0.6)' }}>of {baht(base.goal.target)}</Text>
              </Text>
              <View style={styles.sum}>
                <SumRow k="Already saved" v={baht(inputs.goal.saved)} />
                <SumRow k={`${baht(R.comfortable)} a month × ${keepMonths} month${keepMonths > 1 ? 's' : ''}`} v={baht(R.comfortable * keepMonths)} />
                <View style={{ height: 1, backgroundColor: 'rgba(17,17,17,0.08)' }} />
                <SumRow k={draft.goalKind === 'trip' ? 'Trip budget' : 'Your goal'} v={baht(keepBudget)} bold />
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Stat k="Save a month" v={baht(per)} />
                <Stat k="Spend a day" v={baht(result.daily)} />
                <Stat k="Fun a month" v={baht(result.fun)} />
              </View>
              {includes.length > 0 && <Includes items={includes} />}
              <Text style={styles.dialNote}>{fullFits ? `With your add-ons, the full ${baht(base.goal.target)} fits by your date.` : 'Tick an add-on below and the budget grows.'}</Text>
            </View>
          ) : (
            <View style={[styles.dial, { backgroundColor: ZONE[zone] }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>{short} in</Text>
                <View style={styles.zoneTag}>
                  <Text style={styles.zoneTagText}>{zone === 'comfy' ? 'COMFORTABLE' : zone === 'tight' ? 'TIGHT' : 'TOO MUCH'}</Text>
                </View>
              </View>
              <Text style={styles.date}>
                {monthYear(date)}
                {askedMonths === m && <Text style={{ fontFamily: fonts.semibold, fontSize: 15, letterSpacing: 0 }}> ✓ your date</Text>}
              </Text>
              <MonthDial lo={months.lo} hi={months.hi} value={m} fast={months.fast} comfy={months.comfy} locked={false} onChange={setPick} />
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Stat k="Save a month" v={baht(per)} />
                <Stat k="Spend a day" v={zone === 'too' ? '—' : baht(result.daily)} />
                <Stat k="Fun a month" v={zone === 'too' ? '—' : baht(result.fun)} sub={zone === 'tight' ? 'near the minimum' : undefined} />
              </View>
              {includes.length > 0 && <Includes items={includes} />}
              <Text style={styles.dialNote}>
                {zone === 'too'
                  ? `${baht(per)} a month is ${baht(per - R.most)} more than fits. Slide right, or tick something below.`
                  : nTicked > 0 && askedMonths === m
                    ? `With your ${nTicked === 1 ? 'add-on' : `${nTicked} add-ons`}, your date fits${zone === 'comfy' ? ' comfortably' : ''}.`
                    : 'Drag to try any month.'}
              </Text>
            </View>
          )}

          {
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 4, paddingTop: 4 }}>
              <Text style={styles.section}>{askedMonths !== null ? '2 · ' : ''}ADD-ONS · TICK ANY</Text>
              {nTicked > 0 && <Text style={styles.count}>{nTicked} ticked</Text>}
            </View>
          }
          <View style={{ gap: 8 }}>
            <AddOnRow icon="cash" color={colors.sage} title="I’ve saved some already" effect={effect('saved')} on={ticked.saved} onPress={() => tick('saved')}>
              <AmountInput value={savedExtra} onChange={setSavedExtra} label="Already saved" />
            </AddOnRow>
            {deliveryCut > 0 && <AddOnRow icon="food" color={colors.sky} title="Cut food delivery" effect={effect('delivery')} on={ticked.delivery} onPress={() => tick('delivery')} />}
            <AddOnRow icon="gift" color={colors.lavender} title="A bonus or side money" effect={effect('bonus')} on={ticked.bonus} onPress={() => tick('bonus')}>
              <AmountInput value={bonus} onChange={setBonus} label="Bonus" />
            </AddOnRow>
          </View>
        </>
      ) : (
        <View style={[styles.dial, { backgroundColor: colors.pink }]}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>No date — every month</Text>
          <Text style={styles.date}>
            {baht(Math.max(500, R0.comfortable))}
            <Text style={{ fontSize: 16 }}>/mo</Text>
          </Text>
          <Text style={styles.dialNote}>
            Into {short} every payday, comfortably. That’s {baht(Math.max(500, R0.comfortable) * 12)} in a year — I’ll show you how close it gets.
          </Text>
        </View>
      )}

      <Text style={[styles.section, { paddingTop: 6 }]}>OR</Text>
      <Pressable
        onPress={() => choose(mode === 'nodate' ? 'move' : 'nodate')}
        style={[styles.addon, mode === 'nodate' && { backgroundColor: colors.pink, borderColor: colors.ink }]}
        accessibilityRole="button">
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <CatBadge name="sparkle" color={mode === 'nodate' ? '#FFFFFF' : colors.pink} size={32} />
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={styles.addonTitle}>{mode === 'nodate' ? 'Back to a date' : 'No date — just save every month'}</Text>
            <Text style={styles.addonSub}>{mode === 'nodate' ? `Plan ${short} for a month instead` : `${baht(Math.max(500, R0.comfortable))} a month into ${short}, see how far it gets you`}</Text>
          </View>
        </View>
      </Pressable>
    </SetupScreen>
  );
}

function withAddOns(i: Inputs, on: Record<AddOn, boolean>, o: { savedExtra: number; bonus: number; deliveryCut: number; L: ReturnType<typeof livingFor> }): Inputs {
  let out: Inputs = { ...i, goal: { ...i.goal, months: null } };
  if (on.saved) out = { ...out, goal: { ...out.goal, saved: out.goal.saved + o.savedExtra } };
  if (on.bonus) out = { ...out, goal: { ...out.goal, saved: out.goal.saved + o.bonus } };
  if (on.delivery && o.deliveryCut > 0) out = { ...out, living: { ...out.living, food: Math.max(4500, o.L.food - o.deliveryCut) } };
  return out;
}

function Includes({ items }: { items: string[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.ink }}>Includes:</Text>
      {items.map((x) => (
        <View key={x} style={styles.chip}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.ink }}>{x}</Text>
        </View>
      ))}
    </View>
  );
}

function SumRow({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontFamily: bold ? fonts.semibold : fonts.regular, fontSize: bold ? 14 : 13, color: bold ? colors.ink : colors.muted }}>{k}</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: bold ? 14 : 13, color: colors.ink, fontVariant: ['tabular-nums'] }}>{v}</Text>
    </View>
  );
}

function MonthDial({ lo, hi, value, fast, comfy, locked, onChange }: { lo: number; hi: number; value: number; fast: number; comfy: number; locked: boolean; onChange: (m: number) => void }) {
  const [w, setW] = useState(0);
  const width = useRef(0);
  const last = useRef(value);
  const span = Math.max(1, hi - lo);
  const x = (mm: number) => ((Math.min(hi, Math.max(lo, mm)) - lo) / span) * w;
  const at = (px: number) => {
    const mm = Math.round(lo + Math.min(1, Math.max(0, px / (width.current || 1))) * span);
    if (mm !== last.current) {
      last.current = mm;
      Haptics.selectionAsync().catch(() => {});
      onChange(mm);
    }
  };
  const pan = Gesture.Pan()
    .runOnJS(true)
    .enabled(!locked)
    .minDistance(0)
    .onBegin((e) => at(e.x))
    .onUpdate((e) => at(e.x));
  const tooW = x(fast) - x(lo);
  const tightW = x(comfy) - x(fast);
  return (
    <View style={styles.dialBox}>
      <GestureDetector gesture={pan}>
        <View
          style={{ height: 46, justifyContent: 'flex-end', paddingBottom: 6 }}
          onLayout={(e) => {
            width.current = e.nativeEvent.layout.width;
            setW(e.nativeEvent.layout.width);
          }}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Goal month"
          accessibilityValue={{ min: lo, max: hi, now: value }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => !locked && onChange(Math.min(hi, Math.max(lo, value + (e.nativeEvent.actionName === 'increment' ? 1 : -1))))}>
          <View style={styles.track}>
            <View style={{ width: tooW, backgroundColor: ZONE.too }} />
            <View style={{ width: tightW, backgroundColor: ZONE.tight }} />
            <View style={{ flex: 1, backgroundColor: ZONE.comfy }} />
          </View>
          {w > 0 && (
            <View style={[styles.marker, { left: x(comfy) - 30 }]} pointerEvents="none">
              <Text style={styles.markerText}>KIP’S PICK</Text>
              <View style={{ width: 2, height: 10, backgroundColor: colors.ink }} />
            </View>
          )}
          {w > 0 && <View style={[styles.thumb, { left: x(value) - 14 }, locked && { opacity: 0.5 }]} />}
        </View>
      </GestureDetector>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={styles.zoneLabel}>Sooner · too much</Text>
        <Text style={styles.zoneLabel}>Tight</Text>
        <Text style={styles.zoneLabel}>Comfortable · later</Text>
      </View>
    </View>
  );
}

function Stat({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statK}>{k}</Text>
      <Text style={styles.statV}>{v}</Text>
      {sub ? <Text style={styles.statK}>{sub}</Text> : null}
    </View>
  );
}

function AddOnRow({ icon, color, title, effect, on, onPress, children }: { icon: IconKey; color: string; title: string; effect: string; on: boolean; onPress: () => void; children?: ReactNode }) {
  return (
    <View style={[styles.addon, on && { backgroundColor: color, borderColor: colors.ink }]}>
      <Pressable onPress={onPress} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={title}>
        <View style={[styles.box, on && styles.boxOn]}>{on && <Check size={14} color="#FFFFFF" weight="bold" />}</View>
        <CatBadge name={icon} color={on ? '#FFFFFF' : color} size={32} />
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={styles.addonTitle}>{title}</Text>
          <Text style={[styles.addonSub, on && { color: colors.ink }]}>{effect}</Text>
        </View>
      </Pressable>
      {on && children ? <View style={{ paddingLeft: 34 }}>{children}</View> : null}
    </View>
  );
}

function AmountInput({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <View style={styles.amount}>
      <Text style={styles.amountText}>฿</Text>
      <TextInput
        value={text ?? value.toLocaleString('en-US')}
        onFocus={() => setText(String(value))}
        onChangeText={(t) => setText(t.replace(/[^\d]/g, ''))}
        onBlur={() => {
          if (text !== null) onChange(Math.min(Number(text || 0), 9_999_999));
          setText(null);
        }}
        keyboardType="number-pad"
        selectTextOnFocus
        style={[styles.amountText, { flex: 1, padding: 0 }]}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  seg: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.pill, backgroundColor: colors.grey },
  segItem: { flex: 1, borderRadius: radius.pill, paddingVertical: 8, alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  segOn: { backgroundColor: '#FFFFFF', borderColor: colors.ink },
  segTitle: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  segSub: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  sum: { borderRadius: 14, backgroundColor: '#FFFFFF', paddingVertical: 10, paddingHorizontal: 12, gap: 6 },
  chip: { height: 24, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  count: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  addon: { borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(17,17,17,0.12)', backgroundColor: '#FFFFFF', paddingVertical: 12, paddingHorizontal: 14, gap: 10 },
  addonTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  addonSub: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.muted },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: '#C9C9C2', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  h1: { fontFamily: fonts.semibold, fontSize: 27, letterSpacing: -0.5, color: colors.ink },
  section: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.5, color: colors.muted, paddingHorizontal: 4, paddingTop: 4 },
  dial: { borderRadius: 22, borderWidth: 1.5, borderColor: colors.ink, padding: 14, gap: 10 },
  zoneTag: { height: 22, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  zoneTagText: { fontFamily: fonts.bold, fontSize: 11, color: colors.ink },
  date: { fontFamily: fonts.bold, fontSize: 32, letterSpacing: -0.8, color: colors.ink },
  dialBox: { borderRadius: 14, backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8, gap: 2 },
  track: { height: 10, borderRadius: radius.pill, overflow: 'hidden', flexDirection: 'row', marginBottom: 3 },
  marker: { position: 'absolute', top: 0, width: 60, alignItems: 'center' },
  markerText: { fontFamily: fonts.bold, fontSize: 9, color: '#FFFFFF', backgroundColor: colors.ink, borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  thumb: { position: 'absolute', bottom: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: colors.ink, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' },
  zoneLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  stat: { flex: 1, minWidth: 0, borderRadius: 14, backgroundColor: '#FFFFFF', paddingVertical: 9, paddingHorizontal: 11 },
  statK: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  statV: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink, fontVariant: ['tabular-nums'] },
  dialNote: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.ink },
  lever: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)',
  },
  amount: { alignSelf: 'flex-start', height: 36, minWidth: 130, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 4 },
  amountText: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
});
