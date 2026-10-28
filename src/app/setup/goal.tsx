import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Polaroid } from '@/components/board';
import { CatIcon } from '@/components/CatIcon';
import { DateTile } from '@/components/setup/DateTile';
import { GoalPill, KipSays, SetupScreen, SmallTile, Title, smallValue } from '@/components/setup/kit';
import { Button } from '@/components/ui';
import type { IconKey } from '@/lib/budget';
import { baht } from '@/lib/money';
import { goalDone, useSetup, type GoalKind } from '@/lib/setup/draft';
import { safetyTargetFor } from '@/lib/setup/plan';
import { colors, fonts, pinColors, radius } from '@/theme';

const KINDS: { key: GoalKind; label: string; example: string; icon: IconKey; color: string }[] = [
  { key: 'trip', label: 'Trip', example: 'Copenhagen trip', icon: 'plane', color: colors.lime },
  { key: 'gadget', label: 'Gadget', example: 'New iPhone', icon: 'phone', color: colors.lavender },
  { key: 'car', label: 'Car', example: 'My first car', icon: 'travel', color: colors.sky },
  { key: 'home', label: 'Home', example: 'Condo down payment', icon: 'rent', color: colors.clay },
  { key: 'safety_net', label: 'Safety net', example: 'Rainy-day fund', icon: 'shield', color: colors.sage },
];

// Setup 3/6 · Pin your first goal — or "No goal yet?", which starts with a safety net.
export default function SetupGoal() {
  const { draft, update } = useSetup();
  const example = KINDS.find((k) => k.key === draft.goalKind)?.example ?? 'Copenhagen trip';
  const tooMuchSaved = draft.goalTarget !== null && (draft.goalSaved ?? 0) >= draft.goalTarget;
  const none = draft.noGoal;

  const startSafetyNet = () =>
    update({ noGoal: true, goalKind: 'safety_net', goalTitle: 'Safety net', goalTarget: safetyTargetFor(draft), goalSaved: 0, goalDue: null });
  const pinAGoal = () => update({ noGoal: false, goalKind: 'trip', goalTitle: '', goalTarget: null, goalSaved: null, goalDue: null });

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.7 });
    if (!result.canceled && result.assets[0]) update({ goalPhoto: result.assets[0].uri });
  }

  return (
    <SetupScreen step={3} footer={<Button label="Next" disabled={!goalDone(draft)} onPress={() => router.push('/setup/money')} />}>
      <KipSays>
        {none
          ? 'No goal yet? No problem. Let’s build your safety net first — 3 months of rent and basics. When something exciting comes up, pin it right next to it.'
          : 'Now the fun part. What are you saving for? Pick a photo that makes you want it.'}
      </KipSays>
      <Title>Pin your first goal</Title>

      <View style={styles.photoRow}>
        <Pressable onPress={pickPhoto} accessibilityRole="button" accessibilityLabel={draft.goalPhoto ? 'Change photo' : 'Add a photo'}>
          <Polaroid
            photo={draft.goalPhoto}
            width={168}
            photoHeight={118}
            padding={6}
            bottom={16}
            rotate={-3}
            pin={pinColors[0]}
            empty={none ? { color: colors.sage, icon: <CatIcon name="shield" size={34} /> } : undefined}
          />
        </Pressable>
        <View style={{ flex: 1, gap: 8 }}>
          <Pressable onPress={pickPhoto} style={styles.photoButton} accessibilityRole="button">
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>{draft.goalPhoto ? 'Change photo' : 'Add a photo'}</Text>
          </Pressable>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted }}>Your board holds 3 goals — add the other 2 any time</Text>
        </View>
      </View>

      <Field label="What's it for?" style={{ backgroundColor: none ? '#EDEDEC' : colors.roseBeige }}>
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
        <DateTile label="By when?" value={draft.goalDue} onChange={(goalDue) => update({ goalDue })} style={{ flex: 1 }} emptyLabel={none ? 'No rush' : undefined} />
      </View>
      {tooMuchSaved && <Text style={styles.warn}>You’ve already saved enough for this one — make the goal bigger, or pick another.</Text>}
      {none && !tooMuchSaved && (
        <Text style={styles.note}>{baht(draft.goalTarget ?? 0)} = 3 months of rent, bills and everyday spending. Change it if you like.</Text>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
        {KINDS.map((k) => (
          <GoalPill
            key={k.key}
            label={k.label}
            icon={k.icon}
            color={k.color}
            on={draft.goalKind === k.key}
            onPress={() => update(none && k.key !== 'safety_net' ? { noGoal: false, goalKind: k.key, goalTitle: '', goalDue: null } : { goalKind: k.key })}
          />
        ))}
      </View>

      <Pressable onPress={none ? pinAGoal : startSafetyNet} accessibilityRole="button" hitSlop={8} style={{ alignSelf: 'center', paddingVertical: 4 }}>
        <Text style={styles.link}>{none ? 'I do have a goal — pin it instead' : 'No goal yet? Start with a safety net'}</Text>
      </Pressable>
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
  note: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted, paddingHorizontal: 4 },
  link: { fontFamily: fonts.regular, fontSize: 14, color: colors.ink, textDecorationLine: 'underline' },
});
