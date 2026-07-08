import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Widget } from '@/components/widget';
import { D14Colors, Radius, Spacing } from '@/constants/theme';
import { getDevicePushToken } from '@/lib/push';
import { useDivisions } from '@/lib/queries';
import { supabase } from '@/lib/supabase';

export default function NotificationSettingsScreen() {
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
      if (t) {
        const { data } = await supabase
          .from('push_tokens')
          .select('divisions')
          .eq('token', t)
          .maybeSingle();
        setSelected(data?.divisions ?? null);
      }
      setLoading(false);
    })();
  }, []);

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
    if (!token || saving) return;
    setSaving(true);
    const { error } = await supabase
      .from('push_tokens')
      .update({ divisions: selected })
      .eq('token', token);
    setSaving(false);
    Alert.alert(error ? 'Save failed' : 'Saved', error ? error.message : 'Notification preferences updated.');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={D14Colors.red} />
      </View>
    );
  }

  if (!token) {
    return (
      <View style={styles.center}>
        <Ionicons name="notifications-off" size={36} color={D14Colors.textTertiary} />
        <Text style={styles.unavailable}>
          Push notifications aren&apos;t available on this device or haven&apos;t been allowed yet.
          Check your system notification settings for the D14 app.
        </Text>
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
      <Widget header="Divisions">
        <Pressable style={styles.row} onPress={() => setSelected(null)}>
          <Ionicons
            name={allSelected ? 'checkbox' : 'square-outline'}
            size={22}
            color={allSelected ? D14Colors.red : D14Colors.textTertiary}
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
                color={checked ? D14Colors.red : D14Colors.textTertiary}
              />
              <Text style={styles.rowText}>{d.name}</Text>
            </Pressable>
          );
        })}
      </Widget>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && { backgroundColor: D14Colors.redDark }]}
        onPress={save}
        disabled={saving}>
        {saving ? (
          <ActivityIndicator color={D14Colors.white} />
        ) : (
          <Text style={styles.buttonText}>Save Preferences</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: D14Colors.black },
  content: { padding: Spacing.three, paddingBottom: Spacing.six },
  center: {
    flex: 1,
    backgroundColor: D14Colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  unavailable: { color: D14Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  intro: { color: D14Colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: Spacing.three },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: 11,
  },
  rowText: { color: D14Colors.white, fontSize: 14 },
  button: {
    backgroundColor: D14Colors.red,
    borderRadius: Radius.md,
    alignItems: 'center',
    paddingVertical: 15,
    marginTop: Spacing.three,
  },
  buttonText: { color: D14Colors.white, fontSize: 15, fontWeight: '700' },
});
