// The paywall, inside the app: a black sheet made for the one feature someone just tapped, with their own numbers.
// The plan itself is always free — Plus makes Kip do the work. Two ways to pay, priced by Apple for this person's
// storefront: Yearly (picked first, with a free week as its introductory offer) and Monthly. Bought through
// RevenueCat (lib/purchases.ts); the renewal terms, Restore purchases, Terms and Privacy are what App Review 3.1.2 asks for.
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useState, type ReactNode } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Kip } from '@/components/Kip';
import { Squish } from '@/components/glow/motion';
import { planNow, useAuth } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { ICON3D } from '@/lib/icons3d';
import { buyPlus, plusPlans, restorePlus, waitForPlus, type PlusPlan } from '@/lib/purchases';
import { supabase } from '@/lib/supabase';
import { colors, fonts, themed, whiteA, blackA } from '@/theme';
import { DragSheet } from '@/components/DragSheet';

export type PlusFeature = 'talk' | 'customize' | 'automove' | 'goals';

const perks = () => [t('All 4 money styles — switch any time'), t('Talk to Kip · “Can I buy this?”'), t('Payday auto-move & nudges'), t('Customize & locks · 3 goals · slip photos')];

/** Apple's standard licence agreement: HeyKip uses it as its Terms of Use (App Review 3.1.2). */
const TERMS = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
/** "฿690.00" → "฿690": whole prices read cleaner; others ("$4.99") stay as the store wrote them. */
const whole = (price: string) => price.replace(/[.,]00$/, '');

export function PlusSheet({ open, onClose, onUnlocked, title, sub, children }: { open: boolean; onClose: () => void; onUnlocked: () => void; title: string; sub: string; children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { session, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlusPlan[]>([]);
  const [pick, setPick] = useState<'yearly' | 'monthly'>('yearly');

  useEffect(() => {
    if (!open) return;
    let live = true;
    plusPlans().then((p) => live && setPlans(p));
    return () => {
      live = false;
    };
  }, [open]);

  const chosen = plans.find((p) => p.key === pick) ?? plans[0];
  const yearly = plans.find((p) => p.key === 'yearly');
  const monthly = plans.find((p) => p.key === 'monthly');

  const isPlusNow = async () => {
    if (!session) return false;
    const { data } = await supabase.from('profiles').select('plan, trial_ends_at, plan_until').eq('id', session.user.id).maybeSingle();
    return !!data && planNow(data.plan, data.trial_ends_at, data.plan_until) !== 'free';
  };

  async function finish(on: boolean) {
    setBusy(false);
    await refreshProfile();
    if (!on) return setError(t('Payment done. Plus turns on in a moment — you can close this.'));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onClose();
    onUnlocked();
  }

  async function start() {
    if (!session || busy) return;
    setBusy(true);
    setError(null);
    // Apple's purchase sheet. The server turns Plus on when RevenueCat confirms it — the app can't write the plan.
    const result = await buyPlus(chosen);
    if (result === 'cancelled') return setBusy(false);
    if (result === 'unavailable') {
      setBusy(false);
      return setError(t('Plus isn’t available to buy here yet.'));
    }
    if (typeof result === 'object') {
      setBusy(false);
      return setError(t('Couldn’t start Plus: {msg}', { msg: result.error }));
    }
    finish(await waitForPlus(isPlusNow));
  }

  /** Restore purchases: Plus bought on this Apple ID before (a new phone, or another HeyKip account). */
  async function restore() {
    if (!session || busy) return;
    setBusy(true);
    setError(null);
    const found = await restorePlus().catch(() => false);
    if (!found) {
      setBusy(false);
      return setError(t('No Plus found on this Apple ID.'));
    }
    finish(await waitForPlus(isPlusNow));
  }

  const price = chosen ? whole(chosen.price) : '';
  const fine = !chosen
    ? ''
    : chosen.freeWeek
      ? chosen.key === 'yearly'
        ? t('Free for 7 days, then {price} a year. Renews automatically unless you cancel at least 24 hours before, in your Apple ID settings.', { price })
        : t('Free for 7 days, then {price} a month. Renews automatically unless you cancel at least 24 hours before, in your Apple ID settings.', { price })
      : chosen.key === 'yearly'
        ? t('{price} a year. Renews automatically unless you cancel at least 24 hours before, in your Apple ID settings.', { price })
        : t('{price} a month. Renews automatically unless you cancel at least 24 hours before, in your Apple ID settings.', { price });
  const cta = busy
    ? t('Starting…')
    : !chosen
      ? t('Get Plus')
      : chosen.freeWeek
        ? t('Try free for 7 days')
        : chosen.key === 'yearly'
          ? t('Get Plus · {price} a year', { price })
          : t('Get Plus · {price} a month', { price });

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('Close')} />
      <DragSheet onClose={onClose} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
        <View style={styles.grip} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Kip mood="happy" size={58} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.sub}>{sub}</Text>
          </View>
        </View>
        {children}
        <View style={styles.perks}>
          {perks().map((p) => (
            <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.tick}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.onAccent }}>✓</Text>
              </View>
              <Text style={styles.perk}>{p}</Text>
            </View>
          ))}
        </View>
        {yearly || monthly ? (
          <View style={{ flexDirection: 'row', gap: 10 }} accessibilityRole="radiogroup">
            {yearly ? (
              <PlanCard
                on={chosen?.key === 'yearly'}
                onPress={() => setPick('yearly')}
                name={t('Yearly')}
                price={whole(yearly.price)}
                per={t('/ year')}
                line={yearly.perMonth ? t('{price} a month', { price: whole(yearly.perMonth) }) : ''}
                tag={yearly.freeWeek ? t('7 days free') : undefined}
              />
            ) : null}
            {monthly ? (
              <PlanCard
                on={chosen?.key === 'monthly'}
                onPress={() => setPick('monthly')}
                name={t('Monthly')}
                price={whole(monthly.price)}
                per={t('/ month')}
                line={t('Cancel any time')}
                tag={monthly.freeWeek ? t('7 days free') : undefined}
              />
            ) : null}
          </View>
        ) : null}
        {error && <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.orange, textAlign: 'center' }}>{error}</Text>}
        <View style={{ gap: 10 }}>
          <Squish onPress={start} style={[styles.cta, busy && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel={cta}>
            <Text style={styles.ctaText}>{cta}</Text>
          </Squish>
          {fine ? <Text style={styles.fine}>{fine}</Text> : null}
        </View>
        <View style={styles.links}>
          <Pressable onPress={restore} hitSlop={8} accessibilityRole="button">
            <Text style={styles.link}>{t('Restore purchases')}</Text>
          </Pressable>
          <Text style={styles.dot}>·</Text>
          <Pressable onPress={() => Linking.openURL(TERMS)} hitSlop={8} accessibilityRole="link">
            <Text style={styles.link}>{t('Terms')}</Text>
          </Pressable>
          <Text style={styles.dot}>·</Text>
          <Pressable
            onPress={() => {
              onClose();
              router.push('/privacy-policy');
            }}
            hitSlop={8}
            accessibilityRole="link">
            <Text style={styles.link}>{t('Privacy')}</Text>
          </Pressable>
        </View>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
          <Text style={styles.notNow}>{t('Not now')}</Text>
        </Pressable>
      </DragSheet>
    </Modal>
  );
}

/** One way to pay: picked → the lime border and dot. */
function PlanCard({ on, onPress, name, price, per, line, tag }: { on: boolean; onPress: () => void; name: string; price: string; per: string; line: string; tag?: string }) {
  return (
    <Pressable onPress={onPress} style={[styles.planCard, on && styles.planOn]} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${name} ${price} ${per}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={styles.planName}>{name}</Text>
        <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
      </View>
      <Text style={styles.planPrice}>
        {price} <Text style={styles.planPer}>{per}</Text>
      </Text>
      <Text style={styles.planLine}>{line}</Text>
      {tag ? <Text style={styles.planTag}>{tag}</Text> : null}
    </Pressable>
  );
}

// ---------- pictures for each feature (on black) ----------

export function PaySplit({ parts, note }: { parts: { label: string; amount: number; color: string; light?: boolean }[]; note?: string }) {
  return (
    <View style={{ gap: 10, marginTop: 4 }}>
      <View style={{ flexDirection: 'row', gap: 3, height: 46, borderRadius: 14, overflow: 'hidden' }}>
        {parts
          .filter((p) => p.amount > 0)
          .map((p) => (
            <View key={p.label} style={{ flex: p.amount, backgroundColor: p.color, justifyContent: 'flex-end', padding: 7 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: p.light ? colors.onAccent : colors.onSolid }} numberOfLines={1}>
                {p.label}
              </Text>
            </View>
          ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 }}>
        {parts.map((p) => (
          <View key={p.label} style={{ width: '50%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 10 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: p.color }} />
            <Text style={[styles.laneLabel, { flex: 1 }]}>{p.label}</Text>
            <Text style={[styles.laneWhen, { fontSize: 12 }]}>฿{p.amount.toLocaleString('en-US')}</Text>
          </View>
        ))}
      </View>
      {note ? <Text style={styles.trade}>{note}</Text> : null}
    </View>
  );
}

/** A peek at a conversation with Kip. */
export function ChatPeek({ ask, answer }: { ask: string; answer: ReactNode }) {
  return (
    <View style={{ gap: 8, marginTop: 4 }}>
      <View style={[styles.bub, styles.bubMe]}>
        <Text style={[styles.bubText, { color: colors.onAccent }]}>{ask}</Text>
      </View>
      <View style={styles.bub}>
        <Text style={styles.bubText}>{answer}</Text>
      </View>
    </View>
  );
}

/** Sliders with the goal locked: what Customize & locks feels like. */
export function LockPeek({ rows }: { rows: { label: string; amount: number; share: number; locked?: boolean; icon: keyof typeof ICON3D }[] }) {
  return (
    <View style={{ gap: 12, marginTop: 4 }}>
      {rows.map((r) => (
        <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Image source={ICON3D[r.icon]} style={{ width: 30, height: 30 }} contentFit="contain" />
          <Text style={[styles.laneLabel, { width: 64, color: colors.onSolid }]} numberOfLines={1}>
            {r.label}
          </Text>
          <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: whiteA(0.12) }}>
            <View style={{ width: `${r.share * 100}%`, height: 6, borderRadius: 3, backgroundColor: r.locked ? colors.limeDeep : colors.onSolid }} />
            <View style={[styles.knob, { left: `${r.share * 100}%` }]}>{r.locked ? <Text style={{ fontSize: 9 }}>🔒</Text> : null}</View>
          </View>
          <Text style={[styles.laneWhen, { width: 62, textAlign: 'right' }]}>฿{r.amount.toLocaleString('en-US')}</Text>
        </View>
      ))}
    </View>
  );
}

/** Three goal slots: one pinned, two waiting. */
export function GoalSlots({ first }: { first: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
      <View style={[styles.slot, { backgroundColor: colors.limeDeep }]}>
        <Image source={ICON3D.plane} style={{ width: 34, height: 34 }} contentFit="contain" />
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.onAccent }} numberOfLines={1}>
          {first}
        </Text>
      </View>
      {[t('A new phone'), t('Moving out')].map((s) => (
        <View key={s} style={[styles.slot, { borderWidth: 1.5, borderStyle: 'dashed', borderColor: whiteA(0.25) }]}>
          <Text style={{ fontSize: 22, color: whiteA(0.5) }}>+</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: whiteA(0.5) }} numberOfLines={1}>
            {s}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: blackA(0.4) },
    sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 32, borderTopRightRadius: 32, backgroundColor: colors.solid, paddingTop: 10, paddingHorizontal: 20, gap: 16 },
    grip: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: whiteA(0.2) },
    title: { fontFamily: fonts.medium, fontSize: 22, letterSpacing: -0.4, color: colors.onSolid },
    sub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: whiteA(0.6), marginTop: 2 },
    perks: { borderRadius: 20, backgroundColor: whiteA(0.06), paddingVertical: 12, paddingHorizontal: 14, gap: 9 },
    perk: { fontFamily: fonts.regular, fontSize: 13, color: whiteA(0.85) },
    tick: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.limeDeep, alignItems: 'center', justifyContent: 'center' },
    cta: { height: 56, borderRadius: 999, backgroundColor: colors.limeDeep, alignItems: 'center', justifyContent: 'center' },
    ctaText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.onAccent },
    fine: { textAlign: 'center', fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 16, color: whiteA(0.5) },
    links: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: -4 },
    link: { fontFamily: fonts.regular, fontSize: 12, color: whiteA(0.6) },
    dot: { fontFamily: fonts.regular, fontSize: 12, color: whiteA(0.3) },
    planCard: { flex: 1, borderRadius: 18, borderWidth: 1.5, borderColor: whiteA(0.12), backgroundColor: whiteA(0.04), paddingVertical: 12, paddingHorizontal: 14, gap: 2 },
    planOn: { borderColor: colors.limeDeep, backgroundColor: whiteA(0.08) },
    planName: { fontFamily: fonts.medium, fontSize: 13, color: whiteA(0.75) },
    planPrice: { fontFamily: fonts.semibold, fontSize: 22, letterSpacing: -0.4, color: colors.onSolid, fontVariant: ['tabular-nums'], marginTop: 4 },
    planPer: { fontFamily: fonts.regular, fontSize: 12, letterSpacing: 0, color: whiteA(0.55) },
    planLine: { fontFamily: fonts.regular, fontSize: 12, color: whiteA(0.55) },
    planTag: { fontFamily: fonts.medium, fontSize: 12, color: colors.limeDeep, marginTop: 4 },
    radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: whiteA(0.3), alignItems: 'center', justifyContent: 'center' },
    radioOn: { borderColor: colors.limeDeep },
    radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.limeDeep },
    notNow: { textAlign: 'center', fontFamily: fonts.medium, fontSize: 14, color: whiteA(0.85), textDecorationLine: 'underline' },
    trade: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: whiteA(0.55) },
    laneLabel: { fontFamily: fonts.regular, fontSize: 12, color: whiteA(0.6) },
    laneWhen: { fontFamily: fonts.medium, fontSize: 13, color: colors.onSolid, fontVariant: ['tabular-nums'] },
    bub: { alignSelf: 'flex-start', maxWidth: '86%', borderRadius: 16, borderBottomLeftRadius: 5, backgroundColor: whiteA(0.1), paddingVertical: 9, paddingHorizontal: 12 },
    bubMe: { alignSelf: 'flex-end', borderBottomLeftRadius: 16, borderBottomRightRadius: 5, backgroundColor: colors.lime },
    bubText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.onSolid },
    knob: { position: 'absolute', top: -7, width: 20, height: 20, marginLeft: -10, borderRadius: 10, backgroundColor: colors.onSolid, alignItems: 'center', justifyContent: 'center' },
    slot: { flex: 1, height: 84, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 6 },
  }),
);
