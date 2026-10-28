import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Kip, KIP_MOODS, type KipMood } from '@/components/Kip';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Muted, T } from '@/components/ui';
import { colors, radius, shadow } from '@/theme';

// Kip's moods, from the canvas board. A review screen: tap a mood, tap Kip to poke him.
const MOODS: Record<KipMood, { name: string; what: string; where: string }> = {
  idle: { name: 'Idle', what: 'Blinks, and wobbles like jelly every few seconds', where: 'Home · Setup · empty screens' },
  listen: { name: 'Listening', what: 'Eyes open a little wider, body pulses with your voice', where: 'Talk' },
  think: { name: 'Thinking', what: 'Looks up to the side while it works', where: 'Check · “Can I buy?” loading' },
  talk: { name: 'Talking', what: 'Bobs along while it answers you', where: 'Kip’s replies' },
  happy: { name: 'Happy', what: 'Eyes turn into ^ ^ and it bounces', where: 'Saved · goal progress' },
  careful: { name: 'Careful', what: 'Softer eyes glance down, gentle tilt — never angry', where: '“Not yet” answers · over budget' },
  celebrate: { name: 'Celebrate', what: '^ ^ and a big jump', where: 'Goal reached · first ฿1,000 saved' },
};

export default function KipMoods() {
  const insets = useSafeAreaInsets();
  const [mood, setMood] = useState<KipMood>('idle');
  const info = MOODS[mood];

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: insets.bottom + 40, gap: 20 }}>
      <ScreenHeader title="Kip’s moods" />

      <View style={styles.stage}>
        <Kip mood={mood} size={220} />
      </View>

      <View style={{ gap: 4, alignItems: 'center' }}>
        <T variant="title">{info.name}</T>
        <Muted style={{ textAlign: 'center' }}>{info.what}</Muted>
        <Muted style={{ textAlign: 'center', color: colors.faint }}>Shows on: {info.where}</Muted>
      </View>

      <View style={styles.chips}>
        {KIP_MOODS.map((m) => {
          const on = m === mood;
          return (
            <Pressable
              key={m}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setMood(m)}
              style={[styles.chip, on && styles.chipOn]}>
              <T variant="label" style={{ color: colors.ink, fontFamily: on ? 'Geist_600SemiBold' : undefined }}>{MOODS[m].name}</T>
            </Pressable>
          );
        })}
      </View>

      <Muted style={{ textAlign: 'center' }}>Tap Kip to poke him.</Muted>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, borderRadius: radius.cardLg, backgroundColor: colors.grey },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: { paddingHorizontal: 16, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: 'transparent', ...shadow.card },
  chipOn: { backgroundColor: colors.lime, borderColor: colors.ink },
});
