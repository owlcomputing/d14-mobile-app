import { Ionicons } from '@expo/vector-icons';
import * as Calendar from 'expo-calendar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Widget } from '@/components/widget';
import { D14Colors, Radius, Spacing } from '@/constants/theme';
import { htmlToText } from '@/lib/html';
import { useEvent } from '@/lib/queries';

async function addToCalendar(name: string, date: string, endDate: string | null, notes: string) {
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
    const writable = calendars.find((c) => c.allowsModifications && c.isPrimary) ??
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
  });
  Alert.alert('Added', `"${name}" was added to your calendar.`);
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const event = useEvent(Number(id));

  if (event.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={D14Colors.red} />
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
        <Ionicons name="calendar" size={15} color={D14Colors.red} />
        <Text style={styles.metaText}>{formatEventDate(e.date, e.end_date)}</Text>
      </View>
      {e.divisions ? (
        <Pressable
          style={styles.metaRow}
          onPress={() => router.push(`/division/${e.divisions!.id}`)}>
          <Ionicons name="flag" size={15} color={D14Colors.red} />
          <Text style={[styles.metaText, styles.linkText]}>{e.divisions.name}</Text>
        </Pressable>
      ) : null}

      <Pressable
        style={({ pressed }) => [styles.calendarButton, pressed && { opacity: 0.85 }]}
        onPress={() =>
          addToCalendar(e.name ?? 'D14 Event', e.date, e.end_date, description.slice(0, 500))
        }>
        <Ionicons name="calendar" size={16} color={D14Colors.white} />
        <Text style={styles.calendarButtonText}>Add to Calendar</Text>
      </Pressable>

      {description ? (
        <Widget header="Details" style={{ marginTop: Spacing.three }}>
          <Text style={styles.description}>{description}</Text>
        </Widget>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: D14Colors.black },
  content: { padding: Spacing.three, paddingBottom: Spacing.five },
  center: {
    flex: 1,
    backgroundColor: D14Colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { color: D14Colors.textSecondary },
  title: { color: D14Colors.white, fontSize: 24, fontWeight: '800', marginBottom: Spacing.three },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  metaText: { color: D14Colors.textSecondary, fontSize: 14 },
  linkText: { color: D14Colors.red, fontWeight: '600' },
  calendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: D14Colors.red,
    borderRadius: Radius.md,
    paddingVertical: 13,
    marginTop: Spacing.three,
  },
  calendarButtonText: { color: D14Colors.white, fontSize: 14, fontWeight: '700' },
  description: { color: D14Colors.white, fontSize: 14, lineHeight: 22 },
});
