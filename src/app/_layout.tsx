import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { D14Colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/providers/auth-provider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1 },
  },
});

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

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
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
          name="lookup"
          options={{ headerShown: true, title: 'Member Lookup', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="scanner"
          options={{ headerShown: true, title: 'Scan QR Code', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="contacts"
          options={{ headerShown: true, title: 'District Contacts', headerBackTitle: 'Back' }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={d14Theme}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
