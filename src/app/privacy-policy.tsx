// The privacy policy, in plain words. Only states what is true of the app today — update POLICY_UPDATED
// and these lines whenever what we collect or who processes it changes.
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ScreenHeader';
import { Glass } from '@/components/glow/Glass';
import { GlowBackground } from '@/components/glow/GlowBackground';
import { monthLong, shownYear, t } from '@/lib/i18n';
import { POLICY_UPDATED, PRIVACY_EMAIL } from '@/lib/privacy';
import { colors, fonts, themed } from '@/theme';

export default function PrivacyPolicy() {
  const insets = useSafeAreaInsets();
  const d = POLICY_UPDATED;
  const sections: { title: string; lines: string[] }[] = [
    {
      title: t('What we keep'),
      lines: [
        t('Your email, and the name and photo you add.'),
        t('Your plan: pay, payday, rent, bills, budgets and goals.'),
        t('What you log: amount, category, note, time — and for slips, who you paid and the slip’s reference number.'),
        t('When you agreed to let Kip read for you.'),
      ],
    },
    {
      title: t('What we never keep'),
      lines: [t('Slip pictures — they stay in your Photos.'), t('Your other photos, contacts, location or bank logins.'), t('Anything to sell. We don’t sell or share your data for ads.')],
    },
    {
      title: t('Why'),
      lines: [t('To run your money plan and show your money — that’s the app you signed up for.'), t('Kip’s AI reading (Talk to Kip, slips) only with your Allow, and you can turn it off any time.')],
    },
    {
      title: t('Who helps us'),
      lines: [
        t('Supabase stores your account and data (servers in Singapore).'),
        t('Anthropic’s Claude AI reads what you send Kip, only when you allow it (servers in the USA). It deletes it within 30 days and doesn’t use it to train AI.'),
        t('So your data does leave Thailand — both are bound to protect it.'),
      ],
    },
    {
      title: t('How long'),
      lines: [t('Until you delete it. Delete one entry, all spending, or your whole account any time in Profile → Privacy & data.')],
    },
    {
      title: t('Your rights'),
      lines: [
        t('Under Thailand’s PDPA you can see, correct, take a copy of, or delete your data, and take back your consent.'),
        t('Ask us at {email}. You can also complain to the Personal Data Protection Committee (PDPC).', { email: PRIVACY_EMAIL }),
      ],
    },
    {
      title: t('Keeping it safe'),
      lines: [t('Encrypted connections, and every row is locked to your own account.')],
    },
  ];
  return (
    <View style={{ flex: 1 }}>
      <GlowBackground />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 18, paddingBottom: insets.bottom + 40, gap: 12 }}>
        <ScreenHeader title={t('Privacy policy')} />
        <Text style={styles.updated}>{t('HeyKip · updated {date}', { date: `${d.getDate()} ${monthLong(d.getMonth())} ${shownYear(d)}` })}</Text>
        {sections.map((s) => (
          <Glass key={s.title} radius={22} innerStyle={{ padding: 16, gap: 8 }}>
            <Text style={styles.h}>{s.title}</Text>
            {s.lines.map((l) => (
              <View key={l} style={{ flexDirection: 'row', gap: 8 }}>
                <Text style={styles.dot}>•</Text>
                <Text style={styles.p}>{l}</Text>
              </View>
            ))}
          </Glass>
        ))}
        <Text style={[styles.updated, { textDecorationLine: 'underline', color: colors.ink }]} onPress={() => Linking.openURL(`mailto:${PRIVACY_EMAIL}?subject=HeyKip%20privacy`)}>
          {PRIVACY_EMAIL}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    updated: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, textAlign: 'center' },
    h: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
    dot: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
    p: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink },
  }),
);
