// Slips (Plus, approved mockup): pick bank slip screenshots → Kip reads each one (a ✓ as each finishes)
// → check what Kip found (tap a category to change it; repeats are left out) → save.
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { CaretDown, Check, Minus } from 'phosphor-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Kip } from '@/components/Kip';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Glass } from '@/components/glow/Glass';
import { GlowBackground } from '@/components/glow/GlowBackground';
import { RiseIn, Squish } from '@/components/glow/motion';
import { useAiConsent } from '@/components/AiConsent';
import { MoneyInSheet } from '@/components/MoneyInSheet';
import type { MoneyIn } from '@/lib/moneyin';
import { Sheet } from '@/components/profile/Sheet';
import { useAuth } from '@/lib/auth';
import { budgetKey, monthNumbers, useHome } from '@/lib/home';
import { dayShort, monthShort, rich, t } from '@/lib/i18n';
import { ICON3D } from '@/lib/icons3d';
import { DB_CAT_NAME, dbCatIcon, IN_CAT_NAME, inCatIcon, type DbCat, type InCat } from '@/lib/kip';
import { baht } from '@/lib/money';
import { useMonth } from '@/lib/month';
import { cleanSlip, markAlready, readSlip, savedKeys, slipKey, takePickedSlips, type PickedSlip, type Slip } from '@/lib/slips';
import { supabase } from '@/lib/supabase';
import { colors, fonts, glassA, inkA, themed } from '@/theme';

const AT_ONCE = 3; // slips read side by side
const SPEND: DbCat[] = ['food', 'transport', 'shopping', 'fun', 'health_beauty', 'home_bills', 'travel', 'family_pets', 'giving', 'learning', 'installments', 'other'];
const INCOME: InCat[] = ['pay', 'side_gigs', 'gifts', 'other'];

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
function whenText(d: Date) {
  const today = new Date();
  const diff = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  const day = diff === 0 ? t('Today') : diff === 1 ? t('Yesterday') : `${dayShort(d.getDay())} ${d.getDate()} ${monthShort(d.getMonth())}`;
  return `${day} · ${hhmm(d)}`;
}

/** The picked image as base64 for the server (web gives a data: link instead). */
function payload(a: PickedSlip): { image: string; type: string } | null {
  if (a.base64) return { image: a.base64, type: a.mimeType?.startsWith('image/') ? a.mimeType : 'image/jpeg' };
  const m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(a.uri);
  return m ? { image: m[2], type: m[1] } : null;
}

export default function Slips() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { month } = useMonth();
  const { spent } = useHome(month);
  const [phase, setPhase] = useState<'reading' | 'review'>('reading');
  const [slips, setSlips] = useState<Slip[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [ids, setIds] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [moneyIn, setMoneyIn] = useState<MoneyIn[] | null>(null);
  const started = useRef(false);
  const ai = useAiConsent(() => router.push('/privacy-policy'));

  useEffect(() => {
    supabase
      .from('categories')
      .select('id, key, kind')
      .is('user_id', null)
      .then(({ data }) => setIds(Object.fromEntries((data ?? []).map((c) => [`${c.kind}:${c.key}`, c.id]))));
  }, []);

  // The slips were picked on the + screen; start reading them. Nothing picked → back.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const assets = takePickedSlips();
    if (!assets?.length) {
      router.canGoBack() ? router.back() : router.replace('/');
      return;
    }
    setSlips(assets.map((a, i) => ({ ...cleanSlip(`s${i}`, a.uri, null), state: 'reading' })));
    setPhase('reading');
    readAll(assets).catch((e) => {
      // Never leave the person staring at "Reading…": show what we have and say what went wrong.
      setProblem(t('Something went wrong while reading — try again? ({msg})', { msg: String(e?.message ?? e).slice(0, 80) }));
      setPhase('review');
    });
  }, []);

  async function readAll(assets: PickedSlip[], retried = false): Promise<void> {
    const results: Slip[] = assets.map((a, i) => ({ ...cleanSlip(`s${i}`, a.uri, null), state: 'reading' }));
    let next = 0;
    let stop: string | null = null;
    const worker = async () => {
      while (next < assets.length && !stop) {
        const i = next++;
        const p = payload(assets[i]);
        const res = p ? await readSlip(p.image, p.type) : null;
        if (res && !res.ok && (res.reason === 'plus' || res.reason === 'consent' || res.reason === 'nokey' || res.reason === 'offline')) stop = res.reason;
        results[i] = cleanSlip(`s${i}`, assets[i].uri, res && res.ok ? res.read : null);
        setSlips([...results]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(AT_ONCE, assets.length) }, worker));
    // Kip hasn't been allowed to read yet (or reading was turned off): ask right here, then read again.
    if (stop === 'consent') {
      if (!retried && (await ai.ensure())) {
        setSlips(assets.map((a, i) => ({ ...cleanSlip(`s${i}`, a.uri, null), state: 'reading' })));
        return readAll(assets, true);
      }
      setProblem(t('Kip’s reading is turned off — turn it on in Profile → Privacy & data.'));
      setPhase('review');
      return;
    }
    if (stop) {
      setProblem(
        stop === 'offline'
          ? t('I can’t reach the internet right now. Try again in a moment?')
          : stop === 'plus'
            ? t('Reading slips is a Plus feature.')
            : t('I’m not switched on yet — my AI key still needs to be added in Supabase.'),
      );
      setPhase('review');
      return;
    }
    const keys = results.filter((s) => s.state === 'done').map(slipKey);
    const saved = session ? await savedKeys(session.user.id, keys).catch(() => new Set<string>()) : new Set<string>();
    setSlips(markAlready(results, saved));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setPhase('review');
  }

  const toSave = slips.filter((s) => s.state === 'done' && !s.already);
  const skipped = slips.filter((s) => s.state !== 'done').length;
  const repeats = slips.filter((s) => s.already).length;
  const out = toSave.filter((s) => s.money === 'out').reduce((a, s) => a + s.amount, 0);
  const inn = toSave.filter((s) => s.money === 'in').reduce((a, s) => a + s.amount, 0);
  // Left for today after saving: only today's spending that counts against daily money (not bills).
  const leftAfter = useMemo(() => {
    if (!month) return null;
    const today = new Date().toDateString();
    const add = toSave.filter((s) => s.money === 'out' && s.at.toDateString() === today && budgetKey(s.category as DbCat, month) !== 'bills').reduce((a, s) => a + s.amount, 0);
    return monthNumbers(month, { ...spent, total: spent.total + add, today: spent.today + add }).leftToday;
  }, [month, spent, toSave]);

  async function save() {
    if (!session || !toSave.length) return;
    setBusy(true);
    const rows = toSave.map((s) => {
      const kind = s.money === 'in' ? 'income' : 'spend';
      return {
        user_id: session.user.id,
        kind,
        amount: s.amount,
        category_id: ids[`${kind}:${s.category}`] ?? ids[`${kind}:other`] ?? null,
        note: s.name || null,
        occurred_at: s.at.toISOString(),
        source: 'slip',
        slip_ref: slipKey(s),
      };
    });
    const cols = 'id, kind, amount, note, slip_ref';
    let { data: saved, error } = await supabase.from('transactions').insert(rows).select(cols);
    // One already there (saved on another phone in the meantime): save the rest one by one.
    if (error) {
      const results = await Promise.all(rows.map((r) => supabase.from('transactions').insert(r).select(cols).single()));
      error = results.find((x) => x.error && x.error.code !== '23505')?.error ?? null;
      saved = results.flatMap((x) => (x.data ? [x.data] : []));
    }
    setBusy(false);
    if (error) return setProblem(t('Couldn’t save: {msg}', { msg: error.message }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    // Money in from a slip gets a job too, the same as everywhere else.
    const inn = (saved ?? []).filter((r) => r.kind === 'income');
    if (inn.length)
      return setMoneyIn(
        inn.map((r) => ({ id: r.id as string, amount: Number(r.amount), category: toSave.find((x) => slipKey(x) === r.slip_ref)?.category ?? 'other', note: (r.note as string | null) ?? null })),
      );
    router.dismissTo('/');
  }

  const setCat = (id: string, category: DbCat | InCat) => setSlips((xs) => xs.map((s) => (s.id === id ? { ...s, category } : s)));
  const editingSlip = slips.find((s) => s.id === editing);

  return (
    <View style={{ flex: 1 }}>
      <GlowBackground />
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20 }}>
        <ScreenHeader title={t('Slips')} />
      </View>

      {phase === 'reading' && (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: insets.bottom + 24 }}>
          <View style={styles.grid}>
            {slips.map((s) => (
              <Thumb key={s.id} slip={s} />
            ))}
          </View>
          <RiseIn style={{ alignItems: 'center', gap: 4 }}>
            <Text style={styles.big}>{slips.length === 1 ? t('Reading your slip…') : t('Reading {n} slips…', { n: slips.length })}</Text>
            <Text style={styles.sub}>{t('Amount, who you paid, date and time')}</Text>
          </RiseIn>
          <View style={{ alignItems: 'center' }}>
            <Kip mood="think" size={110} />
          </View>
          <Text style={[styles.small, { textAlign: 'center' }]}>{t('Any Thai bank app · up to 10 at once · never kept')}</Text>
        </ScrollView>
      )}

      {phase === 'review' && (
        <>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 120 + insets.bottom }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
              <Kip mood={problem ? 'careful' : 'happy'} size={44} />
              <Glass radius={20} style={{ flex: 1 }} innerStyle={styles.bub}>
                <Text style={styles.bubText}>
                  {problem ??
                    (toSave.length === 0
                      ? repeats
                        ? t('These are all saved already — nothing new to add.')
                        : t('I couldn’t find a slip in these. Try a screenshot of the bank’s “transfer successful” screen.')
                      : rich(
                          skipped
                            ? repeats + skipped === 1
                              ? 'Read {n} pictures — 1 wasn’t a new slip, so I left it out. **Tap a category to change it.**'
                              : 'Read {n} pictures — {x} weren’t new slips, so I left them out. **Tap a category to change it.**'
                            : repeats
                              ? repeats === 1
                                ? 'Read {n} slips — 1 was already saved, so I left it out. **Tap a category to change it.**'
                                : 'Read {n} slips — {r} were already saved, so I left them out. **Tap a category to change it.**'
                              : toSave.length === 1
                                ? 'Got it. **Tap the category to change it.**'
                                : 'Read all {n}. **Tap a category to change it.**',
                          { n: slips.length, r: repeats, x: repeats + skipped },
                          (s) => <Text style={{ fontFamily: fonts.medium }}>{s}</Text>,
                        ))}
                </Text>
              </Glass>
            </View>

            {slips.map((s, i) => (
              <RiseIn key={s.id} delay={80 + i * 60}>
                <Row slip={s} onCategory={() => setEditing(s.id)} />
              </RiseIn>
            ))}

            {toSave.length > 0 && (
              <View style={styles.sum}>
                <Text style={styles.small}>{inn > 0 ? t('Out {out} · in +{inn}', { out: baht(out), inn: baht(inn) }) : t('Out {out}', { out: baht(out) })}</Text>
                {leftAfter !== null && <Text style={[styles.small, { color: colors.ink, fontFamily: fonts.medium }]}>{t('{amount} left today after', { amount: baht(leftAfter) })}</Text>}
              </View>
            )}
          </ScrollView>

          <View style={[styles.foot, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]}>
            {toSave.length > 0 ? (
              <Squish onPress={save} disabled={busy} style={[styles.dark, busy && { opacity: 0.5 }]} accessibilityRole="button">
                <Text style={styles.darkText}>{busy ? t('Saving…') : toSave.length === 1 ? t('Save it') : t('Save {n}', { n: toSave.length })}</Text>
              </Squish>
            ) : (
              <Squish onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityRole="button">
                <Glass radius={999} innerStyle={styles.light}>
                  <Text style={styles.lightText}>{t('Done')}</Text>
                </Glass>
              </Squish>
            )}
          </View>
        </>
      )}

      {ai.sheet}
      {moneyIn && (
        <MoneyInSheet
          items={moneyIn}
          onClose={() => {
            setMoneyIn(null);
            router.dismissTo('/');
          }}
        />
      )}
      {editingSlip && (
        <Sheet open onClose={() => setEditing(null)} title={editingSlip.money === 'in' ? t('What was it?') : t('What was it for?')} sub={editingSlip.name || undefined}>
          <View style={styles.cats}>
            {(editingSlip.money === 'in' ? INCOME : SPEND).map((c) => {
              const on = editingSlip.category === c;
              const isIn = editingSlip.money === 'in';
              return (
                <Squish
                  key={c}
                  onPress={() => {
                    setCat(editingSlip.id, c);
                    setEditing(null);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}>
                  <Glass radius={999} tint={on ? (isIn ? colors.lavender : colors.lime) : undefined} innerStyle={[styles.catPick, on && { borderWidth: 1.5, borderColor: colors.ink }]}>
                    <Image source={ICON3D[isIn ? inCatIcon(c as InCat) : dbCatIcon(c as DbCat)]} style={{ width: 28, height: 28 }} contentFit="contain" />
                    <Text style={[styles.catText, on && { fontFamily: fonts.medium }]}>{isIn ? IN_CAT_NAME[c as InCat] : DB_CAT_NAME[c as DbCat]}</Text>
                  </Glass>
                </Squish>
              );
            })}
          </View>
        </Sheet>
      )}
    </View>
  );
}

/** A picked slip while Kip reads it: a soft yellow line scans it, then a ✓ (or a dash if it isn't a slip). */
function Thumb({ slip }: { slip: Slip }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = slip.state === 'reading' ? withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, false) : withTiming(0);
  }, [slip.state, y]);
  const scan = useAnimatedStyle(() => ({ transform: [{ translateY: -46 + y.value * 236 }], opacity: slip.state === 'reading' ? 1 : 0 }));
  return (
    <View style={styles.thumb}>
      <Image source={{ uri: slip.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <Animated.View style={[styles.scan, scan]} pointerEvents="none" />
      {slip.state !== 'reading' && (
        <View style={[styles.tick, slip.state !== 'done' && { backgroundColor: colors.faint }]}>
          {slip.state === 'done' ? <Check size={12} color={colors.paper} weight="bold" /> : <Minus size={12} color={colors.paper} weight="bold" />}
        </View>
      )}
    </View>
  );
}

function Row({ slip, onCategory }: { slip: Slip; onCategory: () => void }) {
  const isIn = slip.money === 'in';
  if (slip.state !== 'done')
    return (
      <Glass radius={22} innerStyle={[styles.row, { opacity: 0.6 }]}>
        <Image source={{ uri: slip.uri }} style={styles.mini} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{slip.state === 'notslip' ? t('Not a slip') : t('Couldn’t read this one')}</Text>
          <Text style={styles.small}>{t('Skipped')}</Text>
        </View>
      </Glass>
    );
  return (
    <Glass radius={22} innerStyle={[styles.row, slip.already && { opacity: 0.55 }]}>
      <Image source={{ uri: slip.uri }} style={styles.mini} contentFit="cover" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.name} numberOfLines={1}>
          {isIn ? t('From {name}', { name: slip.name || t('someone') }) : slip.name || t('Transfer')}
        </Text>
        <Text style={styles.small} numberOfLines={2}>
          {whenText(slip.at)}
          {isIn ? t(' · money in') : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <Text style={[styles.amt, isIn && { color: colors.lavenderText }, slip.already && styles.struck]}>
          {isIn ? '+' : ''}
          {baht(slip.amount)}
        </Text>
        {slip.already ? (
          <View style={styles.tag}>
            <Text style={styles.tagText}>{t('Already in')}</Text>
          </View>
        ) : (
          <Pressable onPress={onCategory} hitSlop={6} style={[styles.cat, isIn && { backgroundColor: 'rgba(220,210,247,0.75)' }]} accessibilityRole="button" accessibilityLabel={t('Change category')}>
            <Image source={ICON3D[isIn ? inCatIcon(slip.category as InCat) : dbCatIcon(slip.category as DbCat)]} style={{ width: 22, height: 22 }} contentFit="contain" />
            <Text style={[styles.catText, isIn && { color: '#5B4A96' }]}>{isIn ? IN_CAT_NAME[slip.category as InCat] : DB_CAT_NAME[slip.category as DbCat]}</Text>
            <CaretDown size={10} color={colors.muted} weight="bold" />
          </Pressable>
        )}
      </View>
    </Glass>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    thumb: {
      width: '31%',
      aspectRatio: 0.58,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: inkA(0.06),
      boxShadow: '0 10px 24px rgba(17,17,17,0.08)',
    } as never,
    scan: { position: 'absolute', left: 0, right: 0, top: 0, height: 46, backgroundColor: 'rgba(255,244,122,0.55)' },
    tick: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
    big: { fontFamily: fonts.medium, fontSize: 22, letterSpacing: -0.4, color: colors.ink, textAlign: 'center' },
    sub: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textAlign: 'center' },
    small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
    bub: { paddingVertical: 12, paddingHorizontal: 16, borderTopLeftRadius: 6 },
    bubText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.ink },
    row: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
    mini: { width: 44, height: 60, borderRadius: 8, borderWidth: 1, borderColor: inkA(0.08), backgroundColor: colors.paper },
    name: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    amt: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink, fontVariant: ['tabular-nums'] },
    struck: { textDecorationLine: 'line-through', color: colors.muted },
    cat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      height: 28,
      paddingLeft: 4,
      paddingRight: 8,
      borderRadius: 999,
      backgroundColor: glassA(0.75),
      borderWidth: 1,
      borderColor: colors.paper,
    },
    catText: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink },
    tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: inkA(0.07) },
    tagText: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
    sum: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 4, gap: 12 },
    foot: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12 },
    dark: { height: 56, borderRadius: 999, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
    darkText: { fontFamily: fonts.medium, fontSize: 16, color: colors.paper },
    light: { height: 56, alignItems: 'center', justifyContent: 'center' },
    lightText: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
    cats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 8 },
    catPick: { height: 44, paddingLeft: 4, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
  }),
);
