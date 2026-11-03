import { Caveat_600SemiBold } from '@expo-google-fonts/caveat';
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold, useFonts } from '@expo-google-fonts/geist';
import { MrsSaintDelafield_400Regular } from '@expo-google-fonts/mrs-saint-delafield';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import Stack from 'expo-router/stack';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider, useAuth } from '@/lib/auth';
import { LangProvider, takeReturnTo } from '@/lib/i18n';
import { LookProvider, useLook } from '@/lib/look';
import { SetupProvider, useSetup } from '@/lib/setup/draft';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { session, profile, loading } = useAuth();
  const { ready } = useSetup();
  const signedIn = Boolean(session);
  const onboarded = Boolean(profile?.onboarded);
  const waiting = loading || !ready || (signedIn && !profile);

  useEffect(() => {
    if (!waiting) SplashScreen.hideAsync();
    // After a language change, go back to the screen it was changed on (Profile).
    if (!waiting) {
      const back = takeReturnTo();
      if (back) setTimeout(() => router.push(back as never), 0);
    }
  }, [waiting]);

  if (waiting) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      {/* New here (signed in or not): Setup, which starts with "Hi, I'm Kip." */}
      <Stack.Protected guard={!onboarded}>
        <Stack.Screen name="setup" />
      </Stack.Protected>

      {/* Not signed in: "Log in" from the intro, or saving the plan after the promise. */}
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>

      <Stack.Screen name="privacy-policy" />

      {/* Signed in and set up: the app. */}
      <Stack.Protected guard={signedIn && onboarded}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="month" />
        <Stack.Screen name="styles" />
        <Stack.Screen name="kip-moods" />
        <Stack.Screen name="add" options={{ presentation: 'modal' }} />
        <Stack.Screen name="slips" options={{ presentation: 'modal' }} />
        <Stack.Screen name="goal-edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="goal-new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="history" />
        <Stack.Screen name="safety" />
        <Stack.Screen name="talk" options={{ presentation: 'fullScreenModal' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    'IBMPlexSansThai-Regular': require('../../assets/fonts/IBMPlexSansThai-Regular.ttf'),
    'IBMPlexSansThai-Medium': require('../../assets/fonts/IBMPlexSansThai-Medium.ttf'),
    'IBMPlexSansThai-SemiBold': require('../../assets/fonts/IBMPlexSansThai-SemiBold.ttf'),
    'IBMPlexSansThai-Bold': require('../../assets/fonts/IBMPlexSansThai-Bold.ttf'),
    Caveat_600SemiBold,
    MrsSaintDelafield_400Regular,
  });

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LookProvider>
        <LangProvider>
          <AuthProvider>
            <SetupProvider>
              <Bar />
              <RootStack />
            </SetupProvider>
          </AuthProvider>
        </LangProvider>
      </LookProvider>
    </GestureHandlerRootView>
  );
}

/** Dark text on Light, light text on Dark. */
function Bar() {
  const { scheme } = useLook();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}
