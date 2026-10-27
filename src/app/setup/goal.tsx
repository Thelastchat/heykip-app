import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Polaroid } from '@/components/board';
import { DateTile } from '@/components/setup/DateTile';
import { Chip, KipSays, SetupScreen, SmallTile, Title, smallValue } from '@/components/setup/kit';
import { Button } from '@/components/ui';
import { goalDone, useSetup, type GoalKind } from '@/lib/setup/draft';
import { colors, fonts, pinColors, radius } from '@/theme';

const KINDS: { key: GoalKind; label: string; example: string }[] = [
  { key: 'trip', label: 'Trip', example: 'Copenhagen trip' },
  { key: 'gadget', label: 'Gadget', example: 'New iPhone' },
  { key: 'car', label: 'Car', example: 'My first car' },
  { key: 'home', label: 'Home', example: 'Condo down payment' },
  { key: 'safety_net', label: 'Safety net', example: 'Rainy-day fund' },
];

// Setup 3/5 · Pin your first goal.
export default function SetupGoal() {
  const { draft, update } = useSetup();
  const example = KINDS.find((k) => k.key === draft.goalKind)?.example ?? 'Copenhagen trip';
  const tooMuchSaved = draft.goalTarget !== null && (draft.goalSaved ?? 0) >= draft.goalTarget;

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.7 });
    if (!result.canceled && result.assets[0]) update({ goalPhoto: result.assets[0].uri });
  }

  return (
    <SetupScreen step={3} footer={<Button label="Next" disabled={!goalDone(draft)} onPress={() => router.push('/setup/plan')} />}>
      <KipSays>Now the fun part. What are you saving for? Pick a photo that makes you want it.</KipSays>
      <Title>Pin your first goal</Title>

      <View style={styles.photoRow}>
        <Pressable onPress={pickPhoto} accessibilityRole="button" accessibilityLabel={draft.goalPhoto ? 'Change photo' : 'Add a photo'}>
          <Polaroid photo={draft.goalPhoto} width={168} photoHeight={118} padding={6} bottom={16} rotate={-3} pin={pinColors[0]} />
        </Pressable>
        <View style={{ flex: 1, gap: 8 }}>
          <Pressable onPress={pickPhoto} style={styles.photoButton} accessibilityRole="button">
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>{draft.goalPhoto ? 'Change photo' : 'Add a photo'}</Text>
          </Pressable>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted }}>Your board holds 3 goals — add the other 2 any time</Text>
        </View>
      </View>

      <Field label="What's it for?" style={{ backgroundColor: colors.roseBeige }}>
        <TextInput
          value={draft.goalTitle}
          onChangeText={(goalTitle) => update({ goalTitle })}
          placeholder={example}
          placeholderTextColor={colors.faint}
          maxLength={40}
          style={smallValue}
          accessibilityLabel="What's it for?"
        />
      </Field>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <BahtField label="How much?" value={draft.goalTarget} onChange={(goalTarget) => update({ goalTarget })} placeholder="30,000" />
        <BahtField label="Saved so far" value={draft.goalSaved} onChange={(goalSaved) => update({ goalSaved })} placeholder="0" />
        <DateTile label="By when?" value={draft.goalDue} onChange={(goalDue) => update({ goalDue })} style={{ flex: 1 }} />
      </View>
      {tooMuchSaved && <Text style={styles.warn}>You’ve already saved enough for this one — make the goal bigger, or pick another.</Text>}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {KINDS.map((k) => (
          <Chip key={k.key} label={k.label} on={draft.goalKind === k.key} onPress={() => update({ goalKind: k.key })} />
        ))}
      </View>
    </SetupScreen>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: object }) {
  return (
    <SmallTile label={label} style={style}>
      {children}
    </SmallTile>
  );
}

function BahtField({ label, value, onChange, placeholder }: { label: string; value: number | null; onChange: (n: number | null) => void; placeholder: string }) {
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  return (
    <SmallTile label={label} style={{ flex: 1, minWidth: 0 }} onPress={() => input.current?.focus()}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={[smallValue, value === null && { color: colors.faint }]}>฿</Text>
        <TextInput
          ref={input}
          value={value === null ? '' : value.toLocaleString('en-US')}
          onChangeText={(t) => {
            const d = t.replace(/[^\d]/g, '');
            onChange(d ? Math.min(Number(d), 99_999_999) : null);
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.faint}
          keyboardType="number-pad"
          style={[smallValue, { flex: 1 }]}
          accessibilityLabel={label}
        />
      </View>
    </SmallTile>
  );
}

const styles = StyleSheet.create({
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingTop: 8, paddingHorizontal: 4, paddingBottom: 4 },
  photoButton: { alignSelf: 'flex-start', height: 34, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  warn: { fontFamily: fonts.regular, fontSize: 12, color: colors.orange, paddingHorizontal: 4 },
});
