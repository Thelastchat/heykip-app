// One of their own categories, from Your month: rename it, change its money (Plus, like any category), or delete it.
// Deleting puts its money back where a new one's would come from (wants: shopping or fun; needs: household) and moves
// what was logged in it there too, so the month still adds up and nothing logged is lost.
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { CaretRight } from 'phosphor-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Kip } from '@/components/Kip';
import { Glass } from '@/components/glow/Glass';
import { Squish } from '@/components/glow/motion';
import { Delta, SaveButton, Sheet } from '@/components/profile/Sheet';
import { CATEGORY, defaultFrom, type CatKey, type CustomCat, type MonthBudget } from '@/lib/budget';
import { customCats, deleteCustom, renameCustom } from '@/lib/customCats';
import { t } from '@/lib/i18n';
import { ICON3D } from '@/lib/icons3d';
import { baht } from '@/lib/money';
import { colors, fonts, inkA, themed } from '@/theme';

export function OwnCategory({
  cat,
  month,
  spent,
  save,
  isPlus,
  onAmount,
  onLocked,
  onDone,
  onClose,
}: {
  cat: CustomCat;
  month: MonthBudget;
  spent: number;
  save: (m: MonthBudget) => void;
  isPlus: boolean;
  onAmount: () => void;
  onLocked: () => void;
  onDone: () => void;
  onClose: () => void;
}) {
  const c = customCats().find((x) => x.key === cat);
  const [name, setName] = useState(c?.name ?? '');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!c) return null;
  const amount = month.spend.find((s) => s.key === cat)?.amount ?? 0;
  const rest: MonthBudget = { ...month, spend: month.spend.filter((s) => s.key !== cat) };
  const to = defaultFrom(rest, c.need) as CatKey;
  const toAmount = rest.spend.find((s) => s.key === to)?.amount ?? 0;
  const renamed = name.trim() && name.trim() !== c.name;

  async function rename() {
    if (!c || busy) return;
    setBusy(true);
    const e = await renameCustom(c, name);
    setBusy(false);
    if (e) return setErr(t('Couldn’t save — check your internet and try again.'));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onDone();
  }

  async function remove() {
    if (!c || busy) return;
    setBusy(true);
    // The month first (its line goes, its money goes back), so no screen ever shows a category that's gone.
    save({ ...rest, spend: rest.spend.map((s) => (s.key === to ? { ...s, amount: s.amount + amount } : s)) });
    const e = await deleteCustom(c, to);
    setBusy(false);
    if (e) return setErr(t('Couldn’t delete it — check your internet and try again.'));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onDone();
  }

  if (confirm)
    return (
      <Sheet open onClose={onClose} title={t('Delete {name}?', { name: c.name })} sub={t('Its money goes back to {to}, and what you logged in it moves there too. Nothing is lost.', { to: CATEGORY[to].name })}>
        <View style={{ alignItems: 'center' }}>
          <Kip mood="careful" size={80} />
        </View>
        <Delta
          rows={[
            { label: c.name, was: baht(amount), now: baht(0), warn: true },
            { label: CATEGORY[to].name, was: baht(toAmount), now: baht(toAmount + amount) },
            ...(spent > 0 ? [{ label: t('Logged this month'), was: null, now: t('{amount} → {to}', { amount: baht(spent), to: CATEGORY[to].name }) }] : []),
            { label: t('Each day'), was: null, now: t('No change') },
          ]}
        />
        {err ? <Text style={styles.err}>{err}</Text> : null}
        <SaveButton label={busy ? t('Deleting…') : t('Delete {name}', { name: c.name })} danger disabled={busy} onPress={remove} />
        <Squish onPress={() => setConfirm(false)} accessibilityRole="button">
          <Glass radius={999} innerStyle={styles.ghost}>
            <Text style={styles.title}>{t('Keep it')}</Text>
          </Glass>
        </Squish>
      </Sheet>
    );

  return (
    <Sheet open onClose={onClose} title={c.name} sub={c.need ? t('Your own · a need') : t('Your own · a want')}>
      <View style={{ alignItems: 'center' }}>
        <Image source={ICON3D[c.icon]} style={{ width: 72, height: 72 }} contentFit="contain" />
      </View>
      <Glass radius={18} innerStyle={styles.field}>
        <Text style={styles.k}>{t('Name')}</Text>
        <TextInput value={name} onChangeText={setName} maxLength={24} style={styles.v} accessibilityLabel={t('Name')} />
      </Glass>
      {renamed ? <SaveButton label={busy ? t('Saving…') : t('Save name')} disabled={busy} onPress={rename} /> : null}
      <Glass radius={22} innerStyle={{ paddingHorizontal: 16 }}>
        <Pressable onPress={isPlus ? onAmount : onLocked} style={styles.row} accessibilityRole="button">
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('Money a month')}</Text>
            <Text style={styles.sub}>{t('{amount} · {spent} used this month', { amount: baht(amount), spent: baht(spent) })}</Text>
          </View>
          <CaretRight size={14} color={colors.faint} weight="bold" />
        </Pressable>
        <Pressable onPress={() => setConfirm(true)} style={[styles.row, styles.line]} accessibilityRole="button">
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.orangeText }]}>{t('Delete category')}</Text>
            <Text style={styles.sub}>{t('Its money and what you logged go back to {to}', { to: CATEGORY[to].name })}</Text>
          </View>
        </Pressable>
      </Glass>
      {err ? <Text style={styles.err}>{err}</Text> : null}
    </Sheet>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    field: { paddingHorizontal: 14, paddingVertical: 10, gap: 2 },
    k: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
    v: { fontFamily: fonts.medium, fontSize: 17, color: colors.ink, padding: 0, outlineStyle: 'none' } as never,
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
    line: { borderTopWidth: 1, borderTopColor: inkA(0.06) },
    title: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    sub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
    ghost: { height: 52, alignItems: 'center', justifyContent: 'center' },
    err: { fontFamily: fonts.regular, fontSize: 13, color: colors.orangeText, textAlign: 'center' },
  }),
);
