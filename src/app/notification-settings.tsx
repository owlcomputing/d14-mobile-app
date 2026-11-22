import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { DivisionChecklist } from '@/components/division-checklist';
import { Widget } from '@/components/widget';
import { Radius, Spacing } from '@/constants/theme';
import { loadDivisionChoice, saveDivisionChoice } from '@/lib/notification-prefs';
import { getDevicePushToken } from '@/lib/push';
import { makeStyles, useColors } from '@/lib/theme';
import { useAuth } from '@/providers/auth-provider';

export default function NotificationSettingsScreen() {
  const c = useColors();
  const styles = useStyles();
  const { profile } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // null = all divisions
  const [selected, setSelected] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const t = await getDevicePushToken();
      setToken(t);
      const choice = await loadDivisionChoice(profile.id, t);
      setSelected(choice.divisions);
      setLoading(false);
    })();
  }, [profile]);

  const save = async () => {
    if (!profile || saving) return;
    setSaving(true);
    try {
      await saveDivisionChoice(profile.id, token, selected);
      Alert.alert('Saved', 'Notification preferences updated.');
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.red} />
      </View>
    );
  }

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
        <DivisionChecklist value={selected} onChange={setSelected} />
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
  intro: { color: c.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: Spacing.three },
  button: {
    backgroundColor: c.red,
    borderRadius: Radius.md,
    alignItems: 'center',
    paddingVertical: 15,
    marginTop: Spacing.three,
  },
  buttonText: { color: c.onAccent, fontSize: 15, fontWeight: '700' },
}));
