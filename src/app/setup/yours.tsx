import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Lock, LockOpen } from 'phosphor-react-native';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { CatBadge } from '@/components/CatIcon';
import { Kip } from '@/components/Kip';
import { BackButton, SetupScreen, Title, picked } from '@/components/setup/kit';
import { Slider } from '@/components/Slider';
import { Button } from '@/components/ui';
import { LIVING_FLOOR, applyEdit, funMinimum, goalNeed, livingFor, safetyNet, type Edit, type EditResult, type Locks } from '@/lib/brain';
import { CATEGORY, type IconKey } from '@/lib/budget';
import { getLang, rich, t } from '@/lib/i18n';
import { baht } from '@/lib/money';
import { useSetup, type SetupDraft } from '@/lib/setup/draft';
import { makePlan, monthYear, type Plan } from '@/lib/setup/plan';
import { colors, fonts, money, shadow } from '@/theme';

const names = (): Record<string, string> => ({
  rent: t('Rent'),
  bills: t('Other bills'),
  food: t('Food'),
  transport: t('Transport'),
  health: t('Health & personal'),
  household: t('Household'),
  fun: t('Fun money'),
  goal: '',
});

// Setup 5/6 · Make it yours. Change any number and Kip re-balances the rest — with money rules, not freely
// (see applyEdit in brain.ts). Kip says what moved where, and stops anything that wouldn't work in real life.
export default function SetupYours() {
  const { draft, update } = useSetup();
  const editing = Boolean(useLocalSearchParams<{ edit?: string }>().edit);
  const plan = makePlan(draft);
  const { inputs, result: r, short } = plan;
  const L = livingFor(inputs);
  const S = safetyNet(inputs);
  const monthly = draft.goalKind === 'monthly';
  const emergency = draft.goalKind === 'safety_net';
  const funMin = funMinimum(inputs.income);
  const need = monthly ? Infinity : goalNeed(inputs);
  const sliderMax = Math.max(0, Math.min(r.goal + Math.max(0, r.fun - funMin), need));
  const [note, setNote] = useState<NoteState | null>(null);
  const goalPatch = (g: number): Partial<SetupDraft> => (monthly ? { goalMonthly: g, goalPerMonth: null } : { goalPerMonth: g });
  const locks: Locks = draft.locks ?? { goal: false, fun: false };
  const NAMES = names();

  function toggle(k: keyof Locks) {
    Haptics.selectionAsync().catch(() => {});
    update({ locks: { ...locks, [k]: !locks[k] } });
    if (note?.blocked) setNote(null);
  }

  function edit(e: Edit, at: string, withLocks: Locks = locks) {
    const res = applyEdit(inputs, draft.budgetStyle, r.goal, e, withLocks);
    if (res.blocked > 0) {
      const amount = baht(res.blocked);
      const atMin = !withLocks.fun && r.fun <= funMin;
      setNote({
        at,
        text:
          withLocks.goal && withLocks.fun
            ? t('{short} and fun money are both locked — I can’t find {amount} without touching one of them. Nothing changed yet.', { short, amount })
            : withLocks.goal
              ? atMin
                ? t('{short} is locked, and fun is already at its minimum — I can’t find {amount} without touching it. Nothing changed yet.', { short, amount })
                : t('{short} is locked — I can’t find {amount} without touching it. Nothing changed yet.', { short, amount })
              : atMin
                ? t('Fun money is locked, and fun is already at its minimum — I can’t find {amount} without touching it. Nothing changed yet.', { amount })
                : t('Fun money is locked — I can’t find {amount} without touching it. Nothing changed yet.', { amount }),
        warn: true,
        blocked: { edit: e, locks: withLocks },
      });
      return;
    }
    let patch: Partial<SetupDraft> = {
      rent: res.inputs.rent,
      bills: res.inputs.bills,
      living: res.inputs.living ?? {},
      ...goalPatch(res.goal),
    };
    // Fun is locked, but money was freed that would land in fun: it goes to another living cost instead (food first),
    // and the person can move it (never to fun).
    const parked = withLocks.fun && res.toFun > 0 ? res.toFun : 0;
    if (parked) {
      const dest = at === 'food' ? 'transport' : 'food';
      const liv = { ...(patch.living ?? {}) };
      liv[dest] = (liv[dest] ?? L[dest]) + parked;
      patch = { ...patch, living: liv };
    }
    const after = makePlan({ ...draft, ...patch });
    update(patch);
    const lockedSay = withLocks.goal && (res.fromFun > 0 || res.toFun > 0) ? 'goal' : withLocks.fun && (res.fromGoal > 0 || res.toGoal > 0) ? 'fun' : null;
    const said = explain(res, plan, after, at);
    // English continues the sentence in lower case ("Japan is locked — ฿500 came from…"); Thai has no case.
    const rest = lockedSay && said && getLang() === 'en' ? said.charAt(0).toLowerCase() + said.slice(1) : said;
    let text = lockedSay && said ? (lockedSay === 'goal' ? t('{short} is locked — {rest}', { short, rest }) : t('Fun money is locked — {rest}', { rest })) : said;
    if (parked)
      text =
        at === 'food'
          ? t('Fun money is locked, so the {amount} goes to transport for now — move it below.', { amount: baht(parked) })
          : t('Fun money is locked, so the {amount} goes to food for now — move it below.', { amount: baht(parked) });
    // Money freed by lowering a cost (or fun): Kip puts it somewhere sensible, and the person can choose where instead.
    const freed = res.toGoal + res.toFun;
    const route =
      e.kind !== 'goal' && freed > 0
        ? {
            amount: freed,
            base: { rent: res.inputs.rent, bills: res.inputs.bills, living: res.inputs.living ?? {}, ...goalPatch(r.goal) },
            goalBefore: r.goal,
            from: at,
            picked: (parked ? (at === 'food' ? 'transport' : 'food') : res.toGoal >= res.toFun ? 'goal' : 'fun') as Dest,
          }
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
      const vars = { amount: baht(rt.amount), short, monthly: baht(after.result.goal) };
      text = monthly
        ? t('{amount} goes to {short} — now {monthly} a month.', vars)
        : after.result.goalMonths
          ? t('{amount} goes to {short} — now {monthly} a month, arriving {when}.', { ...vars, when: monthYear(after.due) })
          : t('{amount} goes to {short} — now {monthly} a month, arriving later.', vars);
    } else if (dest === 'fun') {
      const after = makePlan({ ...draft, ...patch });
      text = t('{amount} goes to fun money — now {fun} a month.', { amount: baht(rt.amount), fun: baht(after.result.fun) });
    } else {
      const liv = { ...(base.living ?? {}) };
      liv[dest] = (liv[dest] ?? L[dest]) + rt.amount;
      patch = { ...base, living: liv };
      text = t('{amount} goes to {dest} — now {now} a month.', { amount: baht(rt.amount), dest: NAMES[dest].toLowerCase(), now: baht(liv[dest] ?? 0) });
    }
    update(patch);
    setNote({ ...note, text, warn: false, route: { ...rt, picked: dest } });
  }

  function explain(res: EditResult, before: Plan, after: Plan, at: string): string {
    const out: string[] = [];
    const lim = res.limit;
    const when = (p: Plan) => (p.result.goalMonths ? monthYear(p.due) : t('not yet'));
    const moved = !monthly && before.due.getTime() !== after.due.getTime();
    if (lim?.why === 'floor')
      out.push(
        at === 'food'
          ? t('{name} can’t go below {amount} — that’s ฿150 a day, the least two simple meals cost. I set it there.', { name: NAMES[at], amount: baht(lim.value) })
          : t('{name} can’t go below {amount} — that’s what it realistically costs. I set it there.', { name: NAMES[at], amount: baht(lim.value) }),
      );
    if (lim?.why === 'goalMax')
      out.push(
        t('{amount} is the most for {short}. Any more and fun money drops under {funMin} — plans that tight usually break in the first month.', {
          amount: baht(lim.value),
          short,
          funMin: baht(funMin),
        }),
      );
    if (lim?.why === 'funMin') out.push(t('Fun money stays at least {funMin} — a plan with no fun gets dropped.', { funMin: baht(funMin) }));
    if (lim?.why === 'nothingLeft') out.push(t('That’s as high as it can go — fun money is at its minimum and {short} has nothing left to give.', { short }));
    if (res.fromFun > 0) out.push(t('{amount} came from fun money ({before} → {after}).', { amount: baht(res.fromFun), before: baht(before.result.fun), after: baht(after.result.fun) }));
    if (res.fromGoal > 0)
      out.push(
        moved
          ? t('{amount} came from {short}, so it moves from {before} to {after}.', { amount: baht(res.fromGoal), short, before: when(before), after: when(after) })
          : t('{amount} came from {short}.', { amount: baht(res.fromGoal), short }),
      );
    if (res.toGoal > 0)
      out.push(
        moved
          ? t('{short} gets the {amount} — now {monthly} a month, arriving {after} instead of {before}.', {
              short,
              amount: baht(res.toGoal),
              monthly: baht(after.result.goal),
              after: when(after),
              before: when(before),
            })
          : t('{short} gets the {amount} — now {monthly} a month.', { short, amount: baht(res.toGoal), monthly: baht(after.result.goal) }),
      );
    if (res.toFun > 0)
      out.push(
        moved
          ? t('{amount} goes back to fun money (now {fun}). {short} moves to {when}.', { amount: baht(res.toFun), fun: baht(after.result.fun), short, when: when(after) })
          : t('{amount} goes back to fun money (now {fun}).', { amount: baht(res.toFun), fun: baht(after.result.fun) }),
      );
    if (at === 'goal' && res.fromFun > 0 && moved) out.push(t('{short} now arrives {when}.', { short, when: when(after) }));
    if (res.short > 0)
      out.push(t('Rent and bills are now {amount} more than your income can carry after living costs. I’ll plan around it, but something has to change.', { amount: baht(res.short) }));
    return out.join(' ');
  }

  const when = monthly ? null : r.goalMonths ? monthYear(plan.due) : null;
  const headline = monthly
    ? t('→ {year} saved in a year · {daily} a day to spend', { year: baht(r.goal * 12), daily: baht(r.daily) })
    : when
      ? t('→ {short} in {when} · {daily} a day to spend', { short, when, daily: baht(r.daily) })
      : t('→ Nothing goes to {short} yet · {daily} a day to spend', { short, daily: baht(r.daily) });
  const kipFood = livingFor({ ...inputs, living: {} }).food;
  const noteFor = (at: string) =>
    note?.at === at ? (
      <Note
        note={note}
        short={short}
        locks={locks}
        onRoute={reroute}
        onUnlock={(k) => {
          if (!note.blocked) return;
          const next = { ...note.blocked.locks, [k]: false };
          update({ locks: next });
          edit(note.blocked.edit, note.at, next);
        }}
        onDismiss={() => setNote(null)}
      />
    ) : null;
  const row = (at: string, icon: IconKey, color: string, hint: string, value: number, e: (to: number) => Edit, warn = false, right?: React.ReactNode, readOnly = false) => (
    <Row
      icon={icon}
      color={color}
      name={NAMES[at]}
      hint={hint}
      value={value}
      warn={warn || (note?.blocked !== undefined && note.at === at)}
      onChange={readOnly ? undefined : (to) => edit(e(to), at)}
      note={noteFor(at)}
      right={right}
    />
  );
  const sliderLocked = locks.goal || locks.fun;

  return (
    <SetupScreen step={undefined} footer={<Button label={editing ? t('Update my plan') : t('Done')} disabled={r.goal <= 0} onPress={() => router.back()} />}>
      <BackButton />
      <Title>{t('Make it yours')}</Title>
      <Text style={styles.sub}>{t('Change any number — Kip re-balances the rest and tells you what moved.')}</Text>

      <View style={[styles.goalBox, locks.goal && { borderColor: colors.ink }]}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: 14,
              color: colors.ink,
            }}>
            {t('For {short} each month', { short })}
          </Text>
          <LockPill on={locks.goal} onPress={() => toggle('goal')} label={locks.goal ? t('Unlock {short}', { short }) : t('Lock {short}', { short })} />
        </View>
        <Text
          style={{
            fontFamily: fonts.bold,
            fontSize: 30,
            letterSpacing: -0.6,
            color: colors.ink,
            fontVariant: ['tabular-nums'],
          }}>
          {baht(r.goal)}
        </Text>
        <Slider
          value={r.goal}
          max={sliderLocked ? Math.max(r.goal, sliderMax) : sliderMax}
          locked={sliderLocked}
          onChange={(to) => edit({ kind: 'goal', to }, 'goal')}
          label={t('For {short} each month', { short })}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.tiny}>฿0</Text>
          <Text style={styles.tiny}>
            {locks.goal
              ? t('locked — tap Unlock to change it')
              : locks.fun
                ? t('fun money is locked, so this stays')
                : t('most {max} · keeps {funMin} for fun', { max: baht(sliderMax), funMin: baht(funMin) })}
          </Text>
        </View>
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 13,
            lineHeight: 18,
            color: colors.ink,
          }}>
          {headline}
          {locks.goal ? ` · ${t('stays put while locked')}` : ''}
        </Text>
        {noteFor('goal')}
      </View>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          paddingHorizontal: 4,
        }}>
        <Text style={styles.section}>{t('YOUR MONTH')}</Text>
        <Text style={styles.tiny}>{t('{income} in · every baht has a job', { income: baht(inputs.income) })}</Text>
      </View>
      <View style={styles.card}>
        {row('rent', 'rent', money.fixed, t('You told me'), inputs.rent, (to) => ({
          kind: 'cost',
          key: 'rent',
          to,
        }))}
        {row('bills', 'bill', money.fixed, t('Phone, internet, electricity, Netflix, YouTube…'), inputs.bills, (to) => ({ kind: 'cost', key: 'bills', to }))}
        {row(
          'food',
          'food',
          colors.lime,
          t('{perDay} a day · lowest ฿150', { perDay: baht(Math.round(L.food / 30)) }),
          L.food,
          (to) => ({ kind: 'cost', key: 'food', to }),
          L.food <= LIVING_FLOOR.food,
        )}
        {row('transport', 'travel', colors.sky, t('BTS/MRT, bus or bike fuel'), L.transport, (to) => ({ kind: 'cost', key: 'transport', to }))}
        {row('health', 'health', CATEGORY.health_beauty.color, t('Pharmacy, haircut, toiletries'), L.health, (to) => ({ kind: 'cost', key: 'health', to }))}
        {row('household', 'more', colors.grey, t('Laundry, small things'), L.household, (to) => ({ kind: 'cost', key: 'household', to }))}
        {!emergency && <Row icon="shield" color={colors.sage} name={t('Safety net')} hint={t('Always first · full at {amount}', { amount: baht(S.target) })} value={r.net} note={null} />}
        {r.learn > 0 && <Row icon="book" color={CATEGORY.learning.color} name={t('Learning')} hint={t('6 Jars: courses, books')} value={r.learn} note={null} />}
        {r.give > 0 && <Row icon="gift" color={CATEGORY.giving.color} name={t('Giving')} hint={t('6 Jars: family, merit, gifts')} value={r.give} note={null} />}
        {row(
          'fun',
          'fun',
          money.fun,
          locks.fun ? t('Locked — I won’t move it') : t('Nights out, treats, shopping · at least {amount}', { amount: baht(funMin) }),
          r.fun,
          (to) => ({ kind: 'fun', to }),
          false,
          <LockButton on={locks.fun} onPress={() => toggle('fun')} />,
          locks.fun,
        )}
      </View>

      <View style={styles.result}>
        <Text style={styles.section}>{t('IF YOU STICK TO THIS')}</Text>
        <Text style={styles.resultLine}>
          {monthly
            ? t('💰 {amount} saved for {short} in a year', { amount: baht(r.goal * 12), short })
            : when
              ? emergency
                ? t('🛟 Emergency fund full in {when}', { when })
                : t('✈︎ {short} in {when} — fully paid, no credit card', { short, when })
              : t('📌 {short} is pinned — every day under budget goes to it', { short })}
        </Text>
        {!emergency && r.net > 0 && <Text style={styles.resultLine}>{t('🛟 Safety net: {amount} by this time next year', { amount: baht(r.net * 12) })}</Text>}
        <Text style={styles.resultLine}>
          {r.netIn12 > 0 && !monthly
            ? rich('💰 **{saved}** saved in 12 months ({short} {goal} + safety net {net})', { saved: baht(r.savedIn12), short, goal: baht(r.goalIn12), net: baht(r.netIn12) }, semi)
            : rich('💰 **{saved}** saved in 12 months', { saved: baht(r.savedIn12) }, semi)}
        </Text>
      </View>
      {L.food !== kipFood && <Text style={styles.foot}>{t('Kip’s number for food is {amount}.', { amount: baht(kipFood) })}</Text>}
      <View style={styles.howLocks}>
        <Text style={styles.section}>{t('HOW LOCKS WORK')}</Text>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <View style={[styles.lockBtn, { backgroundColor: colors.ink, borderColor: colors.ink }]}>
            <Lock size={14} color="#FFFFFF" weight="fill" />
          </View>
          <Text
            style={{
              flex: 1,
              fontFamily: fonts.regular,
              fontSize: 12,
              lineHeight: 18,
              color: colors.ink,
            }}>
            {rich('**{short} locked** — changes come from fun money only.', { short }, semi)}
            {'\n'}
            {rich('**Fun locked** — changes come from {short}, and I show the new date.', { short }, semi)}
            {'\n'}
            {rich('**Both locked** — I ask you what to lower. I never move money quietly.', undefined, semi)}
          </Text>
        </View>
      </View>
      <View style={styles.heads}>
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: 13,
            color: colors.ink,
          }}>
          {t('This is your starting plan — it will change')}
        </Text>
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 12,
            lineHeight: 17,
            color: colors.ink,
          }}>
          {t(
            'Once you log for a few weeks, I’ll swap my guesses for your real numbers. Subscriptions (Netflix, YouTube, Spotify, apps) are the ones almost everyone underestimates — when a new one shows up, I’ll show you exactly what it does to {short}.',
            { short },
          )}
        </Text>
      </View>
    </SetupScreen>
  );
}

const semi = (s: string) => <Text style={{ fontFamily: fonts.semibold }}>{s}</Text>;

type Dest = 'goal' | 'food' | 'transport' | 'fun';
type NoteState = {
  at: string;
  text: string;
  warn: boolean;
  route?: {
    amount: number;
    base: Partial<SetupDraft>;
    goalBefore: number;
    from: string;
    picked: Dest;
  };
  /** Locks stopped the change: what was tried, so it can be re-run after unlocking. */
  blocked?: { edit: Edit; locks: Locks };
};
const DEST_COLOR: Record<Dest, string> = {
  goal: money.goalChoice,
  food: colors.lime,
  transport: colors.sky,
  fun: money.fun,
};

function Note({
  note,
  short,
  locks,
  onRoute,
  onUnlock,
  onDismiss,
}: {
  note: NoteState;
  short: string;
  locks: Locks;
  onRoute: (d: Dest) => void;
  onUnlock: (k: keyof Locks) => void;
  onDismiss: () => void;
}) {
  const rt = note.route;
  const NAMES = names();
  const dests = (['goal', 'food', 'transport', 'fun'] as Dest[]).filter((d) => d !== rt?.from && !(d === 'goal' && locks.goal) && !(d === 'fun' && locks.fun));
  return (
    <View style={[styles.note, note.warn && !rt && { backgroundColor: '#FBE3DA' }, !note.warn && !rt && { backgroundColor: colors.lime }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <Kip mood={note.warn && !rt ? 'careful' : 'happy'} size={26} />
        <Text
          style={{
            flex: 1,
            fontFamily: fonts.regular,
            fontSize: 12,
            lineHeight: 17,
            color: colors.ink,
          }}>
          {note.text}
        </Text>
      </View>
      {note.blocked && (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 6,
            paddingLeft: 34,
          }}>
          {note.blocked.locks.goal && (
            <Pressable onPress={() => onUnlock('goal')} style={[styles.unlock, { backgroundColor: colors.ink }]} accessibilityRole="button">
              <LockOpen size={13} color="#FFFFFF" weight="bold" />
              <Text style={[styles.unlockText, { color: '#FFFFFF' }]}>{t('Unlock {short}', { short })}</Text>
            </Pressable>
          )}
          {note.blocked.locks.fun && (
            <Pressable onPress={() => onUnlock('fun')} style={styles.unlock} accessibilityRole="button">
              <LockOpen size={13} color={colors.ink} weight="bold" />
              <Text style={styles.unlockText}>{t('Unlock fun')}</Text>
            </Pressable>
          )}
          <Pressable onPress={onDismiss} style={styles.unlock} accessibilityRole="button">
            <Text style={styles.unlockText}>{t('Keep it as it was')}</Text>
          </Pressable>
        </View>
      )}
      {rt && (
        <View style={{ gap: 6, paddingLeft: 34 }}>
          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: 12,
              color: colors.ink,
            }}>
            {t('Where should the {amount} go?', { amount: baht(rt.amount) })}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} accessibilityRole="radiogroup">
            {dests.map((d) => {
              const on = rt.picked === d;
              return (
                <Pressable key={d} onPress={() => onRoute(d)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.dest, on && picked(DEST_COLOR[d])]}>
                  <Text
                    style={{
                      fontFamily: on ? fonts.semibold : fonts.medium,
                      fontSize: 12,
                      color: colors.ink,
                    }}>
                    {d === 'goal' ? short : NAMES[d]}
                  </Text>
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
  right,
}: {
  icon: IconKey;
  color: string;
  name: string;
  hint: string;
  value: number;
  onChange?: (v: number) => void;
  warn?: boolean;
  note: React.ReactNode;
  right?: React.ReactNode;
}) {
  const [text, setText] = useState<string | null>(null);
  return (
    <View style={styles.row}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <CatBadge name={icon} color={color} size={34} />
        <View style={{ flex: 1, gap: 1 }}>
          <Text
            style={{
              fontFamily: fonts.medium,
              fontSize: 15,
              color: colors.ink,
            }}>
            {name}
          </Text>
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
        {right}
      </View>
      {note}
    </View>
  );
}

function LockPill({ on, onPress, label }: { on: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      style={[styles.lockPill, on && { backgroundColor: colors.ink, borderColor: colors.ink }]}>
      {on ? <Lock size={13} color="#FFFFFF" weight="fill" /> : <LockOpen size={13} color={colors.ink} weight="bold" />}
      <Text style={[styles.unlockText, on && { color: '#FFFFFF' }]}>{on ? t('Locked') : t('Lock')}</Text>
    </Pressable>
  );
}

function LockButton({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={on ? t('Unlock fun money') : t('Lock fun money')}
      style={[styles.lockBtn, on && { backgroundColor: colors.ink, borderColor: colors.ink }]}>
      {on ? <Lock size={14} color="#FFFFFF" weight="fill" /> : <LockOpen size={14} color={colors.ink} weight="bold" />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  lockPill: {
    height: 30,
    paddingLeft: 9,
    paddingRight: 11,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(17,17,17,0.18)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  lockBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(17,17,17,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -4,
  },
  unlock: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  unlockText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.ink },
  howLocks: {
    borderRadius: 16,
    backgroundColor: '#F8F6F4',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
  },
  sub: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    marginTop: -8,
  },
  goalBox: {
    borderRadius: 20,
    backgroundColor: colors.peach,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 6,
  },
  tiny: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 15,
    color: colors.muted,
  },
  section: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.muted,
  },
  card: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 2,
    ...shadow.card,
  },
  row: {
    paddingVertical: 9,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(17,17,17,0.06)',
  },
  amount: {
    height: 36,
    width: 104,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.grey,
    borderWidth: 1.5,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  amountInput: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    textAlign: 'right',
    padding: 0,
  },
  amountText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  note: { gap: 8, borderRadius: 14, backgroundColor: '#F8F6F4', padding: 10 },
  dest: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(17,17,17,0.12)',
    justifyContent: 'center',
  },
  result: {
    borderRadius: 18,
    backgroundColor: colors.lime,
    borderWidth: 1,
    borderColor: colors.ink,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 6,
  },
  resultLine: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    color: colors.ink,
  },
  heads: {
    borderRadius: 16,
    backgroundColor: colors.sky,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 4,
  },
  foot: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
    paddingHorizontal: 4,
  },
});
