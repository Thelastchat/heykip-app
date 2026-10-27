import { router } from 'expo-router';
import { AirplaneTilt, Car, Check, Coins, DeviceMobile, House, Plus, Umbrella } from 'phosphor-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CorkBoard, Polaroid, PostIt } from '@/components/board';
import { KipSays, SetupScreen } from '@/components/setup/kit';
import { Button } from '@/components/ui';
import { baht } from '@/lib/money';
import { useSetup, type GoalKind } from '@/lib/setup/draft';
import { makePlan, shortDate } from '@/lib/setup/plan';
import { colors, fonts, pinColors, radius } from '@/theme';

const KIND_ICON: Record<GoalKind, typeof AirplaneTilt> = {
  trip: AirplaneTilt,
  gadget: DeviceMobile,
  car: Car,
  home: House,
  safety_net: Umbrella,
};

// Setup 4/5 · Kip's plan, pinned to your board.
export default function SetupPlan() {
  const { draft } = useSetup();
  const plan = makePlan(draft);
  const target = draft.goalTarget ?? 0;
  const saved = draft.goalSaved ?? 0;
  const pct = Math.round(plan.progress * 100);
  const first = plan.deposits[0];
  const last = plan.deposits[plan.deposits.length - 1];
  const many = plan.deposits.length;
  const word = draft.incomeType === 'regular' ? 'Payday' : 'Money in';
  const Moment = KIND_ICON[draft.goalKind];

  return (
    <SetupScreen step={4} footer={<Button label="Looks good — write my promise" onPress={() => router.push('/setup/sign')} />}>
      <KipSays mood={plan.stretch ? 'careful' : 'happy'}>
        {plan.stretch
          ? `${plan.short} by ${shortDate(plan.due)} is a stretch on this budget. I’d aim for ${plan.suggestDue ? shortDate(plan.suggestDue) : 'a little later'} — but it’s your call, and I’ve pinned it either way.`
          : `Good news — ${plan.short} is doable, without giving up your life. I’ve pinned it to your board.`}
      </KipSays>

      <CorkBoard height={318}>
        <View style={styles.boardTop}>
          <Text style={styles.boardTitle}>Your board</Text>
          <View style={styles.count}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.ink }}>1 of 3 pinned</Text>
          </View>
        </View>

        <Polaroid photo={draft.goalPhoto} width={186} photoHeight={132} pin={pinColors[0]} style={{ position: 'absolute', left: 14, top: 58 }}>
          <View style={{ gap: 5, paddingTop: 7, paddingHorizontal: 3 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <Text style={[styles.hand, { fontSize: 24, flexShrink: 1 }]} numberOfLines={1}>
                {plan.short}
              </Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.ink }}>{pct}%</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct}%` }]} />
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.muted }}>
              {baht(saved)} saved · {baht(Math.max(0, target - saved))} to go
            </Text>
          </View>
        </Polaroid>

        <View style={styles.slot}>
          <View style={styles.slotPlus}>
            <Plus size={14} color={colors.ink} weight="bold" />
          </View>
          <Text style={styles.slotText}>{'2 spots left\nfor later'}</Text>
        </View>

        <PostIt width={112} style={{ position: 'absolute', right: 16, top: 184 }}>
          <Text style={[styles.hand, { fontSize: 19, lineHeight: 20 }]}>
            {plan.short} in {plan.daysToGo} days!
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: 'rgba(17,17,17,0.6)' }}>
            {shortDate(plan.due)} · {plan.stretch ? 'a stretch' : 'on track'}
          </Text>
        </PostIt>
      </CorkBoard>

      <View style={styles.timeline}>
        <Step
          dot={colors.ink}
          icon={<Coins size={15} color="#FFFFFF" weight="fill" />}
          label={`Today · ${shortDate(first.date)}${plan.firstIsPayday ? ' · payday' : ''}`}
          text={many === 1 ? `${baht(first.amount)} goes in → fully saved` : `${baht(first.amount)} goes in → ${Math.round(first.pctAfter * 100)}% there`}
          line
        />
        {many > 1 && (
          <Step
            dot={colors.lime}
            icon={<Check size={15} color={colors.ink} weight="bold" />}
            label={`${word} · ${shortDate(last.date)}`}
            text={`Last ${baht(last.amount)} → fully saved`}
            sub={many > 2 ? `After ${many - 2} more ${many - 2 === 1 ? word.toLowerCase() : `${word.toLowerCase()}s`} of ${baht(first.amount)}` : undefined}
            line
          />
        )}
        <Step dot={colors.lavender} icon={<Moment size={15} color={colors.ink} weight="fill" />} label={shortDate(plan.due)} text={plan.moment.title} sub={plan.moment.sub} />
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Stat label="Save each month" value={baht(plan.monthlySave)} />
        <Stat label="Spend each day" value={baht(plan.dailySpend)} />
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Notes title="What changes" lines={plan.changes} color="#F6FF9B" />
        <Notes title="What stays" lines={plan.stays} color={colors.sky} />
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted, paddingHorizontal: 4 }}>
        Bad month? I’ll adjust the plan — you never start over.
      </Text>
    </SetupScreen>
  );
}

function Step({ dot, icon, label, text, sub, line }: { dot: string; icon: ReactNode; label: string; text: string; sub?: string; line?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, paddingBottom: line ? 9 : 0 }}>
      {line && <View style={styles.connector} />}
      <View style={[styles.stepDot, { backgroundColor: dot }]}>{icon}</View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={styles.stepLabel}>{label.toUpperCase()}</Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.ink }}>{text}</Text>
        {sub ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted }}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: 'rgba(17,17,17,0.6)' }}>{label}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 25, letterSpacing: -0.8, color: colors.ink, fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}

function Notes({ title, lines, color }: { title: string; lines: string[]; color: string }) {
  return (
    <View style={[styles.notes, { backgroundColor: color }]}>
      <Text style={styles.notesTitle}>{title.toUpperCase()}</Text>
      {lines.map((l) => (
        <Text key={l} style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 17, color: colors.ink }}>
          {l}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  boardTop: { position: 'absolute', left: 16, right: 14, top: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  boardTitle: { fontFamily: fonts.hand, fontSize: 27, lineHeight: 30, color: colors.ink },
  count: { height: 26, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.75)', justifyContent: 'center' },
  hand: { fontFamily: fonts.hand, color: colors.ink, lineHeight: 26 },
  track: { height: 6, borderRadius: radius.pill, backgroundColor: 'rgba(17,17,17,0.08)', overflow: 'hidden' },
  fill: { height: 6, borderRadius: radius.pill, backgroundColor: colors.ink },
  slot: {
    position: 'absolute',
    right: 14,
    top: 60,
    width: 122,
    height: 104,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(122,84,48,0.35)',
    borderRadius: 8,
    transform: [{ rotate: '3deg' }],
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  slotPlus: { width: 28, height: 28, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center' },
  slotText: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 14, color: 'rgba(17,17,17,0.6)', textAlign: 'center' },
  timeline: { borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: '#F6F3F0' },
  connector: { position: 'absolute', left: 13, top: 30, bottom: -6, width: 2, backgroundColor: 'rgba(17,17,17,0.12)' },
  stepDot: { width: 28, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  stepLabel: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.4, color: colors.muted },
  stat: { flex: 1, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: colors.grey },
  notes: { flex: 1, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, gap: 6, boxShadow: 'inset 0 0 0 1px rgba(17,17,17,0.10)' },
  notesTitle: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.5, color: 'rgba(17,17,17,0.6)' },
});
