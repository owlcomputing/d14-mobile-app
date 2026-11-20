import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { makeStyles } from '@/lib/theme';

type EventRowProps = {
  id: number;
  name: string | null;
  date: string;
  endDate?: string | null;
  divisionName?: string | null;
  locationName?: string | null;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function EventRow({ id, name, date, endDate, divisionName, locationName }: EventRowProps) {
  const styles = useStyles();
  const router = useRouter();
  // Dates are date-only strings; avoid timezone shifts from Date parsing
  const [, monthStr, dayStr] = date.slice(0, 10).split('-');
  const month = MONTHS[Number(monthStr) - 1];
  const day = Number(dayStr);
  const endDay = endDate ? Number(endDate.slice(8, 10)) : null;

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={() => router.push(`/event/${id}`)}>
      <View style={styles.dateBadge}>
        <Text style={styles.dateMonth}>{month}</Text>
        <Text style={styles.dateDay}>
          {day}
          {endDay && endDay !== day ? `–${endDay}` : ''}
        </Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {name ?? 'Event'}
        </Text>
        {divisionName || locationName ? (
          <Text style={styles.meta} numberOfLines={1}>
            {[divisionName, locationName].filter(Boolean).join(' • ')}
          </Text>
        ) : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  pressed: { opacity: 0.7 },
  dateBadge: {
    backgroundColor: c.surfaceRaised,
    borderRadius: Radius.md,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    minWidth: 52,
  },
  dateMonth: {
    color: c.red,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dateDay: { color: c.text, fontSize: 17, fontWeight: '700' },
  info: { flex: 1 },
  name: { color: c.text, fontSize: 15, fontWeight: '600' },
  meta: { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  chevron: { color: c.textTertiary, fontSize: 22, fontWeight: '300' },
}));
