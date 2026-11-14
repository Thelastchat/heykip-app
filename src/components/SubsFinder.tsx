// "Show Kip your subscriptions" (approved mockup): for the subscriptions that never make a bank slip (cards, App
// Store, Google Play). The phone lists them all on one screen; Kip reads a screenshot of it (the same reader as
// slips, Plus), then you tick the ones to add — each with its due day and a day-before reminder.
import { Check } from 'phosphor-react-native';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { KipStill } from '@/components/KipStill';
import { Squish } from '@/components/glow/motion';
import { addBill, type MonthBudget } from '@/lib/budget';
import { guessType, yearlySetAside } from '@/lib/everymonth';
import { monthShort, t } from '@/lib/i18n';
import { baht } from '@/lib/money';
import { isoDay, ordinal } from '@/lib/setup/plan';
import { pickSubsShots, readSubs, type SubsRead } from '@/lib/slips';
import { foundSubs, type FoundSub } from '@/lib/subs';
import { colors, fonts, inkA, themed } from '@/theme';

type Stage = { s: 'how' } | { s: 'reading'; n: number; of: number } | { s: 'found'; list: FoundSub[] } | { s: 'none' };

export function SubsFinder({ month, isPlus, onLocked, onAdd }: { month: MonthBudget; isPlus: boolean; onLocked: () => void; onAdd: (next: MonthBudget, names: string[]) => void }) {
  const [stage, setStage] = useState<Stage>({ s: 'how' });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [problem, setProblem] = useState<string | null>(null);
  const now = new Date();

  async function choose() {
    if (!isPlus) return onLocked();
    setProblem(null);
    const shots = await pickSubsShots();
    if (!shots.length) return;
    const reads: NonNullable<SubsRead['items']> = [];
    for (let i = 0; i < shots.length; i++) {
      setStage({ s: 'reading', n: i + 1, of: shots.length });
      const r = await readSubs(shots[i].base64 ?? '', shots[i].mimeType ?? 'image/jpeg');
      if (!r.ok) {
        setStage({ s: 'how' });
        if (r.reason === 'plus') return onLocked();
        return setProblem(
          r.reason === 'consent'
            ? t('Kip’s reading is turned off — turn it on in Profile → Privacy & data.')
            : r.reason === 'limit'
              ? t('That’s a lot of Kip for one day — I’ll be back tomorrow. You can still log by hand.')
              : r.reason === 'offline'
                ? t('I can’t reach the internet right now. Try again in a moment?')
                : t('Kip couldn’t read that one. Try again in a moment?'),
        );
      }
      if (r.read.is_list) reads.push(...(r.read.items ?? []));
    }
    const list = foundSubs(reads, month, (total, due) => yearlySetAside(total, due, 0, now));
    if (!list.length) return setStage({ s: 'none' });
    setPicked(new Set(list.filter((x) => !x.already).map((x) => x.key)));
    setStage({ s: 'found', list });
  }

  // What adding the ticked ones does, made the same way as adding them one by one.
  const plan = (() => {
    if (stage.s !== 'found') return null;
    let m = month;
    let guess = 0;
    let fun = 0;
    let goal = 0;
    const names: string[] = [];
    for (const f of stage.list) {
      if (!picked.has(f.key) || f.already) continue;
      const r = addBill(m, f.name, f.perMonth, {
        type: guessType(f.name),
        ...(f.day ? { day: f.day, remind: 'before' as const } : {}),
        ...(f.due ? { yearly: { total: f.price, due: f.due, since: isoDay(now) } } : {}),
      });
      if (r.short > 0) return { m: null, names, guess, fun, goal, total: 0 };
      m = r.month;
      guess += r.fromGuess;
      fun += r.fromFun;
      goal += r.fromGoal;
      names.push(f.name);
    }
    return { m, names, guess, fun, goal, total: guess + fun + goal };
  })();

  if (stage.s === 'found') {
    const fresh = stage.list.filter((x) => !x.already).length;
    return (
      <>
        <Head title={t('Kip found {n} subscriptions', { n: stage.list.length })} sub={fresh < stage.list.length ? t('{n} already in Every month. Tick the ones to add.', { n: stage.list.length - fresh }) : t('Tick the ones to add.')} />
        <View>
          {stage.list.map((f, i) => {
            const on = picked.has(f.key) && !f.already;
            return (
              <Pressable
                key={f.key}
                disabled={f.already}
                onPress={() => setPicked((p) => (p.has(f.key) ? new Set([...p].filter((k) => k !== f.key)) : new Set([...p, f.key])))}
                style={[styles.ck, i > 0 && styles.line, f.already && { opacity: 0.55 }]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled: f.already }}
                accessibilityLabel={`${f.name} ${baht(f.price)}`}>
                <View style={[styles.box, on ? styles.boxOn : styles.boxOff]}>{on ? <Check size={14} color={colors.paper} weight="bold" /> : null}</View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.ckName} numberOfLines={1}>
                    {f.name}
                    {f.already ? <Text style={styles.tag}>{'  '}{t('Already added')}</Text> : null}
                  </Text>
                  <Text style={styles.ckSub} numberOfLines={1}>
                    {f.period === 'year'
                      ? f.due
                        ? t('Every year · renews {date}', { date: `${f.day ?? ''} ${monthShort(Number(f.due.slice(5)) - 1)}`.trim() })
                        : t('Every year')
                      : f.day
                        ? t('Renews the {day} · reminder the day before', { day: ordinal(f.day), n: f.day })
                        : t('No renewal day on the screenshot')}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.ckAmt}>{baht(f.price)}</Text>
                  <Text style={styles.ckSub}>
                    {f.period === 'year' ? t('{amount}/mo till then', { amount: baht(f.perMonth) }) : f.period === 'week' ? t('a week · {amount}/mo', { amount: baht(f.perMonth) }) : t('a month')}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        {plan && plan.names.length > 0 ? (
          <View style={styles.sum}>
            <Text style={styles.sumT}>
              {plan.m
                ? [
                    t('Adds {amount} a month to Every month.', { amount: baht(plan.total) }),
                    plan.fun === 0 && plan.goal === 0 ? t('It fits inside Kip’s guess for other bills, so nothing else changes.') : '',
                    plan.fun > 0 ? t('{amount} less fun money a month.', { amount: baht(plan.fun) }) : '',
                    plan.goal > 0 ? t('{amount} less saving a month.', { amount: baht(plan.goal) }) : '',
                  ]
                    .filter(Boolean)
                    .join(' ')
                : t('That’s more than your month can carry. Untick one and try again.')}
            </Text>
          </View>
        ) : null}
        <Squish
          style={[styles.btn, !(plan?.m && plan.names.length) && { opacity: 0.4 }]}
          disabled={!(plan?.m && plan.names.length)}
          onPress={() => plan?.m && onAdd(plan.m, plan.names)}
          accessibilityRole="button">
          <Text style={styles.btnT}>{plan && plan.names.length ? (plan.names.length === 1 ? t('Add 1 subscription') : t('Add {n} subscriptions', { n: plan.names.length })) : t('Add')}</Text>
        </Squish>
        <Text style={styles.fine}>{t('Check the names and prices against your screen before adding.')}</Text>
      </>
    );
  }

  return (
    <>
      <Head title={t('Show Kip your subscriptions')} sub={t('Some never make a bank slip: cards, App Store, Google Play. Your phone lists them all in one place.')} />
      {stage.s === 'none' ? <Text style={[styles.fine, { color: colors.ink, textAlign: 'left' }]}>{t('Kip couldn’t find a subscriptions list on that. Try a screenshot of the screen below.')}</Text> : null}
      <View style={{ gap: 2 }}>
        <Step n={1} text={Platform.OS === 'android' ? t('Open Google Play → your profile → Payments & subscriptions → Subscriptions') : t('Open Settings → tap your name → Subscriptions')} />
        <Step n={2} text={t('Take a screenshot (scroll and take more if it’s long)')} />
        <Step n={3} text={t('Come back and choose it here. Kip reads names, prices and renewal days')} />
      </View>
      {problem ? <Text style={[styles.fine, { color: colors.orangeText }]}>{problem}</Text> : null}
      <Squish style={[styles.btn, stage.s === 'reading' && { opacity: 0.5 }]} disabled={stage.s === 'reading'} onPress={choose} accessibilityRole="button">
        <Text style={styles.btnT}>{stage.s === 'reading' ? t('Reading {n} of {total}…', { n: stage.n, total: stage.of }) : isPlus ? t('Choose screenshots') : t('Choose screenshots · Plus')}</Text>
      </Squish>
      <Text style={styles.fine}>
        {Platform.OS === 'android' ? t('On iPhone: Settings → your name → Subscriptions.') : t('On Android: Google Play → profile → Payments & subscriptions → Subscriptions.')} {t('The picture is read and not kept.')}
      </Text>
    </>
  );
}

function Head({ title, sub }: { title: string; sub: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <KipStill size={44} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
    </View>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepN}>
        <Text style={styles.stepNT}>{n}</Text>
      </View>
      <Text style={styles.stepT}>{text}</Text>
    </View>
  );
}


const styles = themed(() =>
  StyleSheet.create({
    title: { fontFamily: fonts.semibold, fontSize: 22, letterSpacing: -0.3, lineHeight: 27, color: colors.ink },
    sub: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted, marginTop: 4 },
    step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 8 },
    stepN: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
    stepNT: { fontFamily: fonts.semibold, fontSize: 13, color: colors.paper },
    stepT: { flex: 1, fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 20, color: colors.ink },
    btn: { height: 52, borderRadius: 999, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
    btnT: { fontFamily: fonts.medium, fontSize: 16, color: colors.paper },
    fine: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted, textAlign: 'center' },
    ck: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
    line: { borderTopWidth: 1, borderTopColor: inkA(0.06) },
    box: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
    boxOn: { backgroundColor: colors.ink },
    boxOff: { borderWidth: 1.5, borderColor: inkA(0.2) },
    ckName: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    tag: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
    ckSub: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted, marginTop: 1 },
    ckAmt: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
    sum: { borderRadius: 16, backgroundColor: inkA(0.04), padding: 12 },
    sumT: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, color: colors.ink },
  }),
);
