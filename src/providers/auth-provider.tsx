import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  completeSignup,
  fetchMyConsents,
  takePendingSignup,
  type PendingSignup,
} from '@/lib/prospect-signup';
import { registerPushToken, unregisterPushToken } from '@/lib/push';
import { supabase, type Membership, type Profile } from '@/lib/supabase';

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  membership: Membership | null;
  /** True until the persisted session (if any) has been restored */
  loading: boolean;
  isAdmin: boolean;
  isChairman: boolean;
  /**
   * Has a D14 membership row (active or expired), or is a family-only account
   * holder (pays for family members' memberships, has none of their own).
   * Signed-in non-members are prospects.
   */
  isMember: boolean;
  /** Family-only account holder: manages family memberships, no membership of their own */
  isFamilyHolder: boolean;
  /** False while the signed-in user's profile/membership are still loading (isMember not yet known). */
  profileReady: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  /**
   * Email a 6-digit sign-in code. createUser: true for prospect sign-up,
   * false for "sign in with a code" (existing accounts only).
   */
  sendSignInCode: (email: string, createUser: boolean) => Promise<{ error: string | null }>;
  verifySignInCode: (email: string, code: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

function friendlyAuthError(message: string | undefined): string | null {
  if (!message) return null;
  if (/signups not allowed/i.test(message)) {
    return 'No account found for that email. New here? Tap "Get race reminders" to sign up.';
  }
  if (/expired|invalid/i.test(message) && /otp|token|code/i.test(message)) {
    return 'That code is incorrect or has expired. Check the latest email, or send a new code.';
  }
  if (/rate limit|too many/i.test(message)) {
    return 'Too many attempts. Please wait a minute and try again.';
  }
  return message;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    const [{ data: profileRow }, { data: membershipRows }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase
        .from('memberships')
        .select('*')
        .eq('profile_id', userId)
        .order('expiration', { ascending: false })
        .limit(1),
    ]);
    setProfile(profileRow ?? null);
    setMembership(membershipRows?.[0] ?? null);
    setLoadedUserId(userId);
  }, []);

  // Runs after a session arrives. Order matters: a brand-new prospect has no
  // profile row until completeSignup, and push_tokens references profiles.
  const handleSession = useCallback(
    async (event: AuthChangeEvent, s: Session) => {
      const userId = s.user.id;
      let signup: PendingSignup | null = null;
      if (event === 'SIGNED_IN') {
        signup = takePendingSignup(s.user.email);
        if (signup) {
          try {
            await completeSignup(userId, signup);
          } catch (e) {
            console.warn('Prospect sign-up could not be completed', e);
          }
        }
      }
      await loadProfile(userId);

      if (event === 'SIGNED_IN') {
        if (signup) {
          if (signup.push) await registerPushToken(userId, signup.divisions);
        } else {
          // Respect an earlier push opt-out; members who never chose keep the default (on).
          const consents = await fetchMyConsents(userId);
          if (consents.push !== false) await registerPushToken(userId);
        }
      }
    },
    [loadProfile],
  );

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session) await loadProfile(session.user.id);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session) {
        // Don't await Supabase calls inside this callback (it can deadlock
        // the auth client); defer to the next tick.
        setTimeout(() => void handleSession(event, session), 0);
      } else {
        setProfile(null);
        setMembership(null);
        setLoadedUserId(null);
      }
    });
    return () => subscription.unsubscribe();
  }, [loadProfile, handleSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return { error: friendlyAuthError(error?.message) };
  }, []);

  const sendSignInCode = useCallback(async (email: string, createUser: boolean) => {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: createUser },
    });
    return { error: friendlyAuthError(error?.message) };
  }, []);

  const verifySignInCode = useCallback(async (email: string, code: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'email',
    });
    return { error: friendlyAuthError(error?.message) };
  }, []);

  const signOut = useCallback(async () => {
    await unregisterPushToken();
    await supabase.auth.signOut();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const value = useMemo(
    () => ({
      session,
      profile,
      membership,
      loading,
      isAdmin: profile?.role === 'admin',
      isChairman: profile?.role === 'chairman',
      isMember: membership != null || profile?.member_type === 'Family',
      isFamilyHolder: membership == null && profile?.member_type === 'Family',
      profileReady: !session || loadedUserId === session.user.id,
      signIn,
      sendSignInCode,
      verifySignInCode,
      signOut,
      refreshProfile,
    }),
    [
      session,
      profile,
      membership,
      loading,
      loadedUserId,
      signIn,
      sendSignInCode,
      verifySignInCode,
      signOut,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
