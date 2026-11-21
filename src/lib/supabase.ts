import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import type { Database } from './database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Web pages are pre-rendered in Node (no window, so no saved session there)
const isServer = typeof window === 'undefined';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isServer ? undefined : AsyncStorage,
    autoRefreshToken: !isServer,
    persistSession: !isServer,
    // No URL-based session detection in native apps
    detectSessionInUrl: false,
  },
});

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type Profile = Tables<'profiles'>;
export type Membership = Tables<'memberships'>;
export type Division = Tables<'divisions'>;
export type D14Event = Tables<'events'>;
export type Organization = Tables<'organizations'>;
export type Contact = Tables<'contacts'>;
export type Rule = Tables<'rules'>;
