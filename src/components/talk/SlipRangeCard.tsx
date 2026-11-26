// "Kip, read my slips for November" (Talk): Kip looks in the bank albums the person chose — only those — for slips
// from that stretch of days and offers to read them. Reading happens on the Slips screen, where every slip is checked
// before anything is saved and slips already logged are left out. Nothing is read until they tap Read them.
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';

import { useAiConsent } from '@/components/AiConsent';
import { Glass } from '@/components/glow/Glass';
import { Squish } from '@/components/glow/motion';
import { AlbumSheet, Stack } from '@/components/home/SlipFinder';
import { askPhotos, autoSlipsAvailable, findAlbums, findInRange, isPhotosDenied, loadAuto, prepareForKip, RANGE_MAX, saveAuto, type FoundAlbum } from '@/lib/autoslips';
import { monthShort, t } from '@/lib/i18n';
import { colors, fonts, themed } from '@/theme';
import type * as MediaLibrary from 'expo-media-library/legacy';

type Found = { assets: MediaLibrary.Asset[]; albums: string[]; total: number };
type State = { k: 'looking' } | { k: 'albums' } | { k: 'found'; f: Found } | { k: 'none'; albums: string[] } | { k: 'photos' } | { k: 'failed' } | { k: 'phone' } | { k: 'sent'; n: number };

/** "1–26 Nov", or "25 Oct – 24 Nov" across months. */
export function rangeLabel(from: string, to: string) {
  const [, m1, d1] = from.split('-').map(Number);
  const [, m2, d2] = to.split('-').map(Number);
  return m1 === m2 ? `${d1}–${d2} ${monthShort(m1 - 1)}` : `${d1} ${monthShort(m1 - 1)} – ${d2} ${monthShort(m2 - 1)}`;
}

export function SlipRangeCard({ from, to, demo }: { from: string; to: string; demo?: Found }) {
  const ai = useAiConsent(() => router.push('/privacy-policy'));
  const [state, setState] = useState<State>(demo ? { k: 'found', f: demo } : { k: 'looking' });
  const [albums, setAlbums] = useState<FoundAlbum[] | null>(null);
  const [busy, setBusy] = useState(false);
  const when = rangeLabel(from, to);

  async function look(chosen?: { id: string; title: string }[]) {
    if (!autoSlipsAvailable) return setState({ k: 'phone' });
    const picked = chosen ?? (await loadAuto())?.albums ?? [];
    if (!picked.length) return setState({ k: 'albums' });
    setState({ k: 'looking' });
    try {
      const f = await findInRange(picked, from, to);
      setState(f.total ? { k: 'found', f } : { k: 'none', albums: picked.map((a) => a.title) });
    } catch (e) {
      setState(isPhotosDenied(e) ? { k: 'photos' } : { k: 'failed' });
    }
  }
  useEffect(() => {
    if (!demo) look();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  async function chooseAlbums() {
    if (!(await ai.ensure())) return;
    const access = await askPhotos();
    if (access !== 'all') return setState({ k: 'photos' });
    try {
      setAlbums(await findAlbums());
    } catch (e) {
      setState(isPhotosDenied(e) ? { k: 'photos' } : { k: 'failed' });
    }
  }

  async function readThem() {
    if (state.k !== 'found' || busy) return;
    if (!(await ai.ensure())) return;
    setBusy(true);
    try {
      const n = await prepareForKip(state.f.assets);
      setBusy(false);
      setState({ k: 'sent', n });
      if (n > 0) router.push('/slips');
    } catch (e) {
      setBusy(false);
      setState(isPhotosDenied(e) ? { k: 'photos' } : { k: 'failed' });
    }
  }

  const f = state.k === 'found' ? state.f : null;
  const title =
    state.k === 'looking'
      ? t('Looking in your bank albums…')
      : state.k === 'albums'
        ? t('Which albums are your slips in?')
        : state.k === 'found'
          ? f!.total === 1
            ? t('1 slip · {when}', { when })
            : t('{n} slips · {when}', { n: f!.total, when })
          : state.k === 'none'
            ? t('No slips for {when}', { when })
            : state.k === 'photos'
              ? t('Kip needs Full Access to Photos')
              : state.k === 'phone'
                ? t('Slips are read on your phone')
                : state.k === 'sent'
                  ? t('Sent to Kip · {when}', { when })
                  : t('Kip couldn’t open your albums');
  const sub =
    state.k === 'albums'
      ? t('Kip only ever looks in the bank albums you choose — never your other photos')
      : state.k === 'found'
        ? f!.total > RANGE_MAX
          ? t('{albums} · Kip reads the first {max} now — ask again for the rest', { albums: f!.albums.join(', '), max: RANGE_MAX })
          : t('{albums} · you check each one before it’s saved', { albums: f!.albums.join(', ') })
        : state.k === 'none'
          ? t('Nothing in {albums} for those days', { albums: state.albums.join(', ') })
          : state.k === 'photos'
            ? t('Settings → HeyKip → Photos → Full Access. Kip still only looks in the albums you choose.')
            : state.k === 'phone'
              ? t('Open HeyKip on your iPhone to read slips from your bank albums')
              : state.k === 'sent'
                ? t('Slips already logged are left out')
                : state.k === 'failed'
                  ? t('Try again in a moment')
                  : '';
  const action =
    state.k === 'albums'
      ? { label: t('Choose albums'), go: chooseAlbums }
      : state.k === 'found'
        ? { label: t('Read them'), go: readThem }
        : state.k === 'photos'
          ? { label: t('Open Settings'), go: () => Linking.openSettings() }
          : state.k === 'failed' || state.k === 'none'
            ? { label: t('Look again'), go: () => look() }
            : null;

  return (
    <>
      <Glass radius={26} innerStyle={styles.card}>
        <Stack n={f ? f.total : 0} uris={f ? f.assets.slice(-3).map((a) => a.uri) : []} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {sub ? <Text style={styles.sub}>{sub}</Text> : null}
          {state.k === 'looking' ? (
            <ActivityIndicator color={colors.muted} style={{ alignSelf: 'flex-start', marginTop: 10 }} />
          ) : action ? (
            <Squish onPress={action.go} disabled={busy} style={styles.pill} accessibilityRole="button">
              {busy ? <ActivityIndicator color={colors.paper} size="small" /> : <Text style={styles.pillText}>{action.label}</Text>}
            </Squish>
          ) : null}
        </View>
      </Glass>
      {albums && (
        <AlbumSheet
          albums={albums}
          onClose={() => setAlbums(null)}
          onDone={async (picked) => {
            const was = await loadAuto();
            // Choosing albums here doesn't switch on Home's "new slips" check by itself; it keeps its own setting.
            await saveAuto({ on: was?.on ?? false, albums: picked, since: was?.since ?? Date.now(), dismissed: was?.dismissed });
            setAlbums(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            look(picked);
          }}
        />
      )}
      {ai.sheet}
    </>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    card: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
    title: { fontFamily: fonts.medium, fontSize: 16, letterSpacing: -0.2, color: colors.ink },
    sub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 2 },
    pill: { alignSelf: 'flex-start', height: 36, minWidth: 96, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
    pillText: { fontFamily: fonts.medium, fontSize: 13, color: colors.paper },
  }),
);
