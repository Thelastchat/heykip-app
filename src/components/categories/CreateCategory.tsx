// "Create your own" category (approved mockup): a name, one of the 3D icons, need or want (so bills and money
// styles treat it right), and how much a month — taken from a category they pick, so the month still adds up and each
// day stays the same. Kip suggests the icon and need/want from the name; they can change both.
// Right after, Kip (Plus) offers to move this month's spending that looks like it — nothing moves without a yes.
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { CaretDown } from 'phosphor-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Kip } from '@/components/Kip';
import { Glass } from '@/components/glow/Glass';
import { Squish } from '@/components/glow/motion';
import { Delta, SaveButton, Sheet } from '@/components/profile/Sheet';
import { useAuth } from '@/lib/auth';
import { CATEGORY, type CatKey } from '@/lib/budget';
import { addToMonth, createCustom, customCats, defaultFrom, guessIcon, guessNeed, MAX_CUSTOM, PICKABLE, type Custom } from '@/lib/customCats';
import { t } from '@/lib/i18n';
import { CAT_ICON3D, ICON3D, type Icon3D } from '@/lib/icons3d';
import { baht } from '@/lib/money';
import { useMonth } from '@/lib/month';
import { colors, fonts, inkA, themed } from '@/theme';

export function CreateCategory({ onClose, onCreated }: { onClose: () => void; onCreated?: (c: Custom) => void }) {
  const { session } = useAuth();
  const { month, save } = useMonth();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<Icon3D | null>(null);
  const [need, setNeed] = useState<boolean | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Until they choose, Kip's guesses from the name fill in.
  const shownIcon = icon ?? (name.trim() ? guessIcon(name) : 'fun');
  const shownNeed = need ?? guessNeed(name);
  const src = month ? (from ?? defaultFrom(month, shownNeed)) : null;
  const srcAmount = month?.spend.find((s) => s.key === src)?.amount ?? 0;
  const amt = Math.min(amount ?? 0, srcAmount);
  const sources = useMemo(() => (month ? month.spend.filter((s) => s.amount > 0 && !s.key.startsWith('c_')) : []), [month]);
  const full = customCats().length >= MAX_CUSTOM;
  const label = name.trim() || t('Your category');

  async function create() {
    if (!session || !month || !src || busy) return;
    if (!name.trim()) return setErr(t('Give it a name first'));
    setBusy(true);
    const made = await createCustom(session.user.id, { name, icon: shownIcon, need: shownNeed });
    if (typeof made === 'string') {
      setBusy(false);
      return setErr(made === 'max' ? t('You can have up to {n} of your own categories', { n: MAX_CUSTOM }) : t('Couldn’t create it — check your internet and try again.'));
    }
    save(addToMonth(month, made.key, amt, src));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setBusy(false);
    if (onCreated) onCreated(made);
    else onClose();
  }

  return (
    <Sheet open onClose={onClose} title={t('Your own category')}>
      {full ? (
        <Text style={styles.note}>{t('You can have up to {n} of your own categories', { n: MAX_CUSTOM })}</Text>
      ) : (
        <>
          <Glass radius={18} innerStyle={styles.field}>
            <Text style={styles.k}>{t('Name')}</Text>
            <TextInput
              value={name}
              onChangeText={(v) => {
                setName(v);
                setErr(null);
              }}
              placeholder={t('Like K-pop, Cat food, Coffee')}
              placeholderTextColor={colors.faint}
              maxLength={24}
              style={styles.v}
              accessibilityLabel={t('Name')}
            />
          </Glass>

          <Text style={styles.cap}>{t('Icon')}</Text>
          <View style={styles.icons}>
            {PICKABLE.map((i) => (
              <Pressable key={i} onPress={() => setIcon(i)} style={[styles.icon, i === shownIcon && styles.iconOn]} accessibilityRole="radio" accessibilityState={{ selected: i === shownIcon }}>
                <Image source={ICON3D[i]} style={{ width: 34, height: 34 }} contentFit="contain" />
              </Pressable>
            ))}
          </View>

          <Text style={styles.cap}>{t('Is it a need or a want?')}</Text>
          <View style={styles.seg}>
            {[true, false].map((n) => (
              <Pressable key={String(n)} onPress={() => setNeed(n)} style={[styles.segBtn, shownNeed === n && styles.segOn]} accessibilityRole="radio" accessibilityState={{ selected: shownNeed === n }}>
                <Text style={[styles.segText, shownNeed === n && { color: colors.paper }]}>{n ? t('Need') : t('Want')}</Text>
              </Pressable>
            ))}
          </View>
          {need === null && name.trim() ? (
            <View style={styles.kip}>
              <Kip mood="happy" size={28} />
              <Text style={styles.kipText}>
                {shownNeed ? t('Kip thinks it’s a need: it comes before fun money. Change it if not.') : t('Kip thinks it’s a want: fun money. Change it if not.')}
              </Text>
            </View>
          ) : null}

          <Text style={styles.cap}>{t('How much a month?')}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Glass radius={18} style={{ flex: 1 }} innerStyle={styles.field}>
              <Text style={styles.k}>{t('Amount')}</Text>
              <TextInput
                value={amount === null ? '' : amount.toLocaleString('en-US')}
                onChangeText={(v) => {
                  const d = v.replace(/[^\d]/g, '');
                  setAmount(d ? Math.min(Number(d), 999_999) : null);
                }}
                keyboardType="number-pad"
                placeholder="฿0"
                placeholderTextColor={colors.faint}
                style={styles.v}
                accessibilityLabel={t('Amount')}
              />
            </Glass>
            <Pressable style={{ flex: 1 }} onPress={() => setPicking((p) => !p)} accessibilityRole="button" accessibilityLabel={t('Take it from')}>
              <Glass radius={18} innerStyle={styles.field}>
                <Text style={styles.k}>{t('Take it from')}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.v, { flexShrink: 1 }]} numberOfLines={1}>
                    {src ? CATEGORY[src as CatKey].name : '—'}
                  </Text>
                  <CaretDown size={12} color={colors.muted} weight="bold" />
                </View>
              </Glass>
            </Pressable>
          </View>
          {picking && (
            <View style={styles.chips}>
              {sources.map((s) => (
                <Pressable
                  key={s.key}
                  onPress={() => {
                    setFrom(s.key);
                    setPicking(false);
                  }}
                  style={[styles.chip, s.key === src && styles.chipOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: s.key === src }}>
                  <Image source={ICON3D[CAT_ICON3D[s.key]]} style={{ width: 24, height: 24 }} contentFit="contain" />
                  <Text style={styles.chipText}>
                    {CATEGORY[s.key].name} · {baht(s.amount)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {amount !== null && amount > srcAmount && src ? (
            <Text style={styles.note}>{t('{from} has {amount}, so that’s the most it can give', { from: CATEGORY[src as CatKey].name, amount: baht(srcAmount) })}</Text>
          ) : null}
          {src && amt > 0 ? (
            <Delta
              rows={[
                { label: CATEGORY[src as CatKey].name, was: baht(srcAmount), now: baht(srcAmount - amt), warn: true },
                { label, was: null, now: baht(amt) },
                { label: t('Each day'), was: null, now: t('No change') },
              ]}
            />
          ) : null}
          {err ? <Text style={styles.err}>{err}</Text> : null}
          <SaveButton label={busy ? t('Creating…') : t('Create {name}', { name: label })} disabled={busy || !name.trim()} onPress={create} />
        </>
      )}
    </Sheet>
  );
}

/** While Kip looks through this month's spending (a few seconds). */
export function Looking({ c, onClose }: { c: Custom; onClose: () => void }) {
  return (
    <Sheet open onClose={onClose} title={t('{name} is ready', { name: c.name })}>
      <View style={styles.kipRow}>
        <Kip mood="think" size={52} />
        <Glass radius={22} style={{ flex: 1 }} innerStyle={styles.bub}>
          <Text style={styles.say}>{t('Let me look through this month for things that fit {name}…', { name: c.name })}</Text>
        </Glass>
      </View>
    </Sheet>
  );
}

/** Right after creating it: Kip offers to move this month's things that look like it. Nothing moves without a yes. */
export function MovePast({
  c,
  items,
  budget,
  busy,
  onMove,
  onClose,
}: {
  c: Custom;
  items: { id: string; name: string; from: CatKey; amount: number }[];
  budget: number;
  busy?: boolean;
  onMove: () => void;
  onClose: () => void;
}) {
  const total = items.reduce((a, i) => a + i.amount, 0);
  return (
    <Sheet open onClose={onClose} title={t('{name} is ready', { name: c.name })}>
      <View style={styles.kipRow}>
        <Kip mood="happy" size={52} />
        <Glass radius={22} style={{ flex: 1 }} innerStyle={styles.bub}>
          <Text style={styles.say}>{t('I found {n} things this month that look like {name}. Move them there?', { n: items.length, name: c.name })}</Text>
        </Glass>
      </View>
      <Glass radius={22} innerStyle={{ paddingHorizontal: 14 }}>
        {items.map((it, i) => (
          <View key={it.id} style={[styles.row, i > 0 && styles.line]}>
            <Image source={ICON3D[CAT_ICON3D[it.from] ?? 'bill']} style={{ width: 34, height: 34 }} contentFit="contain" />
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>
                {it.name}
              </Text>
              <Text style={styles.sub}>{t('{from} → {to}', { from: CATEGORY[it.from]?.name ?? '', to: c.name })}</Text>
            </View>
            <Text style={styles.amt}>{baht(it.amount)}</Text>
          </View>
        ))}
        <View style={[styles.row, styles.line]}>
          <Image source={ICON3D[c.icon]} style={{ width: 34, height: 34 }} contentFit="contain" />
          <Text style={[styles.title, { flex: 1 }]}>{t('{name} this month', { name: c.name })}</Text>
          <Text style={styles.amt}>
            {baht(total)}
            {budget ? <Text style={styles.of}>{t(' of {amount}', { amount: baht(budget) })}</Text> : null}
          </Text>
        </View>
      </Glass>
      <SaveButton label={busy ? t('Moving…') : t('Move them')} disabled={busy} onPress={onMove} />
      <Squish onPress={onClose} accessibilityRole="button">
        <Glass radius={999} innerStyle={{ height: 52, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={styles.title}>{t('Not now')}</Text>
        </Glass>
      </Squish>
    </Sheet>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    field: { paddingHorizontal: 14, paddingVertical: 10, gap: 2 },
    k: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
    v: { fontFamily: fonts.medium, fontSize: 17, color: colors.ink, padding: 0, outlineStyle: 'none' } as never,
    cap: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginBottom: -6, marginLeft: 2 },
    icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    icon: { width: 48, height: 48, borderRadius: 16, backgroundColor: inkA(0.05), alignItems: 'center', justifyContent: 'center' },
    iconOn: { backgroundColor: colors.lime },
    seg: { flexDirection: 'row', backgroundColor: inkA(0.07), borderRadius: 999, padding: 4 },
    segBtn: { flex: 1, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
    segOn: { backgroundColor: colors.ink },
    segText: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
    kip: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -4 },
    kipText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { height: 36, paddingLeft: 6, paddingRight: 12, borderRadius: 999, backgroundColor: inkA(0.05), flexDirection: 'row', alignItems: 'center', gap: 6 },
    chipOn: { backgroundColor: colors.lime },
    chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
    note: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted, textAlign: 'center' },
    err: { fontFamily: fonts.regular, fontSize: 13, color: colors.orangeText, textAlign: 'center' },
    kipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    bub: { paddingVertical: 12, paddingHorizontal: 14, borderTopLeftRadius: 6 },
    say: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.ink },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    line: { borderTopWidth: 1, borderTopColor: inkA(0.06) },
    title: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    sub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 1 },
    amt: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
    of: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  }),
);
