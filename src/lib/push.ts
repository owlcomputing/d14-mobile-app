import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { supabase } from './supabase';

// Remote push was removed from Expo Go (SDK 53+) on Android — importing or
// initializing expo-notifications there crashes the app, so everything in
// this module lazy-loads the native module and no-ops in Expo Go.
const isExpoGo = Constants.executionEnvironment === 'storeClient';

function canUsePush(): boolean {
  return Device.isDevice && !isExpoGo;
}

async function loadNotifications() {
  const Notifications = await import('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  return Notifications;
}

/**
 * Register this device for push notifications and store the Expo push token.
 * Silently no-ops where push isn't available (simulator, Expo Go, no EAS
 * project configured).
 */
export async function registerPushToken(
  profileId: string,
  /** Division filter for this device (null = all). Omit to keep the existing setting. */
  divisions?: string[] | null,
): Promise<void> {
  try {
    if (!canUsePush()) return;
    const Notifications = await loadNotifications();

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'D14 Notifications',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E63946',
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );

    await supabase.from('push_tokens').upsert({
      token,
      profile_id: profileId,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
      ...(divisions !== undefined ? { divisions } : {}),
    });
  } catch {
    // Push is best-effort; never block sign-in on registration failures
  }
}

/** This device's Expo push token, or null where push isn't available. */
export async function getDevicePushToken(): Promise<string | null> {
  try {
    if (!canUsePush()) return null;
    const Notifications = await loadNotifications();
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return token;
  } catch {
    return null;
  }
}

/**
 * Call `open` with the link a tapped notification carries (`data.url`: an
 * in-app path like '/event/12', or an https URL). Covers the tap that
 * launched the app and taps while it's running. Returns an unsubscribe
 * function. No-op where push isn't available.
 */
export function onNotificationTap(open: (url: string) => void): () => void {
  if (!canUsePush()) return () => {};
  let cancelled = false;
  let subscription: { remove(): void } | null = null;

  (async () => {
    try {
      const Notifications = await loadNotifications();
      if (cancelled) return;
      const handle = (response: { notification: { request: { content: { data?: unknown } } } }) => {
        const data = response.notification.request.content.data as { url?: unknown } | undefined;
        if (typeof data?.url === 'string' && data.url) open(data.url);
      };
      const launchedBy = await Notifications.getLastNotificationResponseAsync();
      if (launchedBy && !cancelled) {
        // Clear it so a later remount doesn't open the same link again
        await Notifications.clearLastNotificationResponseAsync();
        handle(launchedBy);
      }
      if (!cancelled) subscription = Notifications.addNotificationResponseReceivedListener(handle);
    } catch {
      // Best-effort: a failed listener just means taps open the app's home screen
    }
  })();

  return () => {
    cancelled = true;
    subscription?.remove();
  };
}

/** Remove this device's token so a signed-out device stops receiving pushes. */
export async function unregisterPushToken(): Promise<void> {
  const token = await getDevicePushToken();
  if (!token) return;
  await supabase.from('push_tokens').delete().eq('token', token);
}
