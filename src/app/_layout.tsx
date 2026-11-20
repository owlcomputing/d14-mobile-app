import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { defaultShouldDehydrateQuery, QueryClient, type Query } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, Stack, ThemeProvider, useRouter, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';

import { LockScreen } from '@/components/lock-screen';
import { D14Colors } from '@/constants/theme';
import { onNotificationTap } from '@/lib/push';
import { AppLockProvider, useAppLock } from '@/providers/app-lock-provider';
import { AuthProvider, useAuth } from '@/providers/auth-provider';

const queryClient = new QueryClient({
  defaultOptions: {
    // gcTime must exceed persister maxAge for offline cache to survive restarts
    queries: { staleTime: 60_000, retry: 1, gcTime: 1000 * 60 * 60 * 24 * 14 },
  },
});

// Saved query cache (offline support). Android AsyncStorage can't read back a
// value over ~2 MB ("Row too big to fit into CursorWindow"), and division page
// content from the website CMS embeds photos as base64 (5 MB+ for some
// divisions), so division detail queries are never saved. Member lookup / QR
// scan results aren't saved either: other members' data shouldn't stay on the
// phone.
const CACHE_KEY = 'd14-query-cache-v2';
AsyncStorage.removeItem('REACT_QUERY_OFFLINE_CACHE').catch(() => {}); // old, possibly oversized
const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: CACHE_KEY });

const NOT_PERSISTED = new Set(['member-search', 'scanned-member']);
function shouldPersistQuery(query: Query) {
  const [root, id] = query.queryKey;
  if (root === 'divisions' && id !== undefined) return false; // division detail (CMS content)
  if (typeof root === 'string' && NOT_PERSISTED.has(root)) return false;
  return defaultShouldDehydrateQuery(query);
}

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

// Screens a notification may open (same list send-push accepts)
const NOTIFICATION_LINK = /^\/(event|division)\/\d+$|^\/(renew|calendar)$/;

/**
 * Open the screen a tapped push notification links to. Waits until the app
 * is showing its screens (not loading or on the lock screen).
 */
function useNotificationLinks(ready: boolean) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => onNotificationTap(setPending), []);

  useEffect(() => {
    if (!ready || !pending) return;
    const url = pending;
    setPending(null);
    if (url.startsWith('https://')) {
      WebBrowser.openBrowserAsync(url).catch(() => {});
    } else if (NOTIFICATION_LINK.test(url)) {
      router.push(url as Href);
    }
  }, [ready, pending, router]);
}

function RootNavigator() {
  const { session, loading } = useAuth();
  const { locked } = useAppLock();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  useNotificationLinks(!loading && !(locked && session));

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
          name="join"
          options={{ headerShown: true, title: 'Become a Member', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="document/new"
          options={{
            headerShown: true,
            title: 'Add Document',
            headerBackTitle: 'Cancel',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="document/crop"
          options={{
            headerShown: true,
            title: 'Crop Photo',
            presentation: 'modal',
            gestureEnabled: false,
            headerStyle: { backgroundColor: '#000000' },
            headerTintColor: '#FFFFFF',
          }}
        />
        <Stack.Screen
          name="document/[id]"
          options={{ headerShown: true, title: 'Document', headerBackTitle: 'Wallet' }}
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
        <Stack.Screen
          name="notification-history"
          options={{ headerShown: true, title: 'Sent Notifications', headerBackTitle: 'Back' }}
        />
      </Stack.Protected>

      {/* Sign-in sheet for guests. When sign-in succeeds the guard turns
          false, Expo Router drops it from history and returns to the tabs. */}
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" options={{ presentation: 'modal' }} />
        {/* Prospect sign-up ("Get race reminders"); closes itself on code verification */}
        <Stack.Screen name="signup" options={{ presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={d14Theme}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 1000 * 60 * 60 * 24 * 7,
          dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
        }}>
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
