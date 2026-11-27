// "Make it happen by itself" (approved 27 Nov): one time, in the person's own bank app, a scheduled transfer of the
// plan's saving into a separate pocket or account on payday. Kip shows the exact amount and day, then the steps —
// MAKE by KBank's by name (Cloud Pocket, Schedule Transfer), everyone else's in general words. HeyKip never sees or
// touches the bank; Done only remembers what they set, so Kip can check on payday.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Pill, SaveButton, Sheet } from '@/components/profile/Sheet';
import { BANKS, RENEWS_YEARLY, type BankKey } from '@/lib/bankTransfer';
import { t } from '@/lib/i18n';
import { baht } from '@/lib/money';
import { ordinal } from '@/lib/setup/plan';
import { colors, fonts, inkA, themed } from '@/theme';

export function BankSheet({
  amount,
  day,
  parts,
  bank: was,
  onDone,
  onClose,
}: {
  amount: number;
  day: number | null;
  /** what the amount is made of: the goal(s) and the safety net */
  parts: { label: string; amount: number }[];
  bank?: BankKey;
  onDone: (bank: BankKey) => void;
  onClose: () => void;
}) {
  const [bank, setBank] = useState<BankKey | null>(was ?? null);
  const when = day ? t('on the {day}, every month', { day: ordinal(day), n: day }) : t('every payday');
  const sep = t('Open a separate savings account or pocket, just for saving, so it isn’t mixed with spending money.');
  const back = t('Come back and tap Done. On payday Kip checks it went through.');
  const money = { amount: baht(amount), when };
  // The menu path inside each bank app, where we've checked it (see bankTransfer.ts).
  const path: Partial<Record<BankKey, string>> = {
    kplus: t('In K PLUS: Transfer → your savings account → “ตั้งโอนล่วงหน้า” (schedule) → “รายเดือน” (monthly). {amount}, {when}.', money),
    scb: t('In SCB EASY: Transfer → your savings account → “ตั้งรายการล่วงหน้า” (schedule) → “ทุกเดือน” (every month). {amount}, {when}.', money),
    ktb: t('In Krungthai NEXT: Transfer → your savings account → turn on “ตั้งรายการล่วงหน้า” (schedule) → “ทุกเดือน” (every month). {amount}, {when}.', money),
    bbl: t('In Bangkok Bank: Transfer → your savings account → “ตั้งรายการล่วงหน้า” (schedule) → “รายเดือน” (monthly). {amount}, {when}.', money),
    krungsri: t('In krungsri app: Transfer → your savings account → “ตั้งเวลา” (schedule) → “ทุกเดือน” (every month). {amount}, {when}.', money),
  };
  const steps = !bank
    ? []
    : bank === 'make'
      ? [t('In MAKE, make a Cloud Pocket just for saving, like “Japan”.'), t('Use Schedule Transfer: {amount} into that pocket, {when}.', money), back]
      : [
          sep,
          path[bank] ?? t('Find the scheduled (repeating) transfer in your bank app and set {amount} into it, {when}.', money),
          ...(RENEWS_YEARLY.includes(bank) ? [t('Bangkok Bank repeats it 12 times at most. Kip reminds you to set it again in a year.')] : []),
          back,
        ];
  const named = !!bank && (bank === 'make' || !!path[bank]);

  return (
    <Sheet open onClose={onClose} title={t('Make it happen by itself')} sub={t('Set your bank to move your saving every payday. HeyKip never touches your bank — you set it once, in your bank app.')}>
      <View style={styles.amountBox}>
        <Text style={styles.amount}>{baht(amount)}</Text>
        <Text style={styles.when}>{when}</Text>
        <Text style={styles.parts}>{parts.map((p) => `${p.label} ${baht(p.amount)}`).join(' · ')}</Text>
      </View>
      <Text style={styles.q}>{t('Which bank app?')}</Text>
      <View style={styles.pills}>
        {BANKS.map((b) => (
          <Pill key={b.key} label={b.key === 'other' ? t('Other') : b.name} on={bank === b.key} onPress={() => setBank(b.key)} />
        ))}
      </View>
      {bank && (
        <View style={styles.steps}>
          {steps.map((s, i) => (
            <View key={i} style={styles.step}>
              <View style={styles.num}>
                <Text style={styles.numText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{s}</Text>
            </View>
          ))}
          {named && <Text style={styles.note}>{t('Menu names are from the bank’s own steps and can change when its app updates.')}</Text>}
        </View>
      )}
      <SaveButton label={t('Done, it’s set')} disabled={!bank} onPress={() => bank && onDone(bank)} />
    </Sheet>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    amountBox: { alignItems: 'center', gap: 2, paddingVertical: 12, borderRadius: 20, backgroundColor: colors.lime },
    amount: { fontFamily: fonts.medium, fontSize: 32, letterSpacing: -1, color: colors.onAccent, fontVariant: ['tabular-nums'] },
    when: { fontFamily: fonts.medium, fontSize: 14, color: colors.onAccent },
    parts: { fontFamily: fonts.regular, fontSize: 13, color: colors.onAccentMuted, marginTop: 4 },
    q: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, textAlign: 'center' },
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
    steps: { gap: 12, paddingHorizontal: 4 },
    step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    num: { width: 24, height: 24, borderRadius: 12, backgroundColor: inkA(0.08), alignItems: 'center', justifyContent: 'center' },
    numText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
    note: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted, paddingLeft: 36 },
    stepText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink },
  }),
);
