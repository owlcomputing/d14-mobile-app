// Admin: send a push notification (optionally also as email) to everyone,
// members or prospects, district-wide or for chosen divisions, with an
// optional link that opens when the notification is tapped.
// Sending happens in the send-push edge function.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Chips, PickerField } from '@/components/form-fields';
import { Radius, Spacing } from '@/constants/theme';
import { useDivisions, useUpcomingEvents } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { makeStyles, useColors } from '@/lib/theme';

type Audience = 'everyone' | 'members' | 'prospects';
type LinkKind = 'none' | 'event' | 'division' | 'renew' | 'web';

const AUDIENCES: { value: Audience; label: string; hint: string }[] = [
  { value: 'everyone', label: 'Everyone', hint: 'Members and prospects.' },
  { value: 'members', label: 'Members', hint: 'People with a current membership (and their families).' },
  {
    value: 'prospects',
    label: 'Prospects',
    hint: 'People without a current membership: app sign-ups for race reminders, and expired members.',
  },
];

const LINKS: { value: LinkKind; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'event', label: 'Event' },
  { value: 'division', label: 'Division' },
  { value: 'renew', label: 'Renew' },
  { value: 'web', label: 'Web link' },
];

type SendResult = {
  sent: number;
  targeted: number;
  emailTargeted: number;
  emailed: number;
  emailNote: string | null;
  errors?: string[];
};

async function errorMessage(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null);
    if (body?.error) return String(body.error);
  }
  return error instanceof Error ? error.message : String(error);
}

const shortDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

export default function SendNotificationScreen() {
  const c = useColors();
  const styles = useStyles();
  const divisions = useDivisions();
  const events = useUpcomingEvents(100);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('everyone');
  const [selectedDivisions, setSelectedDivisions] = useState<string[]>([]);
  const [linkKind, setLinkKind] = useState<LinkKind>('none');
  const [eventLabel, setEventLabel] = useState('');
  const [divisionLabel, setDivisionLabel] = useState('');
  const [webLink, setWebLink] = useState('');
  const [email, setEmail] = useState(true);
  const [sending, setSending] = useState<'send' | 'test' | null>(null);

  const divisionNames = useMemo(
    () => divisions.data?.map((d) => d.name).filter((n): n is string => !!n) ?? [],
    [divisions.data],
  );

  // Picker labels → ids
  const eventOptions = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events.data ?? []) {
      const division = (e.divisions as { name: string | null } | null)?.name;
      const label = `${shortDate(e.date)} · ${e.name ?? 'Event'}${division ? ` (${division})` : ''}`;
      if (!map.has(label)) map.set(label, e.id);
    }
    return map;
  }, [events.data]);
  const divisionIds = useMemo(
    () => new Map((divisions.data ?? []).filter((d) => d.name).map((d) => [d.name as string, d.id])),
    [divisions.data],
  );

  const link: string | null | undefined = (() => {
    switch (linkKind) {
      case 'none':
        return null;
      case 'renew':
        return '/renew';
      case 'event': {
        const id = eventOptions.get(eventLabel);
        return id ? `/event/${id}` : undefined;
      }
      case 'division': {
        const id = divisionIds.get(divisionLabel);
        return id ? `/division/${id}` : undefined;
      }
      case 'web': {
        const url = webLink.trim();
        return /^https:\/\/[^\s.]+\.[^\s]+$/i.test(url) ? url : undefined;
      }
    }
  })();

  const ready = !!title.trim() && !!body.trim() && link !== undefined;

  const toggleDivision = (name: string) =>
    setSelectedDivisions((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );

  const send = async (test: boolean) => {
    setSending(test ? 'test' : 'send');
    try {
      const { data, error } = await supabase.functions.invoke<SendResult>('send-push', {
        body: {
          title: title.trim(),
          body: body.trim(),
          audience,
          divisions: selectedDivisions.length ? selectedDivisions : null,
          link,
          email,
          test,
        },
      });
      if (error) throw error;
      const r = data!;
      const lines = [
        test
          ? `Push: ${r.sent} of your ${r.targeted} device${r.targeted === 1 ? '' : 's'}.`
          : `Push: delivered to ${r.sent} of ${r.targeted} devices.`,
      ];
      if (email) {
        lines.push(
          test
            ? `Email: ${r.emailed ? 'sent to you' : 'not sent'}.`
            : `Email: sent to ${r.emailed} of ${r.emailTargeted} people.`,
        );
        if (r.emailNote) lines.push(r.emailNote);
      }
      if (r.errors?.length) lines.push(`Problems: ${r.errors.join('; ')}`);
      Alert.alert(test ? 'Test sent' : 'Sent', lines.join('\n\n'));
      if (!test) {
        setTitle('');
        setBody('');
      }
    } catch (e) {
      Alert.alert('Send failed', await errorMessage(e));
    } finally {
      setSending(null);
    }
  };

  const onSend = () => {
    if (!ready || sending) return;
    const who = AUDIENCES.find((a) => a.value === audience)!.label.toLowerCase();
    const where = selectedDivisions.length
      ? ` following ${selectedDivisions.join(', ')}`
      : ' (district-wide)';
    Alert.alert(
      'Send notification?',
      `"${title.trim()}" goes to ${who}${where} by push${email ? ' and email' : ''}. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', style: 'destructive', onPress: () => send(false) },
      ],
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="MX Spring Opener — Today!"
        placeholderTextColor={c.textTertiary}
        maxLength={100}
      />
      <Text style={styles.label}>Message</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={body}
        onChangeText={setBody}
        placeholder="Gates open at 7 AM…"
        placeholderTextColor={c.textTertiary}
        multiline
        maxLength={1000}
      />

      <Text style={styles.label}>Audience</Text>
      <View style={styles.pillRow}>
        {AUDIENCES.map((a) => (
          <Pill
            key={a.value}
            label={a.label}
            active={audience === a.value}
            onPress={() => setAudience(a.value)}
          />
        ))}
      </View>
      <Text style={styles.hint}>{AUDIENCES.find((a) => a.value === audience)!.hint}</Text>

      <Text style={styles.label}>Divisions</Text>
      <Chips options={divisionNames} selected={selectedDivisions} onToggle={toggleDivision} />
      <Text style={styles.hint}>
        {selectedDivisions.length
          ? 'Only people following these divisions (or all divisions) receive it.'
          : 'None selected: district-wide, everyone in the audience receives it.'}
      </Text>

      <Text style={styles.label}>When tapped, open</Text>
      <View style={styles.pillRow}>
        {LINKS.map((l) => (
          <Pill
            key={l.value}
            label={l.label}
            active={linkKind === l.value}
            onPress={() => setLinkKind(l.value)}
          />
        ))}
      </View>
      {linkKind === 'event' ? (
        eventOptions.size ? (
          <PickerField
            label="Event"
            value={eventLabel}
            options={[...eventOptions.keys()]}
            onChange={setEventLabel}
            placeholder="Choose an upcoming event"
          />
        ) : (
          <Text style={styles.hint}>No upcoming events on the calendar.</Text>
        )
      ) : null}
      {linkKind === 'division' ? (
        <PickerField
          label="Division page"
          value={divisionLabel}
          options={divisionNames}
          onChange={setDivisionLabel}
          placeholder="Choose a division"
        />
      ) : null}
      {linkKind === 'web' ? (
        <TextInput
          style={[styles.input, { marginTop: Spacing.two }]}
          value={webLink}
          onChangeText={setWebLink}
          placeholder="https://…"
          placeholderTextColor={c.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
      ) : null}
      {linkKind === 'renew' ? (
        <Text style={styles.hint}>Opens the membership renewal screen (website membership page in email).</Text>
      ) : null}
      {link === undefined && linkKind !== 'none' ? (
        <Text style={styles.warn}>
          {linkKind === 'web' ? 'Enter a full https:// address.' : 'Choose where the notification opens.'}
        </Text>
      ) : null}

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.switchLabel}>Also send as email</Text>
          <Text style={styles.hint}>
            Members get it unless they unsubscribed; prospects only if they opted in to email.
          </Text>
        </View>
        <Switch
          value={email}
          onValueChange={setEmail}
          trackColor={{ true: c.red, false: c.surfaceRaised }}
          thumbColor={c.onAccent}
        />
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.button,
          !ready && styles.buttonDisabled,
          pressed && { backgroundColor: c.redDark },
        ]}
        onPress={onSend}
        disabled={!!sending || !ready}>
        {sending === 'send' ? (
          <ActivityIndicator color={c.onAccent} />
        ) : (
          <Text style={styles.buttonText}>Send Notification</Text>
        )}
      </Pressable>
      <Pressable
        style={({ pressed }) => [
          styles.secondary,
          !ready && styles.buttonDisabled,
          pressed && { opacity: 0.7 },
        ]}
        onPress={() => send(true)}
        disabled={!!sending || !ready}>
        {sending === 'test' ? (
          <ActivityIndicator color={c.text} />
        ) : (
          <Text style={styles.secondaryText}>Send Test to Me</Text>
        )}
      </Pressable>
      <Text style={styles.footnote}>
        A test goes only to your own devices{email ? ' and email address' : ''}. Notifications reach
        people who installed the app and allowed notifications.
      </Text>

      <Pressable style={styles.historyRow} onPress={() => router.push('/notification-history')}>
        <Ionicons name="time-outline" size={18} color={c.textSecondary} />
        <Text style={styles.historyText}>Sent notifications</Text>
        <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
      </Pressable>
    </ScrollView>
  );
}

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} style={[styles.pill, active && styles.pillActive]}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: Spacing.three, paddingBottom: Spacing.six },
  label: {
    color: c.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
  },
  input: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    color: c.text,
    fontSize: 15,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  pill: {
    backgroundColor: c.surface,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillActive: { backgroundColor: c.red },
  pillText: { color: c.textSecondary, fontSize: 12, fontWeight: '600' },
  pillTextActive: { color: c.onAccent },
  hint: { color: c.textTertiary, fontSize: 12, lineHeight: 17, marginTop: Spacing.two },
  warn: { color: c.error, fontSize: 12, marginTop: Spacing.two },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.four,
    backgroundColor: c.surface,
    borderRadius: Radius.md,
    padding: Spacing.three,
  },
  switchLabel: { color: c.text, fontSize: 15, fontWeight: '600' },
  button: {
    backgroundColor: c.red,
    borderRadius: Radius.md,
    alignItems: 'center',
    paddingVertical: 15,
    marginTop: Spacing.four,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: c.onAccent, fontSize: 15, fontWeight: '700' },
  secondary: {
    borderRadius: Radius.md,
    alignItems: 'center',
    paddingVertical: 13,
    marginTop: Spacing.two,
    borderWidth: 1,
    borderColor: c.border,
  },
  secondaryText: { color: c.text, fontSize: 14, fontWeight: '600' },
  footnote: {
    color: c.textTertiary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: Spacing.three,
    textAlign: 'center',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.four,
    backgroundColor: c.surface,
    borderRadius: Radius.md,
    padding: Spacing.three,
  },
  historyText: { flex: 1, color: c.text, fontSize: 14 },
}));
