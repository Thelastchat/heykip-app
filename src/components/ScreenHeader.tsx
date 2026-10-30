import { router } from 'expo-router';
import { CaretLeft, X } from 'phosphor-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/ui';
import { Glass } from '@/components/glow/Glass';
import { colors, fonts } from '@/theme';

// Round white back/close button + centred title + optional right slot, as on the canvas.
export function ScreenHeader({ title, close, right }: { title?: string; close?: boolean; right?: ReactNode }) {
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={close ? 'Close' : 'Back'} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
        <Glass radius={23} innerStyle={styles.round}>
          {close ? <X size={18} color={colors.ink} weight="bold" /> : <CaretLeft size={20} color={colors.ink} weight="bold" />}
        </Glass>
      </Pressable>
      {title ? <T style={{ fontSize: 17, fontFamily: fonts.medium }}>{title}</T> : <View />}
      <View style={{ minWidth: 46, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  round: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
});
