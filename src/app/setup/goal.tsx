import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Check, Warning } from 'phosphor-react-native';
import { useRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Polaroid } from '@/components/board';
import { CatIcon } from '@/components/CatIcon';
import { DateTile } from '@/components/setup/DateTile';
import { GoalPill, KipSays, SetupScreen, SmallTile, Title, smallValue } from '@/components/setup/kit';
import { Button } from '@/components/ui';
import { verdict } from '@/lib/brain';
import type { IconKey } from '@/lib/budget';
import { baht } from '@/lib/money';
import { goalDone, useSetup, type GoalKind } from '@/lib/setup/draft';
import { emergencyTargetFor, inputsFrom, room } from '@/lib/setup/plan';
import { colors, fonts, pinColors, radius } from '@/theme';

const KINDS: { key: GoalKind; label: string; example: string; icon: IconKey; color: string }[] = [
  { key: 'trip', label: 'Trip', example: 'Japan trip', icon: 'plane', color: colors.lime },
  { key: 'gadget', label: 'Gadget', example: 'New iPhone', icon: 'phone', color: colors.lavender },
  { key: 'car', label: 'Car', example: 'My first car', icon: 'travel', color: colors.sky },
  { key: 'home', label: 'Home', example: 'Condo down payment', icon: 'rent', color: colors.clay },
  { key: 'safety_net', label: 'Emergency fund', example: 'Emergency fund', icon: 'shield', color: colors.sage },
  { key: 'monthly', label: 'Save every month', example: 'My savings', icon: 'cash', color: colors.peach },
];
const QUICK = [1000, 3000, 5000, 8000];

// Setup 3/6 · Pin your first goal. Saving every month and an emergency fund are goals too.
export default function SetupGoal() {
  const { draft, update } = useSetup();
  const kind = KINDS.find((k) => k.key === draft.goalKind) ?? KINDS[0];
  const monthly = draft.goalKind === 'monthly';
  const emergency = draft.goalKind === 'safety_net';
  const tooMuchSaved = !monthly && draft.goalTarget !== null && (draft.goalSaved ?? 0) >= draft.goalTarget;
  const inputs = inputsFrom(draft);
  const R = room(inputs);

  function pick(k: GoalKind) {
    if (k === draft.goalKind) return;
    const was = KINDS.find((x) => x.key === draft.goalKind);
    const title = !draft.goalTitle.trim() || draft.goalTitle === was?.example ? '' : draft.goalTitle;
    if (k === 'monthly') update({ goalKind: k, goalTitle: title || 'My savings', goalMonthly: draft.goalMonthly ?? Math.max(500, Math.min(5000, R.comfortable)) });
    else if (k === 'safety_net') update({ goalKind: k, goalTitle: title || 'Emergency fund', goalTarget: emergencyTargetFor({ ...draft, goalKind: k }), goalSaved: draft.goalSaved ?? 0, goalDue: null });
    else update({ goalKind: k, goalTitle: title });
  }

  function next() {
    const v = verdict(inputs);
    router.push(v.kind === 'doable' ? '/setup/money' : '/setup/check');
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.7 });
    if (!result.canceled && result.assets[0]) update({ goalPhoto: result.assets[0].uri });
  }

  const fits = monthly && draft.goalMonthly ? draft.goalMonthly <= R.comfortable : null;
  const tight = monthly && draft.goalMonthly ? draft.goalMonthly > R.comfortable && draft.goalMonthly <= R.most : false;

  return (
    <SetupScreen step={3} footer={<Button label="Next" disabled={!goalDone(draft)} onPress={next} />}>
      <KipSays>
        {monthly
          ? 'Saving every month is a great goal — it builds the habit, and the money is there when life happens.'
          : emergency
            ? 'An emergency fund is the smartest first goal: 3 months of costs, so one bad month never becomes debt.'
            : 'What are you saving for? A trip, a thing — or just a habit of saving. All of them count.'}
      </KipSays>
      <Title>Pin your first goal</Title>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
        {KINDS.map((k) => (
          <GoalPill key={k.key} label={k.label} icon={k.icon} color={k.color} on={draft.goalKind === k.key} onPress={() => pick(k.key)} />
        ))}
      </View>

      <View style={styles.photoRow}>
        <Pressable onPress={pickPhoto} accessibilityRole="button" accessibilityLabel={draft.goalPhoto ? 'Change photo' : 'Add a photo'}>
          <Polaroid
            photo={draft.goalPhoto}
            width={150}
            photoHeight={104}
            padding={6}
            bottom={16}
            rotate={-3}
            pin={pinColors[0]}
            empty={monthly || emergency ? { color: kind.color, icon: <CatIcon name={kind.icon} size={34} /> } : undefined}
          />
        </Pressable>
        <View style={{ flex: 1, gap: 8 }}>
          <Pressable onPress={pickPhoto} style={styles.photoButton} accessibilityRole="button">
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>{draft.goalPhoto ? 'Change photo' : 'Add a photo'}</Text>
          </Pressable>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted }}>Your board holds 3 goals — add the other 2 any time</Text>
        </View>
      </View>

      <SmallTile label={monthly ? 'Name it' : 'What’s it for?'} style={{ backgroundColor: colors.roseBeige }}>
        <TextInput
          value={draft.goalTitle}
          onChangeText={(goalTitle) => update({ goalTitle })}
          placeholder={kind.example}
          placeholderTextColor={colors.faint}
          maxLength={40}
          style={smallValue}
          accessibilityLabel={monthly ? 'Name it' : 'What’s it for?'}
        />
      </SmallTile>

      {monthly ? (
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <BahtField label="Each month" value={draft.goalMonthly} onChange={(goalMonthly) => update({ goalMonthly })} placeholder="5,000" flex={1.3} />
            <SmallTile label="For" style={{ flex: 1 }}>
              <Text style={smallValue}>Ongoing</Text>
            </SmallTile>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {QUICK.map((a) => {
              const on = draft.goalMonthly === a;
              return (
                <Pressable key={a} onPress={() => update({ goalMonthly: a })} style={[styles.quick, on && { backgroundColor: colors.ink }]} accessibilityRole="button">
                  <Text style={[styles.quickText, on && { color: '#FFFFFF', fontFamily: fonts.semibold }]}>{baht(a)}</Text>
                </Pressable>
              );
            })}
          </View>
          {fits !== null && inputs.income > 0 && (
            <View style={[styles.fit, !fits && { backgroundColor: tight ? colors.peach : '#F8E1D8', borderColor: 'transparent' }]}>
              {fits ? <Check size={18} color={colors.ink} weight="bold" /> : <Warning size={18} color={colors.ink} weight="bold" />}
              <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.ink }}>
                {fits ? (
                  <>
                    <Text style={{ fontFamily: fonts.semibold }}>Fits your month.</Text> {baht(draft.goalMonthly ?? 0)} a month = <Text style={{ fontFamily: fonts.semibold }}>{baht((draft.goalMonthly ?? 0) * 12)}</Text> in a year, and you still have {baht(R.left - (draft.goalMonthly ?? 0))} for fun.
                  </>
                ) : tight ? (
                  <>
                    <Text style={{ fontFamily: fonts.semibold }}>Possible, but tight.</Text> Fun money drops to {baht(R.left - (draft.goalMonthly ?? 0))}. {baht(R.comfortable)} a month is comfortable.
                  </>
                ) : (
                  <>
                    <Text style={{ fontFamily: fonts.semibold }}>That’s more than fits.</Text> After rent, bills, living and a safety net, the most is {baht(Math.max(0, R.most))}.
                  </>
                )}
              </Text>
            </View>
          )}
        </>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <BahtField label="How much?" value={draft.goalTarget} onChange={(goalTarget) => update({ goalTarget })} placeholder="30,000" />
            <BahtField label="Saved so far" value={draft.goalSaved} onChange={(goalSaved) => update({ goalSaved })} placeholder="0" />
            <DateTile label="By when?" value={draft.goalDue} onChange={(goalDue) => update({ goalDue })} style={{ flex: 1 }} emptyLabel={emergency ? 'No rush' : undefined} />
          </View>
          {tooMuchSaved && <Text style={styles.warn}>You’ve already saved enough for this one — make the goal bigger, or pick another.</Text>}
          {emergency && !tooMuchSaved && (
            <Text style={styles.note}>{baht(draft.goalTarget ?? 0)} = 3 months of rent, bills and living. Thai banks suggest 3–6 months. Change it if you like.</Text>
          )}
        </>
      )}
    </SetupScreen>
  );
}

function BahtField({ label, value, onChange, placeholder, flex = 1 }: { label: string; value: number | null; onChange: (n: number | null) => void; placeholder: string; flex?: number }) {
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  return (
    <SmallTile label={label} style={{ flex, minWidth: 0 }} onPress={() => input.current?.focus()}>
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
  quick: { flex: 1, height: 36, borderRadius: radius.pill, backgroundColor: colors.grey, alignItems: 'center', justifyContent: 'center' },
  quickText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  fit: { borderRadius: 16, backgroundColor: colors.lime, borderWidth: 1, borderColor: colors.ink, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
});
