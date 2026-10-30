// Bills this month: a see-through wallet stack. Each bill is a card; the open one has "slide to mark paid".
// Paid bills sink to the bottom (tap to undo). Kip's guesses carry a dashed "estimate" tag.
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Glass } from '@/components/glow/Glass';
import { baht } from '@/lib/money';
import { colors, fonts, glow } from '@/theme';

export type Bill = { key: string; name: string; amount: number; estimate?: boolean; paid: boolean };
type Glyph = 'house' | 'bolt' | 'drop' | 'phone' | 'wifi' | 'play' | 'receipt';

// Each kind of bill gets its own soft brand colour (no two close tones); unknown bills share "receipt".
const KIND: Record<Glyph, string> = { house: colors.lavender, bolt: colors.lime, drop: colors.sky, phone: colors.peach, wifi: colors.sage, play: colors.pink, receipt: colors.sand };

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
  receipt:
    'M5 2.5h14a1 1 0 0 1 1 1V21a.6.6 0 0 1-1 .4l-2-1.4-2 1.4a.6.6 0 0 1-.7 0L12 20l-2.3 1.4a.6.6 0 0 1-.7 0L7 20l-2 1.4a.6.6 0 0 1-1-.4V3.5a1 1 0 0 1 1-1zM8 7.2a.8.8 0 0 0 0 1.6h8a.8.8 0 0 0 0-1.6zm0 4a.8.8 0 0 0 0 1.6h8a.8.8 0 0 0 0-1.6z',
};

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
  const total = bills.reduce((a, b) => a + b.amount, 0);
  const left = unpaid.reduce((a, b) => a + b.amount, 0);
  const paidN = bills.length - unpaid.length;
  const open = order.find((b) => b.key === openKey && !b.paid) ? openKey : null;

  return (
    <View>
      <View style={styles.sum}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={styles.sumText}>
            <Text style={{ color: colors.ink, fontFamily: fonts.medium }}>
              {paidN} of {bills.length}
            </Text>{' '}
            paid
          </Text>
          <Text style={styles.sumText}>{left === 0 ? 'All paid 🎉' : `${baht(left)} to go`}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 3, height: 8 }}>
          {bills.map((b) => (
            <View key={b.key} style={{ flex: Math.max(b.amount, total * 0.06), borderRadius: 9, backgroundColor: b.paid ? colors.ink : 'rgba(17,17,17,0.08)' }} />
          ))}
        </View>
      </View>

      {order.map((b, i) => {
        const isOpen = open === b.key;
        const last = i === order.length - 1;
        const g = glyphFor(b.name);
        return (
          <Pressable
            key={b.key}
            accessibilityRole="button"
            accessibilityLabel={`${b.name} ${baht(b.amount)}${b.paid ? ', paid' : ''}`}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              if (b.paid) {
                onPaid(b.key, false);
                setOpenKey(b.key);
              } else setOpenKey(isOpen ? null : b.key);
            }}
            style={{ marginTop: i === 0 ? 0 : order[i - 1].key === open ? -14 : -62, zIndex: i }}>
            <Glass
              radius={26}
              tint={b.paid ? 'rgba(255,255,255,0.2)' : isOpen ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.34)'}
              shadow={false}
              style={[styles.cardShadow, isOpen && styles.openShadow]}>
              <View style={[styles.card, { height: isOpen ? 152 : last ? 72 : 132 }]}>
                <View style={styles.strip}>
                  <View style={[styles.ic, { backgroundColor: b.paid ? colors.ink : KIND[g] }]}>{b.paid ? <Check /> : <GlyphIcon g={g} />}</View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.name, b.paid && styles.done]} numberOfLines={1}>
                      {b.name}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.sub}>{b.paid ? 'Paid ✓' : b.estimate ? 'Usually' : 'Monthly'}</Text>
                      {b.estimate && !b.paid && (
                        <View style={styles.est}>
                          <Text style={styles.estText}>estimate</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={[styles.amt, b.paid && styles.done]}>
                    {b.estimate && !b.paid ? '~' : ''}
                    {baht(b.amount)}
                  </Text>
                </View>
                {isOpen && <SlideToPay onDone={() => onPaid(b.key, true)} />}
              </View>
            </Glass>
          </Pressable>
        );
      })}

      <Pressable onPress={() => router.push('/month')} style={styles.add} accessibilityRole="button" accessibilityLabel="Add a bill">
        <View style={styles.addDot}>
          <Text style={{ color: '#FFFFFF', fontSize: 18, lineHeight: 20 }}>+</Text>
        </View>
        <Text style={styles.addText}>Add a bill</Text>
      </Pressable>
    </View>
  );
}

function Check() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path d="M5 12.5 10 17l9-10" stroke="#FFFFFF" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
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
      accessibilityLabel="Slide to mark paid"
      accessibilityActions={[{ name: 'activate', label: 'Mark as paid' }]}
      onAccessibilityAction={done}>
      <Animated.View style={[styles.fill, fill]} />
      <Text style={styles.slideText}>Slide to mark paid</Text>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.knob, knob]}>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path d="M5 12h13M13 6l6 6-6 6" stroke="#FFFFFF" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
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
  est: { height: 18, paddingHorizontal: 7, borderRadius: 9, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.faint, justifyContent: 'center' },
  estText: { fontFamily: fonts.regular, fontSize: 10, color: colors.muted },
  slide: { marginTop: 16, height: 50, borderRadius: 999, backgroundColor: glow.control, borderWidth: 1, borderColor: 'rgba(17,17,17,0.06)', justifyContent: 'center', overflow: 'hidden' },
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
    borderColor: 'rgba(17,17,17,0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  addText: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
});
