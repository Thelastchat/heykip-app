// Everything Kip saved (approved mockup): every entry, newest first, grouped by day.
// Swipe left to delete one — Home and Your month update straight away (they reload when they come into view).
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Kip } from '@/components/Kip';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Glass } from '@/components/glow/Glass';
import { GlowBackground } from '@/components/glow/GlowBackground';
import { useAuth } from '@/lib/auth';
import { dayShort, monthShort, t } from '@/lib/i18n';
import { ICON3D } from '@/lib/icons3d';
import { DB_CAT_NAME, dbCatIcon, IN_CAT_NAME, inCatIcon, type DbCat, type InCat } from '@/lib/kip';
import { baht } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/theme';

const PAGE = 200;
type Entry = { id: string; kind: 'spend' | 'income'; amount: number; note: string | null; occurred_at: string; source: string; cat: string | null };

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
function dayTitle(d: Date) {
  const today = new Date();
  const diff = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  if (diff === 0) return t('Today');
  if (diff === 1) return t('Yesterday');
  return `${dayShort(d.getDay())} ${d.getDate()} ${monthShort(d.getMonth())}`;
}

export default function Saved() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [rows, setRows] = useState<Entry[] | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (limit = PAGE) => {
      if (!session) return;
      const { data, error: e } = await supabase
        .from('transactions')
        .select('id, kind, amount, note, occurred_at, source, categories(key)')
        .eq('user_id', session.user.id)
        .order('occurred_at', { ascending: false })
        .limit(limit + 1);
      if (e) return setError(e.message);
      const list = (data ?? []).map((r) => ({
        id: r.id as string,
        kind: r.kind as Entry['kind'],
        amount: Number(r.amount),
        note: r.note as string | null,
        occurred_at: r.occurred_at as string,
        source: r.source as string,
        cat: ((r.categories as { key?: string } | null)?.key ?? null) as string | null,
      }));
      setMore(list.length > limit);
      setRows(list.slice(0, limit));
    },
    [session],
  );
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function remove(e: Entry) {
    setRows((xs) => (xs ? xs.filter((x) => x.id !== e.id) : xs));
    const { error: err } = await supabase.from('transactions').delete().eq('id', e.id);
    if (err) {
      setError(t('Couldn’t delete: {msg}', { msg: err.message }));
      load();
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }

  // Group by day, newest first.
  const groups: { title: string; items: Entry[] }[] = [];
  for (const r of rows ?? []) {
    const title = dayTitle(new Date(r.occurred_at));
    const g = groups[groups.length - 1];
    if (g && g.title === title) g.items.push(r);
    else groups.push({ title, items: [r] });
  }

  return (
    <View style={{ flex: 1 }}>
      <GlowBackground />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 18, paddingBottom: insets.bottom + 40, gap: 10 }}>
        <ScreenHeader title={t('Everything Kip saved')} />
        {error && <Text style={[styles.small, { color: colors.orangeText, textAlign: 'center' }]}>{error}</Text>}
        {rows === null ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.muted} />
        ) : rows.length === 0 ? (
          <View style={{ alignItems: 'center', gap: 10, marginTop: 40 }}>
            <Kip mood="idle" size={100} />
            <Text style={styles.small}>{t('Nothing saved yet.')}</Text>
          </View>
        ) : (
          <>
            {groups.map((g) => (
              <View key={g.title} style={{ gap: 6 }}>
                <Text style={styles.day}>{g.title}</Text>
                <Glass radius={22} innerStyle={{ overflow: 'hidden' }}>
                  {g.items.map((e, i) => (
                    <Row key={e.id} entry={e} first={i === 0} onDelete={() => remove(e)} />
                  ))}
                </Glass>
              </View>
            ))}
            {more && (
              <Pressable onPress={() => load((rows?.length ?? 0) + PAGE)} style={{ alignSelf: 'center', padding: 10 }} accessibilityRole="button">
                <Text style={[styles.small, { color: colors.ink, textDecorationLine: 'underline' }]}>{t('Show older')}</Text>
              </Pressable>
            )}
            <Text style={[styles.small, { textAlign: 'center', marginTop: 4 }]}>{t('Swipe left on any entry to delete it. Today’s money updates straight away.')}</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Row({ entry, first, onDelete }: { entry: Entry; first: boolean; onDelete: () => void }) {
  const isIn = entry.kind === 'income';
  const cat = entry.cat ?? 'other';
  const name = isIn ? IN_CAT_NAME[(cat as InCat) in IN_CAT_NAME ? (cat as InCat) : 'other'] : DB_CAT_NAME[(cat as DbCat) in DB_CAT_NAME ? (cat as DbCat) : 'other'];
  const icon = isIn ? inCatIcon((cat as InCat) in IN_CAT_NAME ? (cat as InCat) : 'other') : dbCatIcon((cat as DbCat) in DB_CAT_NAME ? (cat as DbCat) : 'other');
  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={60}
      overshootRight={false}
      renderRightActions={(_p, _t, methods) => (
        <Pressable
          onPress={() => {
            methods.close();
            onDelete();
          }}
          style={styles.del}
          accessibilityRole="button"
          accessibilityLabel={t('Delete')}>
          <Text style={styles.delText}>{t('Delete')}</Text>
        </Pressable>
      )}>
      <View style={[styles.row, !first && styles.line]}>
        <Image source={ICON3D[icon]} style={{ width: 34, height: 34 }} contentFit="contain" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.name} numberOfLines={1}>
              {entry.note || name}
            </Text>
            {entry.source === 'slip' && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{t('slip')}</Text>
              </View>
            )}
          </View>
          <Text style={styles.small}>
            {name} · {hhmm(new Date(entry.occurred_at))}
          </Text>
        </View>
        <Text style={[styles.amt, isIn && { color: colors.lavenderText }]}>
          {isIn ? '+' : ''}
          {baht(entry.amount)}
        </Text>
      </View>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  day: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginLeft: 4, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 16, backgroundColor: '#FCFAF6' },
  line: { borderTopWidth: 1, borderTopColor: 'rgba(17,17,17,0.06)' },
  name: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, flexShrink: 1 },
  amt: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
  small: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(17,17,17,0.06)' },
  tagText: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
  del: { width: 88, backgroundColor: colors.orangeText, alignItems: 'center', justifyContent: 'center' },
  delText: { fontFamily: fonts.medium, fontSize: 14, color: '#FFFFFF' },
});
