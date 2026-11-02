// Edit goal (approved mockup): photo, name, how much, by when, and the promise note. Changing how much or by when
// re-plans the month — Kip asks whether to keep the date or the monthly amount, shows what changes, and nothing is
// saved until "Save changes". After saving, every screen shows the new goal at once (new photo file, fresh loads).
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Camera, CaretRight } from 'phosphor-react-native';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Kip } from '@/components/Kip';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Glass } from '@/components/glow/Glass';
import { GlowBackground } from '@/components/glow/GlowBackground';
import { Squish } from '@/components/glow/motion';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { dailyOf } from '@/lib/budget';
import { changes, draftOf, preview, renamed, replanGoal, valid, type GoalDraft, type Keep } from '@/lib/goalEdit';
import { useHome } from '@/lib/home';
import { t } from '@/lib/i18n';
import { goalIcon3D, goalTypeIcon3D, ICON3D } from '@/lib/icons3d';
import { baht } from '@/lib/money';
import { useMonth } from '@/lib/month';
import { smallPhoto } from '@/lib/photos';
import { typeInfo } from '@/lib/setup/goalTypes';
import { isoDay, monthYear, parseDay } from '@/lib/setup/plan';
import { supabase } from '@/lib/supabase';
import { blackA, colors, fonts, inkA, themed, whiteA } from '@/theme';

export default function GoalEdit() {
  const insets = useSafeAreaInsets();
  const { session, refreshProfile } = useAuth();
  const { month, save } = useMonth();
  const { goals, spent, reload } = useHome(month);
  const goal = goals[0];

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
  const plan = useMemo(() => (goal && d && month && c?.money && ok ? replanGoal(month, goal, d, mode) : null), [goal, d, month, c?.money, ok, mode]);
  const p = plan && month && goal && d ? preview(month, plan.month, goal, d, plan.due, spent) : null;
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
        await save(plan.month);
        await supabase
          .from('profiles')
          .update({ daily_budget: dailyOf(plan.month) })
          .eq('id', uid);
      } else if (c?.title) {
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

  const coverUri = photo ?? goal.photo;
  const nameNow = d.title.trim() || goal.title;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
                  sub={t('Save {amount} a month', { amount: baht(replanGoal(month!, goal, d, 'date').month.goal.amount) })}
                  onPress={() => setKeep('date')}
                />
                <Choice
                  on={keep === 'monthly'}
                  title={t('Keep {amount} a month', { amount: baht(month!.goal.amount + month!.goalExtra) })}
                  sub={t('Arrives {date}', { date: monthYear(parseDay(replanGoal(month!, goal, d, 'monthly').due ?? isoDay(new Date()))) })}
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
        {error && <Text style={styles.warn}>{error}</Text>}
      </ScrollView>

      <View style={[styles.foot, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]}>
        <Button label={busy ? t('Saving…') : plan ? t('Save changes') : t('Save')} disabled={!dirty || !ok || busy} loading={busy} onPress={saveAll} />
      </View>
    </KeyboardAvoidingView>
  );
}

function AmountRow({ label, value, was, onChange }: { label: string; value: number | null; was: number | null; onChange: (v: number | null) => void }) {
  return (
    <View style={[styles.row, styles.line]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.k}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.v}>฿</Text>
          <TextInput
            value={value === null ? '' : value.toLocaleString('en-US')}
            onChangeText={(s) => {
              const n = s.replace(/[^\d]/g, '');
              onChange(n ? Math.min(Number(n), 99_999_999) : null);
            }}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.faint}
            style={[styles.v, styles.input, { flex: 1 }]}
            accessibilityLabel={label}
          />
        </View>
      </View>
      {was !== null && <Text style={styles.was}>{t('was {amount}', { amount: baht(was) })}</Text>}
    </View>
  );
}

/** "By when" — the phone's date picker (a typed date on web). */
function DueRow({ value, onChange }: { value: string | null; onChange: (iso: string) => void }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const tomorrow = new Date(Date.now() + 86_400_000);
  const current = value ? parseDay(value) : new Date(tomorrow.getFullYear() + 1, tomorrow.getMonth(), 1);
  const [picked, setPicked] = useState(current);
  const dark = colors.paper !== '#FFFFFF';

  if (Platform.OS === 'web')
    return (
      <View style={[styles.row, styles.line]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.k}>{t('By when')}</Text>
          <TextInput
            defaultValue={value ?? ''}
            onChangeText={(s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && onChange(s)}
            placeholder="2027-12-25"
            placeholderTextColor={colors.faint}
            style={[styles.v, styles.input]}
            accessibilityLabel={t('By when')}
          />
        </View>
      </View>
    );

  const show = () => {
    if (Platform.OS === 'android') return DateTimePickerAndroid.open({ value: current, minimumDate: tomorrow, mode: 'date', onChange: (e, x) => e.type === 'set' && x && onChange(isoDay(x)) });
    setPicked(current);
    setOpen(true);
  };
  return (
    <>
      <Pressable onPress={show} style={[styles.row, styles.line]} accessibilityRole="button" accessibilityLabel={t('By when')}>
        <View style={{ flex: 1 }}>
          <Text style={styles.k}>{t('By when')}</Text>
          <Text style={styles.v}>{value ? monthYear(parseDay(value)) : t('Pick a date')}</Text>
        </View>
        <CaretRight size={14} color={colors.faint} weight="bold" />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)} accessibilityLabel={t('Close')} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <Text style={styles.sheetTitle}>{t('By when')}</Text>
          <DateTimePicker value={picked} minimumDate={tomorrow} mode="date" display="inline" accentColor={colors.ink} themeVariant={dark ? 'dark' : 'light'} onChange={(_, x) => x && setPicked(x)} />
          <Button
            label={t('Done')}
            onPress={() => {
              onChange(isoDay(picked));
              setOpen(false);
            }}
          />
        </View>
      </Modal>
    </>
  );
}

function Choice({ on, title, sub, onPress }: { on: boolean; title: string; sub: string; onPress: () => void }) {
  return (
    <Squish onPress={onPress} style={{ flex: 1 }} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${title}. ${sub}`}>
      <Glass radius={20} tint={on ? colors.lime : undefined} innerStyle={[styles.choice, on && styles.choiceOn]}>
        <Text style={[styles.choiceTitle, on && { color: colors.onAccent }]}>{title}</Text>
        <Text style={[styles.choiceSub, on && { color: colors.onAccentMuted }]}>{sub}</Text>
      </Glass>
    </Squish>
  );
}

function Delta({ label, was, now, warn }: { label: string; was: string | null; now: string; warn?: boolean }) {
  return (
    <View style={[styles.drow, styles.line]}>
      <Text style={styles.dk}>{label}</Text>
      {was ? <Text style={styles.dwas}>{was}</Text> : null}
      <Text style={[styles.dnow, warn && { color: colors.orangeText }]}>{now}</Text>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
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
    paperHead: { fontFamily: fonts.regular, fontSize: 11, color: blackA(0.55) },
    paperText: { fontFamily: fonts.hand, fontSize: 20, lineHeight: 24, color: colors.onAccent, marginTop: 4, padding: 0, minHeight: 48 },
    foot: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12 },
    scrim: { flex: 1, backgroundColor: inkA(0.25) },
    sheet: { backgroundColor: colors.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 20, paddingHorizontal: 20, gap: 8 },
    sheetTitle: { fontFamily: fonts.medium, fontSize: 17, color: colors.ink, textAlign: 'center' },
  }),
);
