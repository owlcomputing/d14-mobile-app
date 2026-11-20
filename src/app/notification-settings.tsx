import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { Widget } from '@/components/widget';
import { Radius, Spacing } from '@/constants/theme';
import { getDevicePushToken } from '@/lib/push';
import { useDivisions } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { makeStyles, useColors } from '@/lib/theme';
import { useAuth } from '@/providers/auth-provider';

export default function NotificationSettingsScreen() {
  const c = useColors();
  const styles = useStyles();
  const { profile } = useAuth();
  const divisions = useDivisions();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // null = all divisions
  const [selected, setSelected] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const t = await getDevicePushToken();
      setToken(t);
      // This phone's push setting wins; otherwise use the account-level choice
      // (set at sign-up, used for email and new devices).
      const [{ data: device }, { data: account }] = await Promise.all([
        t
          ? supabase.from('push_tokens').select('divisions').eq('token', t).maybeSingle()
          : Promise.resolve({ data: null }),
        profile
          ? supabase
              .from('communication_preferences')
              .select('divisions')
              .eq('profile_id', profile.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setSelected(device ? device.divisions : (account?.divisions ?? null));
      setLoading(false);
    })();
  }, [profile]);

  const toggle = (name: string) => {
    const all = divisions.data?.map((d) => d.name).filter((n): n is string => !!n) ?? [];
    setSelected((prev) => {
      const current = prev ?? all; // "all" expands to every division when narrowing
      const next = current.includes(name)
        ? current.filter((n) => n !== name)
        : [...current, name];
      return next.length === all.length ? null : next;
    });
  };

  const save = async () => {
    if (!profile || saving) return;
    setSaving(true);
    const { error: accountError } = await supabase.from('communication_preferences').upsert({
      profile_id: profile.id,
      divisions: selected,
      updated_at: new Date().toISOString(),
    });
    const { error: deviceError } = token
      ? await supabase.from('push_tokens').update({ divisions: selected }).eq('token', token)
      : { error: null };
    const error = accountError ?? deviceError;
    setSaving(false);
    Alert.alert(error ? 'Save failed' : 'Saved', error ? error.message : 'Notification preferences updated.');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.red} />
      </View>
    );
  }

  const allSelected = selected === null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Choose which divisions send you event reminders and news. District-wide announcements are
        always delivered.
      </Text>
      {!token ? (
        <View style={styles.notice}>
          <Ionicons name="notifications-off" size={18} color={c.textTertiary} />
          <Text style={styles.noticeText}>
            Push notifications aren&apos;t available on this device or haven&apos;t been allowed
            yet. Your choices are still saved to your account for emails and your other devices.
          </Text>
        </View>
      ) : null}
      <Widget header="Divisions">
        <Pressable style={styles.row} onPress={() => setSelected(null)}>
          <Ionicons
            name={allSelected ? 'checkbox' : 'square-outline'}
            size={22}
            color={allSelected ? c.red : c.textTertiary}
          />
          <Text style={styles.rowText}>All Divisions</Text>
        </Pressable>
        {divisions.data?.map((d) => {
          if (!d.name) return null;
          const checked = allSelected || (selected?.includes(d.name) ?? false);
          return (
            <Pressable key={d.id} style={styles.row} onPress={() => toggle(d.name!)}>
              <Ionicons
                name={checked ? 'checkbox' : 'square-outline'}
                size={22}
                color={checked ? c.red : c.textTertiary}
              />
              <Text style={styles.rowText}>{d.name}</Text>
            </Pressable>
          );
        })}
      </Widget>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && { backgroundColor: c.redDark }]}
        onPress={save}
        disabled={saving}>
        {saving ? (
          <ActivityIndicator color={c.onAccent} />
        ) : (
          <Text style={styles.buttonText}>Save Preferences</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: Spacing.three, paddingBottom: Spacing.six },
  notice: {
    flexDirection: 'row',
    gap: Spacing.two,
    backgroundColor: c.surface,
    borderRadius: Radius.md,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  noticeText: { flex: 1, color: c.textSecondary, fontSize: 12, lineHeight: 17 },
  center: {
    flex: 1,
    backgroundColor: c.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  unavailable: { color: c.textSecondary, textAlign: 'center', lineHeight: 20 },
  intro: { color: c.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: Spacing.three },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: 11,
  },
  rowText: { color: c.text, fontSize: 14 },
  button: {
    backgroundColor: c.red,
    borderRadius: Radius.md,
    alignItems: 'center',
    paddingVertical: 15,
    marginTop: Spacing.three,
  },
  buttonText: { color: c.onAccent, fontSize: 15, fontWeight: '700' },
}));
