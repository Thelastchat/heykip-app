// Building blocks for the Setup flow, matched to the canvas (v3).
import { router } from 'expo-router';
import { CaretLeft, Lock } from 'phosphor-react-native';
import { useRef, type ComponentRef, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CatIcon } from '@/components/CatIcon';
import { Kip, type KipMood } from '@/components/Kip';
import type { IconKey } from '@/lib/budget';
import { T } from '@/components/ui';
import { colors, fonts, radius, shadow } from '@/theme';

export const STEPS = 6;

/** A Setup page: header, scrolling content, and the main button pinned at the bottom. */
export function SetupScreen({ step, footer, children }: { step?: number; footer: ReactNode; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 16, gap: 14 }}>
        {step !== undefined && <StepHeader step={step} />}
        {children}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 16) + 8, gap: 10 }}>{footer}</View>
    </KeyboardAvoidingView>
  );
}

export function BackButton({ size = 40 }: { size?: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={8}
      onPress={() => router.back()}
      style={[styles.back, { width: size, height: size }]}>
      <CaretLeft size={16} color={colors.ink} weight="bold" />
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
      <View style={styles.bubble}>
        <T style={{ fontSize: 15, lineHeight: 21 }}>{children}</T>
      </View>
    </View>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return (
    <T variant="title" accessibilityRole="header">
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
    <Pressable onPress={() => input.current?.focus()} style={[styles.tile, style]} accessibilityHint={hint}>
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
    </Pressable>
  );
}

/** A small tile for a short value (17pt), used on the goal step. */
export function SmallTile({ label, children, style, onPress }: { label: string; children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.small, style]}>
      <Text style={styles.smallLabel}>{label}</Text>
      {children}
    </Pressable>
  );
}

export const smallValue = { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink, padding: 0 } as const;

export function Segmented<K extends string>({ options, value, onChange }: { options: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <View style={styles.segment} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.key)}
            style={[styles.segmentItem, on && { backgroundColor: colors.ink }]}>
            <Text style={[styles.segmentText, on && { color: '#FFFFFF', fontFamily: fonts.semibold }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Switch({ on }: { on: boolean }) {
  return (
    <View style={[styles.switch, !on && { backgroundColor: 'rgba(17,17,17,0.18)' }]}>
      <View style={[styles.knob, on ? { right: 3 } : { left: 3 }]} />
    </View>
  );
}

export function ToggleRow({ title, sub, on, onToggle }: { title: string; sub: string; on: boolean; onToggle: () => void }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} onPress={onToggle} style={styles.toggle}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>{title}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: 'rgba(17,17,17,0.65)' }}>{sub}</Text>
      </View>
      <Switch on={on} />
    </Pressable>
  );
}

export function RadioCard({ label, sub, on, onPress }: { label: string; sub?: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[styles.radioCard, on && { borderColor: colors.ink, backgroundColor: colors.roseBeige }]}>
      <View style={[styles.radio, on && { borderWidth: 7, borderColor: colors.ink }]} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: on ? fonts.semibold : fonts.medium, fontSize: 15, color: colors.ink }}>{label}</Text>
        {on && sub ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted }}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}

export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={[styles.chip, on && { backgroundColor: colors.ink }]}>
      <Text style={[styles.chipText, on && { color: '#FFFFFF', fontFamily: fonts.semibold }]}>{label}</Text>
    </Pressable>
  );
}

/** A goal-type pill: grey with a black icon; when picked, it fills with its own brand colour and gets a black outline. */
export function GoalPill({ label, icon, color, on, onPress }: { label: string; icon: IconKey; color: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[styles.goalPill, on && { backgroundColor: color, borderColor: colors.ink }]}>
      <CatIcon name={icon} size={18} />
      <Text style={[styles.chipText, on && { fontFamily: fonts.semibold }]}>{label}</Text>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  back: { borderRadius: radius.pill, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', ...shadow.card },
  bars: { flex: 1, flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: 'rgba(17,17,17,0.12)' },
  count: { width: 40, textAlign: 'right', fontFamily: fonts.regular, fontSize: 13, color: colors.muted },

  saysRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  saysKip: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  bubble: { flex: 1, backgroundColor: colors.grey, paddingVertical: 12, paddingHorizontal: 14, borderTopLeftRadius: 4, borderTopRightRadius: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },

  tile: { borderRadius: 18, backgroundColor: colors.grey, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  tileLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  tileValue: { fontFamily: fonts.regular, letterSpacing: -0.6, color: colors.ink, fontVariant: ['tabular-nums'] },
  tileInput: { flex: 1, padding: 0, margin: 0 },

  small: { borderRadius: 16, backgroundColor: colors.grey, paddingVertical: 10, paddingHorizontal: 14 },
  smallLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },

  segment: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.pill, backgroundColor: colors.grey },
  segmentItem: { flex: 1, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },

  switch: { width: 44, height: 26, borderRadius: radius.pill, backgroundColor: colors.ink },
  knob: { position: 'absolute', top: 3, width: 20, height: 20, borderRadius: radius.pill, backgroundColor: '#FFFFFF' },
  toggle: { borderRadius: 18, backgroundColor: colors.lime, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },

  radioCard: { borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: 'transparent', paddingVertical: 13, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, ...shadow.card },
  radio: { width: 22, height: 22, borderRadius: radius.pill, borderWidth: 2, borderColor: '#C9C9C2' },

  chip: { height: 38, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.grey, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  goalPill: { height: 38, paddingLeft: 10, paddingRight: 14, borderRadius: radius.pill, backgroundColor: colors.grey, borderWidth: 1.5, borderColor: 'transparent', flexDirection: 'row', alignItems: 'center', gap: 6 },
});
