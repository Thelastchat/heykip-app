import Tabs from 'expo-router/js-tabs';

import { TabBar } from '@/components/TabBar';
import { t } from '@/lib/i18n';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: t('Home') }} />
      <Tabs.Screen name="goals" options={{ title: t('Goals') }} />
      <Tabs.Screen name="calendar" options={{ title: t('Calendar') }} />
      <Tabs.Screen name="profile" options={{ title: t('You') }} />
    </Tabs>
  );
}
