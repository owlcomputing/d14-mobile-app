// Prospect sign-up: a guest creates a login (6-digit email code, no password)
// to get race reminders without buying a membership. Their profile has
// member_type NULL and no membership, which is how the website already
// represents registered-but-unpaid accounts; buying a membership on the
// website later turns the same account into a member.
//
// Consent is recorded per channel in communication_consents with the exact
// wording below, so we can show what someone agreed to and when.
import { supabase } from './supabase';

export const PUSH_CONSENT_TEXT =
  'Send me push notifications about AMA District 14 races, events and news.';
export const EMAIL_CONSENT_TEXT =
  'Email me AMA District 14 news, event reminders and membership offers. I can unsubscribe at any time.';

export type ConsentChannel = 'push' | 'email_marketing';

export type PendingSignup = {
  email: string;
  firstName: string;
  lastName: string;
  /** Division names of interest; null = all divisions */
  divisions: string[] | null;
  push: boolean;
  emailMarketing: boolean;
};

// Held in memory between "Email me a code" and code verification. The
// AuthProvider finishes the sign-up when the new session arrives.
let pending: PendingSignup | null = null;

export function setPendingSignup(signup: PendingSignup) {
  pending = { ...signup, email: signup.email.trim().toLowerCase() };
}

export function takePendingSignup(email: string | undefined): PendingSignup | null {
  if (!pending || !email || pending.email !== email.trim().toLowerCase()) return null;
  const s = pending;
  pending = null;
  return s;
}

export async function recordConsent(
  profileId: string,
  channel: ConsentChannel,
  granted: boolean,
  source: string,
) {
  const { error } = await supabase.from('communication_consents').insert({
    profile_id: profileId,
    channel,
    granted,
    source,
    consent_text: channel === 'push' ? PUSH_CONSENT_TEXT : EMAIL_CONSENT_TEXT,
  });
  if (error) throw error;
}

/**
 * Create the prospect's profile, preferences and consent records. Runs once,
 * right after their first code sign-in. Skips the profile insert if one
 * already exists (e.g. they had a website account).
 */
export async function completeSignup(userId: string, signup: PendingSignup) {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  if (!existing) {
    const { error } = await supabase.from('profiles').insert({
      id: userId,
      email: signup.email,
      first_name: signup.firstName.trim(),
      last_name: signup.lastName.trim(),
    });
    if (error) throw error;
  }

  const { error: prefError } = await supabase.from('communication_preferences').upsert({
    profile_id: userId,
    divisions: signup.divisions,
    signup_source: 'app:prospect-signup',
    updated_at: new Date().toISOString(),
  });
  if (prefError) throw prefError;

  await recordConsent(userId, 'push', signup.push, 'app:prospect-signup');
  await recordConsent(userId, 'email_marketing', signup.emailMarketing, 'app:prospect-signup');
}

/** Latest consent per channel for the signed-in user (true/false, or undefined if never asked). */
export async function fetchMyConsents(
  profileId: string,
): Promise<Partial<Record<ConsentChannel, boolean>>> {
  const { data } = await supabase
    .from('current_communication_consents')
    .select('channel, granted')
    .eq('profile_id', profileId);
  const result: Partial<Record<ConsentChannel, boolean>> = {};
  for (const row of data ?? []) {
    if (row.channel === 'push' || row.channel === 'email_marketing') {
      result[row.channel] = !!row.granted;
    }
  }
  return result;
}
