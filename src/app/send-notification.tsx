import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';

import { D14Colors, Radius, Spacing } from '@/constants/theme';
import { useDivisions } from '@/lib/queries';
import { supabase } from '@/lib/supabase';

export default function SendNotificationScreen() {
  const divisions = useDivisions();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [division, setDivision] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const onSend = async () => {
    if (!title.trim() || !body.trim() || sending) return;
    const target = division ?? 'all members';
    Alert.alert('Send Notification', `Send "${title.trim()}" to ${target}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send',
        style: 'destructive',
        onPress: async () => {
          setSending(true);
          const { data, error } = await supabase.functions.invoke('send-push', {
            body: { title: title.trim(), body: body.trim(), division },
          });
          setSending(false);
          if (error) {
            Alert.alert('Send failed', error.message);
          } else {
            Alert.alert('Sent', `Delivered to ${data?.sent ?? 0} of ${data?.targeted ?? 0} devices.`);
            setTitle('');
            setBody('');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="MX Spring Opener — Today!"
        placeholderTextColor={D14Colors.textTertiary}
        maxLength={80}
      />
      <Text style={styles.label}>Message</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={body}
        onChangeText={setBody}
        placeholder="Gates open at 7 AM…"
        placeholderTextColor={D14Colors.textTertiary}
        multiline
        maxLength={500}
      />
      <Text style={styles.label}>Audience</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pills}>
        <Pill label="All Members" active={!division} onPress={() => setDivision(null)} />
        {divisions.data?.map((d) =>
          d.name ? (
            <Pill
              key={d.id}
              label={d.name}
              active={division === d.name}
              onPress={() => setDivision(d.name)}
            />
          ) : null,
        )}
      </ScrollView>

      <Pressable
        style={({ pressed }) => [
          styles.button,
          (!title.trim() || !body.trim()) && styles.buttonDisabled,
          pressed && { backgroundColor: D14Colors.redDark },
        ]}
        onPress={onSend}
        disabled={sending || !title.trim() || !body.trim()}>
        {sending ? (
          <ActivityIndicator color={D14Colors.white} />
        ) : (
          <Text style={styles.buttonText}>Send Push Notification</Text>
        )}
      </Pressable>
      <Text style={styles.hint}>
        Notifications are delivered to members who have installed the app and allowed
        notifications. Division targeting respects each member&apos;s notification preferences.
      </Text>
    </ScrollView>
  );
}

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.pill, active && styles.pillActive]}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: D14Colors.black },
  content: { padding: Spacing.three, paddingBottom: Spacing.six },
  label: {
    color: D14Colors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: Spacing.three,
    marginBottom: 6,
  },
  input: {
    backgroundColor: D14Colors.surface,
    borderColor: D14Colors.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    color: D14Colors.white,
    fontSize: 15,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  pills: { flexGrow: 0, marginBottom: Spacing.two },
  pill: {
    backgroundColor: D14Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  pillActive: { backgroundColor: D14Colors.red },
  pillText: { color: D14Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  pillTextActive: { color: D14Colors.white },
  button: {
    backgroundColor: D14Colors.red,
    borderRadius: Radius.md,
    alignItems: 'center',
    paddingVertical: 15,
    marginTop: Spacing.four,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: D14Colors.white, fontSize: 15, fontWeight: '700' },
  hint: {
    color: D14Colors.textTertiary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: Spacing.three,
    textAlign: 'center',
  },
});
