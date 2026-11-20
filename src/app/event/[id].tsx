import { Ionicons } from '@expo/vector-icons';
// SDK 57 replaced the functional API; the classic functions live under /legacy
import * as Calendar from 'expo-calendar/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { Widget } from '@/components/widget';
import { Radius, Spacing } from '@/constants/theme';
import { htmlToText } from '@/lib/html';
import { useEvent } from '@/lib/queries';
import { makeStyles, useColors } from '@/lib/theme';
import { useAuth } from '@/providers/auth-provider';

function openDirections(
  locationName: string | null,
  address: string | null,
  latitude: number | null,
  longitude: number | null,
) {
  // Exact coordinates (from the website's Places autocomplete) beat a text search
  const query =
    latitude != null && longitude != null
      ? `${latitude},${longitude}`
      : encodeURIComponent([locationName, address].filter(Boolean).join(', '));
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
}

async function addToCalendar(
  name: string,
  date: string,
  endDate: string | null,
  notes: string,
  location?: string,
) {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Calendar access needed', 'Allow calendar access in Settings to add events.');
      return;
    }
    let calendarId: string;
    if (Platform.OS === 'ios') {
      const defaultCal = await Calendar.getDefaultCalendarAsync();
      calendarId = defaultCal.id;
    } else {
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const writable =
        calendars.find((c) => c.allowsModifications && c.isPrimary) ??
        calendars.find((c) => c.allowsModifications);
      if (!writable) {
        Alert.alert('No calendar found', 'No writable calendar is available on this device.');
        return;
      }
      calendarId = writable.id;
    }
    // All-day event spanning the event date range
    const start = new Date(`${date.slice(0, 10)}T00:00:00`);
    const end = new Date(`${(endDate ?? date).slice(0, 10)}T00:00:00`);
    end.setDate(end.getDate() + 1);
    await Calendar.createEventAsync(calendarId, {
      title: name,
      startDate: start,
      endDate: end,
      allDay: true,
      notes,
      location,
    });
    Alert.alert('Added', `"${name}" was added to your calendar.`);
  } catch (error) {
    console.error('addToCalendar failed:', error);
    Alert.alert(
      'Could not add event',
      error instanceof Error ? error.message : 'An unexpected error occurred.',
    );
  }
}

function formatEventDate(date: string, endDate?: string | null) {
  const opts = { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' } as const;
  const start = new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', opts);
  if (endDate && endDate.slice(0, 10) !== date.slice(0, 10)) {
    const end = new Date(`${endDate.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', opts);
    return `${start} – ${end}`;
  }
  return start;
}

export default function EventDetailScreen() {
  const c = useColors();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const event = useEvent(Number(id));

  if (event.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.red} />
      </View>
    );
  }
  if (!event.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Event not found</Text>
      </View>
    );
  }

  const e = event.data;
  const description = htmlToText(e.description);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{e.name ?? 'Event'}</Text>
      <View style={styles.metaRow}>
        <Ionicons name="calendar" size={15} color={c.red} />
        <Text style={styles.metaText}>{formatEventDate(e.date, e.end_date)}</Text>
      </View>
      {e.divisions ? (
        <Pressable
          style={styles.metaRow}
          onPress={() => router.push(`/division/${e.divisions!.id}`)}>
          <Ionicons name="flag" size={15} color={c.red} />
          <Text style={[styles.metaText, styles.linkText]}>{e.divisions.name}</Text>
        </Pressable>
      ) : null}
      {e.location_name || e.address ? (
        <View style={styles.metaRow}>
          <Ionicons name="location" size={15} color={c.red} />
          <Text style={styles.metaText}>
            {[e.location_name, e.address].filter(Boolean).join(' • ')}
          </Text>
        </View>
      ) : null}

      <View style={styles.buttonRow}>
        <Pressable
          style={({ pressed }) => [styles.calendarButton, pressed && { opacity: 0.85 }]}
          onPress={() =>
            addToCalendar(
              e.name ?? 'D14 Event',
              e.date,
              e.end_date,
              description.slice(0, 500),
              [e.location_name, e.address].filter(Boolean).join(', ') || undefined,
            )
          }>
          <Ionicons name="calendar" size={16} color={c.onAccent} />
          <Text style={styles.calendarButtonText}>Add to Calendar</Text>
        </Pressable>
        {e.location_name || e.address ? (
          <Pressable
            style={({ pressed }) => [
              styles.calendarButton,
              styles.directionsButton,
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => openDirections(e.location_name, e.address, e.latitude, e.longitude)}>
            <Ionicons name="navigate" size={16} color={c.text} />
            <Text style={[styles.calendarButtonText, styles.directionsButtonText]}>Directions</Text>
          </Pressable>
        ) : null}
      </View>

      {description ? (
        <Widget header="Details" style={{ marginTop: Spacing.three }}>
          <Text style={styles.description}>{description}</Text>
        </Widget>
      ) : null}

      {/* Guests: invite them to sign up for reminders (board request, Q3 2026) */}
      {!session ? (
        <Pressable
          style={({ pressed }) => [styles.reminderCta, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/signup')}>
          <Ionicons name="notifications" size={20} color={c.red} />
          <View style={{ flex: 1 }}>
            <Text style={styles.reminderTitle}>Never miss a race</Text>
            <Text style={styles.reminderText}>
              Get free reminders for {e.divisions?.name ?? 'D14'} events. No membership needed.
            </Text>
          </View>
          <Text style={styles.reminderChevron}>›</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  reminderCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.red,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    marginTop: Spacing.three,
  },
  reminderTitle: { color: c.text, fontSize: 14, fontWeight: '700' },
  reminderText: { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  reminderChevron: { color: c.textTertiary, fontSize: 22, fontWeight: '300' },
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: Spacing.three, paddingBottom: Spacing.five },
  center: {
    flex: 1,
    backgroundColor: c.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { color: c.textSecondary },
  title: { color: c.text, fontSize: 24, fontWeight: '800', marginBottom: Spacing.three },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  metaText: { color: c.textSecondary, fontSize: 14 },
  linkText: { color: c.red, fontWeight: '600' },
  buttonRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three },
  calendarButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: c.red,
    borderRadius: Radius.md,
    paddingVertical: 13,
  },
  directionsButton: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  calendarButtonText: { color: c.onAccent, fontSize: 14, fontWeight: '700' },
  directionsButtonText: { color: c.text },
  description: { color: c.text, fontSize: 14, lineHeight: 22 },
}));
