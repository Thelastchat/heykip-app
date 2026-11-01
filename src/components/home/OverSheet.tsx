// "What going over changes" (approved mockup). Tapping the minus number on Home opens it.
// Over today only: the days ahead carry it (a little less each day) — the month and the goal don't move.
// Over the whole month: it comes out of this month's goal saving, then the safety net — never rent or bills.
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Kip } from '@/components/Kip';
import { Glass } from '@/components/glow/Glass';
import { SaveButton, Sheet } from '@/components/profile/Sheet';
import { rich, t } from '@/lib/i18n';
import { ICON3D, type Icon3D } from '@/lib/icons3d';
import { baht } from '@/lib/money';
import { colors, fonts } from '@/theme';

export type OverInfo = {
  spentToday: number;
  dailyToday: number;
  overToday: number;
  overMonth: number;
  daysAfter: number; // days left after today, until payday
  dailyAfter: number; // each of those days now
  leftAtStart: number; // left this month when today started
  leftMonth: number;
  goal: { name: string; perMonth: number; date: string | null; laterDate: string | null } | null;
  fromGoal: number;
  fromSafety: number;
  safetyPerMonth: number;
};

export function OverSheet({ info, onClose }: { info: OverInfo; onClose: () => void }) {
  const month = info.overMonth > 0;
  const b = (s: string) => <Text style={styles.b}>{s}</Text>;
  const lessEach = Math.max(0, info.dailyToday - info.dailyAfter);

  return (
    <Sheet
      open
      onClose={onClose}
      title={month ? t('{amount} over this month', { amount: baht(info.overMonth) }) : t('{amount} over today', { amount: baht(info.overToday) })}
      sub={
        month
          ? info.daysAfter > 0
            ? t('Spending money for this month is used up · {n} days to payday', { n: info.daysAfter })
            : t('Spending money for this month is used up')
          : t('You spent {spent} · today’s money was {daily}', { spent: baht(info.spentToday), daily: baht(info.dailyToday) })
      }>
      <View style={styles.kipRow}>
        <Kip mood="careful" size={58} />
        <Glass radius={22} style={{ flex: 1 }} innerStyle={styles.bub}>
          <Text style={styles.say}>
            {month
              ? info.goal && info.fromGoal > 0
                ? rich('This comes out of **this month’s {goal} saving**, so rent and bills are safe. Until payday, try to spend only on must-haves.', { goal: info.goal.name }, b)
                : rich('This comes out of **your safety net**, so rent and bills are safe. Until payday, try to spend only on must-haves.', undefined, b)
              : info.daysAfter > 0
                ? rich('No stress — I took it from the days ahead, **about {amount} less each day**. Your month and your goal don’t move.', { amount: baht(lessEach) }, b)
                : rich('No stress — payday is tomorrow, and **your month still has room** for it.', undefined, b)}
          </Text>
        </Glass>
      </View>

      <Glass radius={24} innerStyle={{ paddingHorizontal: 16 }}>
        {month ? (
          <>
            {info.goal && info.fromGoal > 0 && (
              <Change
                icon="plane"
                title={t('{goal} saving this month', { goal: info.goal.name })}
                sub={t('{amount} went to spending', { amount: baht(info.fromGoal) })}
                from={baht(info.goal.perMonth)}
                to={baht(info.goal.perMonth - info.fromGoal)}
                warn
              />
            )}
            {info.goal?.date && info.goal.laterDate && info.goal.laterDate !== info.goal.date && (
              <Change
                icon="plane"
                title={t('{goal} arrives', { goal: info.goal.name })}
                sub={t('Unless you save {amount} more later', { amount: baht(info.fromGoal) })}
                from={info.goal.date}
                to={info.goal.laterDate}
                warn
                line
              />
            )}
            {info.fromSafety > 0 && (
              <Change
                icon="shield"
                title={t('Safety net this month')}
                sub={t('{amount} went to spending', { amount: baht(info.fromSafety) })}
                from={baht(info.safetyPerMonth)}
                to={baht(info.safetyPerMonth - info.fromSafety)}
                warn
                line
              />
            )}
            {info.daysAfter > 0 && <Change icon="bowl" title={t('Each day until payday')} sub={t('Next {n} days', { n: info.daysAfter })} from={baht(info.dailyToday)} to={baht(0)} warn line />}
          </>
        ) : (
          <>
            {info.daysAfter > 0 && (
              <Change
                icon="bowl"
                title={t('Each day until payday')}
                sub={t('Next {n} days', { n: info.daysAfter })}
                from={baht(info.dailyToday)}
                to={baht(info.dailyAfter)}
                warn={info.dailyAfter < info.dailyToday}
              />
            )}
            <Change icon="income" title={t('Left this month')} sub={t('Already counted')} from={baht(info.leftAtStart)} to={baht(info.leftMonth)} line={info.daysAfter > 0} />
            {info.goal && (
              <Change icon="plane" title={info.goal.name} sub={t('Still saving {amount} this month', { amount: baht(info.goal.perMonth) })} to={info.goal.date ? `${info.goal.date} ✓` : '✓'} line />
            )}
          </>
        )}
      </Glass>

      <SaveButton label={t('Got it')} onPress={onClose} />
      <Text
        style={styles.link}
        onPress={() => {
          onClose();
          router.push(month ? '/month' : '/history');
        }}
        accessibilityRole="link">
        {month ? t('Change my plan instead') : t('See what I spent today')}
      </Text>
    </Sheet>
  );
}

function Change({ icon, title, sub, from, to, warn, line }: { icon: Icon3D; title: string; sub: string; from?: string; to: string; warn?: boolean; line?: boolean }) {
  return (
    <View style={[styles.row, line && styles.line]}>
      <Image source={ICON3D[icon]} style={{ width: 38, height: 38 }} contentFit="contain" />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
        {from ? <Text style={styles.from}>{from}</Text> : null}
        <Text style={[styles.to, warn && { color: colors.orangeText }]}>{to}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  kipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bub: { padding: 12, paddingHorizontal: 14, borderTopLeftRadius: 6 },
  say: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.ink },
  b: { fontFamily: fonts.semibold },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  line: { borderTopWidth: 1, borderTopColor: 'rgba(17,17,17,0.07)' },
  title: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 1 },
  from: { fontFamily: fonts.regular, fontSize: 13, color: colors.faint, textDecorationLine: 'line-through', fontVariant: ['tabular-nums'] },
  to: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink, fontVariant: ['tabular-nums'] },
  link: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textAlign: 'center', textDecorationLine: 'underline', paddingVertical: 4 },
});
