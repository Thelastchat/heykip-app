// Every month (was Bills this month): a see-through wallet stack. Each bill is a card; the open one has "slide to mark paid".
// Paid bills sink to the bottom (tap to undo). Kip's guesses say "Estimate" and "about ฿…".
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Glass } from '@/components/glow/Glass';
import { t } from '@/lib/i18n';
import { baht } from '@/lib/money';
import type { BillType } from '@/lib/budget';
import { colors, fonts, glow, glassA, inkA, themed } from '@/theme';

/** One thing in Every month. `sub` replaces "Monthly" (e.g. "Streaming · monthly"); a yearly item shows its monthly
 *  set-aside (`perMonth`) and how much is ready (`note`). */
export type Bill = { key: string; name: string; amount: number; estimate?: boolean; paid: boolean; type?: BillType; sub?: string; note?: string; perMonth?: boolean };
type Glyph = 'house' | 'bolt' | 'drop' | 'phone' | 'wifi' | 'play' | 'receipt' | 'shield' | 'heart' | 'dumbbell' | 'card';

/** The glyph for each kind of thing paid every month. */
const TYPE_GLYPH: Record<BillType, Glyph> = {
  rent: 'house',
  utilities: 'bolt',
  phone: 'phone',
  internet: 'wifi',
  streaming: 'play',
  fitness: 'dumbbell',
  insurance: 'shield',
  loan: 'card',
  family: 'heart',
  other: 'receipt',
};
export const glyphOfType = (k: BillType) => TYPE_GLYPH[k];

// Each kind gets its own colour — no two close tones (insurance is teal so it never sits next to family's orange).
const KIND: Record<Glyph, string> = {
  house: colors.lavender,
  bolt: colors.lime,
  drop: colors.sky,
  phone: colors.peach,
  wifi: colors.sage,
  play: colors.pink,
  receipt: colors.sand,
  shield: '#7FC4B8', // teal: never next to family's orange
  heart: colors.orange,
  dumbbell: colors.sky,
  card: colors.solid,
};
/** Glyphs drawn light (on the dark circle). */
const LIGHT_GLYPH: Partial<Record<Glyph, boolean>> = { card: true };

export function glyphFor(name: string): Glyph {
  const n = name.toLowerCase();
  if (/rent|ค่าเช่า|ห้อง|condo|dorm|หอ/.test(n)) return 'house';
  if (/elec|ไฟ|pea|mea/.test(n)) return 'bolt';
  if (/water|น้ำ|pwa|mwa/.test(n)) return 'drop';
  if (/internet|wifi|wi-fi|3bb|fiber|เน็ต/.test(n)) return 'wifi';
  if (/phone|mobile|ais|true|dtac|โทร|มือถือ/.test(n)) return 'phone';
  if (/netflix|spotify|youtube|disney|apple|icloud|prime|max|sub/.test(n)) return 'play';
  return 'receipt';
}

const PATHS: Record<Glyph, string> = {
  house: 'M11.3 2.6a1 1 0 0 1 1.4 0l8.6 7.8c.4.4.7.9.7 1.5V20a2 2 0 0 1-2 2h-4.5v-6.5h-5V22H5.5a2 2 0 0 1-2-2v-8.1c0-.6.3-1.1.7-1.5z',
  bolt: 'M13.6 1.8a.6.6 0 0 1 1 .5L13.5 10h6a.6.6 0 0 1 .5 1l-9.6 11.2a.6.6 0 0 1-1-.5L10.5 14h-6a.6.6 0 0 1-.5-1z',
  drop: 'M12 2.2c.3 0 .6.1.8.4C14.6 4.8 20 11 20 15a8 8 0 0 1-16 0c0-4 5.4-10.2 7.2-12.4.2-.3.5-.4.8-.4z',
  phone: 'M8.5 1.5h7a3 3 0 0 1 3 3v15a3 3 0 0 1-3 3h-7a3 3 0 0 1-3-3v-15a3 3 0 0 1 3-3zm2 17.2a.8.8 0 0 0 0 1.6h3a.8.8 0 0 0 0-1.6z',
  wifi: 'M12 4.5c3.9 0 7.4 1.5 10 4a1.2 1.2 0 0 1-1.7 1.7A12 12 0 0 0 12 7c-3.2 0-6.2 1.2-8.3 3.3A1.2 1.2 0 0 1 2 8.6c2.6-2.6 6.1-4.1 10-4.1zm0 4.7c2.6 0 5 1 6.7 2.7a1.2 1.2 0 1 1-1.7 1.7 7.1 7.1 0 0 0-10 0 1.2 1.2 0 0 1-1.7-1.7A9.5 9.5 0 0 1 12 9.2zm0 4.7c1.3 0 2.6.5 3.5 1.4a1.2 1.2 0 0 1-1.7 1.7 2.5 2.5 0 0 0-3.6 0 1.2 1.2 0 0 1-1.7-1.7c.9-.9 2.2-1.4 3.5-1.4zM12 18a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4z',
  play: 'M6 3.5c0-.8.9-1.3 1.6-.9l12.5 7.6c.7.4.7 1.4 0 1.8L7.6 21.4c-.7.4-1.6-.1-1.6-.9z',
  shield: 'M12 1.8l8.2 3.1c.5.2.8.6.8 1.1v5.2c0 5.3-3.6 9.6-8.7 11a1.2 1.2 0 0 1-.6 0C6.6 20.8 3 16.5 3 11.2V6c0-.5.3-.9.8-1.1z',
  heart: 'M12 21.3l-1.4-1.2C5.4 15.5 2 12.4 2 8.6A5.4 5.4 0 0 1 7.5 3.2c1.8 0 3.4.8 4.5 2.1a5.9 5.9 0 0 1 4.5-2.1A5.4 5.4 0 0 1 22 8.6c0 3.8-3.4 6.9-8.6 11.5z',
  dumbbell: 'M5 7.5a1.5 1.5 0 0 1 3 0V11h8V7.5a1.5 1.5 0 0 1 3 0v9a1.5 1.5 0 0 1-3 0V13H8v3.5a1.5 1.5 0 0 1-3 0zM1.5 10a1 1 0 0 1 2 0v4a1 1 0 0 1-2 0zm19 0a1 1 0 0 1 2 0v4a1 1 0 0 1-2 0z',
  card: 'M4 4.5h16a2.5 2.5 0 0 1 2.5 2.5v1.5h-21V7A2.5 2.5 0 0 1 4 4.5zM1.5 11h21v6a2.5 2.5 0 0 1-2.5 2.5H4A2.5 2.5 0 0 1 1.5 17zm4 4a.9.9 0 0 0 0 1.8h4a.9.9 0 0 0 0-1.8z',
  receipt:
    'M5 2.5h14a1 1 0 0 1 1 1V21a.6.6 0 0 1-1 .4l-2-1.4-2 1.4a.6.6 0 0 1-.7 0L12 20l-2.3 1.4a.6.6 0 0 1-.7 0L7 20l-2 1.4a.6.6 0 0 1-1-.4V3.5a1 1 0 0 1 1-1zM8 7.2a.8.8 0 0 0 0 1.6h8a.8.8 0 0 0 0-1.6zm0 4a.8.8 0 0 0 0 1.6h8a.8.8 0 0 0 0-1.6z',
};

/** The bill's solid glyph: from its type when it has one, otherwise picked from its name. */
export function BillGlyph({ name, type }: { name: string; type?: BillType }) {
  const g = type ? TYPE_GLYPH[type] : glyphFor(name);
  return <GlyphIcon g={g} color={LIGHT_GLYPH[g] ? '#FFFFFF' : undefined} />;
}
/** The soft colour behind a bill's glyph. */
export const billTint = (name: string, type?: BillType) => KIND[type ? TYPE_GLYPH[type] : glyphFor(name)];

function GlyphIcon({ g, color = '#2A2A2A', size = 20 }: { g: Glyph; color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={PATHS[g]} fill={color} fillRule="evenodd" />
    </Svg>
  );
}

export function BillStack({ bills, onPaid }: { bills: Bill[]; onPaid: (key: string, paid: boolean) => void }) {
  const unpaid = bills.filter((b) => !b.paid);
  const [openKey, setOpenKey] = useState<string | null>(unpaid[0]?.key ?? null);
  const order = [...unpaid, ...bills.filter((b) => b.paid)];
  // A new pay cycle brings every bill back unpaid: open the first one again so "slide to mark paid" is right there.
  const unpaidKeys = unpaid.map((b) => b.key).join('|');
  useEffect(() => {
    setOpenKey((k) => (k && unpaid.some((b) => b.key === k) ? k : (unpaid[0]?.key ?? null)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unpaidKeys]);
  const total = bills.reduce((a, b) => a + b.amount, 0);
  const left = unpaid.reduce((a, b) => a + b.amount, 0);
  const open = order.find((b) => b.key === openKey && !b.paid) ? openKey : null;

  return (
    <View>
      <View style={styles.sum}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={styles.sumText}>{t('{amount} set aside', { amount: baht(total) })}</Text>
          <Text style={styles.sumText}>{left === 0 ? t('All paid') : t('{amount} to go', { amount: baht(left) })}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 3, height: 8 }}>
          {bills.map((b) => (
            <View key={b.key} style={{ flex: Math.max(b.amount, total * 0.06), borderRadius: 9, backgroundColor: b.paid ? colors.ink : inkA(0.08) }} />
          ))}
        </View>
      </View>

      {order.map((b, i) => {
        const isOpen = open === b.key;
        const last = i === order.length - 1;
        const g = b.type ? TYPE_GLYPH[b.type] : glyphFor(b.name);
        return (
          <Pressable
            key={b.key}
            accessibilityRole="button"
            accessibilityLabel={b.paid ? t('{name} {amount}, paid', { name: b.name, amount: baht(b.amount) }) : `${b.name} ${baht(b.amount)}`}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              if (b.paid) {
                onPaid(b.key, false);
                setOpenKey(b.key);
              } else setOpenKey(isOpen ? null : b.key);
            }}
            style={{ marginTop: i === 0 ? 0 : order[i - 1].key === open ? -14 : -62, zIndex: i }}>
            <Glass radius={26} tint={b.paid ? glassA(0.2) : isOpen ? glassA(0.5) : glassA(0.34)} shadow={false} style={[styles.cardShadow, isOpen && styles.openShadow]}>
              <View style={[styles.card, { height: isOpen ? 152 : last ? 72 : 132 }]}>
                <View style={styles.strip}>
                  <View style={[styles.ic, { backgroundColor: b.paid ? colors.ink : KIND[g] }]}>{b.paid ? <Check /> : <GlyphIcon g={g} color={LIGHT_GLYPH[g] ? '#FFFFFF' : undefined} />}</View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.name, b.paid && styles.done]} numberOfLines={1}>
                      {b.name}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.sub} numberOfLines={1}>
                        {b.paid ? t('Paid') : b.estimate ? t('Estimate') : (b.sub ?? t('Monthly'))}
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.amt, b.paid && styles.done]}>
                      {b.estimate && !b.paid ? t('about {amount}', { amount: baht(b.amount) }) : b.perMonth ? t('{amount}/mo', { amount: baht(b.amount) }) : baht(b.amount)}
                    </Text>
                    {b.note && !b.paid && !isOpen ? <Text style={styles.sub}>{b.note}</Text> : null}
                    {/* An open bill can be edited (approved mockup): rename, amount, how often — in Your month's sheet */}
                    {isOpen && !b.estimate && (b.key === 'rent' || b.key.startsWith('item:')) && (
                      <Pressable
                        onPress={() => router.push(`/month?edit=${encodeURIComponent(b.key === 'rent' ? 'rent' : b.key.slice(5))}` as never)}
                        hitSlop={8}
                        style={[styles.editPill, { marginTop: 4 }]}
                        accessibilityRole="button"
                        accessibilityLabel={t('Edit {name}', { name: b.name })}>
                        <Text style={styles.editText}>{t('Edit')}</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
                {isOpen && <SlideToPay onDone={() => onPaid(b.key, true)} />}
              </View>
            </Glass>
          </Pressable>
        );
      })}

      <Pressable onPress={() => router.push('/month?add=1')} style={styles.add} accessibilityRole="button" accessibilityLabel={t('Add to every month')}>
        <View style={styles.addDot}>
          <Text style={{ color: colors.paper, fontSize: 18, lineHeight: 20 }}>+</Text>
        </View>
        <Text style={styles.addText}>{t('Add to every month')}</Text>
      </Pressable>
    </View>
  );
}

function Check() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path d="M5 12.5 10 17l9-10" stroke={colors.paper} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const KNOB = 44;
function SlideToPay({ onDone }: { onDone: () => void }) {
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  const max = Math.max(0, w - KNOB - 6);
  const done = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setTimeout(onDone, 250);
  };
  const pan = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .onChange((e) => {
      x.value = Math.max(0, Math.min(max, x.value + e.changeX));
    })
    .onEnd(() => {
      if (x.value > max * 0.82) {
        x.value = withTiming(max, { duration: 150 });
        runOnJS(done)();
      } else x.value = withSpring(0, { damping: 14 });
    });
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const fill = useAnimatedStyle(() => ({ width: x.value > 2 ? x.value + KNOB + 3 : 0 }));
  return (
    <View
      style={styles.slide}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessibilityRole="adjustable"
      accessibilityLabel={t('Slide to mark paid')}
      accessibilityActions={[{ name: 'activate', label: t('Mark as paid') }]}
      onAccessibilityAction={done}>
      <Animated.View style={[styles.fill, fill]} />
      <Text style={styles.slideText}>{t('Slide to mark paid')}</Text>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.knob, knob]}>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path d="M5 12h13M13 6l6 6-6 6" stroke={colors.paper} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    editPill: { borderRadius: 999, backgroundColor: inkA(0.06), paddingHorizontal: 10, paddingVertical: 4 },
    editText: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink },
    sum: { marginBottom: 14 },
    sumText: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
    cardShadow: { boxShadow: '0 -6px 16px rgba(17,17,17,0.045)' },
    openShadow: { boxShadow: '0 -6px 16px rgba(17,17,17,0.05), 0 14px 30px rgba(17,17,17,0.08)' },
    card: { paddingHorizontal: 16, paddingVertical: 14 },
    strip: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 44 },
    ic: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    name: { fontFamily: fonts.medium, fontSize: 17, letterSpacing: -0.2, color: colors.ink },
    sub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
    amt: { fontFamily: fonts.medium, fontSize: 17, color: colors.ink, fontVariant: ['tabular-nums'] },
    done: { textDecorationLine: 'line-through', opacity: 0.45 },
    slide: { marginTop: 16, height: 50, borderRadius: 999, backgroundColor: glow.control, borderWidth: 1, borderColor: inkA(0.06), justifyContent: 'center', overflow: 'hidden' },
    fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 999, backgroundColor: colors.limeDeep },
    slideText: { textAlign: 'center', paddingLeft: 34, fontFamily: fonts.medium, fontSize: 14, color: colors.ink, opacity: 0.75 },
    knob: {
      position: 'absolute',
      left: 3,
      top: 2,
      width: KNOB,
      height: KNOB,
      borderRadius: KNOB / 2,
      backgroundColor: colors.ink,
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
    },
    add: {
      marginTop: 10,
      height: 64,
      borderRadius: 26,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: inkA(0.16),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    addDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
    addText: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  }),
);
