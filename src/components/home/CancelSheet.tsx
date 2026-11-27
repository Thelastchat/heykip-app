// "Cancel it" from Keep or cancel (approved 27 Nov): Kip can't cancel for you, so step 1 opens the right place —
// Apple's or Google's page for every subscription bought through them, or says where to look on the service itself.
// Step 2, once it's cancelled: where its money goes. The goal is first (cancelling pays the goal), with the new
// arrival date; fun money is the other choice. Nothing changes until Done, and Home's Undo puts it back.
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

import { Delta, Pill, SaveButton, Sheet } from '@/components/profile/Sheet';
import { Squish } from '@/components/glow/motion';
import { t } from '@/lib/i18n';
import { baht } from '@/lib/money';
import { monthYear } from '@/lib/setup/plan';
import { CANCEL_URL, type FreedTo, type PaidVia } from '@/lib/subscriptions';
import { colors, fonts, inkA, themed } from '@/theme';

export type CancelChoice = {
  name: string;
  perMonth: number;
  goal: string;
  /** the goal's arrival now, and after the money moves (null: a monthly saver, no date) */
  was: Date | null;
  will: Date | null;
  /** fun money a month now, and with this back */
  fun: { was: number; now: number } | null;
};

export function CancelSheet({ c, onClose, onDone, startAt = 'how' }: { c: CancelChoice; onClose: () => void; onDone: (to: FreedTo) => void; startAt?: 'how' | 'where' }) {
  const [step, setStep] = useState<'how' | 'where'>(startAt);
  const [via, setVia] = useState<PaidVia>(Platform.OS === 'android' ? 'google' : 'apple');
  const [to, setTo] = useState<FreedTo>('goal');
  const store = via === 'apple' ? 'App Store' : 'Google Play';

  if (step === 'how')
    return (
      <Sheet open onClose={onClose} title={t('Cancel {name}', { name: c.name })} sub={t('Kip can’t cancel it for you, but here’s where to do it')}>
        <Text style={styles.q}>{t('Where do you pay for it?')}</Text>
        <View style={styles.pills}>
          <Pill label="App Store" on={via === 'apple'} onPress={() => setVia('apple')} />
          <Pill label="Google Play" on={via === 'google'} onPress={() => setVia('google')} />
          <Pill label={t('Its own app or site')} on={via === 'direct'} onPress={() => setVia('direct')} />
        </View>
        <Text style={styles.how}>
          {via === 'direct'
            ? t('Open {name}, go to your account and look for Cancel or Manage plan. You keep it until the end of what you’ve paid for.', { name: c.name })
            : t('{store} lists every subscription you pay through it. Tap {name}, then Cancel subscription. You keep it until the end of what you’ve paid for.', { store, name: c.name })}
        </Text>
        {via !== 'direct' && <SaveButton label={t('Open {store} subscriptions', { store })} onPress={() => Linking.openURL(CANCEL_URL[via]).catch(() => {})} />}
        <Squish onPress={() => setStep('where')} style={[styles.second, via === 'direct' && styles.secondDark]} accessibilityRole="button">
          <Text style={[styles.secondText, via === 'direct' && { color: colors.paper }]}>{t('I’ve cancelled it')}</Text>
        </Squish>
      </Sheet>
    );

  const sooner = c.was && c.will && c.will.getTime() !== c.was.getTime();
  return (
    <Sheet open onClose={onClose} title={t('{amount} a month is free', { amount: baht(c.perMonth) })} sub={t('{name} is cancelled. Where should its money go?', { name: c.name })}>
      <Option
        on={to === 'goal'}
        onPress={() => setTo('goal')}
        title={t('To {goal}', { goal: c.goal })}
        line={sooner ? t('Arrives {will} instead of {was}', { will: monthYear(c.will!), was: monthYear(c.was!) }) : t('+{amount} a month to your saving', { amount: baht(c.perMonth) })}
      />
      {c.fun && (
        <Option on={to === 'fun'} onPress={() => setTo('fun')} title={t('Back to fun money')} line={t('{was} → {now} a month', { was: baht(c.fun.was), now: baht(c.fun.now) })} />
      )}
      {to === 'goal' && sooner && (
        <Delta
          rows={[
            { label: t('{goal} saving a month', { goal: c.goal }), was: null, now: `+${baht(c.perMonth)}` },
            { label: t('{goal} arrives', { goal: c.goal }), was: monthYear(c.was!), now: monthYear(c.will!) },
          ]}
        />
      )}
      <SaveButton label={t('Done')} onPress={() => onDone(to)} />
    </Sheet>
  );
}

/** A choice that fills with lime when picked (no outline). */
function Option({ on, onPress, title, line }: { on: boolean; onPress: () => void; title: string; line: string }) {
  return (
    <Squish onPress={onPress} style={[styles.opt, on && styles.optOn]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
      <View style={[styles.dot, on && styles.dotOn]}>{on && <View style={styles.dotIn} />}</View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.optTitle, on && { color: colors.onAccent }]}>{title}</Text>
        <Text style={[styles.optLine, on && { color: colors.onAccentMuted }]}>{line}</Text>
      </View>
    </Squish>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    q: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, textAlign: 'center' },
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
    how: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center', paddingHorizontal: 8 },
    second: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: inkA(0.06) },
    secondDark: { backgroundColor: colors.ink },
    secondText: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
    opt: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 20, backgroundColor: inkA(0.04) },
    optOn: { backgroundColor: colors.lime },
    dot: { width: 22, height: 22, borderRadius: 11, backgroundColor: inkA(0.1), alignItems: 'center', justifyContent: 'center' },
    dotOn: { backgroundColor: colors.onAccent },
    dotIn: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lime },
    optTitle: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
    optLine: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 2 },
  }),
);
