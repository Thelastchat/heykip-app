// Kip's full note (approved mockup): on Home it's one line; tap it and the whole thing opens here, with today's
// spending, the goal's date and "Ask Kip anything".
import { CaretRight, LockSimple } from 'phosphor-react-native';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KipStill } from '@/components/KipStill';
import { Squish } from '@/components/glow/motion';
import { t } from '@/lib/i18n';
import { colors, fonts, inkA, themed } from '@/theme';

type Props = {
  say: string;
  spentToday: string;
  over: boolean;
  goalName: string;
  goalWhen: string;
  isPlus: boolean;
  onAsk: () => void;
  onClose: () => void;
};

export function KipSheet({ say, spentToday, over, goalName, goalWhen, isPlus, onAsk, onClose }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.dim} onPress={onClose} accessibilityLabel={t('Close')} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
        <View style={styles.grip} />
        <View style={styles.head}>
          <KipStill size={44} />
          <Text style={styles.name}>Kip</Text>
        </View>
        <Text style={styles.say}>{say}</Text>
        <View style={styles.two}>
          <View style={{ flex: 1 }}>
            <Text style={styles.k}>{t('Spent today')}</Text>
            <Text style={[styles.v, over && { color: colors.orangeText }]}>{spentToday}</Text>
          </View>
          <View style={styles.r}>
            <Text style={styles.k}>{goalName}</Text>
            <Text style={styles.v}>{goalWhen}</Text>
          </View>
        </View>
        <Squish
          style={styles.ask}
          onPress={() => {
            onClose();
            onAsk();
          }}
          accessibilityRole="button"
          accessibilityLabel={isPlus ? t('Ask Kip anything') : t('Ask Kip anything — Plus')}>
          <Text style={styles.askT}>{t('Ask Kip anything')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {!isPlus && <Text style={styles.quiet}>Plus</Text>}
            {isPlus ? <CaretRight size={16} color={colors.muted} /> : <LockSimple size={16} color={colors.muted} />}
          </View>
        </Squish>
      </View>
    </Modal>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    dim: { flex: 1, backgroundColor: inkA(0.38) },
    sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 32, borderTopRightRadius: 32, backgroundColor: colors.sheet, paddingTop: 10, paddingHorizontal: 20, gap: 14 },
    grip: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: inkA(0.15), marginBottom: 4 },
    head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    name: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
    say: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 25, color: colors.ink },
    two: { flexDirection: 'row', paddingTop: 14, borderTopWidth: 1, borderTopColor: inkA(0.08) },
    r: { flex: 1, borderLeftWidth: 1, borderLeftColor: inkA(0.08), paddingLeft: 16 },
    k: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
    v: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink, marginTop: 2, fontVariant: ['tabular-nums'] },
    ask: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 52, borderRadius: 999, backgroundColor: inkA(0.05), marginTop: 4 },
    askT: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    quiet: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  }),
);
