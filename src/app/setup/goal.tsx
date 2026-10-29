import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { CatIcon } from '@/components/CatIcon';
import { Kip } from '@/components/Kip';
import { Pin, Polaroid } from '@/components/board';
import { DateTile } from '@/components/setup/DateTile';
import { picked, SetupScreen, SmallTile, smallValue } from '@/components/setup/kit';
import { Button } from '@/components/ui';
import { room, verdict } from '@/lib/brain';
import { baht } from '@/lib/money';
import { goalDone, useSetup } from '@/lib/setup/draft';
import { applyIdea, deal, GOAL_TYPES, ideasFor, typeInfo, type GoalTypeInfo, type Idea } from '@/lib/setup/goalTypes';
import { emergencyTargetFor, inputsFrom, monthYear, monthsFromNow, parseDay, fullDate } from '@/lib/setup/plan';
import { colors, fonts, radius } from '@/theme';

// Card colours along the carousel, none alike next to each other (from the canvas).
const CARD = [colors.sage, colors.orange, colors.sky, colors.lime, colors.lavender, colors.pink];
const PIN = [colors.orange, colors.sky, colors.lavender, colors.orange, colors.lime, colors.sage];
const CARD_W = 272;
const GAP = 14;
const QUICK = [1000, 2000, 3000, 5000];

// Setup 3/6 · What are you saving for? Kip's ideas (sized to your pay) — or make your own.
export default function SetupGoal() {
  const { draft, update } = useSetup();
  const editing = Boolean(useLocalSearchParams<{ edit?: string }>().edit);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const formY = useRef(0);
  const { width } = useWindowDimensions();

  const inputs = inputsFrom(draft);
  const all = useMemo(() => ideasFor(draft), [draft.monthlyIncome, draft.slowMonth, draft.goodMonth, draft.rent, draft.bills, draft.incomeType]); // eslint-disable-line react-hooks/exhaustive-deps
  const [shuffles, setShuffles] = useState(0);
  const [page, setPage] = useState(0);
  const deck = deal(all, shuffles);
  const cards = useRef<ComponentRef<typeof ScrollView>>(null);

  const type = typeInfo(draft.goalType, draft.goalKind);
  const monthly = draft.goalKind === 'monthly';
  const emergency = draft.goalKind === 'safety_net';

  function shuffle() {
    Haptics.selectionAsync().catch(() => {});
    setShuffles((n) => n + 1);
    setPage(0);
    cards.current?.scrollTo({ x: 0, animated: true });
  }

  function pickIdea(idea: Idea) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    update(applyIdea(draft, idea));
    setTimeout(() => scroll.current?.scrollTo({ y: formY.current - 12, animated: true }), 60);
  }

  function pickType(t: GoalTypeInfo) {
    Haptics.selectionAsync().catch(() => {});
    if (t.key === draft.goalType) return;
    const was = typeInfo(draft.goalType, draft.goalKind);
    const title = !draft.goalTitle.trim() || draft.goalTitle === was.example || all.some((i) => i.title === draft.goalTitle) ? '' : draft.goalTitle;
    const R = room({ ...inputs, goal: { ...inputs.goal, type: t.kind === 'monthly' ? 'monthly' : 'gadget' } });
    if (t.kind === 'monthly') update({ goalType: t.key, goalKind: 'monthly', goalTitle: title, goalMonthly: draft.goalMonthly ?? Math.max(500, Math.min(3000, Math.floor(R.comfortable / 500) * 500)), goalPerMonth: null });
    else if (t.kind === 'safety_net')
      update({ goalType: t.key, goalKind: 'safety_net', goalTitle: title || 'Emergency fund', goalTarget: emergencyTargetFor({ ...draft, goalKind: 'safety_net' }), goalSaved: draft.goalSaved ?? 0, goalDue: null, goalPerMonth: null });
    else update({ goalType: t.key, goalKind: t.kind, goalTitle: title, goalPerMonth: null, ...(draft.goalKind === 'monthly' || draft.goalKind === 'safety_net' ? { goalTarget: null, goalDue: null } : {}) });
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.7 });
    if (!result.canceled && result.assets[0]) update({ goalPhoto: result.assets[0].uri });
  }

  function next() {
    if (editing) return router.back();
    router.push(verdict(inputs).kind === 'doable' ? '/setup/thinking' : '/setup/check');
  }

  const chosenIdea = all.find((i) => i.title === draft.goalTitle && (i.target === draft.goalTarget || (i.monthly !== null && i.monthly === draft.goalMonthly)));

  return (
    <SetupScreen step={3} scrollRef={scroll} footer={<Button label={editing ? 'Update my plan' : 'Next'} disabled={!goalDone(draft)} onPress={next} />}>
      <View style={styles.titleRow}>
        <Text style={styles.h1} accessibilityRole="header">
          What are you{'\n'}saving for?
        </Text>
        <Kip mood="idle" size={70} />
      </View>

      {/* Kip's suggestions */}
      {deck.length > 0 && (
        <View style={styles.suggested}>
          <View style={styles.suggestedHead}>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={styles.kipTag}>
                <CatIcon name="sparkle" size={13} />
                <Text style={styles.kipTagText}>SUGGESTED BY KIP</Text>
              </View>
              <Text style={styles.suggestedSub}>
                Ideas sized to <Text style={{ fontFamily: fonts.semibold, color: colors.ink }}>your {baht(inputs.income)}</Text>. They’re only ideas — nothing is set until you pick one.
              </Text>
            </View>
            <Pressable onPress={shuffle} style={styles.shuffle} accessibilityRole="button" accessibilityLabel="Shuffle ideas" hitSlop={6}>
              <CatIcon name="shuffle" size={17} />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>Shuffle</Text>
            </Pressable>
          </View>

          <ScrollView
            ref={cards}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_W + GAP}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: 22, gap: GAP, paddingTop: 14, paddingBottom: 18 }}
            onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / (CARD_W + GAP)))}
            scrollEventThrottle={32}
            accessibilityLabel="Kip’s suggestions, swipe for more">
            {deck.map((idea, i) => (
              <IdeaCard key={`${shuffles}-${idea.id}`} idea={idea} i={i} on={chosenIdea?.id === idea.id} onPick={() => pickIdea(idea)} draftMonths={(m) => monthYear(monthsFromNow(m, draft))} />
            ))}
          </ScrollView>

          <View style={styles.dotsRow}>
            <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
              {deck.map((d, i) => (
                <View key={d.id} style={[styles.dot, i === Math.min(page, deck.length - 1) && styles.dotOn]} />
              ))}
            </View>
            <Text style={styles.hand}>swipe for more →</Text>
          </View>
        </View>
      )}

      {/* Make your own */}
      <View
        onLayout={(e) => {
          formY.current = e.nativeEvent.layout.y;
        }}
        style={styles.sectionHead}>
        <Text style={styles.h2}>{chosenIdea ? 'Your goal' : 'Or make your own'}</Text>
        <Text style={styles.muted12}>{chosenIdea ? 'change anything' : 'nothing fits? build it'}</Text>
      </View>

      <View style={styles.own}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>1 · WHAT KIND OF GOAL?</Text>
          <Text style={[styles.hand, { fontSize: 18 }]}>swipe →</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -14 }} contentContainerStyle={{ paddingHorizontal: 14, gap: 6 }} accessibilityRole="radiogroup">
          {GOAL_TYPES.map((t) => {
            const on = draft.goalType ? draft.goalType === t.key : t.key === type.key && Boolean(draft.goalTitle);
            return (
              <Pressable key={t.key} onPress={() => pickType(t)} style={styles.sticker} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={t.label}>
                <View style={[styles.stickerDot, t.key === 'other' && !on && styles.stickerOther, on && picked(t.color)]}>
                  <CatIcon name={t.icon} size={t.key === 'other' ? 20 : 26} />
                </View>
                <Text style={[styles.stickerText, on && { fontFamily: fonts.semibold }]} numberOfLines={1}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.label}>2 · MAKE IT YOURS</Text>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', paddingTop: 6 }}>
          <Pressable onPress={pickPhoto} accessibilityRole="button" accessibilityLabel={draft.goalPhoto ? 'Change photo' : 'Add a photo'}>
            <Polaroid
              photo={draft.goalPhoto}
              width={Math.min(132, width * 0.34)}
              photoHeight={Math.min(112, width * 0.29)}
              padding={7}
              bottom={26}
              rotate={-3}
              empty={{
                color: colors.grey,
                icon: (
                  <View style={{ alignItems: 'center', gap: 6 }}>
                    <CatIcon name="camera" size={26} />
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.ink }}>Add a photo</Text>
                  </View>
                ),
              }}>
              <Text style={[styles.hand, styles.polaroidNote]}>{draft.goalPhoto ? 'my dream' : 'your dream here'}</Text>
            </Polaroid>
          </Pressable>
          <View style={{ flex: 1, gap: 8 }}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Name your goal</Text>
              <TextInput
                value={draft.goalTitle}
                onChangeText={(goalTitle) => update({ goalTitle })}
                placeholder={`e.g. ${type.example}`}
                placeholderTextColor={colors.faint}
                maxLength={40}
                style={[smallValue, { fontSize: 16 }]}
                accessibilityLabel="Name your goal"
              />
            </View>
            <Text style={styles.muted12}>A photo of the real thing keeps you going on payday.</Text>
          </View>
        </View>

        {monthly ? (
          <>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <BahtField label="Each month" value={draft.goalMonthly} onChange={(goalMonthly) => update({ goalMonthly })} placeholder="0" flex={1.3} />
              <SmallTile label="For" style={[styles.white, { flex: 1 }]}>
                <Text style={smallValue}>Ongoing</Text>
              </SmallTile>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {QUICK.map((a) => {
                const on = draft.goalMonthly === a;
                return (
                  <Pressable key={a} onPress={() => update({ goalMonthly: a })} style={[styles.quick, on && picked(type.color)]} accessibilityRole="button">
                    <Text style={[styles.quickText, on && { fontFamily: fonts.semibold }]}>{baht(a)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <BahtField label="How much?" value={draft.goalTarget} onChange={(goalTarget) => update({ goalTarget })} placeholder="0" flex={1.2} />
            <BahtField label="Saved so far" value={draft.goalSaved} onChange={(goalSaved) => update({ goalSaved })} placeholder="0" />
            <DateTile label="By when?" value={draft.goalDue} onChange={(goalDue) => update({ goalDue })} style={[styles.white, { flex: 1 }]} emptyLabel={emergency ? 'No rush' : 'Pick'} />
          </View>
        )}

        <FitCheck />
      </View>
    </SetupScreen>
  );
}

function IdeaCard({ idea, i, on, onPick, draftMonths }: { idea: Idea; i: number; on: boolean; onPick: () => void; draftMonths: (m: number) => string }) {
  const t = typeInfo(idea.type);
  const bg = CARD[i % CARD.length];
  const amount = idea.monthly !== null ? baht(idea.monthly) : baht(idea.target ?? 0);
  const chip = idea.monthly !== null ? '♡ every month' : `⏱ ${idea.months} month${idea.months === 1 ? '' : 's'} · ${draftMonths(idea.months ?? 1)}`;
  return (
    <View style={{ width: CARD_W, paddingTop: 2 }}>
      <View style={[styles.card, { backgroundColor: bg, transform: [{ rotate: `${i % 2 ? 1.5 : -1.5}deg` }] }]}>
        <Pin color={PIN[i % PIN.length] === bg ? colors.ink : PIN[i % PIN.length]} size={20} style={{ position: 'absolute', top: -9, left: CARD_W / 2 - 10 }} />
        <View style={styles.cardTop}>
          <View style={styles.cardIcon}>
            <CatIcon name={t.icon} size={23} />
          </View>
          {idea.kipsPick ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Kip mood="happy" size={50} />
              <View style={[styles.tag, { backgroundColor: colors.ink }]}>
                <Text style={[styles.tagText, { color: '#FFFFFF' }]}>KIP’S PICK</Text>
              </View>
            </View>
          ) : (
            <View style={styles.tag}>
              <CatIcon name="sparkle" size={11} />
              <Text style={styles.tagText}>SUGGESTED</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {idea.title}
        </Text>
        <Text style={styles.cardAmount}>
          {amount}
          {idea.monthly !== null && <Text style={{ fontSize: 16 }}>/mo</Text>}
        </Text>
        <View style={styles.chip}>
          <Text style={styles.chipText}>{chip}</Text>
        </View>
        <Text style={styles.why} numberOfLines={3}>
          {idea.why}
        </Text>
        <Pressable onPress={onPick} style={[styles.pickBtn, on && { backgroundColor: '#FFFFFF' }]} accessibilityRole="button" accessibilityLabel={`Pick ${idea.title}`}>
          <Text style={[styles.pickText, on && { color: colors.ink }]}>{on ? 'Picked ✓ — edit it below' : 'Pick this goal'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Kip checks the goal against the person's month as they type. */
function FitCheck() {
  const { draft } = useSetup();
  const inputs = inputsFrom(draft);
  const R = room(inputs);
  const monthly = draft.goalKind === 'monthly';
  let text: ReactNode;
  let mood: 'idle' | 'happy' | 'careful' = 'idle';
  let bg: string = '#FFFFFF';

  if (monthly) {
    const m = draft.goalMonthly ?? 0;
    if (!m) text = 'Pick an amount for each month and I’ll check it fits.';
    else if (m <= R.comfortable) {
      mood = 'happy';
      bg = colors.lime;
      text = (
        <>
          <B>Fits your month.</B> {baht(m)} a month = <B>{baht(m * 12)}</B> in a year, and fun money stays {baht(R.left - m)}.
        </>
      );
    } else if (m <= R.most) {
      mood = 'careful';
      bg = colors.peach;
      text = (
        <>
          <B>Possible, but tight.</B> Fun money drops to {baht(R.left - m)}. {baht(R.comfortable)} a month is comfortable.
        </>
      );
    } else {
      mood = 'careful';
      bg = '#F8E1D8';
      text = (
        <>
          <B>That’s more than fits.</B> After rent, bills, living and a safety net, the most is {baht(Math.max(0, R.most))} a month.
        </>
      );
    }
  } else if (!draft.goalTarget) {
    text = 'Type an amount and I’ll check it fits your month — and tell you a date that works.';
  } else if ((draft.goalSaved ?? 0) >= draft.goalTarget) {
    mood = 'happy';
    text = 'You’ve already saved enough for this one — make it bigger, or pick another goal.';
  } else {
    const v = verdict(inputs);
    const comfy = verdict({ ...inputs, goal: { ...inputs.goal, months: null } });
    const comfyDate = comfy.kind === 'doable' ? monthYear(monthsFromNow(comfy.months, draft)) : null;
    if (v.kind === 'noRoom') {
      mood = 'careful';
      bg = '#F8E1D8';
      text = (
        <>
          <B>Your costs already use up your pay.</B> I’ll show you a few ways to make room next.
        </>
      );
    } else if (!draft.goalDue && draft.goalKind !== 'safety_net') {
      text = comfyDate ? (
        <>
          At a comfortable pace you’d have it by <B>{comfyDate}</B>. Pick that date — or another one.
        </>
      ) : (
        'Pick a date and I’ll check it.'
      );
    } else if (v.kind === 'doable') {
      mood = 'happy';
      bg = colors.lime;
      text = (
        <>
          <B>Fits your month.</B> {baht(v.perMonth)} a month gets you there{draft.goalDue ? ` by ${fullDate(parseDay(draft.goalDue))}` : ` in ${v.months} months`}.
        </>
      );
    } else if (v.kind === 'tight') {
      mood = 'careful';
      bg = colors.peach;
      text = (
        <>
          <B>Possible, but tight.</B> {baht(v.perMonth)} a month leaves {baht(v.funLeft)} for fun.{comfyDate ? ` ${comfyDate} is comfortable.` : ''}
        </>
      );
    } else {
      mood = 'careful';
      bg = '#F8E1D8';
      text = (
        <>
          <B>That date needs {baht(v.need)} a month</B> — more than fits.{comfyDate ? ` Comfortable: ${comfyDate}.` : ''} I’ll show you options next.
        </>
      );
    }
  }

  return (
    <View style={[styles.fit, { backgroundColor: bg }]}>
      <Kip mood={mood} size={34} />
      <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: bg === '#FFFFFF' ? colors.muted : colors.ink }}>{text}</Text>
    </View>
  );
}

const B = ({ children }: { children: ReactNode }) => <Text style={{ fontFamily: fonts.semibold, color: colors.ink }}>{children}</Text>;

function BahtField({ label, value, onChange, placeholder, flex = 1 }: { label: string; value: number | null; onChange: (n: number | null) => void; placeholder: string; flex?: number }) {
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  return (
    <SmallTile label={label} style={[styles.white, { flex, minWidth: 0 }]} onPress={() => input.current?.focus()}>
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
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  h1: { fontFamily: fonts.semibold, fontSize: 30, lineHeight: 34, letterSpacing: -0.7, color: colors.ink },
  h2: { fontFamily: fonts.semibold, fontSize: 19, letterSpacing: -0.3, color: colors.ink },
  muted12: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted },
  hand: { fontFamily: fonts.hand, fontSize: 20, color: '#4A4A44' },

  suggested: { marginHorizontal: -6, paddingTop: 8, paddingBottom: 8 },
  suggestedHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 16 },
  kipTag: { alignSelf: 'flex-start', height: 26, paddingLeft: 9, paddingRight: 11, borderRadius: radius.pill, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', gap: 6 },
  kipTagText: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.6, color: colors.ink },
  suggestedSub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  shuffle: { height: 38, paddingLeft: 11, paddingRight: 14, borderRadius: radius.pill, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 7, boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 6px 16px rgba(0,0,0,0.08)' },
  dotsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(17,17,17,0.2)' },
  dotOn: { width: 18, backgroundColor: colors.ink },

  card: { height: 300, borderRadius: 22, paddingTop: 18, paddingHorizontal: 16, paddingBottom: 16, gap: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 12px 24px rgba(60,40,20,0.16)' },
  cardTop: { height: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.75)', alignItems: 'center', justifyContent: 'center' },
  tag: { height: 24, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.8)', flexDirection: 'row', alignItems: 'center', gap: 4 },
  tagText: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.4, color: colors.ink },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 19, color: colors.ink, marginTop: 2 },
  cardAmount: { fontFamily: fonts.bold, fontSize: 32, letterSpacing: -0.8, color: colors.ink, fontVariant: ['tabular-nums'] },
  chip: { alignSelf: 'flex-start', height: 24, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.8)', justifyContent: 'center' },
  chipText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.ink },
  why: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: 'rgba(17,17,17,0.78)' },
  pickBtn: { height: 44, borderRadius: radius.pill, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  pickText: { fontFamily: fonts.semibold, fontSize: 15, color: '#FFFFFF' },

  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 10, paddingHorizontal: 2 },
  own: { borderRadius: 26, backgroundColor: colors.grey, paddingTop: 18, paddingHorizontal: 14, paddingBottom: 14, gap: 12 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 2 },
  label: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.5, color: colors.muted, paddingHorizontal: 2 },
  sticker: { width: 70, alignItems: 'center', gap: 6 },
  stickerDot: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  stickerOther: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(17,17,17,0.3)', backgroundColor: 'transparent' },
  stickerText: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.ink },
  polaroidNote: { fontSize: 17, textAlign: 'center', color: '#8E8E86', position: 'absolute', left: 0, right: 0, bottom: 2 },
  field: { borderRadius: 16, backgroundColor: '#FFFFFF', paddingVertical: 10, paddingHorizontal: 14, gap: 2 },
  fieldLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  white: { backgroundColor: '#FFFFFF' },
  quick: { flex: 1, height: 36, borderRadius: radius.pill, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  quickText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  fit: { borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
});
