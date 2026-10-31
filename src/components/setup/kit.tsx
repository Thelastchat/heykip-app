// Building blocks for the Setup flow — glow look (Oct 2026): one soft field behind, frosted cards on top,
// picked things in their colour with a black outline.
import { router } from 'expo-router';
import { CaretLeft, Lock } from 'phosphor-react-native';
import { useRef, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CatIcon } from '@/components/CatIcon';
import { Glass } from '@/components/glow/Glass';
import { GlowBackground } from '@/components/glow/GlowBackground';
import { Kip, type KipMood } from '@/components/Kip';
import type { IconKey } from '@/lib/budget';
import { T } from '@/components/ui';
import { colors, fonts, glow, radius } from '@/theme';

export const STEPS = 4;

/** A Setup page: header, scrolling content, and the main button pinned at the bottom. */
export function SetupScreen({ step, footer, children, scrollRef }: { step?: number; footer: ReactNode; children: ReactNode; scrollRef?: RefObject<ComponentRef<typeof ScrollView> | null> }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <GlowBackground />
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 12, paddingHorizontal: 18, paddingBottom: 16, gap: 14 }}
        showsVerticalScrollIndicator={false}>
        {step !== undefined && <StepHeader step={step} />}
        {children}
      </ScrollView>
      <View style={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 16) + 8, gap: 10 }}>{footer}</View>
    </KeyboardAvoidingView>
  );
}

export function BackButton({ size = 40 }: { size?: number }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} onPress={() => router.back()}>
      <Glass radius={size / 2} innerStyle={[styles.back, { width: Math.max(size, 44), height: Math.max(size, 44) }]}>
        <CaretLeft size={17} color={colors.ink} weight="bold" />
      </Glass>
    </Pressable>
  );
}

export function StepHeader({ step }: { step: number }) {
  return (
    <View style={styles.headerRow}>
      <BackButton />
      <View style={styles.bars} accessibilityLabel={`Step ${step} of ${STEPS}`}>
        {Array.from({ length: STEPS }, (_, i) => (
          <View key={i} style={[styles.bar, i < step && { backgroundColor: colors.ink }]} />
        ))}
      </View>
      <Text style={styles.count}>
        {step}/{STEPS}
      </Text>
    </View>
  );
}

export function KipSays({ children, mood = 'idle' }: { children: ReactNode; mood?: KipMood }) {
  return (
    <View style={styles.saysRow}>
      <View style={styles.saysKip}>
        <Kip mood={mood} size={42} />
      </View>
      <Glass radius={20} style={{ flex: 1 }} innerStyle={styles.bubble}>
        <T style={{ fontSize: 15, lineHeight: 21 }}>{children}</T>
      </Glass>
    </View>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return (
    <T accessibilityRole="header" style={styles.title}>
      {children}
    </T>
  );
}

// ---------- inputs ----------

const digits = (s: string) => s.replace(/[^\d]/g, '');
const grouped = (n: number | null) => (n === null ? '' : n.toLocaleString('en-US'));

/** A grey tile with a small label and a big number you type straight into. */
export function MoneyTile({
  label,
  hint,
  value,
  onChange,
  placeholder,
  size = 26,
  style,
  right,
}: {
  label: ReactNode;
  hint?: string;
  value: number | null;
  onChange: (n: number | null) => void;
  placeholder: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  right?: ReactNode;
}) {
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  return (
    <Pressable onPress={() => input.current?.focus()} style={style} accessibilityHint={hint}>
      <Glass radius={20} innerStyle={styles.tile}>
        <View style={{ flex: 1 }}>
          <Text style={styles.tileLabel}>{label}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={[styles.tileValue, { fontSize: size }, value === null && { color: colors.faint }]}>฿</Text>
            <TextInput
              ref={input}
              value={grouped(value)}
              onChangeText={(t) => {
                const d = digits(t);
                onChange(d ? Math.min(Number(d), 99_999_999) : null);
              }}
              placeholder={placeholder}
              placeholderTextColor={colors.faint}
              keyboardType="number-pad"
              style={[styles.tileValue, styles.tileInput, { fontSize: size }]}
              accessibilityLabel={typeof label === 'string' ? label : undefined}
            />
          </View>
        </View>
        {right}
      </Glass>
    </Pressable>
  );
}

/** A small tile for a short value (17pt), used on the goal step. */
export function SmallTile({ label, children, style, onPress }: { label: string; children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={style}>
      <Glass radius={18} innerStyle={styles.small}>
        <Text style={styles.smallLabel}>{label}</Text>
        {children}
      </Glass>
    </Pressable>
  );
}

export const smallValue = { fontFamily: fonts.medium, fontSize: 17, color: colors.ink, padding: 0 } as const;

// Picked = its own brand colour + a black outline, everywhere in the app (ก้อย: easier to see than colour alone).
// Lists pass a colour per option, so when several are picked at once they're still easy to tell apart.
export const picked = (color: string) => ({ backgroundColor: color, borderColor: colors.ink, boxShadow: 'none' });

export function Segmented<K extends string>({ options, value, onChange }: { options: { key: K; label: string; color?: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <Glass radius={999} innerStyle={styles.segment}>
      <View style={{ flexDirection: 'row', gap: 4, flex: 1 }} accessibilityRole="radiogroup">
        {options.map((o) => {
          const on = o.key === value;
          return (
            <Pressable key={o.key} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => onChange(o.key)} style={[styles.segmentItem, on && picked(o.color ?? colors.lime)]}>
              <Text style={[styles.segmentText, on && { color: colors.ink, fontFamily: fonts.semibold }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Glass>
  );
}

export function Switch({ on }: { on: boolean }) {
  return (
    <View style={[styles.switch, !on && { backgroundColor: 'rgba(17,17,17,0.18)' }]}>
      <View style={[styles.knob, on ? { right: 3, backgroundColor: colors.limeDeep } : { left: 3 }]} />
    </View>
  );
}

export function ToggleRow({ title, sub, on, onToggle }: { title: string; sub: string; on: boolean; onToggle: () => void }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} onPress={onToggle}>
      <Glass radius={20} innerStyle={styles.toggle}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.ink }}>{title}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.muted }}>{sub}</Text>
        </View>
        <Switch on={on} />
      </Glass>
    </Pressable>
  );
}

export function RadioCard({ label, sub, on, onPress, color = colors.lime }: { label: string; sub?: string; on: boolean; onPress: () => void; color?: string }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={onPress}>
      <Glass radius={20} tint={on ? color : undefined} innerStyle={[styles.radioCard, on && styles.on]}>
        <View style={[styles.radio, on && { borderWidth: 7, borderColor: colors.ink }]} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: on ? fonts.medium : fonts.regular, fontSize: 15, color: colors.ink }}>{label}</Text>
          {on && sub ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: 'rgba(17,17,17,0.65)', marginTop: 2 }}>{sub}</Text> : null}
        </View>
      </Glass>
    </Pressable>
  );
}

export function Chip({ label, on, onPress, color = colors.lime }: { label: string; on: boolean; onPress: () => void; color?: string }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={onPress}>
      <Glass radius={999} tint={on ? color : undefined} innerStyle={[styles.chip, on && styles.on]}>
        <Text style={[styles.chipText, on && { fontFamily: fonts.medium }, on && color === colors.ink && { color: '#FFFFFF' }]}>{label}</Text>
      </Glass>
    </Pressable>
  );
}

/** A goal-type pill: grey with a black icon; when picked, it fills with its own brand colour and gets a black outline. */
export function GoalPill({ label, icon, color, on, onPress }: { label: string; icon: IconKey; color: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={onPress}>
      <Glass radius={999} tint={on ? color : undefined} innerStyle={[styles.goalPill, on && styles.on]}>
        <CatIcon name={icon} size={18} />
        <Text style={[styles.chipText, on && { fontFamily: fonts.medium }]}>{label}</Text>
      </Glass>
    </Pressable>
  );
}

export function PrivacyNote() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Lock size={14} color={colors.muted} />
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted }}>Kip only uses this to plan for you. Never shared.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { alignItems: 'center', justifyContent: 'center' },
  bars: { flex: 1, flexDirection: 'row', gap: 5 },
  bar: { flex: 1, height: 5, borderRadius: radius.pill, backgroundColor: 'rgba(17,17,17,0.1)' },
  count: { width: 36, textAlign: 'right', fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  title: { fontFamily: fonts.regular, fontSize: 32, lineHeight: 37, letterSpacing: -1, color: colors.ink },
  on: { borderWidth: 1.5, borderColor: colors.ink },

  saysRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  saysKip: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  bubble: { paddingVertical: 11, paddingHorizontal: 14, borderTopLeftRadius: 6 },

  tile: { paddingVertical: 11, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 10 },
  tileLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  tileValue: { fontFamily: fonts.medium, letterSpacing: -0.8, color: colors.ink, fontVariant: ['tabular-nums'] },
  tileInput: { flex: 1, padding: 0, margin: 0, outlineStyle: 'none' } as never,

  small: { paddingVertical: 10, paddingHorizontal: 14 },
  smallLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },

  segment: { padding: 4, height: 48 },
  segmentItem: { flex: 1, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  segmentText: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },

  switch: { width: 48, height: 28, borderRadius: radius.pill, backgroundColor: colors.ink },
  knob: { position: 'absolute', top: 3, width: 22, height: 22, borderRadius: radius.pill, backgroundColor: '#FFFFFF' },
  toggle: { paddingVertical: 12, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },

  radioCard: { paddingVertical: 12, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: glow.glassEdge },
  radio: { width: 22, height: 22, borderRadius: radius.pill, borderWidth: 2, borderColor: '#C9C9C2' },

  chip: { height: 40, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: fonts.regular, fontSize: 14, color: colors.ink },
  goalPill: { height: 40, paddingLeft: 10, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
});
