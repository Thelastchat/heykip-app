// The first-use tour (approved mockup): coach marks, not a card. The screen dims, one spot stays bright (cut out of
// the dim, exactly where the real button is), a short line sits next to it, and Next moves on. One tour per screen
// (Home, Your saving plan, Your goals, the + screen), each shown the first time that screen opens; Skip always there.
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useAuth } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { markTourSeen, measureSpot, tourSeen, type Rect, type TourName, type TourSpot } from '@/lib/tour';
import { colors, fonts, themed } from '@/theme';

export type TourStop = { spot: TourSpot; title: string; body: string; round?: boolean };

/** Home (9 stops). The other screens' tours are next to their screens. */
export const homeTour = (): TourStop[] => [
  { spot: 'today', title: t('What you can spend today'), body: t('Set so you stay on track for your goal. It changes as you log money in and out.') },
  { spot: 'month', title: t('Your whole pay month'), body: t('The line is what you’ve spent so far. Stay inside the safe zone and you reach payday with your saving untouched.') },
  { spot: 'week', title: t('Your week'), body: t('Tap a day to see what you spent. Full calendar shows the whole month.') },
  { spot: 'bills', title: t('Monthly bills'), body: t('Tap a bill to open it, slide to mark it paid, or Edit to change it. Kip reminds you the day before it’s due.') },
  { spot: 'plus', title: t('Log what you spent'), body: t('Tap + and type it — or just tell Kip. Slips work too.'), round: true },
  { spot: 'kip', title: t('Ask Kip anything'), body: t('“Can I buy this?” “When’s Netflix due?” Kip answers from your own numbers.'), round: true },
  { spot: 'plan', title: t('Your saving plan'), body: t('Where every baht goes each month: saving first, then bills, then spending. Change any part there.'), round: true },
  { spot: 'goals', title: t('Your goals'), body: t('What you’re saving for, how far you’ve come, and how much is left to reach it.'), round: true },
  { spot: 'you', title: t('You'), body: t('Your account, language, reminders, and what Kip may read.'), round: true },
];

const PAD = 8;
const TIP_W = 264;

/** Mount on a screen; starts on its own (once per person) when `ready`. `scrollBy` lets it reach spots below the fold. */
export function Tour({ name, stops, ready, scrollBy }: { name: TourName; stops: () => TourStop[]; ready: boolean; scrollBy?: (dy: number) => void }) {
  const { session } = useAuth();
  const uid = session?.user.id;
  const { width: W, height: H } = useWindowDimensions();
  const [i, setI] = useState<number | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const list = stops();
  const moved = useRef(false);

  useEffect(() => {
    if (!ready || !uid) return;
    let on = true;
    // A moment after Home has settled, so every spot is laid out.
    const id = setTimeout(async () => {
      if (on && !(await tourSeen(name, uid))) setI(0);
    }, 1200);
    return () => {
      on = false;
      clearTimeout(id);
    };
  }, [ready, uid, name]);

  // Measure the spot for this stop; a spot that isn't on screen is skipped.
  useEffect(() => {
    if (i === null) return;
    let on = true;
    (async () => {
      let r = await measureSpot(list[i].spot);
      // Below the fold (or under the top): scroll it to the upper third, then measure again.
      if (r && scrollBy && (r.y + Math.min(r.height, 200) > H - 150 || r.y < 90)) {
        moved.current = true;
        scrollBy(r.y - H * 0.3);
        await new Promise((ok) => setTimeout(ok, 450));
        r = await measureSpot(list[i].spot);
      }
      if (!on) return;
      if (r) setRect(r);
      else next();
    })();
    return () => {
      on = false;
    };
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  function finish() {
    setI(null);
    setRect(null);
    if (moved.current) scrollBy?.(-100000); // back to the top, where they were
    if (uid) markTourSeen(name, uid);
  }
  function next() {
    if (i === null) return;
    if (i + 1 >= list.length) return finish();
    setRect(null);
    setI(i + 1);
  }

  if (i === null) return null;
  const stop = list[i];
  const last = i === list.length - 1;

  let hole = '';
  let tip: { left: number; top?: number; bottom?: number; arrowX: number; up: boolean } | null = null;
  if (rect) {
    const x = rect.x - PAD;
    const y = rect.y - PAD;
    const w = rect.width + PAD * 2;
    const h = rect.height + PAD * 2;
    const r = stop.round ? Math.min(w, h) / 2 : Math.min(22, h / 2);
    hole = `M${x + r},${y} H${x + w - r} A${r},${r} 0 0 1 ${x + w},${y + r} V${y + h - r} A${r},${r} 0 0 1 ${x + w - r},${y + h} H${x + r} A${r},${r} 0 0 1 ${x},${y + h - r} V${y + r} A${r},${r} 0 0 1 ${x + r},${y} Z`;
    const cx = rect.x + rect.width / 2;
    const left = Math.max(16, Math.min(W - TIP_W - 16, cx - TIP_W / 2));
    const below = rect.y + rect.height / 2 < H / 2;
    tip = below ? { left, top: y + h + 14, arrowX: cx - left, up: true } : { left, bottom: H - y + 14, arrowX: cx - left, up: false };
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={finish}>
      <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Path d={`M0,0 H${W} V${H} H0 Z ${hole}`} fill="rgba(17,17,17,0.62)" fillRule="evenodd" />
      </Svg>
      {tip && (
        <Animated.View key={i} entering={FadeIn.duration(220)} style={[styles.tip, { left: tip.left, top: tip.top, bottom: tip.bottom }]} accessibilityLiveRegion="polite">
          <View style={[styles.arrow, tip.up ? styles.arrowUp : styles.arrowDown, { left: Math.max(18, Math.min(TIP_W - 30, tip.arrowX - 10)) }]} />
          <Text style={styles.title}>{stop.title}</Text>
          <Text style={styles.body}>{stop.body}</Text>
          <View style={styles.foot}>
            {/* Skip lives in the card (it used to float top-right, over some screens' buttons) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={styles.count}>{t('{n} of {total}', { n: i + 1, total: list.length })}</Text>
              {!last && (
                <Pressable onPress={finish} accessibilityRole="button" hitSlop={10}>
                  <Text style={styles.skipT}>{t('Skip')}</Text>
                </Pressable>
              )}
            </View>
            <Pressable onPress={last ? finish : next} style={styles.next} accessibilityRole="button">
              <Text style={styles.nextT}>{last ? t('Got it') : t('Next')}</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </Modal>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    skipT: { fontFamily: fonts.medium, fontSize: 12.5, color: '#111111', textDecorationLine: 'underline' },
    tip: { position: 'absolute', width: TIP_W, backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, boxShadow: '0 12px 30px rgba(0,0,0,0.25)' },
    arrow: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 10, borderRightWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
    arrowUp: { top: -11, borderBottomWidth: 12, borderBottomColor: '#FFFFFF' },
    arrowDown: { bottom: -11, borderTopWidth: 12, borderTopColor: '#FFFFFF' },
    title: { fontFamily: fonts.semibold, fontSize: 15, color: '#111111', marginBottom: 3 },
    body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: '#111111' },
    foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
    count: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted },
    next: { backgroundColor: '#111111', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 16 },
    nextT: { fontFamily: fonts.medium, fontSize: 13, color: '#FFFFFF' },
  }),
);
