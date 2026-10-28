import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { CatBadge } from '@/components/CatIcon';
import { Kip } from '@/components/Kip';
import { SetupScreen, Title, picked } from '@/components/setup/kit';
import { Slider } from '@/components/Slider';
import { Button } from '@/components/ui';
import { LIVING_FLOOR, applyEdit, funMinimum, livingFor, safetyNet, type Edit, type EditResult } from '@/lib/brain';
import type { IconKey } from '@/lib/budget';
import { baht } from '@/lib/money';
import { useSetup, type SetupDraft } from '@/lib/setup/draft';
import { makePlan, monthYear, type Plan } from '@/lib/setup/plan';
import { colors, fonts, shadow } from '@/theme';

const NAMES: Record<string, string> = { rent: 'Rent', bills: 'Other bills', food: 'Food', transport: 'Transport', health: 'Health & personal', household: 'Household', fun: 'Fun money', goal: '' };

// Setup 5/6 · Make it yours. Change any number and Kip re-balances the rest — with money rules, not freely
// (see applyEdit in brain.ts). Kip says what moved where, and stops anything that wouldn't work in real life.
export default function SetupYours() {
  const { draft, update } = useSetup();
  const plan = makePlan(draft);
  const { inputs, result: r, short } = plan;
  const L = livingFor(inputs);
  const S = safetyNet(inputs);
  const monthly = draft.goalKind === 'monthly';
  const emergency = draft.goalKind === 'safety_net';
  const funMin = funMinimum(inputs.income);
  const need = monthly ? Infinity : Math.max(0, inputs.goal.target - inputs.goal.saved);
  const sliderMax = Math.max(0, Math.min(r.goal + Math.max(0, r.fun - funMin), need));
  const [note, setNote] = useState<NoteState | null>(null);
  const goalPatch = (g: number): Partial<SetupDraft> => (monthly ? { goalMonthly: g, goalPerMonth: null } : { goalPerMonth: g });

  function edit(e: Edit, at: string) {
    const res = applyEdit(inputs, draft.budgetStyle, r.goal, e);
    const patch: Partial<SetupDraft> = { rent: res.inputs.rent, bills: res.inputs.bills, living: res.inputs.living ?? {}, ...goalPatch(res.goal) };
    const after = makePlan({ ...draft, ...patch });
    update(patch);
    const text = explain(res, plan, after, at);
    // Money freed by lowering a cost (or fun): Kip puts it somewhere sensible, and the person can choose where instead.
    const freed = res.toGoal + res.toFun;
    const route =
      e.kind !== 'goal' && freed > 0
        ? { amount: freed, base: { ...patch, ...goalPatch(r.goal) }, goalBefore: r.goal, from: at, picked: (res.toGoal >= res.toFun ? 'goal' : 'fun') as Dest }
        : undefined;
    setNote(text ? { at, text, warn: Boolean(res.limit || res.short), route } : null);
  }

  /** Send the freed money somewhere else: the goal, food, transport or fun money. Never bills. */
  function reroute(dest: Dest) {
    const rt = note?.route;
    if (!rt || !note) return;
    const base = rt.base;
    let patch: Partial<SetupDraft> = base;
    let text: string;
    if (dest === 'goal') {
      const add = Math.min(rt.amount, Math.max(0, need - rt.goalBefore));
      patch = { ...base, ...goalPatch(rt.goalBefore + add) };
      const after = makePlan({ ...draft, ...patch });
      text = `${baht(rt.amount)} goes to ${short} — now ${baht(after.result.goal)} a month${monthly ? '' : `, arriving ${after.result.goalMonths ? monthYear(after.due) : 'later'}`}.`;
    } else if (dest === 'fun') {
      const after = makePlan({ ...draft, ...patch });
      text = `${baht(rt.amount)} goes to fun money — now ${baht(after.result.fun)} a month.`;
    } else {
      const liv = { ...(base.living ?? {}) };
      liv[dest] = (liv[dest] ?? L[dest]) + rt.amount;
      patch = { ...base, living: liv };
      text = `${baht(rt.amount)} goes to ${NAMES[dest].toLowerCase()} — now ${baht(liv[dest] ?? 0)} a month.`;
    }
    update(patch);
    setNote({ ...note, text, warn: false, route: { ...rt, picked: dest } });
  }

  function explain(res: EditResult, before: Plan, after: Plan, at: string): string {
    const out: string[] = [];
    const lim = res.limit;
    const when = (p: Plan) => (p.result.goalMonths ? monthYear(p.due) : 'not yet');
    const moved = !monthly && before.due.getTime() !== after.due.getTime();
    if (lim?.why === 'floor') out.push(`${NAMES[at]} can’t go below ${baht(lim.value)}${at === 'food' ? ' — that’s ฿150 a day, the least two simple meals cost' : ' — that’s what it realistically costs'}. I set it there.`);
    if (lim?.why === 'goalMax') out.push(`${baht(lim.value)} is the most for ${short}. Any more and fun money drops under ${baht(funMin)} — plans that tight usually break in the first month.`);
    if (lim?.why === 'funMin') out.push(`Fun money stays at least ${baht(funMin)} — a plan with no fun gets dropped.`);
    if (lim?.why === 'nothingLeft') out.push(`That’s as high as it can go — fun money is at its minimum and ${short} has nothing left to give.`);
    if (res.fromFun > 0) out.push(`${baht(res.fromFun)} came from fun money (${baht(before.result.fun)} → ${baht(after.result.fun)}).`);
    if (res.fromGoal > 0) out.push(`${baht(res.fromGoal)} came from ${short}${moved ? `, so it moves from ${when(before)} to ${when(after)}` : ''}.`);
    if (res.toGoal > 0) out.push(`${short} gets the ${baht(res.toGoal)} — now ${baht(after.result.goal)} a month${moved ? `, arriving ${when(after)} instead of ${when(before)}` : ''}.`);
    if (res.toFun > 0) out.push(`${baht(res.toFun)} goes back to fun money (now ${baht(after.result.fun)}).${moved ? ` ${short} moves to ${when(after)}.` : ''}`);
    if (at === 'goal' && res.fromFun > 0 && moved) out.push(`${short} now arrives ${when(after)}.`);
    if (res.short > 0) out.push(`Rent and bills are now ${baht(res.short)} more than your income can carry after living costs. I’ll plan around it, but something has to change.`);
    return out.join(' ');
  }

  const when = monthly ? null : r.goalMonths ? monthYear(plan.due) : null;
  const headline = monthly
    ? `→ ${baht(r.goal * 12)} saved in a year · ${baht(r.daily)} a day to spend`
    : when
      ? `→ ${short} in ${when} · ${baht(r.daily)} a day to spend`
      : `→ Nothing goes to ${short} yet · ${baht(r.daily)} a day to spend`;
  const kipFood = livingFor({ ...inputs, living: {} }).food;
  const row = (at: string, icon: IconKey, color: string, hint: string, value: number, e: (to: number) => Edit, warn = false) => (
    <Row icon={icon} color={color} name={NAMES[at]} hint={hint} value={value} warn={warn} onChange={(to) => edit(e(to), at)} note={note?.at === at ? <Note note={note} short={short} onRoute={reroute} /> : null} />
  );

  return (
    <SetupScreen step={5} footer={<Button label="Looks good — write my promise" disabled={r.goal <= 0} onPress={() => router.push('/setup/sign')} />}>
      <Title>Make it yours</Title>
      <Text style={styles.sub}>Change any number — Kip re-balances the rest and tells you what moved.</Text>

      <View style={styles.goalBox}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>For {short} each month</Text>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 22, letterSpacing: -0.4, color: colors.ink, fontVariant: ['tabular-nums'] }}>{baht(r.goal)}</Text>
        </View>
        <Slider value={r.goal} max={sliderMax} onChange={(to) => edit({ kind: 'goal', to }, 'goal')} label={`For ${short} each month`} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.tiny}>฿0</Text>
          <Text style={styles.tiny}>most {baht(sliderMax)} · keeps {baht(funMin)} for fun</Text>
        </View>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.ink }}>{headline}</Text>
        {note?.at === 'goal' && <Note note={note} short={short} onRoute={reroute} />}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 4 }}>
        <Text style={styles.section}>YOUR MONTH</Text>
        <Text style={styles.tiny}>{baht(inputs.income)} in · every baht has a job</Text>
      </View>
      <View style={styles.card}>
        {row('rent', 'rent', colors.orange, 'You told me', inputs.rent, (to) => ({ kind: 'cost', key: 'rent', to }))}
        {row('bills', 'bill', colors.sand, 'Phone, internet, electricity, Netflix, YouTube…', inputs.bills, (to) => ({ kind: 'cost', key: 'bills', to }))}
        {row('food', 'food', colors.lime, `${baht(Math.round(L.food / 30))} a day · lowest ฿150`, L.food, (to) => ({ kind: 'cost', key: 'food', to }), L.food <= LIVING_FLOOR.food)}
        {row('transport', 'travel', colors.sky, 'BTS/MRT, bus or bike fuel', L.transport, (to) => ({ kind: 'cost', key: 'transport', to }))}
        {row('health', 'health', colors.lilac, 'Pharmacy, haircut, toiletries', L.health, (to) => ({ kind: 'cost', key: 'health', to }))}
        {row('household', 'more', colors.grey, 'Laundry, small things', L.household, (to) => ({ kind: 'cost', key: 'household', to }))}
        {!emergency && <Row icon="shield" color={colors.sage} name="Safety net" hint={`Always first · full at ${baht(S.target)}`} value={r.net} note={null} />}
        {r.learn > 0 && <Row icon="book" color={colors.roseBeige} name="Learning" hint="6 Jars: courses, books" value={r.learn} note={null} />}
        {r.give > 0 && <Row icon="gift" color={colors.pink} name="Giving" hint="6 Jars: family, merit, gifts" value={r.give} note={null} />}
        {row('fun', 'fun', colors.lavender, `Nights out, treats, shopping · at least ${baht(funMin)}`, r.fun, (to) => ({ kind: 'fun', to }))}
      </View>

      <View style={styles.result}>
        <Text style={styles.section}>IF YOU STICK TO THIS</Text>
        <Text style={styles.resultLine}>
          {monthly
            ? `💰 ${baht(r.goal * 12)} saved for ${short} in a year`
            : when
              ? emergency
                ? `🛟 Emergency fund full in ${when}`
                : `✈︎ ${short} in ${when} — fully paid, no credit card`
              : `📌 ${short} is pinned — every day under budget goes to it`}
        </Text>
        {!emergency && r.net > 0 && <Text style={styles.resultLine}>🛟 Safety net: {baht(r.net * 12)} by this time next year</Text>}
        <Text style={styles.resultLine}>
          💰 <Text style={{ fontFamily: fonts.semibold }}>{baht(r.savedIn12)}</Text> saved in 12 months
          {r.netIn12 > 0 && !monthly ? ` (${short} ${baht(r.goalIn12)} + safety net ${baht(r.netIn12)})` : ''}
        </Text>
      </View>
      {L.food !== kipFood && <Text style={styles.foot}>Kip’s number for food is {baht(kipFood)}.</Text>}
      <View style={styles.heads}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>This is your starting plan — it will change</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.ink }}>
          Once you log for a few weeks, I’ll swap my guesses for your real numbers. Subscriptions (Netflix, YouTube, Spotify, apps) are the ones almost everyone underestimates — when a new one shows up, I’ll show you exactly what it does to {short}.
        </Text>
      </View>
    </SetupScreen>
  );
}

type Dest = 'goal' | 'food' | 'transport' | 'fun';
type NoteState = {
  at: string;
  text: string;
  warn: boolean;
  route?: { amount: number; base: Partial<SetupDraft>; goalBefore: number; from: string; picked: Dest };
};
const DEST_COLOR: Record<Dest, string> = { goal: colors.peach, food: colors.lime, transport: colors.sky, fun: colors.lavender };

function Note({ note, short, onRoute }: { note: NoteState; short: string; onRoute: (d: Dest) => void }) {
  const rt = note.route;
  const dests = (['goal', 'food', 'transport', 'fun'] as Dest[]).filter((d) => d !== rt?.from);
  return (
    <View style={[styles.note, note.warn && !rt && { backgroundColor: '#FBE3DA' }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <Kip mood={note.warn && !rt ? 'careful' : 'happy'} size={26} />
        <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.ink }}>{note.text}</Text>
      </View>
      {rt && (
        <View style={{ gap: 6, paddingLeft: 34 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.ink }}>Where should the {baht(rt.amount)} go?</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} accessibilityRole="radiogroup">
            {dests.map((d) => {
              const on = rt.picked === d;
              return (
                <Pressable key={d} onPress={() => onRoute(d)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.dest, on && picked(DEST_COLOR[d])]}>
                  <Text style={{ fontFamily: on ? fonts.semibold : fonts.medium, fontSize: 12, color: colors.ink }}>{d === 'goal' ? short : NAMES[d]}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

function Row({
  icon,
  color,
  name,
  hint,
  value,
  onChange,
  warn,
  note,
}: {
  icon: IconKey;
  color: string;
  name: string;
  hint: string;
  value: number;
  onChange?: (v: number) => void;
  warn?: boolean;
  note: React.ReactNode;
}) {
  const [text, setText] = useState<string | null>(null);
  return (
    <View style={styles.row}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
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
              onBlur={() => {
                if (text !== null && Number(text || 0) !== value) onChange(Math.min(Number(text || 0), 9_999_999));
                setText(null);
              }}
              keyboardType="number-pad"
              returnKeyType="done"
              selectTextOnFocus
              style={[styles.amountText, styles.amountInput]}
              accessibilityLabel={name}
            />
          </View>
        ) : (
          <Text style={[styles.amountText, { paddingHorizontal: 12 }]}>{baht(value)}</Text>
        )}
      </View>
      {note}
    </View>
  );
}

const styles = StyleSheet.create({
  sub: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted, marginTop: -8 },
  goalBox: { borderRadius: 20, backgroundColor: colors.peach, paddingVertical: 14, paddingHorizontal: 16, gap: 6 },
  tiny: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 15, color: colors.muted },
  section: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.5, color: colors.muted },
  card: { borderRadius: 18, backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 2, ...shadow.card },
  row: { paddingVertical: 9, gap: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(17,17,17,0.06)' },
  amount: { height: 36, width: 104, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.grey, borderWidth: 1.5, borderColor: 'transparent', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  amountInput: { flex: 1, minWidth: 0, width: '100%', textAlign: 'right', padding: 0 },
  amountText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
  note: { gap: 8, borderRadius: 14, backgroundColor: '#F8F6F4', padding: 10 },
  dest: { height: 30, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: 'rgba(17,17,17,0.12)', justifyContent: 'center' },
  result: { borderRadius: 18, backgroundColor: colors.lime, borderWidth: 1, borderColor: colors.ink, paddingVertical: 14, paddingHorizontal: 16, gap: 6 },
  resultLine: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.ink },
  heads: { borderRadius: 16, backgroundColor: colors.sky, paddingVertical: 12, paddingHorizontal: 14, gap: 4 },
  foot: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted, paddingHorizontal: 4 },
});
