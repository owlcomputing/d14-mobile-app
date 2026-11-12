import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DivisionIcon } from '@/components/division-icon';
import { EventRow } from '@/components/event-row';
import { Widget } from '@/components/widget';
import { D14Colors, Radius, Spacing } from '@/constants/theme';
import { useDivisions, useUpcomingEvents } from '@/lib/queries';
import { useAuth } from '@/providers/auth-provider';

function membershipStatus(expiration: string | undefined) {
  if (!expiration) return { label: 'No active membership', active: false };
  const expired = new Date(expiration) < new Date();
  const formatted = new Date(expiration).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return expired
    ? { label: `Expired ${formatted}`, active: false }
    : { label: `Valid thru ${formatted}`, active: true };
}

export default function HomeScreen() {
  const router = useRouter();
  const { session, profile, membership } = useAuth();
  const events = useUpcomingEvents(3);
  const divisions = useDivisions();
  const status = membershipStatus(membership?.expiration);

  const refreshing = events.isRefetching || divisions.isRefetching;
  const onRefresh = () => {
    events.refetch();
    divisions.refetch();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={D14Colors.red} />
        }>
        <View style={styles.topBar}>
          <Image
            source={require('../../../assets/images/d14-logo.png')}
            style={styles.logo}
            contentFit="contain"
          />
        </View>
        <Text style={styles.greeting}>
          {session
            ? `Welcome back${profile?.first_name ? `, ${profile.first_name}` : ''}`
            : 'Welcome to District 14'}
        </Text>

        {session ? (
          /* Membership card teaser */
          <Pressable onPress={() => router.push('/wallet')}>
            <Widget variant="red" style={styles.cardTeaser}>
              <Ionicons name="card" size={28} color={D14Colors.white} />
              <View style={styles.cardTeaserText}>
                <Text style={styles.cardTeaserTitle}>Membership Card</Text>
                <Text style={styles.cardTeaserSub}>
                  {status.active ? `Tap to open wallet • ${status.label}` : status.label}
                </Text>
              </View>
              <Text style={styles.cardTeaserChevron}>›</Text>
            </Widget>
          </Pressable>
        ) : (
          /* Guest: invite to sign in or join */
          <Pressable onPress={() => router.push('/login')}>
            <Widget variant="red" style={styles.cardTeaser}>
              <Ionicons name="person-add" size={26} color={D14Colors.white} />
              <View style={styles.cardTeaserText}>
                <Text style={styles.cardTeaserTitle}>Join AMA District 14</Text>
                <Text style={styles.cardTeaserSub}>
                  Members: sign in for your card • New riders: become a member
                </Text>
              </View>
              <Text style={styles.cardTeaserChevron}>›</Text>
            </Widget>
          </Pressable>
        )}

        {/* Upcoming events */}
        <Widget header="Upcoming Events">
          {events.data?.length ? (
            events.data.map((e) => (
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
              {events.isLoading ? 'Loading…' : 'No upcoming events'}
            </Text>
          )}
          <Pressable onPress={() => router.push('/calendar')}>
            <Text style={styles.link}>View full calendar ›</Text>
          </Pressable>
        </Widget>

        {/* Podcast */}
        <Widget header="The Dirtbike Download">
          <View style={styles.podcastRow}>
            <View style={styles.podcastIcon}>
              <Ionicons name="mic" size={24} color={D14Colors.red} />
            </View>
            <Text style={styles.podcastText}>
              The official D14 podcast — riders, race recaps, and district news. Listen or watch
              right in the app.
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.podcastButton, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/media')}>
            <Text style={styles.podcastButtonText}>Listen &amp; Watch</Text>
          </Pressable>
        </Widget>

        {/* Divisions grid */}
        <Widget header="Divisions">
          <View style={styles.divisionGrid}>
            {divisions.data?.map((d) => (
              <Pressable
                key={d.id}
                style={({ pressed }) => [styles.divisionItem, pressed && { opacity: 0.7 }]}
                onPress={() => router.push(`/division/${d.id}`)}>
                <View style={styles.divisionCircle}>
                  <DivisionIcon name={d.name} size={26} />
                </View>
                <Text style={styles.divisionLabel} numberOfLines={2}>
                  {d.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </Widget>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: D14Colors.black },
  content: { padding: Spacing.three, paddingBottom: Spacing.five },
  topBar: { alignItems: 'center', marginBottom: Spacing.three },
  logo: { width: 150, height: 53 },
  greeting: {
    color: D14Colors.white,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: Spacing.three,
  },
  cardTeaser: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  cardTeaserText: { flex: 1 },
  cardTeaserTitle: { color: D14Colors.white, fontSize: 15, fontWeight: '700' },
  cardTeaserSub: { color: D14Colors.white, opacity: 0.85, fontSize: 12, marginTop: 2 },
  cardTeaserChevron: { color: D14Colors.white, opacity: 0.7, fontSize: 24, fontWeight: '300' },
  empty: { color: D14Colors.textSecondary, paddingVertical: Spacing.two },
  link: { color: D14Colors.red, fontSize: 13, fontWeight: '600', marginTop: Spacing.two },
  divisionGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  divisionItem: { width: '25%', alignItems: 'center', paddingVertical: Spacing.two },
  divisionCircle: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    backgroundColor: D14Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  podcastRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  podcastIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: D14Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podcastText: { flex: 1, color: D14Colors.textSecondary, fontSize: 12, lineHeight: 18 },
  podcastButton: {
    backgroundColor: D14Colors.red,
    borderRadius: Radius.md,
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: Spacing.three,
  },
  podcastButtonText: { color: D14Colors.white, fontSize: 13, fontWeight: '700' },
  divisionLabel: {
    color: D14Colors.textSecondary,
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 13,
    paddingHorizontal: 2,
  },
});
