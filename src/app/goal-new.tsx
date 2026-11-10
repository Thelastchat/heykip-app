// New goal (More goals, Plus — approved "fridge door" mockup). Step 1: what it is (type, photo, name, how much, by
// when). Step 2: which goal comes first — Kip finds what the month can still save (shopping and fun, never below
// their minimum) and the timeline shows when each goal lands. Nothing is saved until "Pin {goal}".
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { BookmarkSimple, Camera } from 'phosphor-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormScroll } from '@/components/FormScroll';
import { KeyboardSafe } from '@/components/KeyboardSafe';
import { Kip } from '@/components/Kip';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AmountRow, Delta, DueRow } from '@/components/goals/GoalFields';
import { Timeline, type Lane } from '@/components/goals/Timeline';
import { iconOf, liteOf, nameOf } from '@/components/goals/bits';
import { Glass } from '@/components/glow/Glass';
import { GlowBackground } from '@/components/glow/GlowBackground';
import { Squish } from '@/components/glow/motion';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { dailyOf } from '@/lib/budget';
import { arrivals, assess, goalTotal, MAX_GOALS, monthsBetween, newFirst, planNew, renameSplit, splitOf, type First, type Fix } from '@/lib/goals';
import { renamed } from '@/lib/goalEdit';
import { monthNumbers, useHome } from '@/lib/home';
import { t } from '@/lib/i18n';
import { goalTypeIcon3D, ICON3D, type Icon3D } from '@/lib/icons3d';
import { baht } from '@/lib/money';
import { useMonth } from '@/lib/month';
import { smallPhoto } from '@/lib/photos';
import { GOAL_TYPES, typeInfo, type GoalTypeKey } from '@/lib/setup/goalTypes';
import { isoDay, monthYear, ordinal, parseDay } from '@/lib/setup/plan';
import { supabase } from '@/lib/supabase';
import { colors, fonts, pinColors, themed, whiteA } from '@/theme';

// Most-picked first; the safety net has its own place.
const ORDER: GoalTypeKey[] = ['gadget', 'trip', 'concert', 'beauty', 'clothes', 'home', 'car', 'learning', 'health', 'wedding', 'family', 'gift', 'card', 'monthly', 'other'];
const TYPES = ORDER.map((k) => GOAL_TYPES.find((x) => x.key === k)).filter((x): x is (typeof GOAL_TYPES)[number] => !!x);
const sameMonth = (a: Date | null | undefined, b: Date | null | undefined) => !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

export default function GoalNew() {
  const insets = useSafeAreaInsets();
  const { session, refreshProfile } = useAuth();
  const { month, save } = useMonth();
  const { goals, spent, reload } = useHome(month);

  const [step, setStep] = useState<'what' | 'first'>('what');
  const [type, setType] = useState<GoalTypeKey>('gadget');
  const [photo, setPhoto] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState<number | null>(null);
  const [due, setDue] = useState<string | null>(null);
  const [monthlyAmt, setMonthlyAmt] = useState<number | null>(1000);
  const [first, setFirst] = useState<First>('old');
  const [fix, setFix] = useState<Fix>('later');
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [fromRow, setFromRow] = useState<{ id: string; photo: string | null } | null>(null);

  // Pinning a goal from "For later": start from what was saved.
  useEffect(() => {
    if (!from) return;
    supabase
      .from('goals')
      .select('id, title, goal_type, target_amount, monthly_amount, due_date, photo_url')
      .eq('id', from)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setFromRow({ id: data.id as string, photo: (data.photo_url as string | null) ?? null });
        setType(((data.goal_type as GoalTypeKey | null) ?? 'other') as GoalTypeKey);
        setTitle((data.title as string) ?? '');
        setTarget(data.monthly_amount ? null : Number(data.target_amount));
        setMonthlyAmt(data.monthly_amount ? Number(data.monthly_amount) : 1000);
        setDue((data.due_date as string | null) && parseDay(data.due_date as string).getTime() > Date.now() ? (data.due_date as string) : null);
      });
  }, [from]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const info = typeInfo(type);
  const monthly = info.kind === 'monthly';
  const name = title.trim() || info.example;
  const ok = !!title.trim() && (monthly ? (monthlyAmt ?? 0) > 0 : (target ?? 0) > 0 && !!due && parseDay(due).getTime() > Date.now());
  const lites = useMemo(() => goals.map(liteOf), [goals]);
  const full = goals.length >= MAX_GOALS;

  const isCard = type === 'card' && goals.length > 0;
  const ng = useMemo(() => ({ target: target ?? 0, due: monthly ? null : due, monthly: monthly ? monthlyAmt : null, kind: info.kind }), [target, due, monthly, monthlyAmt, info.kind]);
  // Kip's read on this goal: both orders, Kip's pick, and whether it fits at all.
  const a = useMemo(() => (month && ok ? assess(month, lites, ng, { card: isCard }) : null), [month, ok, lites, ng, isCard]);
  const plan = useMemo(() => {
    if (!a || !month) return null;
    if (!a.fits) return fix === 'later' ? a.old : fix === 'smaller' && a.smaller ? planNew(month, lites, { ...ng, target: a.smaller }, 'old') : null;
    return isCard || first === 'new' ? a.neu : a.old;
  }, [a, month, fix, first, isCard, lites, ng]);
  // The other order too, so the timeline's axis stays still while the ends move.
  const other = a ? (plan === a.neu ? a.old : a.neu) : null;
  const until = useMemo(() => {
    const all = [...(plan?.arrive.values() ?? []), ...(other?.arrive.values() ?? [])].filter((d): d is Date => !!d);
    return all.length ? new Date(Math.max(...all.map((d) => d.getTime()))) : null;
  }, [plan, other]);
  // Before: when the goals you have arrive now (for the marks on the timeline).
  const before = useMemo(() => (month ? arrivals(lites, splitOf(month, lites), month.payday) : new Map<string, Date | null>()), [month, lites]);

  if (!month || full) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top + 12, paddingHorizontal: 20 }}>
        <GlowBackground />
        <ScreenHeader title={t('New goal')} close />
        {full && <Text style={[styles.note, { marginTop: 24 }]}>{t('You have 3 goals pinned — that’s the most. Finish or remove one to pin another.')}</Text>}
      </View>
    );
  }

  const g1 = goals[0];
  const g1Name = g1 ? nameOf(g1) : '';
  const needsChoice = !!a && a.fits && a.needsChoice;
  const g1Before = g1 ? before.get(g1.id) : null;
  const g1After = g1 && plan ? plan.arrive.get(g1.id) : null;
  const moved = g1Before && g1After ? monthsBetween(g1Before, g1After) : 0;
  const payLine = (amount: number) =>
    month.payday ? t('{amount} every {day}', { amount: baht(amount), day: ordinal(month.payday), n: month.payday }) : t('{amount} a month', { amount: baht(amount) });
  const daily = plan ? [monthNumbers(month, spent).dailyToday, monthNumbers(plan.month, spent).dailyToday] : null;
  const newArrives = plan?.arrive.get(plan.newId) ?? null;

  const pickName = a?.pick === 'new' ? name : g1Name;
  const say = !a
    ? ''
    : !a.fits
      ? lites.some((g) => g.kind !== 'monthly')
        ? t('{goal} by {date} needs {amount} a month. Your pay can’t fit that next to {first}. Here’s what can work:', {
            goal: name,
            date: monthYear(parseDay(due!)),
            amount: baht(a.old.need ?? 0),
            first: g1Name,
          })
        : t('{goal} by {date} needs {amount} a month. Your pay can’t fit that right now. Here’s what can work:', { goal: name, date: monthYear(parseDay(due!)), amount: baht(a.old.need ?? 0) })
      : !plan
        ? ''
        : isCard
          ? (plan.amounts.get(g1?.id ?? '') ?? 0) === 0
            ? t('Card debt costs interest every month, so I put it first — paid off by {date}. {first} waits until then.', { date: newArrives ? monthYear(newArrives) : '', first: g1Name })
            : t('Card debt costs interest every month, so I put it first — paid off by {date}.', { date: newArrives ? monthYear(newArrives) : '' })
          : needsChoice && first === a.pick
            ? a.pick === 'new'
              ? moved > 0
                ? t('I’d do {goal} first: a finished goal by {date}, and {first} moves {n} months.', { goal: name, date: newArrives ? monthYear(newArrives) : '', first: g1Name, n: moved })
                : t('I’d do {goal} first: a finished goal by {date}, and {first} still lands {when}.', {
                    goal: name,
                    date: newArrives ? monthYear(newArrives) : '',
                    first: g1Name,
                    when: g1After ? monthYear(g1After) : '',
                  })
              : t('I’d keep {first} first: it’s finished by {date}, then {goal} speeds up.', { first: g1Name, date: g1After ? monthYear(g1After) : '', goal: name })
            : plan.need === null
              ? t('I found {amount} a month for {goal} without touching food, transport or bills.', { amount: baht(plan.amount), goal: name })
              : !needsChoice
                ? t('{goal} needs {amount} a month — I found it in shopping and fun.', { goal: name, amount: baht(plan.need) })
                : first === 'new'
                  ? t('{goal} by {date} needs {amount} a month, so {first} slows down for now.', { goal: name, date: monthYear(parseDay(due!)), amount: baht(plan.need), first: g1Name })
                  : plan.found > 0
                    ? t('I found {amount} a month for {goal}. Which one should arrive first?', { amount: baht(plan.found), goal: name })
                    : t('Shopping and fun are already at their minimum, so {goal} starts when {first} is done — or it can go first.', { goal: name, first: g1Name });

  const lanesInPinOrder: Lane[] = plan
    ? [
        ...goals.map((g, i) => ({
          id: g.id,
          name: nameOf(g),
          pin: pinColors[isCard ? i + 1 : i] ?? pinColors[2],
          icon: iconOf(g),
          arrives: plan.arrive.get(g.id) ?? null,
          was: before.get(g.id) ?? null,
          monthly: g.kind === 'monthly',
          later: !sameMonth(plan.arrive.get(g.id), before.get(g.id)) && (plan.arrive.get(g.id)?.getTime() ?? Infinity) > (before.get(g.id)?.getTime() ?? 0),
        })),
        { id: plan.newId, name, pin: isCard ? pinColors[0] : (pinColors[goals.length] ?? pinColors[2]), icon: goalTypeIcon3D(type), arrives: newArrives, monthly },
      ]
    : [];

  // Card debt sits at pin 1, so it leads the timeline too.
  const lanes = isCard && lanesInPinOrder.length ? [lanesInPinOrder[lanesInPinOrder.length - 1], ...lanesInPinOrder.slice(0, -1)] : lanesInPinOrder;

  async function pickPhoto() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 1 });
    if (!r.canceled && r.assets[0]) setPhoto(r.assets[0].uri);
  }

  async function pin() {
    if (!a || !session || !month || busy) return;
    if (!plan && !(a && !a.fits && fix === 'someday')) return;
    setBusy(true);
    setError(null);
    const uid = session.user.id;
    try {
      let photoPath: string | null = null;
      if (photo) {
        const small = await smallPhoto(photo, 1080);
        const path = `${uid}/goal-${Date.now()}.${small.ext}`;
        const { error: e } = await supabase.storage.from('goal-photos').upload(path, small.bytes, { contentType: small.contentType, upsert: false });
        if (e) throw new Error(t('Couldn’t upload your photo: {reason}', { reason: e.message }));
        photoPath = `goal-photos/${path}`;
      }
      const someday = !a.fits && fix === 'someday';
      const smallerTarget = !a.fits && fix === 'smaller' ? a.smaller : null;
      // Card debt goes to pin 1: the others move down a pin first (last one first, so pins never clash).
      if (isCard && !someday)
        for (let i = goals.length - 1; i >= 0; i--) {
          const { error: e0 } = await supabase
            .from('goals')
            .update({ position: i + 2, pin_color: pinColors[i + 1] })
            .eq('id', goals[i].id);
          if (e0) throw new Error(t('Couldn’t save: {msg}', { msg: e0.message }));
        }
      const position = someday ? null : isCard ? 1 : goals.length + 1;
      const row = {
        user_id: uid,
        title: title.trim(),
        kind: info.kind,
        goal_type: type,
        target_amount: monthly ? (monthlyAmt ?? 0) * 12 : (smallerTarget ?? target),
        monthly_amount: monthly ? monthlyAmt : null,
        due_date: monthly ? null : someday ? due : newArrives ? isoDay(newArrives) : due,
        pin_color: position ? pinColors[position - 1] : null,
        position,
        status: someday ? 'someday' : 'active',
        ...(photoPath ? { photo_url: photoPath } : {}),
      };
      const { data, error: e } = fromRow
        ? await supabase.from('goals').update(row).eq('id', fromRow.id).select('id').single()
        : await supabase
            .from('goals')
            .insert({ ...row, saved_amount: 0 })
            .select('id')
            .single();
      if (e || !data) throw new Error(t('Couldn’t pin your goal: {reason}', { reason: e?.message ?? '' }));
      if (someday || !plan) {
        await reload();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        return router.canGoBack() ? router.back() : router.replace('/goals');
      }
      // Goals that now land later get their new date, so every screen tells the truth.
      for (const g of goals) {
        const a = plan.arrive.get(g.id);
        if (g.kind !== 'monthly' && a && !sameMonth(a, g.due ? parseDay(g.due) : null))
          await supabase
            .from('goals')
            .update({ due_date: isoDay(a) })
            .eq('id', g.id);
      }
      const named = renameSplit(plan.month, plan.newId, data.id as string);
      const next = isCard ? renamed(newFirst(named, data.id as string), title.trim()) : named;
      await save(next);
      await supabase
        .from('profiles')
        .update({ daily_budget: dailyOf(next) })
        .eq('id', uid);
      await reload();
      refreshProfile();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.canGoBack() ? router.back() : router.replace('/goals');
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <KeyboardSafe style={{ flex: 1 }}>
      <GlowBackground />
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20 }}>
        {step === 'what' ? (
          <ScreenHeader title={t('New goal')} close />
        ) : (
          <Pressable onPress={() => setStep('what')} accessibilityRole="button" accessibilityLabel={t('Back')}>
            <View pointerEvents="none">
              <ScreenHeader title={t('New goal')} />
            </View>
          </Pressable>
        )}
      </View>

      {step === 'what' ? (
        <FormScroll contentContainerStyle={{ paddingTop: 16, gap: 16, paddingBottom: 120 + insets.bottom }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
            {TYPES.map((x) => {
              const on = x.key === type;
              return (
                <Squish key={x.key} onPress={() => setType(x.key)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={x.label}>
                  <Glass radius={22} tint={on ? colors.lime : undefined} innerStyle={[styles.type, on && styles.typeOn]}>
                    <Image source={ICON3D[goalTypeIcon3D(x.key)]} style={{ width: 36, height: 36 }} contentFit="contain" />
                    <Text style={[styles.typeText, on && { fontFamily: fonts.medium, color: colors.onAccent }]}>{x.label}</Text>
                  </Glass>
                </Squish>
              );
            })}
          </ScrollView>

          <View style={{ paddingHorizontal: 20, gap: 16 }}>
            <Pressable onPress={pickPhoto} style={[styles.cover, { backgroundColor: info.color }]} accessibilityRole="button" accessibilityLabel={photo ? t('Change photo') : t('Add a photo')}>
              {photo ? (
                <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                  <Image source={ICON3D[goalTypeIcon3D(type)]} style={{ width: 96, height: 96 }} contentFit="contain" />
                </View>
              )}
              <View style={styles.photoBtn}>
                <Camera size={16} color={colors.onAccent} />
                <Text style={styles.photoText}>{photo ? t('Change photo') : t('Add a photo')}</Text>
              </View>
            </Pressable>

            <Glass radius={24} innerStyle={{ paddingHorizontal: 16 }}>
              <View style={styles.row}>
                <Text style={styles.k}>{t('Name')}</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  maxLength={40}
                  placeholder={info.example}
                  placeholderTextColor={colors.faint}
                  style={[styles.v, styles.input]}
                  accessibilityLabel={t('Name')}
                />
              </View>
              {monthly ? (
                <AmountRow label={t('Each month')} value={monthlyAmt} was={null} onChange={setMonthlyAmt} />
              ) : (
                <>
                  <AmountRow label={t('How much')} value={target} was={null} onChange={setTarget} />
                  <DueRow value={due} onChange={setDue} />
                </>
              )}
            </Glass>
            <Text style={styles.note}>{t('Already saved some? Add it with “Put money in” after')}</Text>
          </View>
        </FormScroll>
      ) : (
        a && (
          <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 16, gap: 12, paddingBottom: 120 + insets.bottom }} showsVerticalScrollIndicator={false}>
            <View style={styles.kipRow}>
              <Kip mood={a.fits && plan && plan.amount > 0 ? 'happy' : 'careful'} size={40} />
              <Glass radius={20} style={{ flex: 1 }} innerStyle={styles.bub}>
                <Text style={styles.say}>{say}</Text>
              </Glass>
            </View>
            {a && !a.fits && (
              <View style={{ gap: 8 }}>
                {(
                  [
                    [
                      'later',
                      a.later ? t('Later: around {date}', { date: monthYear(a.later) }) : t('Later: when your other goals are done'),
                      t('{amount} now, more once {first} is done', { amount: baht(a.old.amount), first: g1Name || name }),
                      iconOf({ goalType: type, kind: info.kind }),
                    ],
                    ...(a.smaller
                      ? [['smaller', t('Smaller: {amount} by {date}', { amount: baht(a.smaller), date: monthYear(parseDay(due!)) }), t('A first step toward {goal}', { goal: name }), 'piggy']]
                      : []),
                    ['someday', t('Save it for later'), t('On your wish list, no money yet. Pin it when there’s room'), null],
                  ] as [Fix, string, string, Icon3D | null][]
                ).map(([k, title1, sub, icon]) => {
                  const on = fix === k;
                  return (
                    <Squish key={k} onPress={() => setFix(k)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={title1}>
                      <Glass radius={20} tint={on ? colors.lime : undefined} innerStyle={[styles.opt, on && styles.optOn]}>
                        {icon ? (
                          <Image source={ICON3D[icon]} style={{ width: 40, height: 40 }} contentFit="contain" />
                        ) : (
                          <View style={styles.bm}>
                            <BookmarkSimple size={18} color={on ? colors.onAccent : colors.muted} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.optTitle, on && { color: colors.onAccent }]}>{title1}</Text>
                          <Text style={[styles.optSub, on && { color: colors.onAccentMuted }]}>{sub}</Text>
                        </View>
                      </Glass>
                    </Squish>
                  );
                })}
              </View>
            )}
            {needsChoice && (
              <Glass radius={24} innerStyle={styles.seg}>
                {(['old', 'new'] as const).map((f) => {
                  const on = first === f;
                  return (
                    <Pressable key={f} onPress={() => setFirst(f)} style={[styles.segBtn, on && styles.segOn]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                      <Text style={[styles.segText, on && { color: colors.onAccent }]} numberOfLines={1}>
                        {t('{goal} first', { goal: f === 'old' ? g1Name : name })}
                      </Text>
                    </Pressable>
                  );
                })}
              </Glass>
            )}
            {needsChoice && <Text style={styles.pickNote}>{t('Kip’s pick: {goal} first · a finished goal sooner', { goal: pickName })}</Text>}
            {plan && (
              <>
                {a?.fits !== false && <Timeline lanes={lanes} until={until} />}
                <Glass radius={24} innerStyle={{ paddingHorizontal: 16 }}>
                  {daily && <Delta label={t('Today’s money')} was={daily[0] !== daily[1] ? baht(daily[0]) : null} now={baht(daily[1])} warn={daily[1] < daily[0]} />}
                  {[...goals.map((g) => ({ id: g.id, label: nameOf(g) })), { id: plan.newId, label: name }].map((x) => {
                    const was = splitOf(month, lites).get(x.id);
                    const now = plan.amounts.get(x.id) ?? 0;
                    return <Delta key={x.id} label={x.label} was={was !== undefined && was !== now ? baht(was) : null} now={payLine(now)} />;
                  })}
                </Glass>
                {a && a.share(plan) > 0.3 && (
                  <Text style={styles.warn}>
                    {t('That’s {pct}% of your pay going to saving. People often keep up only about half of what they plan, so under 30% is easier to stick to.', {
                      pct: Math.round(a.share(plan) * 100),
                    })}
                  </Text>
                )}
              </>
            )}
            <Text style={styles.note}>
              {plan && plan.amount > 0 && goalTotal(plan.month) > goalTotal(month)
                ? t('The {amount} comes from shopping and fun. Food, transport and bills stay the same', { amount: baht(goalTotal(plan.month) - goalTotal(month)) })
                : t('Food, transport and bills stay the same')}
            </Text>
            {error && <Text style={styles.warn}>{error}</Text>}
          </ScrollView>
        )
      )}

      <View style={[styles.foot, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]}>
        {step === 'what' ? (
          <Button
            label={t('Next')}
            disabled={!ok}
            onPress={() => {
              if (a) setFirst(a.pick); // start on Kip's pick
              setFix('later');
              setStep('first');
            }}
          />
        ) : (
          <Button
            label={
              busy
                ? t('Saving…')
                : a && !a.fits
                  ? fix === 'someday'
                    ? t('Save for later')
                    : fix === 'smaller' && a.smaller
                      ? t('Pin {goal} · {amount}', { goal: name, amount: baht(a.smaller) })
                      : t('Pin {goal} · {date}', { goal: name, date: newArrives ? monthYear(newArrives) : '' })
                  : t('Pin {goal}', { goal: name })
            }
            disabled={(!plan && !(a && !a.fits && fix === 'someday')) || busy}
            loading={busy}
            onPress={pin}
          />
        )}
      </View>
    </KeyboardSafe>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    type: { height: 44, paddingLeft: 4, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
    typeOn: { borderWidth: 1.5, borderColor: colors.onAccent },
    typeText: { fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
    cover: { height: 160, borderRadius: 24, overflow: 'hidden' },
    photoBtn: { position: 'absolute', right: 12, bottom: 12, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: whiteA(0.9), flexDirection: 'row', alignItems: 'center', gap: 6 },
    photoText: { fontFamily: fonts.medium, fontSize: 13, color: colors.onAccent },
    row: { minHeight: 64, paddingVertical: 10, justifyContent: 'center' },
    k: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
    v: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink, marginTop: 2 },
    input: { padding: 0, outlineStyle: 'none' } as never,
    note: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted, textAlign: 'center' },
    warn: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.orangeText, textAlign: 'center' },
    kipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    bub: { paddingVertical: 12, paddingHorizontal: 16, borderTopLeftRadius: 6 },
    say: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.ink },
    seg: { flexDirection: 'row', padding: 4 },
    pickNote: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: -4 },
    opt: { paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
    optOn: { borderWidth: 1.5, borderColor: colors.onAccent },
    optTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    optSub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 2 },
    bm: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(17,17,17,0.06)', alignItems: 'center', justifyContent: 'center' },
    segBtn: { flex: 1, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
    segOn: { backgroundColor: colors.lime, borderWidth: 1.5, borderColor: colors.onAccent },
    segText: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
    foot: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12 },
  }),
);
