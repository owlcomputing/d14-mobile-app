import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventRow } from '@/components/event-row';
import { Widget } from '@/components/widget';
import { Radius, Spacing } from '@/constants/theme';
import { useDivisions, useEventsForMonth } from '@/lib/queries';
import { makeStyles } from '@/lib/theme';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function CalendarScreen() {
  const styles = useStyles();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [divisionId, setDivisionId] = useState<number | undefined>(undefined);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const events = useEventsForMonth(year, month, divisionId);
  const divisions = useDivisions();

  const prevMonth = () => {
    setSelectedDay(null);
    if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1);
  };
  const nextMonth = () => {
    setSelectedDay(null);
    if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1);
  };

  const isoForDay = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // Filter to events overlapping the selected day (handles multi-day ranges)
  const visibleEvents = (events.data ?? []).filter((e) => {
    if (selectedDay === null) return true;
    const iso = isoForDay(selectedDay);
    return iso >= e.date.slice(0, 10) && iso <= (e.end_date ?? e.date).slice(0, 10);
  });

  // Days of this month that have at least one event (handles multi-day ranges)
  const eventDays = useMemo(() => {
    const days = new Set<number>();
    for (const e of events.data ?? []) {
      const start = e.date.slice(0, 10);
      const end = (e.end_date ?? e.date).slice(0, 10);
      for (let d = 1; d <= 31; d++) {
        const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (iso >= start && iso <= end) days.add(d);
      }
    }
    return days;
  }, [events.data, year, month]);

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today =
    now.getFullYear() === year && now.getMonth() === month ? now.getDate() : null;

  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} stickyHeaderIndices={[]}>
        <Widget>
          <View style={styles.monthHeader}>
            <Pressable onPress={prevMonth} hitSlop={12}>
              <Text style={styles.monthArrow}>‹</Text>
            </Pressable>
            <Text style={styles.monthTitle}>
              {MONTH_NAMES[month]} {year}
            </Text>
            <Pressable onPress={nextMonth} hitSlop={12}>
              <Text style={styles.monthArrow}>›</Text>
            </Pressable>
          </View>
          <View style={styles.grid}>
            {DAY_HEADERS.map((d, i) => (
              <Text key={`h${i}`} style={styles.dayHeader}>
                {d}
              </Text>
            ))}
            {cells.map((day, i) => (
              <Pressable
                key={i}
                disabled={!day}
                onPress={() => day && setSelectedDay(selectedDay === day ? null : day)}
                style={[
                  styles.dayCell,
                  day === today && styles.todayCell,
                  day != null && day === selectedDay && styles.selectedCell,
                ]}>
                <Text
                  style={[
                    styles.dayText,
                    day === today && styles.todayText,
                    // White on the red "today" fill (a selected cell drops the fill)
                    day === today && day !== selectedDay && styles.onRedText,
                  ]}>
                  {day ?? ''}
                </Text>
                {day && eventDays.has(day) ? <View style={styles.eventDot} /> : null}
              </Pressable>
            ))}
          </View>
        </Widget>

        {/* Division filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pills}>
          <FilterPill label="All" active={!divisionId} onPress={() => setDivisionId(undefined)} />
          {divisions.data?.map((d) => (
            <FilterPill
              key={d.id}
              label={d.name ?? ''}
              active={divisionId === d.id}
              onPress={() => setDivisionId(d.id)}
            />
          ))}
        </ScrollView>

        <Widget
          header={
            selectedDay !== null
              ? `Events on ${MONTH_NAMES[month]} ${selectedDay}`
              : `Events in ${MONTH_NAMES[month]}`
          }>
          {visibleEvents.length ? (
            visibleEvents.map((e) => (
              <EventRow
                key={e.id}
                id={e.id}
                name={e.name}
                date={e.date}
                endDate={e.end_date}
                divisionName={e.divisions?.name}
                locationName={e.location_name}
              />
            ))
          ) : (
            <Text style={styles.empty}>
              {events.isLoading
                ? 'Loading…'
                : selectedDay !== null
                  ? 'No events on this day'
                  : 'No events this month'}
            </Text>
          )}
          {selectedDay !== null ? (
            <Pressable onPress={() => setSelectedDay(null)} hitSlop={8}>
              <Text style={styles.clearFilter}>Show all of {MONTH_NAMES[month]} ›</Text>
            </Pressable>
          ) : null}
        </Widget>
      </ScrollView>
    </SafeAreaView>
  );
}

function FilterPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} style={[styles.pill, active && styles.pillActive]}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.background },
  content: { padding: Spacing.three, paddingBottom: Spacing.five },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  monthArrow: { color: c.red, fontSize: 28, fontWeight: '300', paddingHorizontal: 8 },
  monthTitle: { color: c.text, fontSize: 17, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayHeader: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    color: c.textTertiary,
    fontSize: 11,
    fontWeight: '700',
    paddingVertical: 4,
  },
  dayCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  todayCell: { backgroundColor: c.red },
  selectedCell: {
    borderWidth: 1.5,
    borderColor: c.red,
    backgroundColor: c.surfaceRaised,
  },
  dayText: { color: c.text, fontSize: 13 },
  clearFilter: {
    color: c.red,
    fontSize: 13,
    fontWeight: '600',
    marginTop: Spacing.two,
  },
  todayText: { fontWeight: '800' },
  onRedText: { color: c.onAccent },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.red,
    marginTop: 2,
  },
  pills: { marginBottom: Spacing.three, flexGrow: 0 },
  pill: {
    backgroundColor: c.surface,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
  },
  pillActive: { backgroundColor: c.red },
  pillText: { color: c.textSecondary, fontSize: 12, fontWeight: '600' },
  pillTextActive: { color: c.onAccent },
  empty: { color: c.textSecondary, paddingVertical: Spacing.two },
}));
