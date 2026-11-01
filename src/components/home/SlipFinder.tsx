// Home card for Kip finding slips (approved mockup):
//   not set up   → "Let Kip find your slips" · Turn on (✕ hides it)
//   new slips    → "Kip found 3 new slips · K PLUS · since yesterday 21:15" · Read them
//   nothing new  → nothing (Home stays clean)
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { X } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { useAiConsent } from '@/components/AiConsent';
import { useAuth } from '@/lib/auth';
import { Glass } from '@/components/glow/Glass';
import { RiseIn, Squish } from '@/components/glow/motion';
import { SaveButton, Sheet } from '@/components/profile/Sheet';
import { askPhotos, autoSlipsAvailable, checkNew, findAlbums, loadAuto, markChecked, prepareForKip, saveAuto, type AutoSlips, type FoundAlbum, type NewSlips } from '@/lib/autoslips';
import { dayShort, monthShort, t } from '@/lib/i18n';
import { colors, fonts } from '@/theme';

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
function sinceText(ms: number) {
  const d = new Date(ms);
  const diff = Math.round((new Date(new Date().toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  const day = diff === 0 ? t('today') : diff === 1 ? t('yesterday') : `${dayShort(d.getDay())} ${d.getDate()} ${monthShort(d.getMonth())}`;
  return t('since {when}', { when: `${day} ${hhmm(d)}` });
}

export function SlipFinder({ isPlus }: { isPlus: boolean }) {
  const { profile } = useAuth();
  const ai = useAiConsent(() => router.push('/privacy-policy'));
  const [auto, setAuto] = useState<AutoSlips | null | undefined>(undefined);
  const [found, setFound] = useState<NewSlips | null>(null);
  const [albums, setAlbums] = useState<FoundAlbum[] | null>(null);
  const [problem, setProblem] = useState<'denied' | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!autoSlipsAvailable || !isPlus) return;
    const a = await loadAuto();
    setAuto(a);
    setFound(a?.on ? await checkNew(a).catch(() => null) : null);
  }, [isPlus]);
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  async function turnOn() {
    if (!(await ai.ensure())) return;
    const access = await askPhotos();
    if (access === 'denied') return setProblem('denied');
    setAlbums(await findAlbums());
  }

  async function readThem() {
    if (!found || !auto || busy) return;
    setBusy(true);
    const n = await prepareForKip(found.assets);
    await markChecked(auto, found.assets);
    setBusy(false);
    setFound(null);
    if (n > 0) router.push('/slips');
  }

  // Kip's AI turned off in Privacy & data: don't offer to read anything.
  if (!autoSlipsAvailable || !isPlus || auto === undefined || profile?.ai_off) return null;

  const card =
    auto?.on && found ? (
      <Glass radius={26} innerStyle={styles.card}>
        <Stack n={found.assets.length} uris={found.assets.slice(0, 3).map((a) => a.uri)} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{found.assets.length === 1 ? t('Kip found a new slip') : t('Kip found {n} new slips', { n: found.assets.length })}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {found.albums.join(', ')} · {sinceText(found.since)}
          </Text>
          <Squish onPress={readThem} disabled={busy} style={styles.pill} accessibilityRole="button">
            {busy ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.pillText}>{t('Read them')}</Text>}
          </Squish>
        </View>
      </Glass>
    ) : !auto?.on && !auto?.dismissed ? (
      <Glass radius={26} innerStyle={styles.card}>
        <Stack n={0} uris={[]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('Let Kip find your slips')}</Text>
          <Text style={styles.sub}>{t('Kip checks your bank albums each time you open the app — no more picking them one by one')}</Text>
          <Squish onPress={turnOn} style={styles.pill} accessibilityRole="button">
            <Text style={styles.pillText}>{t('Turn on')}</Text>
          </Squish>
        </View>
        <Pressable
          onPress={async () => {
            const next = { on: false, albums: [], since: Date.now(), dismissed: true };
            await saveAuto(next);
            setAuto(next);
          }}
          hitSlop={10}
          style={styles.x}
          accessibilityRole="button"
          accessibilityLabel={t('Not now')}>
          <X size={12} color={colors.muted} weight="bold" />
        </Pressable>
      </Glass>
    ) : null;

  return (
    <>
      {card && <RiseIn style={{ paddingHorizontal: 18, marginTop: 22 }}>{card}</RiseIn>}
      {albums && (
        <AlbumSheet
          albums={albums}
          onClose={() => setAlbums(null)}
          onDone={async (picked) => {
            const next: AutoSlips = { on: picked.length > 0, albums: picked, since: Date.now() };
            await saveAuto(next);
            setAuto(next);
            setAlbums(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }}
        />
      )}
      {problem === 'denied' && (
        <Sheet open onClose={() => setProblem(null)} title={t('Kip needs Photos')} sub={t('Turn on Photos for HeyKip in Settings, then come back and tap Turn on.')}>
          <SaveButton
            label={t('Open Settings')}
            onPress={() => {
              setProblem(null);
              Linking.openSettings();
            }}
          />
        </Sheet>
      )}
      {ai.sheet}
    </>
  );
}

/** "Kip found these albums": bank albums on, Screenshots off. Kip only ever looks in the ones left on. */
export function AlbumSheet({ albums, onClose, onDone }: { albums: FoundAlbum[]; onClose: () => void; onDone: (picked: { id: string; title: string }[]) => void }) {
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(albums.map((a) => [a.id, a.bank])));
  const picked = albums.filter((a) => on[a.id]).map((a) => ({ id: a.id, title: a.title }));
  return (
    <Sheet open onClose={onClose} title={albums.some((a) => a.bank) ? t('Kip found these albums') : t('Kip didn’t find a bank album')} sub={t('Kip only looks here — never at your other photos')}>
      {albums.length > 0 ? (
        <Glass radius={22} innerStyle={{ paddingHorizontal: 16 }}>
          {albums.map((a, i) => (
            <View key={a.id} style={[styles.alb, i > 0 && styles.line]}>
              <View style={styles.thumb}>{a.thumb ? <Image source={{ uri: a.thumb }} style={{ width: 40, height: 40 }} contentFit="cover" contentPosition="top" /> : null}</View>
              <View style={{ flex: 1 }}>
                <Text style={styles.albTitle}>{a.title}</Text>
                <Text style={styles.sub}>{a.bank ? t('{n} pictures', { n: a.count }) : t('Other pictures too — Kip skips anything that isn’t a slip')}</Text>
              </View>
              <Switch
                value={!!on[a.id]}
                onValueChange={(v) => setOn((x) => ({ ...x, [a.id]: v }))}
                trackColor={{ true: colors.ink, false: 'rgba(17,17,17,0.15)' }}
                thumbColor="#FFFFFF"
                {...({ activeThumbColor: '#FFFFFF', activeTrackColor: colors.ink } as object)}
                accessibilityLabel={a.title}
              />
            </View>
          ))}
        </Glass>
      ) : (
        <Text style={[styles.sub, { textAlign: 'center' }]}>{t('Save a slip from your bank app first, or add slips any time with Slip on the + screen.')}</Text>
      )}
      <Text style={[styles.sub, { textAlign: 'center' }]}>{t('Kip starts from now. Older slips stay as they are — add them any time with Slip on the + screen.')}</Text>
      <SaveButton label={picked.length ? t('Done') : t('Not now')} onPress={() => (picked.length ? onDone(picked) : onClose())} />
    </Sheet>
  );
}

function Stack({ n, uris }: { n: number; uris: string[] }) {
  const tilt = ['-8deg', '-1deg', '7deg'];
  return (
    <View style={styles.stack}>
      {(uris.length ? uris : [null, null]).map((u, i) => (
        <View key={i} style={[styles.paper, { left: i * 12, top: i === 1 ? 2 : 6 - i * 2, transform: [{ rotate: tilt[i] ?? '0deg' }] }]}>
          {u ? <Image source={{ uri: u }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" /> : <FakeSlip />}
        </View>
      ))}
      {n > 0 && (
        <View style={styles.count}>
          <Text style={styles.countText}>{n}</Text>
        </View>
      )}
    </View>
  );
}

/** A tiny drawn slip for the "Turn on" card (no real photos yet). */
function FakeSlip() {
  return (
    <View style={{ flex: 1, padding: 4, gap: 3, backgroundColor: '#FFFFFF' }}>
      <View style={{ height: 6, borderRadius: 2, backgroundColor: colors.limeDeep }} />
      {[1, 0.7, 1, 0.6].map((w, i) => (
        <View key={i} style={{ height: 3, width: `${w * 100}%`, borderRadius: 2, backgroundColor: 'rgba(17,17,17,0.1)' }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { fontFamily: fonts.medium, fontSize: 16, letterSpacing: -0.2, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 2 },
  pill: { alignSelf: 'flex-start', height: 36, minWidth: 96, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  pillText: { fontFamily: fonts.medium, fontSize: 13, color: '#FFFFFF' },
  x: { position: 'absolute', top: 12, right: 12, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(17,17,17,0.06)', alignItems: 'center', justifyContent: 'center' },
  stack: { width: 64, height: 76 },
  paper: {
    position: 'absolute',
    width: 40,
    height: 68,
    borderRadius: 7,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.08)',
    backgroundColor: '#FFFFFF',
    boxShadow: '0 6px 14px rgba(17,17,17,0.12)',
  } as never,
  count: {
    position: 'absolute',
    right: -2,
    top: -6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 5,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  countText: { fontFamily: fonts.semibold, fontSize: 12, color: '#FFFFFF' },
  alb: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  line: { borderTopWidth: 1, borderTopColor: 'rgba(17,17,17,0.06)' },
  thumb: { width: 40, height: 40, borderRadius: 10, overflow: 'hidden', backgroundColor: '#DFE7EF' },
  albTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
});
