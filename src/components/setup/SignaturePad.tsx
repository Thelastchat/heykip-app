import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';

import { colors, fonts } from '@/theme';

/**
 * Sign with your finger. The signature is kept as a tiny SVG (a single path),
 * so it stays crisp at any size and costs almost nothing to store.
 * To clear it, the parent remounts the pad (give it a new `key`).
 */
export function SignaturePad({ value, onChange, height = 84 }: { value: string | null; onChange: (svg: string | null) => void; height?: number }) {
  const width = useRef(0);
  const path = useRef(value?.match(/ d="([^"]*)"/)?.[1] ?? '');
  const [d, setD] = useState(path.current);

  const add = (segment: string) => {
    path.current = `${path.current} ${segment}`.trim();
    setD(path.current);
  };

  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((e) => add(`M${e.x.toFixed(1)} ${e.y.toFixed(1)} l0.1 0`))
    .onUpdate((e) => add(`L${e.x.toFixed(1)} ${e.y.toFixed(1)}`))
    .onFinalize(() =>
      onChange(
        path.current
          ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.round(width.current)} ${height}"><path d="${path.current}" fill="none" stroke="#111111" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`
          : null,
      ),
    );

  return (
    <GestureDetector gesture={pan}>
      <View
        style={[styles.pad, { height }]}
        onLayout={(e) => (width.current = e.nativeEvent.layout.width)}
        accessibilityLabel="Signature pad. Sign with your finger.">
        {!d && <Text style={styles.placeholder}>Sign here with your finger</Text>}
        <Svg width="100%" height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
          {d ? <Path d={d} fill="none" stroke={colors.ink} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" /> : null}
        </Svg>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  pad: { justifyContent: 'center', alignItems: 'center' },
  placeholder: { fontFamily: fonts.hand, fontSize: 24, color: 'rgba(17,17,17,0.35)' },
});
