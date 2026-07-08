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
export async function registerPushToken(profileId: string): Promise<void> {
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

/** Remove this device's token so a signed-out device stops receiving pushes. */
export async function unregisterPushToken(): Promise<void> {
  const token = await getDevicePushToken();
  if (!token) return;
  await supabase.from('push_tokens').delete().eq('token', token);
}
