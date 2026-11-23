import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Glass } from '@/components/glow/Glass';
import { BackButton, SetupScreen, Switch, Title } from '@/components/setup/kit';
import { Button } from '@/components/ui';
import { t } from '@/lib/i18n';
import { ICON3D, type Icon3D } from '@/lib/icons3d';
import { useSetup } from '@/lib/setup/draft';
import { colors, fonts, inkA, themed } from '@/theme';

// Setup · "What Kip can do" (approved mockup), right after the intro: the three things Kip does on its own, each
// with its switch, in plain words — before anything is asked. Nothing is sent anywhere here; the answers are kept
// in the draft and applied when the account is made (Kip's AI permission is saved to the account then).
// The iPhone still asks for Photos and notifications itself, later, the first time each one is used.
export default function SetupKipCan() {
  const { draft, update } = useSetup();
  const allow = draft.allow;
  const set = (k: keyof typeof allow) => update({ allow: { ...allow, [k]: !allow[k] } });

  return (
    <SetupScreen footer={<Button label={t('Continue')} onPress={() => router.push('/setup/basics')} />}>
      <View style={{ flexDirection: 'row' }}>
        <BackButton />
      </View>
      <Title>
        {t('What Kip')}
        {'\n'}
        <Text style={{ color: colors.soft }}>{t('can do for you')}</Text>
      </Title>
      <Text style={styles.lead}>{t('Switch these on or off now, or later in Profile.')}</Text>

      <Glass radius={24} innerStyle={styles.card}>
        <Row icon="expense" title={t('Read what you type')} asks divider>
          {t('“ข้าวมันไก่ 60” becomes a logged spend. Only what you log is kept, never used to train AI.')}
        </Row>
        <Row icon="bill" title={t('Read your bank slips')} on={allow.slips} onToggle={() => set('slips')} divider>
          {t('Kip finds new slips in the albums you choose and reads them for you. Nothing else in Photos is looked at.')}
        </Row>
        <Row icon="phone" title={t('Remind you about bills')} on={allow.reminders} onToggle={() => set('reminders')}>
          {t('The day before a bill is due, at 9:00.')}
        </Row>
      </Glass>

      <Text style={styles.note}>{t('Kip asks before it reads anything for the first time. Your iPhone asks for Photos and notifications too. Full details in Profile → Privacy & data.')}</Text>
    </SetupScreen>
  );
}

function Row({
  icon,
  title,
  on = false,
  onToggle,
  asks,
  divider,
  children,
}: {
  icon: Icon3D;
  title: string;
  on?: boolean;
  onToggle?: () => void;
  asks?: boolean;
  divider?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole={asks ? 'text' : 'switch'}
      accessibilityLabel={title}
      accessibilityState={asks ? undefined : { checked: on }}
      onPress={onToggle}
      disabled={asks}
      style={[styles.row, divider && styles.divider]}>
      <Image source={ICON3D[icon]} style={{ width: 44, height: 44 }} contentFit="contain" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{children}</Text>
      </View>
      {asks ? (
        <View style={styles.asks}>
          <Text style={styles.asksText}>{t('Asks first')}</Text>
        </View>
      ) : (
        <Switch on={on} />
      )}
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    lead: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.muted, marginTop: -4 },
    card: { paddingHorizontal: 16, paddingVertical: 4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
    divider: { borderBottomWidth: 1, borderBottomColor: inkA(0.06) },
    rowTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    rowSub: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.muted },
    asks: { height: 30, paddingHorizontal: 11, borderRadius: 999, backgroundColor: inkA(0.06), alignItems: 'center', justifyContent: 'center' },
    asksText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.ink },
    note: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.muted, textAlign: 'center', paddingHorizontal: 8 },
  }),
);
