import { router } from 'expo-router';
import { CaretLeft, X } from 'phosphor-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/ui';
import { colors, shadow } from '@/theme';

// Round white back/close button + centred title + optional right slot, as on the canvas.
export function ScreenHeader({ title, close, right }: { title?: string; close?: boolean; right?: ReactNode }) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={close ? 'Close' : 'Back'}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={styles.round}>
        {close ? <X size={18} color={colors.ink} weight="bold" /> : <CaretLeft size={20} color={colors.ink} weight="bold" />}
      </Pressable>
      {title ? <T variant="bodyStrong" style={{ fontSize: 16 }}>{title}</T> : <View />}
      <View style={{ minWidth: 46, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  round: { width: 46, height: 46, borderRadius: 999, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', ...shadow.card },
});
