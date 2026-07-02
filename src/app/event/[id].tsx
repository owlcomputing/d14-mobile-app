import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Widget } from '@/components/widget';
import { D14Colors, Radius, Spacing } from '@/constants/theme';
import { htmlToText } from '@/lib/html';
import { useEvent } from '@/lib/queries';

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
  description: { color: D14Colors.white, fontSize: 14, lineHeight: 22 },
});
