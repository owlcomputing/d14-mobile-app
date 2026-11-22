// Notification preferences shared by the first sign-in walkthrough
// (notification-setup) and Profile > Notification Preferences.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabase';

// ---- First sign-in walkthrough: shown once per person on each phone ----

const setupKey = (userId: string) => `d14-notification-setup:${userId}`;

export async function isNotificationSetupDone(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(setupKey(userId))) != null;
  } catch {
    return true; // can't tell: don't nag
  }
}

export async function markNotificationSetupDone(userId: string) {
  await AsyncStorage.setItem(setupKey(userId), new Date().toISOString()).catch(() => {});
}

// ---- Division filter (null = all divisions) ----

/**
 * The divisions this person hears from. This phone's push setting wins;
 * otherwise the account-level choice (used for email and new devices).
 * `saved` is false if they've never chosen.
 */
export async function loadDivisionChoice(
  profileId: string,
  token: string | null,
): Promise<{ divisions: string[] | null; saved: boolean }> {
  const [{ data: device }, { data: account }] = await Promise.all([
    token
      ? supabase.from('push_tokens').select('divisions').eq('token', token).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('communication_preferences')
      .select('divisions')
      .eq('profile_id', profileId)
      .maybeSingle(),
  ]);
  if (device) return { divisions: device.divisions, saved: true };
  if (account) return { divisions: account.divisions, saved: true };
  return { divisions: null, saved: false };
}

/** Save the division filter to the account and to this phone's push registration. */
export async function saveDivisionChoice(
  profileId: string,
  token: string | null,
  divisions: string[] | null,
) {
  const { error: accountError } = await supabase.from('communication_preferences').upsert({
    profile_id: profileId,
    divisions,
    updated_at: new Date().toISOString(),
  });
  if (accountError) throw new Error(accountError.message);
  if (token) {
    const { error } = await supabase.from('push_tokens').update({ divisions }).eq('token', token);
    if (error) throw new Error(error.message);
  }
}
