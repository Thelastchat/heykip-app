// Edit goal (approved mockup): photo, name, how much, by when, and the promise note. Changing how much or by when
// re-plans the month — Kip asks whether to keep the date or the monthly amount, shows what changes, and nothing is
// saved until "Save changes". After saving, every screen shows the new goal at once (new photo file, fresh loads).
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, CaretRight } from 'phosphor-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardSafe } from '@/components/KeyboardSafe';
import { Kip } from '@/components/Kip';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Glass } from '@/components/glow/Glass';
import { GlowBackground } from '@/components/glow/GlowBackground';
import { Squish } from '@/components/glow/motion';
import { Button } from '@/components/ui';
import { AmountRow, Choice, Delta, DueRow } from '@/components/goals/GoalFields';
import { useAuth } from '@/lib/auth';
import { dailyOf } from '@/lib/budget';
import { changes, draftOf, preview, renamed, replanGoal, valid, type GoalDraft, type Keep } from '@/lib/goalEdit';
import { monthNumbers, useHome } from '@/lib/home';
import { arrivals, replanOne, splitOf, withoutGoal } from '@/lib/goals';
import { liteOf } from '@/components/goals/bits';
import { t } from '@/lib/i18n';
import { goalIcon3D, goalTypeIcon3D, ICON3D } from '@/lib/icons3d';
import { baht } from '@/lib/money';
import { useMonth } from '@/lib/month';
import { smallPhoto } from '@/lib/photos';
import { typeInfo } from '@/lib/setup/goalTypes';
import { isoDay, monthYear, parseDay } from '@/lib/setup/plan';
import { supabase } from '@/lib/supabase';
import { blackA, colors, fonts, inkA, pinColors, themed, whiteA } from '@/theme';

export default function GoalEdit() {
  const insets = useSafeAreaInsets();
  const { session, refreshProfile } = useAuth();
  const { month, save } = useMonth();
  const { goals, spent, reload } = useHome(month);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const goal = goals.find((g) => g.id === id) ?? goals[0];
  const idx = goal ? goals.indexOf(goal) : 0;
  const several = goals.length > 1;
  const lites = useMemo(() => goals.map(liteOf), [goals]);
  const [confirm, setConfirm] = useState(false);

  const [d, setD] = useState<GoalDraft | null>(null);
  const [photo, setPhoto] = useState<string | null>(null); // a newly picked photo (local), until saved
  const [promise, setPromise] = useState<string | null>(null);
  const [keep, setKeep] = useState<Keep>('date');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start from the goal as it is now (once it has loaded).
  useEffect(() => {
    if (goal && !d) {
      setD(draftOf(goal));
      setPromise((goal.promise ?? '').split('\n')[0]);
    }
  }, [goal, d]);

  const c = goal && d ? changes(goal, d) : null;
  const promiseChanged = !!goal && promise !== null && promise.trim() !== (goal.promise ?? '').split('\n')[0];
  const ok = !!goal && !!d && valid(goal, d);
  // Kip only asks "date or monthly amount?" when just the amount changed.
  const asks = !!c && c.target && !c.date;
  const mode: Keep = asks ? keep : 'date';
  // One goal: Kip re-plans the way Setup does. Several: only this goal's share (and the total) changes.
  const many = useMemo(
    () =>
      several && goal && d && month && c?.money && ok
        ? {
            date: replanOne(month, lites, goal.id, { target: d.target ?? 0, due: d.due, monthly: d.monthly }, 'date'),
            monthly: replanOne(month, lites, goal.id, { target: d.target ?? 0, due: d.due, monthly: d.monthly }, 'monthly'),
          }
        : null,
    [several, goal, d, month, c?.money, ok, lites],
  );
  const one = useMemo(() => (!several && goal && d && month && c?.money && ok ? replanGoal(month, goal, d, mode) : null), [several, goal, d, month, c?.money, ok, mode]);
  const plan = many ? { month: many[mode].month, due: many[mode].due } : one;
  const before = useMemo(() => (month ? arrivals(lites, splitOf(month, lites), month.payday) : null), [month, lites]);
  const p =
    plan && month && goal && d
      ? many
        ? {
            each: [many[mode].was, many[mode].now] as const,
            daily: [monthNumbers(month, spent).dailyToday, monthNumbers(many[mode].month, spent).dailyToday] as const,
            arrives: [before?.get(goal.id) ? monthYear(before.get(goal.id)!) : null, many[mode].arrive.get(goal.id) ? monthYear(many[mode].arrive.get(goal.id)!) : null] as const,
          }
        : preview(month, plan.month, goal, d, plan.due, spent)
      : null;
  const dirty = (!!c && (c.title || c.money)) || !!photo || promiseChanged;

  if (!goal || !d) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top + 12, paddingHorizontal: 20 }}>
        <GlowBackground />
        <ScreenHeader title={t('Edit goal')} close />
      </View>
    );
  }

  const monthly = goal.kind === 'monthly';
  const type = typeInfo(goal.goalType, goal.kind as never);
  const icon = goal.goalType ? goalTypeIcon3D(goal.goalType) : goalIcon3D(goal.kind);
  const set = (x: Partial<GoalDraft>) => setD((v) => (v ? { ...v, ...x } : v));

  async function pickPhoto() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 1 });
    if (!r.canceled && r.assets[0]) setPhoto(r.assets[0].uri);
  }

  async function saveAll() {
    if (!goal || !d || !session || !month || !ok) return;
    setBusy(true);
    setError(null);
    const uid = session.user.id;
    const fields: Record<string, unknown> = {};
    try {
      // 1. A new photo is a new file, so no phone can keep showing the old one.
      if (photo) {
        const small = await smallPhoto(photo, 1080);
        const path = `${uid}/goal-${Date.now()}.${small.ext}`;
        const { error: e } = await supabase.storage.from('goal-photos').upload(path, small.bytes, { contentType: small.contentType, upsert: false });
        if (e) throw new Error(t('Couldn’t upload your photo: {reason}', { reason: e.message }));
        fields.photo_url = `goal-photos/${path}`;
      }
      // 2. The goal row.
      if (c?.title) fields.title = d.title.trim();
      if (monthly && c?.each) Object.assign(fields, { monthly_amount: d.monthly, target_amount: (d.monthly ?? 0) * 12 });
      if (!monthly && c?.money) Object.assign(fields, { target_amount: d.target, due_date: plan?.due ?? d.due });
      if (Object.keys(fields).length) {
        const { error: e } = await supabase.from('goals').update(fields).eq('id', goal.id);
        if (e) throw new Error(t('Couldn’t save: {msg}', { msg: e.message }));
      }
      // 3. The promise: a new line keeps the signature and the second line ("if I slip…").
      if (promiseChanged && promise !== null) {
        const rest = (goal.promise ?? '').split('\n').slice(1);
        const { error: e } = await supabase
          .from('promises')
          .insert({ user_id: uid, goal_id: goal.id, text: [promise.trim(), ...rest].join('\n'), signature_url: goal.signatureKey, signed_at: new Date().toISOString() });
        if (e) throw new Error(t('Couldn’t save your promise: {reason}', { reason: e.message }));
      }
      // 4. The month: new numbers when money changed, or just the new name.
      if (plan) {
        await save(idx === 0 && c?.title ? renamed(plan.month, d.title.trim()) : plan.month);
        await supabase
          .from('profiles')
          .update({ daily_budget: dailyOf(plan.month) })
          .eq('id', uid);
      } else if (c?.title && idx === 0) {
        await save(renamed(month, d.title.trim()));
      }
      // 5. Every screen loads the goal fresh.
      await reload();
      refreshProfile();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.canGoBack() ? router.back() : router.replace('/goals');
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  /** Pin this goal first: it swaps places with goal 1, keeps its amount, and Kip's line and payday follow it. */
  async function makeFirst() {
    if (!goal || !month || idx === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const old = goals[0];
      const split = splitOf(month, lites);
      const steps: [string, Record<string, unknown>][] = [
        [goal.id, { position: null }],
        [old.id, { position: idx + 1, pin_color: pinColors[idx] }],
        [goal.id, { position: 1, pin_color: pinColors[0] }],
      ];
      for (const [gid, f] of steps) {
        const { error: e } = await supabase.from('goals').update(f).eq('id', gid);
        if (e) throw new Error(t('Couldn’t save: {msg}', { msg: e.message }));
      }
      const order = [goal, ...goals.filter((g) => g.id !== goal.id)].map((g) => ({ id: g.id, amount: split.get(g.id) ?? 0 }));
      await save(renamed({ ...month, goals: order }, goal.title));
      await reload();
      router.canGoBack() ? router.back() : router.replace('/goals');
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  /** Take the goal off the board. What's saved stays the person's; its monthly share goes to the first goal. */
  async function remove() {
    if (!goal || !month || !several || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: e } = await supabase.from('goals').update({ status: 'someday', position: null }).eq('id', goal.id);
      if (e) throw new Error(t('Couldn’t save: {msg}', { msg: e.message }));
      // The goals after it move up a pin.
      const rest = goals.filter((g) => g.id !== goal.id);
      for (let i = idx; i < rest.length; i++) {
        const { error: e2 } = await supabase
          .from('goals')
          .update({ position: i + 1, pin_color: pinColors[i] })
          .eq('id', rest[i].id);
        if (e2) throw new Error(t('Couldn’t save: {msg}', { msg: e2.message }));
      }
      const next = withoutGoal(month, lites, goal.id);
      await save(idx === 0 ? renamed(next, rest[0].title) : next);
      await reload();
      refreshProfile();
      router.canGoBack() ? router.back() : router.replace('/goals');
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const coverUri = photo ?? goal.photo;
  const nameNow = d.title.trim() || goal.title;

  return (
    <KeyboardSafe style={{ flex: 1 }}>
      <GlowBackground />
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20 }}>
        <ScreenHeader title={t('Edit goal')} close />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 16, gap: 16, paddingBottom: 120 + insets.bottom }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* photo */}
        <Pressable onPress={pickPhoto} style={[styles.cover, { backgroundColor: type.color }]} accessibilityRole="button" accessibilityLabel={t('Change photo')}>
          {coverUri ? (
            <Image source={{ uri: coverUri, cacheKey: photo ? undefined : (goal.photoKey ?? undefined) }} cachePolicy="disk" style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
              <Image source={ICON3D[icon]} style={{ width: 128, height: 128 }} contentFit="contain" />
            </View>
          )}
          <View style={styles.photoBtn}>
            <Camera size={16} color={colors.onAccent} />
            <Text style={styles.photoText}>{coverUri ? t('Change photo') : t('Add a photo')}</Text>
          </View>
        </Pressable>

        {/* name, how much, by when */}
        <Glass radius={24} innerStyle={styles.group}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.k}>{t('Name')}</Text>
              <TextInput
                value={d.title}
                onChangeText={(title) => set({ title })}
                maxLength={40}
                style={[styles.v, styles.input]}
                placeholder={t('Your goal')}
                placeholderTextColor={colors.faint}
                accessibilityLabel={t('Name')}
              />
            </View>
          </View>
          {monthly ? (
            <AmountRow label={t('Each month')} value={d.monthly} was={c?.each ? (goal.monthly ?? null) : null} onChange={(monthly) => set({ monthly })} />
          ) : (
            <>
              <AmountRow label={t('How much')} value={d.target} was={c?.target ? goal.target : null} onChange={(target) => set({ target })} />
              <DueRow value={d.due} onChange={(due) => set({ due })} />
            </>
          )}
        </Glass>
        {!monthly && d.target !== null && d.target <= goal.saved && <Text style={styles.warn}>{t('That’s less than you’ve already saved ({amount}).', { amount: baht(goal.saved) })}</Text>}

        {/* what it changes */}
        {plan && p && (
          <>
            <View style={styles.kipRow}>
              <Kip mood={p.daily[1] < p.daily[0] ? 'careful' : 'happy'} size={40} />
              <Glass radius={20} style={{ flex: 1 }} innerStyle={styles.bub}>
                <Text style={styles.say}>
                  {asks
                    ? (d.target ?? 0) > goal.target
                      ? t('{amount} more. Keep {date}, or keep saving the same each month?', { amount: baht((d.target ?? 0) - goal.target), date: goal.due ? monthYear(parseDay(goal.due)) : '' })
                      : t('{amount} less. Keep {date} and save less each month, or keep the same and get there sooner?', {
                          amount: baht(goal.target - (d.target ?? 0)),
                          date: goal.due ? monthYear(parseDay(goal.due)) : '',
                        })
                    : t('Here’s your month with the new {goal}.', { goal: nameNow })}
                </Text>
              </Glass>
            </View>
            {asks && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Choice
                  on={keep === 'date'}
                  title={t('Keep {date}', { date: goal.due ? monthYear(parseDay(goal.due)) : '' })}
                  sub={t('Save {amount} a month', { amount: baht(many ? many.date.now : replanGoal(month!, goal, d, 'date').month.goal.amount) })}
                  onPress={() => setKeep('date')}
                />
                <Choice
                  on={keep === 'monthly'}
                  title={t('Keep {amount} a month', { amount: baht(many ? many.monthly.was : month!.goal.amount + month!.goalExtra) })}
                  sub={t('Arrives {date}', { date: monthYear(parseDay((many ? many.monthly.due : replanGoal(month!, goal, d, 'monthly').due) ?? isoDay(new Date()))) })}
                  onPress={() => setKeep('monthly')}
                />
              </View>
            )}
            <Glass radius={24} innerStyle={styles.group}>
              <Delta label={t('Each month')} was={p.each[0] !== p.each[1] ? baht(p.each[0]) : null} now={baht(p.each[1])} />
              <Delta label={t('Daily money')} was={p.daily[0] !== p.daily[1] ? baht(p.daily[0]) : null} now={baht(p.daily[1])} warn={p.daily[1] < p.daily[0]} />
              {!monthly && <Delta label={t('Arrives')} was={p.arrives[0] !== p.arrives[1] ? p.arrives[0] : null} now={p.arrives[1] ?? t('When there’s room')} warn={!p.arrives[1]} />}
            </Glass>
            <Text style={styles.note}>{t('Nothing changes until you save')}</Text>
          </>
        )}

        {/* promise */}
        <View style={styles.paper}>
          <View style={styles.tape} />
          <Text style={styles.paperHead}>{t('My promise')}</Text>
          <TextInput
            value={promise ?? ''}
            onChangeText={setPromise}
            multiline
            maxLength={120}
            placeholder={t('Why this goal matters to you')}
            placeholderTextColor={blackA(0.35)}
            style={[styles.paperText, { outlineStyle: 'none' } as never]}
            accessibilityLabel={t('My promise')}
          />
        </View>
        {!monthly && <Text style={styles.note}>{t('Saved so far {amount} · that only changes with “Put money in”', { amount: baht(goal.saved) })}</Text>}
        {several && (
          <View style={{ gap: 8, marginTop: 8 }}>
            {idx > 0 && (
              <Squish onPress={makeFirst} accessibilityRole="button">
                <Glass radius={24} innerStyle={styles.action}>
                  <Text style={styles.actionText}>{t('Make this my first goal')}</Text>
                  <Text style={styles.actionSub}>{t('Kip’s line and payday follow your first goal')}</Text>
                </Glass>
              </Squish>
            )}
            {confirm ? (
              <Glass radius={24} innerStyle={[styles.action, { gap: 12 }]}>
                <Text style={styles.actionText}>{t('Remove {goal}?', { goal: nameNow })}</Text>
                <Text style={styles.actionSub}>
                  {goal.saved > 0
                    ? t('The {amount} you saved stays yours — HeyKip just stops planning for it. Its monthly share goes to your other goals.', { amount: baht(goal.saved) })
                    : t('Its monthly share goes to your other goals.')}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Squish onPress={() => setConfirm(false)} style={[styles.small, { backgroundColor: inkA(0.06) }]} accessibilityRole="button">
                    <Text style={styles.actionText}>{t('Keep it')}</Text>
                  </Squish>
                  <Squish onPress={remove} style={[styles.small, { backgroundColor: colors.orange }]} accessibilityRole="button">
                    <Text style={[styles.actionText, { color: colors.onAccent }]}>{t('Remove')}</Text>
                  </Squish>
                </View>
              </Glass>
            ) : (
              <Pressable onPress={() => setConfirm(true)} style={{ alignSelf: 'center', padding: 8 }} accessibilityRole="button">
                <Text style={[styles.actionSub, { color: colors.orangeText }]}>{t('Remove this goal')}</Text>
              </Pressable>
            )}
          </View>
        )}
        {error && <Text style={styles.warn}>{error}</Text>}
      </ScrollView>

      <View style={[styles.foot, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]}>
        <Button label={busy ? t('Saving…') : plan ? t('Save changes') : t('Save')} disabled={!dirty || !ok || busy} loading={busy} onPress={saveAll} />
      </View>
    </KeyboardSafe>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    action: { paddingVertical: 14, paddingHorizontal: 16 },
    actionText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, textAlign: 'center' },
    actionSub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted, textAlign: 'center', marginTop: 2 },
    small: { flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    cover: { height: 200, borderRadius: 24, overflow: 'hidden' },
    photoBtn: { position: 'absolute', right: 12, bottom: 12, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: whiteA(0.9), flexDirection: 'row', alignItems: 'center', gap: 6 },
    photoText: { fontFamily: fonts.medium, fontSize: 13, color: colors.onAccent },
    group: { paddingHorizontal: 16 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10 },
    line: { borderTopWidth: 1, borderTopColor: inkA(0.08) },
    k: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
    v: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink, fontVariant: ['tabular-nums'], marginTop: 2 },
    input: { padding: 0, outlineStyle: 'none' } as never,
    was: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, fontVariant: ['tabular-nums'] },
    warn: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.orangeText, textAlign: 'center' },
    kipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    bub: { paddingVertical: 12, paddingHorizontal: 16, borderTopLeftRadius: 6 },
    say: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.ink },
    choice: { paddingVertical: 12, paddingHorizontal: 14, minHeight: 72 },
    choiceOn: { borderWidth: 1.5, borderColor: colors.onAccent },
    choiceTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    choiceSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2, fontVariant: ['tabular-nums'] },
    drow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingVertical: 14 },
    dk: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    dwas: { fontFamily: fonts.regular, fontSize: 13, color: colors.faint, textDecorationLine: 'line-through', fontVariant: ['tabular-nums'] },
    dnow: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink, fontVariant: ['tabular-nums'] },
    note: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted, textAlign: 'center' },
    paper: { backgroundColor: colors.lime, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 12, transform: [{ rotate: '-1deg' }], boxShadow: '0 10px 18px rgba(0,0,0,0.14)', marginTop: 8 },
    tape: { position: 'absolute', top: -8, alignSelf: 'center', width: 48, height: 16, backgroundColor: whiteA(0.65), transform: [{ rotate: '-4deg' }] },
    paperHead: { fontFamily: fonts.regular, fontSize: 12, color: blackA(0.55) },
    paperText: { fontFamily: fonts.hand, fontSize: 20, lineHeight: 24, color: colors.onAccent, marginTop: 4, padding: 0, minHeight: 48 },
    foot: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12 },
    scrim: { flex: 1, backgroundColor: inkA(0.25) },
    sheet: { backgroundColor: colors.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 20, paddingHorizontal: 20, gap: 8 },
    sheetTitle: { fontFamily: fonts.medium, fontSize: 17, color: colors.ink, textAlign: 'center' },
  }),
);
