import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/theme';

/** A rounded bar split into coloured parts, with a small label under each part. */
export function StyleBar({ parts, height = 10 }: { parts: [number, string, string][]; height?: number }) {
  return (
    <View style={{ gap: 4 }}>
      <View style={[styles.track, { height }]}>
        {parts.map(([share, color], i) => (
          <View key={i} style={{ flex: share, backgroundColor: color, borderRightWidth: i < parts.length - 1 ? 2 : 0, borderRightColor: '#FFFFFF' }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {parts.map(([share, , label], i) => (
          <Text key={i} style={[styles.label, { flex: share }]} numberOfLines={1}>
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: radius.pill, overflow: 'hidden', boxShadow: 'inset 0 0 0 1px rgba(17,17,17,0.08)' },
  label: { fontFamily: fonts.regular, fontSize: 10, color: colors.muted },
});
