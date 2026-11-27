// Kip notices first (approved mockup): when the app's maths spots something, Kip's line on Home grows into this
// card — the problem in one sentence, the exact change, "Do it" and "Not now". After Do it it shrinks to a "Done"
// line with Undo. One card at a time; "1 of 2" says another is waiting.
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { KipStill } from '@/components/KipStill';
import { Glass } from '@/components/glow/Glass';
import { Squish } from '@/components/glow/motion';
import { CATEGORY } from '@/lib/budget';
import { monthLong, monthShort, rich, t } from '@/lib/i18n';
import type { PlusNote } from '@/lib/plusBill';
import { CAT_ICON3D, ICON3D } from '@/lib/icons3d';
import { baht } from '@/lib/money';
import type { Notice } from '@/lib/notice';
import type { Recap } from '@/lib/recap';
import { monthYear, ordinal } from '@/lib/setup/plan';
import { colors, fonts, glassA, inkA, themed } from '@/theme';

const B = (s: string) => <Text style={{ fontFamily: fonts.semibold, color: colors.ink }}>{s}</Text>;
const O = (s: string) => <Text style={{ fontFamily: fonts.semibold, color: colors.orangeText }}>{s}</Text>;
const day = (d: Date) => `${d.getDate()} ${monthShort(d.getMonth())}`;

type Props = { notice: Notice; index: number; count: number; busy: boolean; isPlus?: boolean; onDo: () => void; onLater: () => void; onLocked?: () => void };

export function KipNotice({ notice: n, index, count, busy, isPlus = false, onDo, onLater, onLocked }: Props) {
  if (n.kind === 'recap') return <RecapCard r={n.recap} isPlus={isPlus} onRead={onDo} onLater={onLater} onLocked={onLocked} />;
  const billName = n.kind === 'billdue' ? (n.key === 'rent' ? t('Rent') : n.name) : '';
  const title =
    n.kind === 'runout'
      ? t('{category} won’t last to payday', { category: t(CATEGORY[n.key].name) })
      : n.kind === 'billdue'
        ? n.late === 0
          ? t('{name} is due today', { name: billName })
          : t('{name} was due {date}', { name: billName, date: day(n.date) })
        : n.kind === 'plus'
          ? plusTitle(n.note)
        : n.kind === 'payday'
          ? n.bank
            ? t('Payday · your bank moves {amount} today', { amount: baht(n.amount) })
            : t('Payday · move {amount} to savings', { amount: baht(n.amount) })
        : n.kind === 'sweep'
          ? t('{amount} spare so far this month', { amount: baht(n.amount) })
        : n.kind === 'renew'
          ? n.days === 1
            ? t('{name} renews tomorrow', { name: n.name })
            : t('{name} renews in {n} days', { name: n.name, n: n.days })
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
      : n.kind === 'plus'
        ? t('Got it')
      : n.kind === 'payday'
        ? n.bank
          ? t('It moved')
          : t('I moved it')
      : n.kind === 'sweep'
        ? n.goalId
          ? t('Send to {goal}', { goal: n.goalName })
          : t('Send to safety net')
      : n.kind === 'renew'
        ? t('Still using it')
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
      : n.kind === 'plus'
        ? t('See subscriptions')
      : n.kind === 'payday'
        ? n.bank
          ? t('Not yet')
          : t('Make it automatic')
      : n.kind === 'sweep'
        ? t('Keep it')
      : n.kind === 'renew'
        ? t('Cancel it')
      : n.kind === 'billdue'
        ? t('Not yet')
        : n.kind === 'sub'
          ? t('Not a bill')
          : n.kind === 'substream'
            ? null
            : t('Not now');
  const label = `${t('Kip noticed')}: ${title}`;
  return (
    <Glass radius={24} tint={glassA(0.78)} innerStyle={styles.card}>
      <View accessibilityLabel={label} style={styles.cardIn}>
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
      ) : n.kind === 'plus' ? (
        <Text style={styles.body}>{plusBody(n.note, n.goalName)}</Text>
      ) : n.kind === 'payday' ? (
        <Text style={styles.body}>
          {n.parts.map((p) => `${p.label} ${baht(p.amount)}`).join(' · ')}
          {'. '}
          {n.bank
            ? n.renew
              ? t('Did it reach your savings account? Bangkok Bank stops after 12 — set it again soon.')
              : t('Did it reach your savings account?')
            : t('Move it to a separate account now, before it gets spent.')}
        </Text>
      ) : n.kind === 'sweep' ? (
        <Text style={styles.body}>
          {rich('You’ve spent **{amount}** less than planned. Send it now, before it gets spent? Every day left still gets **{daily}**.', { amount: baht(n.amount), daily: baht(n.daily) }, B)}
          {n.was && n.will && n.will.getTime() < n.was.getTime() ? ' ' : ''}
          {n.was && n.will && n.will.getTime() < n.was.getTime()
            ? rich('{goal} arrives **{will}** instead of {was}.', { goal: n.goalName, will: monthYear(n.will), was: monthYear(n.was) }, B)
            : null}
        </Text>
      ) : n.kind === 'renew' ? (
        <Text style={styles.body}>
          {n.yearly
            ? rich('**{amount}** for another year on {date}. Still using it? If not, cancel before then and its money goes to your saving.', { amount: baht(n.charge), date: day(n.date) }, B)
            : rich('**{amount}** on {date}. Still using it? If not, cancel before then and **{amount} a month** goes to your saving.', { amount: baht(n.charge), date: day(n.date) }, B)}
        </Text>
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
    </Glass>
  );
}

/** Payday (approved mockup): last month in a minute. Plus reads the full recap; Free sees the numbers. */
function RecapCard({ r, isPlus, onRead, onLater, onLocked }: { r: Recap; isPlus: boolean; onRead: () => void; onLater: () => void; onLocked?: () => void }) {
  const name = monthLong(r.month.getMonth());
  const over = r.left < 0;
  return (
    <Glass radius={24} tint={glassA(0.78)} innerStyle={styles.card}>
      <View accessibilityLabel={t('Payday recap: your {month}', { month: name })} style={styles.cardIn}>
      <View style={styles.top}>
        <KipStill size={26} />
        <Text style={styles.kicker}>{t('Payday recap')}</Text>
      </View>
      <Text style={styles.title}>{t('Your {month}, in a minute', { month: name })}</Text>
      <Text style={styles.body}>
        {over
          ? rich('You went **{amount}** over your plan.', { amount: baht(-r.left) }, O)
          : rich('You stayed inside your plan, with **{amount} left**.', { amount: baht(r.left) }, B)}
        {r.goal ? ' ' : ''}
        {r.goal
          ? r.goal.arrives
            ? rich('{goal} gets **{amount}** a month and is on track for **{date}**.', { goal: r.goal.name, amount: baht(r.goal.perMonth), date: monthYear(r.goal.arrives) }, B)
            : rich('{goal} gets **{amount}** a month.', { goal: r.goal.name, amount: baht(r.goal.perMonth) }, B)
          : null}
      </Text>
      <View style={styles.two}>
        <View style={{ flex: 1 }}>
          <Text style={styles.k}>{t('Spent')}</Text>
          <Text style={styles.v}>
            {baht(r.spent)} <Text style={styles.k}>{t('of {amount}', { amount: baht(r.plan) })}</Text>
          </Text>
        </View>
        <View style={styles.twoR}>
          {isPlus && r.suggestions.length ? (
            <>
              <Text style={styles.k}>{t('Kip suggests')}</Text>
              <Text style={styles.v}>{r.suggestions.length === 1 ? t('1 change') : t('{n} changes', { n: r.suggestions.length })}</Text>
            </>
          ) : r.mostOver ? (
            <>
              <Text style={styles.k} numberOfLines={1}>
                {t('Most over: {category}', { category: t(CATEGORY[r.mostOver.key].name) })}
              </Text>
              <Text style={[styles.v, { color: colors.orangeText }]}>+{baht(r.mostOver.spent - r.mostOver.plan)}</Text>
            </>
          ) : (
            <>
              <Text style={styles.k}>{t('Days logged')}</Text>
              <Text style={styles.v}>{r.facts.days}</Text>
            </>
          )}
        </View>
      </View>
      {!isPlus && (
        <Squish style={styles.lock} onPress={() => onLocked?.()} accessibilityRole="button">
          <Text style={styles.lockT}>{t('What Kip noticed + changes')}</Text>
          <Text style={styles.kicker}>Plus</Text>
        </Squish>
      )}
      <View style={styles.btns}>
        <Squish style={styles.do} onPress={onRead} accessibilityRole="button" accessibilityLabel={t('Read the recap')}>
          <Text style={styles.doT}>{t('Read the recap')}</Text>
        </Squish>
        <Squish style={styles.no} onPress={onLater} accessibilityRole="button" accessibilityLabel={t('Later')}>
          <Text style={styles.noT}>{t('Later')}</Text>
        </Squish>
      </View>
      </View>
    </Glass>
  );
}

/** After Do it: what changed, with Undo. */
export function KipDone({ text, onUndo, busy }: { text: string; onUndo: () => void; busy: boolean }) {
  return (
    <Glass radius={999} tint={glassA(0.78)} innerStyle={styles.done}>
      <KipStill size={32} />
      <Text style={styles.doneT} numberOfLines={2}>
        <Text style={{ fontFamily: fonts.semibold }}>{t('Done')}</Text> · {text}
      </Text>
      <Squish style={[styles.undo, busy && { opacity: 0.5 }]} disabled={busy} onPress={onUndo} accessibilityRole="button" accessibilityLabel={t('Undo')}>
        <Text style={styles.undoT}>{t('Undo')}</Text>
      </Squish>
    </Glass>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    two: { flexDirection: 'row', marginTop: 12, borderRadius: 16, backgroundColor: inkA(0.04), paddingHorizontal: 12, paddingVertical: 10 },
    twoR: { flex: 1, borderLeftWidth: 1, borderLeftColor: inkA(0.08), paddingLeft: 12 },
    k: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
    v: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink, marginTop: 2, fontVariant: ['tabular-nums'] },
    lock: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44, marginTop: 10, borderRadius: 999, backgroundColor: inkA(0.05), paddingHorizontal: 16 },
    lockT: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
    // See-through like the other cards on Home (approved 27 Nov): the glow shows through, softened.
    card: { padding: 16 },
    cardIn: {},
    top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    kicker: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
    title: { fontFamily: fonts.semibold, fontSize: 18, letterSpacing: -0.3, color: colors.ink, marginTop: 10 },
    body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink, marginTop: 4 },
    box: { marginTop: 12, borderRadius: 16, backgroundColor: inkA(0.04), paddingHorizontal: 12, paddingVertical: 2 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
    line: { borderTopWidth: 1, borderTopColor: inkA(0.06) },
    name: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.ink },
    was: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textDecorationLine: 'line-through', fontVariant: ['tabular-nums'] },
    now: { minWidth: 64, textAlign: 'right', fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, fontVariant: ['tabular-nums'] },
    after: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 8 },
    btns: { flexDirection: 'row', gap: 8, marginTop: 12 },
    do: { flex: 1, height: 44, borderRadius: 999, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
    doT: { fontFamily: fonts.medium, fontSize: 15, color: colors.paper },
    no: { height: 44, paddingHorizontal: 16, borderRadius: 999, backgroundColor: inkA(0.05), alignItems: 'center', justifyContent: 'center' },
    noT: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    done: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingLeft: 8, paddingRight: 8, },
    doneT: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.ink },
    undo: { height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: inkA(0.06), alignItems: 'center', justifyContent: 'center' },
    undoT: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  }),
);

/** HeyKip Plus's bill changed by itself: what it costs now. */
function plusTitle(p: PlusNote) {
  const price = p.yearly ? t('{amount} a year', { amount: baht(p.charge) }) : t('{amount} a month', { amount: baht(p.charge) });
  if (p.kind === 'gone') return t('HeyKip Plus has ended');
  if (p.kind === 'changed') return t('HeyKip Plus is now {price} (was {was})', { price, was: baht(p.was ?? 0) });
  return t('HeyKip Plus is a bill now · {price}', { price });
}
/** Where its money comes from — or goes, once it ended. */
function plusBody(p: PlusNote, goal: string) {
  if (p.kind === 'gone') return t('The {amount} a month set aside for it goes to {goal} now.', { amount: baht(p.perMonth), goal });
  const aside = p.yearly ? t('Set aside {amount} a month for next year’s renewal.', { amount: baht(p.perMonth) }) + ' ' : '';
  const from =
    p.fromFun > 0 && p.fromGoal > 0
      ? t('It comes from fun money ({fun}) and {goal}’s saving ({goalAmount}).', { fun: baht(p.fromFun), goal, goalAmount: baht(p.fromGoal) })
      : p.fromGoal > 0
        ? t('It comes from {goal}’s saving.', { goal })
        : p.fromFun > 0
          ? t('It comes from fun money.')
          : t('It uses money already set aside for bills, so nothing else changes.');
  return aside + (p.kind === 'changed' && p.charge < (p.was ?? 0) ? t('The difference goes to {goal}.', { goal }) : from);
}
