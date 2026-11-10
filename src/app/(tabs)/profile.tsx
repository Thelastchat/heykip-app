// You & settings (approved mockup): who you are, your plan, the money basics Kip plans from, Kip's settings,
// log out and delete account. Changing a basic re-plans the month — the sheet shows the new numbers first.
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { CaretRight } from 'phosphor-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Kip } from '@/components/Kip';
import { PlusSheet } from '@/components/PlusSheet';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Glass } from '@/components/glow/Glass';
import { GlowBackground } from '@/components/glow/GlowBackground';
import { RiseIn, Ring, Squish } from '@/components/glow/motion';
import { PaySheet, RentSheet } from '@/components/profile/MoneySheets';
import { Pill, SaveButton, Sheet, sheet } from '@/components/profile/Sheet';
import { planNow, useAuth } from '@/lib/auth';
import { billsTotal, dailyOf, STYLES, type MonthBudget } from '@/lib/budget';
import { useHome } from '@/lib/home';
import { getLang, t, useLang, type Lang } from '@/lib/i18n';
import { ICON3D } from '@/lib/icons3d';
import { baht } from '@/lib/money';
import { useMonth } from '@/lib/month';
import type { Basics, GoalNow } from '@/lib/replan';
import { shortName } from '@/lib/setup/plan';
import { useLook } from '@/lib/look';
import { smallPhoto } from '@/lib/photos';
import { supabase } from '@/lib/supabase';
import { colors, fonts, glassA, inkA, themed, whiteA } from '@/theme';

type Row = {
  display_name: string | null;
  avatar_url: string | null;
  plan: 'free' | 'trial' | 'yearly' | 'monthly' | 'student';
  trial_ends_at: string | null;
  income_type: 'regular' | 'changes';
  monthly_income: number | null;
  slow_month_income: number | null;
  good_month_income: number | null;
  payday: number | null;
  rent: number | null;
  checkin_time: string | null;
};
type Open = null | 'me' | 'pay' | 'rent' | 'checkin' | 'delete' | 'plus';

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
/** "25th" in English; Thai just uses the number (วันที่ 25). */
const ordinal = (n: number) => (getLang() === 'th' ? String(n) : `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`);
const CHECKIN = ['19:00', '20:00', '21:00', '22:00'];
/** "9:00 pm" in English, "21:00 น." in Thai. */
const timeLabel = (time: string) => {
  if (getLang() === 'th') return `${time.slice(0, 5)} น.`;
  const h = Number(time.slice(0, 2));
  return `${h % 12 || 12}:${time.slice(3, 5)} ${h < 12 ? 'am' : 'pm'}`;
};

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { session, signOut, refreshProfile } = useAuth();
  const { month, save } = useMonth();
  const { goals } = useHome(month);
  const [row, setRow] = useState<Row | null>(null);
  const [open, setOpen] = useState<Open>(null);
  const [toast, setToast] = useState<string | null>(null);
  const uid = session?.user.id;
  const { lang, setLang } = useLang();
  const { look, setLook } = useLook();

  const load = useCallback(async () => {
    if (!uid) return;
    const { data } = await supabase
      .from('profiles')
      .select('display_name, avatar_url, plan, trial_ends_at, income_type, monthly_income, slow_month_income, good_month_income, payday, rent, checkin_time')
      .eq('id', uid)
      .single();
    if (data) setRow(data as Row);
  }, [uid]);
  useEffect(() => {
    load();
  }, [load]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  /** Switch the app's language and remember it on the account too. */
  function pickLang(l: Lang) {
    if (l === lang) return;
    Haptics.selectionAsync().catch(() => {});
    if (uid)
      supabase
        .from('profiles')
        .update({ language: l })
        .eq('id', uid)
        .then(() => {});
    setLang(l, '/profile');
  }

  const goal = goals[0];
  const goalName = goal ? (goal.kind === 'monthly' ? goal.title : shortName(goal.title, goal.kind as never)) : t('Your goal');
  const goalNow: GoalNow = goal ? { saved: goal.saved, target: goal.target, due: goal.due ?? null, isMonthly: goal.kind === 'monthly' } : null;
  const basics: Basics | null = row
    ? {
        incomeType: row.income_type,
        monthlyIncome: num(row.monthly_income),
        slowMonth: num(row.slow_month_income),
        goodMonth: num(row.good_month_income),
        payday: row.payday,
        rent: num(row.rent) ?? 0,
      }
    : null;

  async function saveBasics(b: Basics, next: MonthBudget) {
    if (!uid) return;
    const { error } = await supabase
      .from('profiles')
      .update({
        income_type: b.incomeType,
        monthly_income: b.incomeType === 'regular' ? b.monthlyIncome : null,
        slow_month_income: b.incomeType === 'changes' ? b.slowMonth : null,
        good_month_income: b.incomeType === 'changes' ? b.goodMonth : null,
        payday: b.incomeType === 'regular' ? b.payday : null,
        rent: b.rent,
        daily_budget: dailyOf(next),
      })
      .eq('id', uid);
    if (error) return flash(t('Couldn’t save: {msg}', { msg: error.message }));
    await save(next);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setOpen(null);
    flash(t('Saved — your month is re-planned'));
    load();
  }

  async function patch(fields: Partial<Row>, done = t('Saved')) {
    if (!uid) return false;
    const { error } = await supabase.from('profiles').update(fields).eq('id', uid);
    if (error) {
      flash(t('Couldn’t save: {msg}', { msg: error.message }));
      return false;
    }
    setRow((r) => (r ? { ...r, ...fields } : r));
    flash(done);
    return true;
  }

  // ---- what each row says ----
  const regular = row?.income_type !== 'changes';
  const pay = regular ? num(row?.monthly_income) : num(row?.slow_month_income);
  const paySub = regular
    ? row?.payday
      ? t('Every month on the {day}', { day: ordinal(row.payday) })
      : t('Every month')
    : t('Changes · good month {amount}', { amount: row?.good_month_income ? baht(Number(row.good_month_income)) : '—' });
  const billCount = month?.bills.items?.length ?? 0;
  const styleName = STYLES.find((s) => s.key === month?.style)?.name ?? t('Kip’s plan');

  // ---- Plus ----
  const plan = planNow(row?.plan, row?.trial_ends_at);
  const daysLeft = row?.trial_ends_at ? Math.max(0, Math.ceil((new Date(row.trial_ends_at).getTime() - Date.now()) / 86_400_000)) : 0;

  return (
    <View style={{ flex: 1 }}>
      <GlowBackground />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 180, gap: 16 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('You')} back={false} />

        <RiseIn>
          <Glass radius={24} innerStyle={styles.me}>
            <View style={styles.ava}>{row?.avatar_url ? <Image source={{ uri: row.avatar_url }} style={{ width: 56, height: 56 }} contentFit="cover" /> : <Kip mood="happy" size={46} />}</View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {row?.display_name || t('Add your name')}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {session?.user.email}
              </Text>
            </View>
            <Squish onPress={() => setOpen('me')} style={styles.chip} accessibilityRole="button" accessibilityLabel={t('Edit name and photo')}>
              <Text style={styles.chipText}>{t('Edit')}</Text>
            </Squish>
          </Glass>
        </RiseIn>

        <RiseIn delay={120}>
          <View style={styles.plus}>
            {plan === 'trial' ? (
              <View style={{ width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }}>
                <Ring pct={daysLeft / 7} size={46} stroke={5} color={colors.lime} track="rgba(255,255,255,0.16)" />
                <Text style={styles.ringNum}>{daysLeft}</Text>
              </View>
            ) : (
              <Image source={ICON3D.piggy} style={{ width: 44, height: 44 }} contentFit="contain" />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.plusTitle}>
                {plan === 'trial'
                  ? daysLeft > 0
                    ? daysLeft === 1
                      ? t('{n} day of Plus left', { n: daysLeft })
                      : t('{n} days of Plus left', { n: daysLeft })
                    : t('Your Plus trial ended')
                  : plan === 'free'
                    ? 'HeyKip Free'
                    : 'HeyKip Plus'}
              </Text>
              <Text style={styles.plusSub}>{plan === 'free' ? t('Plus: Talk to Kip, your budgets, 3 goals') : t('Talk to Kip, your budgets, 3 goals')}</Text>
            </View>
            {plan === 'trial' || plan === 'free' ? (
              <Squish
                onPress={() => (plan === 'free' ? setOpen('plus') : flash(t('Paying for Plus is coming soon — your trial keeps everything on until then.')))}
                style={styles.go}
                accessibilityRole="button">
                <Text style={styles.goText}>{plan === 'free' ? t('Try free') : t('Keep Plus')}</Text>
              </Squish>
            ) : null}
          </View>
        </RiseIn>

        <Text style={styles.cap}>{t('Your money')}</Text>
        <RiseIn delay={240}>
          <Glass radius={24} innerStyle={styles.group}>
            <SetRow first icon="income" title={t('Usual pay')} sub={paySub} value={pay ? baht(pay) : t('Add it')} onPress={() => month && basics && setOpen('pay')} />
            <SetRow
              icon="house"
              title={t('Rent & bills')}
              sub={`${t('Rent {amount}', { amount: baht(num(row?.rent) ?? 0) })}${billCount ? ` · ${billCount === 1 ? t('{n} bill', { n: billCount }) : t('{n} bills', { n: billCount })}` : ''}`}
              value={month ? baht(billsTotal(month)) : '—'}
              onPress={() => month && basics && setOpen('rent')}
            />
            <SetRow icon="piggy" title={t('Money style')} sub={t('How your month is split')} value={styleName} soft onPress={() => router.push('/styles')} />
          </Glass>
        </RiseIn>
        <Text style={styles.note}>{t('Change one and Kip re-plans your month — you’ll see the new numbers first.')}</Text>

        <Text style={styles.cap}>Kip</Text>
        <RiseIn delay={360}>
          <Glass radius={24} innerStyle={styles.group}>
            <SetRow first title={t('Evening check-in')} sub={t('Kip asks what you spent')} value={timeLabel(row?.checkin_time ?? '21:00')} soft onPress={() => setOpen('checkin')} />
            <View style={[styles.row, styles.rowLine]}>
              <Text style={[styles.rowTitle, { flex: 1 }]}>{t('Language')}</Text>
              <View style={styles.seg}>
                {(['en', 'th'] as const).map((l) => (
                  <Pressable
                    key={l}
                    onPress={() => pickLang(l)}
                    style={[styles.segBtn, lang === l && styles.segOn]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: lang === l }}
                    accessibilityLabel={l === 'en' ? 'English' : 'ไทย'}>
                    <Text style={[styles.segText, lang === l && { color: colors.paper }]}>{l === 'en' ? 'English' : 'ไทย'}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={[styles.row, styles.rowLine]}>
              <Text style={[styles.rowTitle, { flex: 1 }]}>{t('Look')}</Text>
              <View style={styles.seg}>
                {(['light', 'dark', 'system'] as const).map((l) => (
                  <Pressable
                    key={l}
                    onPress={() => look !== l && setLook(l, '/profile')}
                    style={[styles.segBtn, look === l && styles.segOn]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: look === l }}
                    accessibilityLabel={l === 'light' ? t('Light') : l === 'dark' ? t('Dark') : t('Same as my phone')}>
                    <Text style={[styles.segText, look === l && { color: colors.paper }]}>{l === 'light' ? t('Light') : l === 'dark' ? t('Dark') : t('Phone')}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </Glass>
        </RiseIn>

        <RiseIn delay={420}>
          <Glass radius={24} innerStyle={styles.group}>
            <SetRow first icon="shield" title={t('Privacy & data')} sub={t('Kip’s AI, what’s saved, delete')} value="" onPress={() => router.push('/privacy')} />
          </Glass>
        </RiseIn>

        <View style={styles.foot}>
          <Pressable onPress={signOut} hitSlop={10} accessibilityRole="button">
            <Text style={styles.footText}>{t('Log out')}</Text>
          </Pressable>
          <Pressable onPress={() => setOpen('delete')} hitSlop={10} accessibilityRole="button">
            <Text style={[styles.footText, { color: colors.orangeText }]}>{t('Delete account')}</Text>
          </Pressable>
        </View>
      </ScrollView>

      {open === 'me' && row && uid && (
        <MeSheet
          uid={uid}
          name={row.display_name ?? ''}
          avatar={row.avatar_url}
          onClose={() => setOpen(null)}
          onSaved={(fields) => {
            setRow((r) => (r ? { ...r, ...fields } : r));
            refreshProfile();
            setOpen(null);
            flash(t('Saved'));
          }}
        />
      )}
      {open === 'pay' && month && basics && <PaySheet open onClose={() => setOpen(null)} month={month} basics={basics} goal={goalNow} goalName={goalName} onSave={saveBasics} />}
      {open === 'rent' && month && basics && (
        <RentSheet
          open
          onClose={() => setOpen(null)}
          month={month}
          basics={basics}
          goal={goalNow}
          goalName={goalName}
          onSave={saveBasics}
          onBills={() => {
            setOpen(null);
            router.push('/month');
          }}
        />
      )}
      {open === 'checkin' && (
        <CheckinSheet
          value={row?.checkin_time?.slice(0, 5) ?? '21:00'}
          onClose={() => setOpen(null)}
          onPick={async (time) => {
            if (await patch({ checkin_time: time }, t('Kip will check in at {time}', { time: timeLabel(time) }))) setOpen(null);
          }}
        />
      )}
      {open === 'delete' && <DeleteSheet onClose={() => setOpen(null)} onError={flash} />}
      {open === 'plus' && (
        <PlusSheet
          open
          onClose={() => setOpen(null)}
          onUnlocked={() => {
            setOpen(null);
            load();
          }}
          title={t('Get there sooner with Plus')}
          sub={t('Talk to Kip, your own budgets and 3 goals — free for 7 days.')}
        />
      )}

      {toast && (
        <View style={[styles.toast, { bottom: Math.max(insets.bottom, 12) + 96 }]} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

function SetRow({ icon, title, sub, value, soft, first, onPress }: { icon?: keyof typeof ICON3D; title: string; sub?: string; value: string; soft?: boolean; first?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, !first && styles.rowLine, pressed && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel={`${title}: ${value}`}>
      {icon && <Image source={ICON3D[icon]} style={{ width: 38, height: 38 }} contentFit="contain" />}
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {sub ? <Text style={styles.small}>{sub}</Text> : null}
      </View>
      <Text style={[styles.rowVal, soft && { color: colors.muted, fontFamily: fonts.regular }]} numberOfLines={1}>
        {value}
      </Text>
      <CaretRight size={14} color={colors.faint} weight="bold" />
    </Pressable>
  );
}

// ---------- sheets ----------

function MeSheet({
  uid,
  name,
  avatar,
  onClose,
  onSaved,
}: {
  uid: string;
  name: string;
  avatar: string | null;
  onClose: () => void;
  onSaved: (f: { display_name: string; avatar_url: string | null }) => void;
}) {
  const [n, setN] = useState(name);
  const [photo, setPhoto] = useState<string | null>(avatar);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!r.canceled && r.assets[0]) setPhoto(r.assets[0].uri);
  }

  async function saveMe() {
    setBusy(true);
    setError(null);
    let url = photo;
    if (photo && photo !== avatar && !photo.startsWith('http')) {
      const small = await smallPhoto(photo, 400);
      const path = `${uid}/avatar-${Date.now()}.${small.ext}`;
      const { error: e } = await supabase.storage.from('avatars').upload(path, small.bytes, { contentType: small.contentType, upsert: true });
      if (e) {
        setBusy(false);
        return setError(t('Couldn’t upload your photo: {msg}', { msg: e.message }));
      }
      url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    }
    const fields = { display_name: n.trim(), avatar_url: url };
    const { error: e } = await supabase.from('profiles').update(fields).eq('id', uid);
    setBusy(false);
    if (e) return setError(t('Couldn’t save: {msg}', { msg: e.message }));
    onSaved(fields);
  }

  return (
    <Sheet open onClose={onClose} title={t('You')}>
      <Pressable onPress={pick} style={{ alignSelf: 'center', alignItems: 'center', gap: 8 }} accessibilityRole="button" accessibilityLabel={t('Change photo')}>
        <View style={[styles.ava, { width: 88, height: 88, borderRadius: 44 }]}>
          {photo ? <Image source={{ uri: photo }} style={{ width: 88, height: 88 }} contentFit="cover" /> : <Kip mood="happy" size={66} />}
        </View>
        <Text style={[styles.rowTitle, { fontSize: 14, textDecorationLine: 'underline' }]}>{photo ? t('Change photo') : t('Add a photo')}</Text>
      </Pressable>
      <Glass radius={18}>
        <TextInput
          value={n}
          onChangeText={setN}
          placeholder={t('Your name')}
          placeholderTextColor={colors.faint}
          style={[sheet.field, { outlineStyle: 'none' } as never]}
          maxLength={40}
          accessibilityLabel={t('Your name')}
        />
      </Glass>
      {error && <Text style={styles.err}>{error}</Text>}
      <SaveButton label={busy ? t('Saving…') : t('Save')} disabled={busy || !n.trim()} onPress={saveMe} />
    </Sheet>
  );
}

function CheckinSheet({ value, onClose, onPick }: { value: string; onClose: () => void; onPick: (t: string) => void }) {
  return (
    <Sheet open onClose={onClose} title={t('Evening check-in')} sub={t('When should Kip ask what you spent today?')}>
      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        {CHECKIN.map((time) => (
          <Pill key={time} label={timeLabel(time)} on={value === time} onPress={() => onPick(time)} />
        ))}
      </View>
      <Text style={[sheet.sub, { textAlign: 'center', marginBottom: 6 }]}>{t('Kip’s reminders arrive with notifications, coming soon — your time is saved for then.')}</Text>
    </Sheet>
  );
}

function DeleteSheet({ onClose, onError }: { onClose: () => void; onError: (t: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function del() {
    setBusy(true);
    const { error } = await supabase.functions.invoke('delete-account', { body: {} });
    if (error) {
      setBusy(false);
      onClose();
      return onError(t('Couldn’t delete your account — check your internet and try again.'));
    }
    await supabase.auth.signOut({ scope: 'local' });
  }
  return (
    <Sheet open onClose={onClose} title={t('Delete your account?')} sub={t('Your goals, spending, photos and promise are deleted for good. This can’t be undone.')}>
      <View style={{ alignItems: 'center', marginVertical: 4 }}>
        <Kip mood="careful" size={90} />
      </View>
      <SaveButton label={busy ? t('Deleting…') : t('Delete everything')} danger disabled={busy} onPress={del} />
      <Squish onPress={onClose} accessibilityRole="button">
        <Glass radius={999} innerStyle={{ height: 52, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={styles.rowTitle}>{t('Keep my account')}</Text>
        </Glass>
      </Squish>
    </Sheet>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    me: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
    ava: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FBF6CF', borderWidth: 1, borderColor: colors.paper },
    name: { fontFamily: fonts.medium, fontSize: 19, letterSpacing: -0.3, color: colors.ink },
    sub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
    chip: { height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: inkA(0.07), alignItems: 'center', justifyContent: 'center' },
    chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
    plus: {
      borderRadius: 24,
      padding: 16,
      backgroundColor: colors.solid,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      boxShadow: '0 1px 2px rgba(17,17,17,0.04), 0 14px 28px rgba(17,17,17,0.12)',
    } as never,
    ringNum: { position: 'absolute', fontFamily: fonts.medium, fontSize: 14, color: colors.onSolid },
    plusTitle: { fontFamily: fonts.medium, fontSize: 16, color: colors.onSolid },
    plusSub: { fontFamily: fonts.regular, fontSize: 13, color: whiteA(0.6), marginTop: 2 },
    go: { height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
    goText: { fontFamily: fonts.medium, fontSize: 13, color: colors.onAccent },
    cap: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginLeft: 4, marginTop: 8, marginBottom: -8 }, // closer to its own group than to the one above
    group: { paddingHorizontal: 16, paddingVertical: 4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    rowLine: { borderTopWidth: 1, borderTopColor: inkA(0.06) },
    rowTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    rowVal: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'], maxWidth: 130 },
    small: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
    note: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted, marginHorizontal: 4, marginTop: -8 },
    seg: { flexDirection: 'row', backgroundColor: inkA(0.07), borderRadius: 999, padding: 4 },
    segBtn: { paddingHorizontal: 12, paddingVertical: 6, minWidth: 64, borderRadius: 999, alignItems: 'center' },
    segOn: { backgroundColor: colors.ink },
    segText: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
    foot: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 8 },
    footText: { fontFamily: fonts.regular, fontSize: 14, color: colors.ink },
    err: { fontFamily: fonts.regular, fontSize: 12, color: colors.orangeText, textAlign: 'center' },
    toast: { position: 'absolute', alignSelf: 'center', backgroundColor: colors.ink, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, maxWidth: '90%' },
    toastText: { fontFamily: fonts.regular, fontSize: 13, color: colors.paper, textAlign: 'center' },
  }),
);
