import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { DivisionIcon } from '@/components/division-icon';
import { EventRow } from '@/components/event-row';
import { SocialLinks } from '@/components/social-links';
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
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const rulesY = useRef(0);

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
    d.rules.length ? { key: 'rules', icon: 'document-text' as const, label: 'Rules' } : null,
    { key: 'contacts', icon: 'people' as const, label: 'Contacts' },
    d.results_link ? { key: 'results', icon: 'trophy' as const, label: 'Results' } : null,
    d.points_link ? { key: 'points', icon: 'stats-chart' as const, label: 'Points' } : null,
    d.shop_link ? { key: 'shop', icon: 'cart' as const, label: 'Shop' } : null,
  ].filter((l) => l !== null);

  const onQuickLink = (key: string) => {
    if (key === 'rules') {
      // One rules document (the usual case) opens straight away; several
      // scroll down to the list.
      if (d.rules.length === 1) router.push(`/rules/${d.rules[0].id}`);
      else scrollRef.current?.scrollTo({ y: rulesY.current, animated: true });
    } else if (key === 'contacts') {
      router.push({ pathname: '/contacts', params: { division: String(d.id) } });
    } else if (key === 'results' && d.results_link) open(d.results_link);
    else if (key === 'points' && d.points_link) open(d.points_link);
    else if (key === 'shop' && d.shop_link) open(d.shop_link);
  };

  return (
    <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.content}>
      {/* Division header: social links first, then the logo in place of the
          title and the main image. Always dark (both appearances): division
          logos from the website are made for it. */}
      <View style={styles.hero}>
        <View style={styles.socialRow}>
          <SocialLinks
            tone="hero"
            links={[
              { network: 'facebook', url: d.cms?.facebook },
              { network: 'instagram', url: d.cms?.instagram },
            ]}
          />
        </View>
        <DivisionLogo uri={d.logo} name={d.name} />
        <Text style={styles.heroSub}>AMA District 14</Text>
        {d.main_img ? <MainImage key={d.main_img} uri={d.main_img} widthPercent={d.main_img_width} /> : null}
      </View>

      {/* Quick links: Rules, Contacts, Results, Points */}
      {quickLinks.length ? (
        <View style={styles.quickGrid}>
          {quickLinks.map((l) => (
            <Pressable
              key={l.label}
              style={({ pressed }) => [styles.quickItem, pressed && { opacity: 0.7 }]}
              onPress={() => onQuickLink(l.key)}
              accessibilityRole="button">
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

      {d.rules.length > 1 ? (
        <Widget header="Rules" onLayout={(e) => (rulesY.current = e.nativeEvent.layout.y)}>
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

/** The division's logo, or its icon and name when it has none (or it won't load). */
function DivisionLogo({ uri, name }: { uri: string | null; name: string | null }) {
  const styles = useStyles();
  const [failedUri, setFailedUri] = useState<string | null>(null);
  if (uri && uri !== failedUri) {
    return (
      <Image
        source={{ uri }}
        style={styles.heroLogo}
        contentFit="contain"
        onError={() => setFailedUri(uri)}
        accessibilityLabel={name ?? 'Division logo'}
      />
    );
  }
  return (
    <>
      <DivisionIcon name={name} size={44} />
      <Text style={styles.heroTitle}>{name}</Text>
    </>
  );
}

/**
 * The division's main image, at the size the chairman set on the website (% of
 * the header width), else its own size; never wider than the header.
 */
function MainImage({ uri, widthPercent }: { uri: string; widthPercent: number | null }) {
  const styles = useStyles();
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <Image
      source={{ uri }}
      onLoad={(e) => {
        const { width, height } = e.source;
        if (width > 0 && height > 0) setNatural({ width, height });
      }}
      onError={() => setFailed(true)}
      style={[
        styles.mainImage,
        {
          width: widthPercent ? `${widthPercent}%` : (natural?.width ?? '100%'),
          aspectRatio: natural ? natural.width / natural.height : 16 / 9,
        },
      ]}
      contentFit="contain"
      cachePolicy="memory-disk"
      accessibilityLabel="Division photo"
    />
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
  heroLogo: { width: 240, height: 96, borderRadius: Radius.sm },
  mainImage: { maxWidth: '100%', marginTop: Spacing.three, borderRadius: Radius.sm },
  heroTitle: { color: hero.text, fontSize: 22, fontWeight: '800', marginTop: Spacing.two },
  heroSub: { color: hero.textSecondary, fontSize: 12, marginTop: 2 },
  socialRow: { marginBottom: Spacing.three },
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
