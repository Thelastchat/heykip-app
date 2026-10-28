// "Is it realistic?" for a goal with an amount and a date that doesn't fit as asked.
// Instead of three fixed answers: one month slider with live numbers and comfort zones, plus other ways
// to make it work (a smaller budget, money already saved, cutting a leak, a bonus, or no date at all).
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Minus, Plus } from 'phosphor-react-native';
import { useMemo, useRef, useState, type ReactNode } from 'react';
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
type LeverKey = 'smaller' | 'saved' | 'delivery' | 'bonus' | 'nodate';

const r100 = (n: number) => Math.round(n / 100) * 100;

export function FindWhatWorks() {
  const { draft, update } = useSetup();
  const base = inputsFrom(draft);
  const L = livingFor(base);
  const short = shortName(draft.goalTitle, draft.goalKind);
  const asked = draft.goalDue ? parseDay(draft.goalDue) : null;
  const askedMonths = draft.goalDue ? monthsUntil(draft.goalDue) : null;
  const v0 = verdict(base);
  const R0 = room(base);

  const [on, setOn] = useState<Record<LeverKey, boolean>>({ smaller: false, saved: false, delivery: false, bonus: false, nodate: false });
  const [savedExtra, setSavedExtra] = useState(10000);
  const [bonus, setBonus] = useState(10000);
  // A third less delivery a month (delivery ≈ 60% of food), never below the ฿150-a-day food floor.
  const deliveryCut = draft.leaks.includes('delivery') ? Math.max(0, Math.min(r100(L.food * 0.6 * 0.33), L.food - 4500)) : 0;

  // The person's numbers with the levers applied.
  const lever = (k: LeverKey) => withLevers(base, { ...on, [k]: true }, { savedExtra, bonus, deliveryCut, L });
  const inputs = withLevers(base, on, { savedExtra, bonus, deliveryCut, L });
  const R = room(inputs);
  const need = Math.max(0, inputs.goal.target - inputs.goal.saved);
  const months = useMemo(() => {
    const fast = Math.max(1, Math.ceil(need / Math.max(R.most, 100)));
    const comfy = Math.max(1, Math.ceil(need / Math.max(R.comfortable, 100)));
    const lo = Math.max(1, Math.floor(fast * 0.6));
    const hi = Math.min(240, Math.max(comfy + Math.ceil(comfy * 0.4), fast + 6, askedMonths ?? 0));
    return { fast, comfy, lo, hi };
  }, [need, R.most, R.comfortable, askedMonths]);

  // Smaller budget keeps the asked date; the target becomes what fits comfortably by then.
  const smallerTarget = askedMonths ? Math.min(base.goal.target, inputs.goal.saved + R.comfortable * askedMonths) : base.goal.target;
  const [pick, setPick] = useState<number>(() => months.comfy);
  const m = on.smaller && askedMonths ? askedMonths : Math.min(months.hi, Math.max(months.lo, pick));
  const effective: Inputs = on.smaller ? { ...inputs, goal: { ...inputs.goal, target: smallerTarget } } : inputs;
  const effNeed = Math.max(0, effective.goal.target - effective.goal.saved);
  const per = Math.ceil(effNeed / m / 100) * 100;
  const zone: Zone = per <= R.comfortable ? 'comfy' : per <= R.most ? 'tight' : 'too';
  const result = splitMonth({ ...effective, goal: { ...effective.goal, months: m } }, 'kip');
  const date = monthsFromNow(m, draft);

  const t = typeInfo(draft.goalType, draft.goalKind);
  const say =
    v0.kind === 'notByThen'
      ? `Honest answer: ${short}${asked ? ` by ${fullDate(asked)}` : ''} needs ${baht(v0.need)} a month — ${baht(v0.need - R0.most)} more than you can save. Slide to find a date that feels right, or try another way below.`
      : `${short}${asked ? ` by ${fullDate(asked)}` : ''} is possible, but tight — fun money drops to ${baht(v0.kind === 'tight' ? v0.funLeft : 0)}. Slide to see how a little later feels.`;

  function toggle(k: LeverKey) {
    Haptics.selectionAsync().catch(() => {});
    setOn((o) => ({ ...o, [k]: !o[k] }));
  }

  function go() {
    if (on.nodate) {
      update({ goalType: draft.goalType ?? t.key, goalKind: 'monthly', goalMonthly: Math.max(500, R.comfortable), goalTarget: null, goalDue: null, goalPerMonth: null });
    } else {
      update({
        goalDue: on.smaller && draft.goalDue ? draft.goalDue : isoDay(date),
        goalSaved: effective.goal.saved,
        goalTarget: effective.goal.target,
        living: inputs.living ?? {},
        goalPerMonth: null,
      });
    }
    router.push('/setup/thinking');
  }

  // What each lever would do on its own, so people can see it before tapping.
  const preview = (k: LeverKey): string => {
    if (k === 'smaller') {
      if (!askedMonths) return 'Aim for less';
      if (smallerTarget >= base.goal.target) return `With the changes below, ${asked ? fullDate(asked) : 'your date'} already fits — slide to it.`;
      return `Keep ${asked ? fullDate(asked) : 'your date'} — ${baht(smallerTarget)} instead of ${baht(base.goal.target)}`;
    }
    if (k === 'nodate') return `${baht(R0.comfortable)} a month into ${short} — no deadline, see how far it gets you`;
    // Compare "everything else as it is, without this one" with "… plus this one".
    const without = withLevers(base, { ...on, [k]: false }, { savedExtra, bonus, deliveryCut, L });
    const Rw = room(without);
    const alt = lever(k);
    const Ra = room(alt);
    const comfyNow = Math.ceil(Math.max(0, without.goal.target - without.goal.saved) / Math.max(Rw.comfortable, 100));
    const comfyAlt = Math.ceil(Math.max(0, alt.goal.target - alt.goal.saved) / Math.max(Ra.comfortable, 100));
    const sooner = comfyNow - comfyAlt;
    const what = k === 'saved' ? `${baht(savedExtra)} already saved` : k === 'bonus' ? `A ${baht(bonus)} bonus or side money` : `Delivery ${baht(deliveryCut)} less a month`;
    return sooner > 0 ? `${what} = ${sooner} month${sooner > 1 ? 's' : ''} sooner, comfortably` : `${what} — a little more room each month`;
  };

  return (
    <SetupScreen
      step={3}
      footer={
        <Button
          label={on.nodate ? `Save ${baht(Math.max(500, R.comfortable))} a month` : zone === 'too' ? 'Pick a later month' : `Go with ${monthYear(date)}`}
          disabled={!on.nodate && zone === 'too'}
          onPress={go}
        />
      }>
      <KipSays mood="careful">{say}</KipSays>
      <Text style={styles.h1} accessibilityRole="header">
        Find what works
      </Text>

      {!on.nodate && (
        <View style={[styles.dial, { backgroundColor: ZONE[zone] }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>{short} in</Text>
            <View style={styles.zoneTag}>
              <Text style={styles.zoneTagText}>{zone === 'comfy' ? 'COMFORTABLE' : zone === 'tight' ? 'TIGHT' : 'TOO MUCH'}</Text>
            </View>
          </View>
          <Text style={styles.date}>{on.smaller && asked ? fullDate(asked) : monthYear(date)}</Text>
          <MonthDial lo={months.lo} hi={months.hi} value={m} fast={months.fast} comfy={months.comfy} locked={on.smaller} onChange={setPick} />
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Stat k="Save a month" v={baht(per)} />
            <Stat k="Spend a day" v={zone === 'too' ? '—' : baht(result.daily)} />
            <Stat k="Fun a month" v={zone === 'too' ? '—' : baht(result.fun)} sub={zone === 'tight' ? 'near the minimum' : undefined} />
          </View>
          <Text style={styles.dialNote}>
            {on.smaller
              ? `A ${baht(effective.goal.target)} budget keeps your date — ${baht(per)} a month fits comfortably.`
              : zone === 'too'
                ? `${baht(per)} a month is ${baht(per - R.most)} more than fits. Slide right, or try something below.`
                : askedMonths && m !== askedMonths && asked
                  ? `Drag to try any month. Your date (${fullDate(asked)}) ${months.fast <= askedMonths ? 'is tight' : `needs ${baht(Math.ceil(effNeed / askedMonths / 100) * 100)} a month`}.`
                  : 'Drag to try any month.'}
          </Text>
        </View>
      )}

      <Text style={styles.section}>{on.nodate ? 'NO DATE' : 'OR CHANGE SOMETHING ELSE · TAP TO TRY'}</Text>
      <View style={{ gap: 8 }}>
        {!on.nodate && askedMonths && (smallerTarget < base.goal.target || on.smaller) && (
          <Lever
            icon={t.icon}
            color={t.color}
            title={draft.goalKind === 'trip' ? 'Spend less on the trip' : 'Aim for a smaller amount'}
            effect={preview('smaller')}
            on={on.smaller}
            onPress={() => toggle('smaller')}
          />
        )}
        {!on.nodate && (
          <Lever icon="cash" color={colors.sage} title="I’ve saved some already" effect={preview('saved')} on={on.saved} onPress={() => toggle('saved')}>
            <AmountInput value={savedExtra} onChange={setSavedExtra} label="Already saved" />
          </Lever>
        )}
        {!on.nodate && deliveryCut > 0 && <Lever icon="food" color={colors.sky} title="Cut food delivery" effect={preview('delivery')} on={on.delivery} onPress={() => toggle('delivery')} />}
        {!on.nodate && (
          <Lever icon="gift" color={colors.lavender} title="Add a bonus or side money" effect={preview('bonus')} on={on.bonus} onPress={() => toggle('bonus')}>
            <AmountInput value={bonus} onChange={setBonus} label="Bonus" />
          </Lever>
        )}
        <Lever icon="sparkle" color={colors.pink} title="No date — save every month" effect={preview('nodate')} on={on.nodate} onPress={() => toggle('nodate')} />
      </View>
    </SetupScreen>
  );
}

function withLevers(i: Inputs, on: Record<LeverKey, boolean>, o: { savedExtra: number; bonus: number; deliveryCut: number; L: ReturnType<typeof livingFor> }): Inputs {
  let out: Inputs = { ...i, goal: { ...i.goal, months: null } };
  if (on.saved) out = { ...out, goal: { ...out.goal, saved: out.goal.saved + o.savedExtra } };
  if (on.bonus) out = { ...out, goal: { ...out.goal, saved: out.goal.saved + o.bonus } };
  if (on.delivery && o.deliveryCut > 0) out = { ...out, living: { ...out.living, food: Math.max(4500, o.L.food - o.deliveryCut) } };
  return out;
}

/** Months as a slider over coloured comfort zones, with Kip's pick marked. */
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

function Lever({ icon, color, title, effect, on, onPress, children }: { icon: IconKey; color: string; title: string; effect: string; on: boolean; onPress: () => void; children?: ReactNode }) {
  return (
    <View style={[styles.lever, on && { backgroundColor: color, borderColor: colors.ink, boxShadow: 'none' }]}>
      <Pressable onPress={onPress} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={title}>
        <CatBadge name={icon} color={on ? '#FFFFFF' : color} size={34} />
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>{title}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: on ? colors.ink : colors.muted }}>{effect}</Text>
        </View>
        {on ? <Minus size={16} color={colors.ink} weight="bold" /> : <Plus size={16} color={colors.muted} weight="bold" />}
      </Pressable>
      {on && children ? <View style={{ paddingLeft: 44 }}>{children}</View> : null}
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
