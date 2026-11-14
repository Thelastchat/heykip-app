// Kip notices first (approved mockup): when the app's maths spots something, Kip's line on Home grows into this
// card — the problem in one sentence, the exact change, "Do it" and "Not now". After Do it it shrinks to a "Done"
// line with Undo. One card at a time; "1 of 2" says another is waiting.
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { KipStill } from '@/components/KipStill';
import { Squish } from '@/components/glow/motion';
import { CATEGORY } from '@/lib/budget';
import { monthShort, rich, t } from '@/lib/i18n';
import { CAT_ICON3D, ICON3D } from '@/lib/icons3d';
import { baht } from '@/lib/money';
import type { Notice } from '@/lib/notice';
import { monthYear, ordinal } from '@/lib/setup/plan';
import { colors, fonts, inkA, themed } from '@/theme';

const B = (s: string) => <Text style={{ fontFamily: fonts.semibold, color: colors.ink }}>{s}</Text>;
const O = (s: string) => <Text style={{ fontFamily: fonts.semibold, color: colors.orangeText }}>{s}</Text>;
const day = (d: Date) => `${d.getDate()} ${monthShort(d.getMonth())}`;

type Props = { notice: Notice; index: number; count: number; busy: boolean; onDo: () => void; onLater: () => void };

export function KipNotice({ notice: n, index, count, busy, onDo, onLater }: Props) {
  const billName = n.kind === 'billdue' ? (n.key === 'rent' ? t('Rent') : n.name) : '';
  const title =
    n.kind === 'runout'
      ? t('{category} won’t last to payday', { category: t(CATEGORY[n.key].name) })
      : n.kind === 'billdue'
        ? n.late === 0
          ? t('{name} is due today', { name: billName })
          : t('{name} was due {date}', { name: billName, date: day(n.date) })
        : n.kind === 'sub'
          ? t('{name} looks like a subscription', { name: n.name })
          : n.kind === 'subprice'
            ? t('{name} went up', { name: n.name })
            : n.kind === 'substop'
              ? t('{name} hasn’t charged in 2 months', { name: n.name })
              : n.kind === 'substream'
                ? t('{n} streaming apps · {amount} a year', { n: n.names.length, amount: baht(n.perYear) })
                : t('{amount} left over last month', { amount: baht(n.amount) });
  const yes =
    n.kind === 'billdue'
      ? t('Paid')
      : n.kind === 'sub'
        ? t('Add it')
        : n.kind === 'subprice'
          ? t('Make it {amount}', { amount: baht(n.now) })
          : n.kind === 'substop'
            ? t('Remove it')
            : n.kind === 'substream'
              ? t('Got it')
              : t('Do it');
  const no =
    n.kind === 'leftover' || n.kind === 'substop'
      ? t('Keep it')
      : n.kind === 'billdue'
        ? t('Not yet')
        : n.kind === 'sub'
          ? t('Not a bill')
          : n.kind === 'substream'
            ? null
            : t('Not now');
  const label = `${t('Kip noticed')}: ${title}`;
  return (
    <View style={styles.card} accessibilityLabel={label}>
      <View style={styles.top}>
        <KipStill size={26} />
        <Text style={styles.kicker}>{t('Kip noticed')}</Text>
        {count > 1 && <Text style={[styles.kicker, { marginLeft: 'auto' }]}>{t('{n} of {total}', { n: index + 1, total: count })}</Text>}
      </View>
      <Text style={styles.title}>{title}</Text>
      {n.kind === 'runout' ? (
        <>
          <Text style={styles.body}>
            {rich(
              'You have **{left}** for {category} and spend about **{perDay} a day**. At this pace it runs out on **{date}**, {n} days before payday.',
              { left: baht(n.left), category: t(CATEGORY[n.key].name).toLowerCase(), perDay: baht(n.perDay), date: day(n.runsOut), n: n.daysEarly },
              (part) => (part === day(n.runsOut) ? O(part) : B(part)),
            )}
          </Text>
          <View style={styles.box}>
            {n.moves.map((m, i) => (
              <View key={m.key} style={[styles.row, i > 0 && styles.line]}>
                <Image source={ICON3D[CAT_ICON3D[m.key]]} style={{ width: 24, height: 24 }} contentFit="contain" />
                <Text style={styles.name} numberOfLines={1}>
                  {t(CATEGORY[m.key].name)}
                </Text>
                <Text style={styles.was}>{baht(m.was)}</Text>
                <Text style={styles.now}>{baht(m.now)}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.after}>{t('Then {category} lasts to payday at about {perDay} a day.', { category: t(CATEGORY[n.key].name), perDay: baht(n.perDayAfter) })}</Text>
        </>
      ) : n.kind === 'billdue' ? (
        <Text style={styles.body}>{rich('**{amount}** is set aside for it. Paid already?', { amount: baht(n.amount) }, B)}</Text>
      ) : n.kind === 'sub' ? (
        <>
          <Text style={styles.body}>
            {rich('**{amount}** around the **{day}**, 3 months running. It isn’t in Every month, so it comes out of your spending money.', { amount: baht(n.amount), day: ordinal(n.day), n: n.day }, B)}
          </Text>
          <View style={styles.box}>
            {n.dates.map((d, i) => (
              <View key={i} style={[styles.row, i > 0 && styles.line]}>
                <Text style={styles.name}>{day(d)}</Text>
                <Text style={styles.now}>{baht(n.amount)}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.after}>
            {[
              t('Add it: {amount} set aside every month, due the {day}, reminder the day before.', { amount: baht(n.amount), day: ordinal(n.day), n: n.day }),
              n.from.guess > 0 ? t('{amount} comes out of Kip’s guess for other bills.', { amount: baht(n.from.guess) }) : '',
              n.from.fun > 0 ? t('{amount} less fun money a month.', { amount: baht(n.from.fun) }) : '',
              n.from.goal > 0 ? t('{amount} less saving a month.', { amount: baht(n.from.goal) }) : '',
            ]
              .filter(Boolean)
              .join(' ')}
          </Text>
        </>
      ) : n.kind === 'subprice' ? (
        <Text style={styles.body}>{rich('Your last 2 payments were **{now}**. Every month still sets aside **{was}**.', { now: baht(n.now), was: baht(n.was) }, B)}</Text>
      ) : n.kind === 'substop' ? (
        <Text style={styles.body}>{rich('Cancelled? Removing it gives **{amount} a month** back to your saving.', { amount: baht(n.amount) }, B)}</Text>
      ) : n.kind === 'substream' ? (
        <Text style={styles.body}>
          {t('{list} a month. Just so you see it. Keeping them is fine.', { list: n.names.map((x) => `${x.name} ${baht(x.amount)}`).join(' + ') })}
        </Text>
      ) : (
        <Text style={styles.body}>
          {n.will && n.was && n.will.getTime() !== n.was.getTime()
            ? rich(
                'By what you logged, last pay month had **{amount}** left. If it’s still in your account, put it toward {goal}? It arrives **{will}** instead of {was}.',
                { amount: baht(n.amount), goal: n.goalName, will: monthYear(n.will), was: monthYear(n.was) },
                B,
              )
            : rich('By what you logged, last pay month had **{amount}** left. If it’s still in your account, put it toward {goal}?', { amount: baht(n.amount), goal: n.goalName }, B)}
        </Text>
      )}
      <View style={styles.btns}>
        <Squish style={[styles.do, busy && { opacity: 0.5 }]} disabled={busy} onPress={onDo} accessibilityRole="button" accessibilityLabel={yes}>
          <Text style={styles.doT}>{busy ? t('Saving…') : yes}</Text>
        </Squish>
        {no && (
          <Squish style={styles.no} disabled={busy} onPress={onLater} accessibilityRole="button" accessibilityLabel={no}>
            <Text style={styles.noT}>{no}</Text>
          </Squish>
        )}
      </View>
    </View>
  );
}

/** After Do it: what changed, with Undo. */
export function KipDone({ text, onUndo, busy }: { text: string; onUndo: () => void; busy: boolean }) {
  return (
    <View style={styles.done}>
      <KipStill size={32} />
      <Text style={styles.doneT} numberOfLines={1}>
        <Text style={{ fontFamily: fonts.semibold }}>{t('Done')}</Text> · {text}
      </Text>
      <Squish style={[styles.undo, busy && { opacity: 0.5 }]} disabled={busy} onPress={onUndo} accessibilityRole="button" accessibilityLabel={t('Undo')}>
        <Text style={styles.undoT}>{t('Undo')}</Text>
      </Squish>
    </View>
  );
}

const shadow = '0 1px 2px rgba(0,0,0,0.04), 0 10px 30px rgba(0,0,0,0.06)';
const styles = themed(() =>
  StyleSheet.create({
    card: { borderRadius: 26, backgroundColor: colors.paper, padding: 16, boxShadow: shadow },
    top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    kicker: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted },
    title: { fontFamily: fonts.semibold, fontSize: 18, letterSpacing: -0.3, color: colors.ink, marginTop: 10 },
    body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink, marginTop: 4 },
    box: { marginTop: 12, borderRadius: 16, backgroundColor: inkA(0.04), paddingHorizontal: 12, paddingVertical: 2 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
    line: { borderTopWidth: 1, borderTopColor: inkA(0.06) },
    name: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.ink },
    was: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textDecorationLine: 'line-through', fontVariant: ['tabular-nums'] },
    now: { minWidth: 64, textAlign: 'right', fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, fontVariant: ['tabular-nums'] },
    after: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.muted, marginTop: 8 },
    btns: { flexDirection: 'row', gap: 8, marginTop: 12 },
    do: { flex: 1, height: 44, borderRadius: 999, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
    doT: { fontFamily: fonts.medium, fontSize: 15, color: colors.paper },
    no: { height: 44, paddingHorizontal: 16, borderRadius: 999, backgroundColor: inkA(0.05), alignItems: 'center', justifyContent: 'center' },
    noT: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    done: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingLeft: 8, paddingRight: 8, borderRadius: 999, backgroundColor: colors.paper, boxShadow: shadow },
    doneT: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.ink },
    undo: { height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: inkA(0.06), alignItems: 'center', justifyContent: 'center' },
    undoT: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  }),
);
