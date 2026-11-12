import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { LockScreen } from '@/components/lock-screen';
import { D14Colors } from '@/constants/theme';
import { AppLockProvider, useAppLock } from '@/providers/app-lock-provider';
import { AuthProvider, useAuth } from '@/providers/auth-provider';

const queryClient = new QueryClient({
  defaultOptions: {
    // gcTime must exceed persister maxAge for offline cache to survive restarts
    queries: { staleTime: 60_000, retry: 1, gcTime: 1000 * 60 * 60 * 24 * 14 },
  },
});

const persister = createAsyncStoragePersister({ storage: AsyncStorage });

SplashScreen.preventAutoHideAsync();

const d14Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: D14Colors.red,
    background: D14Colors.black,
    card: D14Colors.surface,
    text: D14Colors.white,
    border: D14Colors.border,
    notification: D14Colors.red,
  },
};

function RootNavigator() {
  const { session, loading } = useAuth();
  const { locked } = useAppLock();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null;
  // App Lock protects a signed-in member's data; guests have nothing to lock.
  if (locked && session) return <LockScreen />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Public: anyone can browse without an account (board request, Q3 2026).
          Wallet and Profile tabs show a sign-in prompt to guests. */}
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="event/[id]"
        options={{ headerShown: true, title: 'Event', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="division/[id]"
        options={{ headerShown: true, title: 'Division', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="contacts"
        options={{ headerShown: true, title: 'District Contacts', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="media"
        options={{ headerShown: true, title: 'Podcast & Media', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="rules/[id]"
        options={{ headerShown: true, title: 'Rules', headerBackTitle: 'Back' }}
      />

      {/* Members only. A guest who reaches one of these (e.g. via a deep link)
          is redirected to the tabs. */}
      <Stack.Protected guard={!!session}>
        <Stack.Screen
          name="lookup"
          options={{ headerShown: true, title: 'Member Lookup', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="scanner"
          options={{ headerShown: true, title: 'Scan QR Code', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="edit-profile"
          options={{ headerShown: true, title: 'Edit Profile', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="send-notification"
          options={{ headerShown: true, title: 'Send Notification', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="renew"
          options={{ headerShown: true, title: 'Renew Membership', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="notification-settings"
          options={{ headerShown: true, title: 'Notifications', headerBackTitle: 'Back' }}
        />
      </Stack.Protected>

      {/* Sign-in sheet for guests. When sign-in succeeds the guard turns
          false, Expo Router drops it from history and returns to the tabs. */}
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" options={{ presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={d14Theme}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 7 }}>
        <AuthProvider>
          <AppLockProvider>
            <StatusBar style="light" />
            <RootNavigator />
          </AppLockProvider>
        </AuthProvider>
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
}
