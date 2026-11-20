import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { DivisionIcon } from '@/components/division-icon';
import { EventRow } from '@/components/event-row';
import { HtmlContent } from '@/components/html-content';
import { Widget } from '@/components/widget';
import { darkPalette, Radius, Spacing } from '@/constants/theme';
import { useDivision, useUpcomingEvents } from '@/lib/queries';
import { makeStyles, useColors } from '@/lib/theme';

/** Hero banner colors: the same in Dark and Light. */
const hero = darkPalette;

export default function DivisionDetailScreen() {
  const c = useColors();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const divisionId = Number(id);
  const division = useDivision(divisionId);
  const events = useUpcomingEvents(5, divisionId);

  if (division.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.red} />
      </View>
    );
  }
  if (!division.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Division not found</Text>
      </View>
    );
  }

  const d = division.data;
  const about = d.cms?.content?.trim();
  const open = (url: string) => WebBrowser.openBrowserAsync(url);

  const quickLinks = [
    d.results_link ? { icon: 'trophy' as const, label: 'Results', url: d.results_link } : null,
    d.points_link ? { icon: 'stats-chart' as const, label: 'Points', url: d.points_link } : null,
    d.shop_link ? { icon: 'cart' as const, label: 'Shop', url: d.shop_link } : null,
  ].filter((l): l is NonNullable<typeof l> => l !== null);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Division hero — main_img as background, logo in place of the title. Always
          dark (both appearances): division logos from the website are made for it. */}
      <View style={styles.hero}>
        {d.main_img ? (
          <>
            <Image source={{ uri: d.main_img }} style={styles.heroBackground} contentFit="cover" />
            <View style={styles.heroOverlay} />
          </>
        ) : null}
        {d.logo ? (
          <Image
            source={{ uri: d.logo }}
            style={styles.heroLogo}
            contentFit="contain"
            accessibilityLabel={d.name ?? 'Division logo'}
          />
        ) : (
          <>
            <DivisionIcon name={d.name} size={44} />
            <Text style={styles.heroTitle}>{d.name}</Text>
          </>
        )}
        <Text style={styles.heroSub}>AMA District 14</Text>
        {d.cms?.facebook || d.cms?.instagram ? (
          <View style={styles.socialRow}>
            {d.cms?.facebook ? (
              <Pressable onPress={() => open(d.cms!.facebook!)} hitSlop={8}>
                <Ionicons name="logo-facebook" size={22} color={hero.textSecondary} />
              </Pressable>
            ) : null}
            {d.cms?.instagram ? (
              <Pressable onPress={() => open(d.cms!.instagram!)} hitSlop={8}>
                <Ionicons name="logo-instagram" size={22} color={hero.textSecondary} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Quick links */}
      {quickLinks.length ? (
        <View style={styles.quickGrid}>
          {quickLinks.map((l) => (
            <Pressable
              key={l.label}
              style={({ pressed }) => [styles.quickItem, pressed && { opacity: 0.7 }]}
              onPress={() => open(l.url)}>
              <Ionicons name={l.icon} size={20} color={c.red} />
              <Text style={styles.quickLabel}>{l.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {about ? (
        <Widget header="About">
          <HtmlContent html={about} />
        </Widget>
      ) : null}

      <Widget header="Upcoming Events">
        {events.data?.length ? (
          events.data.map((e) => (
            <EventRow key={e.id} id={e.id} name={e.name} date={e.date} endDate={e.end_date} locationName={e.location_name} />
          ))
        ) : (
          <Text style={styles.emptyText}>
            {events.isLoading ? 'Loading…' : 'No upcoming events'}
          </Text>
        )}
      </Widget>

      {d.rules.length ? (
        <Widget header="Rules">
          {d.rules.map((r, i) => (
            <Pressable
              key={r.id}
              style={({ pressed }) => [
                styles.ruleRow,
                i < d.rules.length - 1 && styles.ruleRowBorder,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => router.push(`/rules/${r.id}`)}>
              <Ionicons name="document-text" size={15} color={c.textTertiary} />
              <Text style={styles.ruleName}>{r.name ?? 'Rules document'}</Text>
              <Text style={styles.ruleChevron}>›</Text>
            </Pressable>
          ))}
        </Widget>
      ) : null}
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: Spacing.three, paddingBottom: Spacing.five },
  center: {
    flex: 1,
    backgroundColor: c.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    backgroundColor: hero.surface,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    marginBottom: Spacing.three,
    overflow: 'hidden',
  },
  heroBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,10,10,0.72)',
  },
  heroLogo: { width: 240, height: 96, borderRadius: Radius.sm },
  heroTitle: { color: hero.text, fontSize: 22, fontWeight: '800', marginTop: Spacing.two },
  heroSub: { color: hero.textSecondary, fontSize: 12, marginTop: 2 },
  socialRow: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.three },
  quickGrid: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.three },
  quickItem: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: Radius.md,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    gap: 4,
  },
  quickLabel: { color: c.text, fontSize: 12, fontWeight: '600' },
  emptyText: { color: c.textSecondary, paddingVertical: Spacing.two },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 10,
  },
  ruleRowBorder: { borderBottomWidth: 1, borderBottomColor: c.border },
  ruleName: { color: c.text, fontSize: 13, flex: 1 },
  ruleChevron: { color: c.textTertiary, fontSize: 18, fontWeight: '300' },
}));
