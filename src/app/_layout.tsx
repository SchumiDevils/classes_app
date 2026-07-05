import { SplashScreen, Stack } from 'expo-router';

import { SessionProvider, useSession } from '@/lib/ctx';

SplashScreen.preventAutoHideAsync();

function SplashController() {
  const { isLoading } = useSession();
  if (!isLoading) {
    SplashScreen.hideAsync();
  }
  return null;
}

function RootNavigator() {
  const { session, profile, isLoading } = useSession();

  const areCont = !!session;
  const areProfil = !!profile;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!areCont && !isLoading}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>

      <Stack.Protected guard={areCont && !areProfil && !isLoading}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>

      <Stack.Protected guard={areCont && areProfil}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <SplashController />
      <RootNavigator />
    </SessionProvider>
  );
}
