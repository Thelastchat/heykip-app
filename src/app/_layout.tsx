import { Caveat_600SemiBold } from '@expo-google-fonts/caveat';
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  useFonts,
} from '@expo-google-fonts/geist';
import {
  IBMPlexSansThai_400Regular,
  IBMPlexSansThai_500Medium,
  IBMPlexSansThai_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans-thai';
import { MrsSaintDelafield_400Regular } from '@expo-google-fonts/mrs-saint-delafield';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import Stack from 'expo-router/stack';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider, useAuth } from '@/lib/auth';
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

      {/* Signed in and set up: the app. */}
      <Stack.Protected guard={signedIn && onboarded}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="kip-moods" />
        <Stack.Screen name="add" options={{ presentation: 'modal' }} />
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
    IBMPlexSansThai_400Regular,
    IBMPlexSansThai_500Medium,
    IBMPlexSansThai_600SemiBold,
    Caveat_600SemiBold,
    MrsSaintDelafield_400Regular,
  });

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <SetupProvider>
          <StatusBar style="dark" />
          <RootStack />
        </SetupProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
