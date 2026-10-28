import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { colors, radius } from '@/theme';

/** A simple money slider: drag or tap anywhere on the track. Snaps to `step`. */
export function Slider({ value, max, step = 100, onChange, label }: { value: number; max: number; step?: number; onChange: (v: number) => void; label: string }) {
  const width = useRef(0);
  const [w, setW] = useState(0);
  const last = useRef(value);
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;

  const at = (x: number) => {
    const v = Math.round((Math.min(1, Math.max(0, x / (width.current || 1))) * max) / step) * step;
    if (v !== last.current) {
      last.current = v;
      if (v === 0 || v === max) Haptics.selectionAsync();
      onChange(v);
    }
  };
  const pan = Gesture.Pan().runOnJS(true).minDistance(0).onBegin((e) => at(e.x)).onUpdate((e) => at(e.x));

  return (
    <GestureDetector gesture={pan}>
      <View
        style={styles.hit}
        onLayout={(e) => {
          width.current = e.nativeEvent.layout.width;
          setW(e.nativeEvent.layout.width);
        }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max, now: value }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => onChange(Math.min(max, Math.max(0, value + (e.nativeEvent.actionName === 'increment' ? step * 5 : -step * 5))))}>
        <View style={styles.track} />
        <View style={[styles.fill, { width: pct * w }]} />
        <View style={[styles.thumb, { left: pct * w - 14 }]} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  hit: { height: 32, justifyContent: 'center' },
  track: { position: 'absolute', left: 0, right: 0, height: 6, borderRadius: radius.pill, backgroundColor: 'rgba(17,17,17,0.10)' },
  fill: { position: 'absolute', left: 0, height: 6, borderRadius: radius.pill, backgroundColor: colors.ink },
  thumb: { position: 'absolute', width: 28, height: 28, borderRadius: radius.pill, backgroundColor: '#FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,0.25)' },
});
