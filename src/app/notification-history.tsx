// Admin: history of sent notifications (manual sends and the daily automatic
// event notifications), newest first, with push and email delivery counts.
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { makeStyles, useColors } from '@/lib/theme';

const AUDIENCE_LABEL: Record<string, string> = {
  everyone: 'Everyone',
  members: 'Members',
  prospects: 'Prospects',
};

function useSendHistory() {
  return useQuery({
    queryKey: ['notification-sends'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_sends')
        .select('*, sender:profiles(first_name, last_name)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
}

type Send = NonNullable<ReturnType<typeof useSendHistory>['data']>[number];

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

function SendRow({ item }: { item: Send }) {
  const c = useColors();
  const styles = useStyles();
  const sender = item.sender as { first_name: string | null; last_name: string | null } | null;
  const by =
    item.kind === 'event_auto'
      ? 'Automatic'
      : [sender?.first_name, sender?.last_name].filter(Boolean).join(' ') || 'Admin';
  const audience = `${AUDIENCE_LABEL[item.audience] ?? item.audience} · ${
    item.divisions?.length ? item.divisions.join(', ') : 'District-wide'
  }`;
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons
          name={item.kind === 'event_auto' ? 'calendar' : 'megaphone'}
          size={16}
          color={c.red}
        />
        <Text style={styles.meta}>
          {when(item.created_at)} · {by}
        </Text>
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.body}>{item.body}</Text>
      <Text style={styles.meta}>{audience}</Text>
      {item.link ? <Text style={styles.meta}>Opens: {item.link}</Text> : null}
      <View style={styles.stats}>
        <Stat icon="notifications" text={`${item.push_sent} of ${item.push_targeted} pushes`} />
        {item.email_requested ? (
          <Stat icon="mail" text={`${item.email_sent} email${item.email_sent === 1 ? '' : 's'}`} />
        ) : null}
      </View>
      {item.email_note ? <Text style={styles.note}>{item.email_note}</Text> : null}
      {item.error ? <Text style={styles.error}>{item.error}</Text> : null}
    </View>
  );
}

function Stat({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={13} color={c.textSecondary} />
      <Text style={styles.statText}>{text}</Text>
    </View>
  );
}

export default function NotificationHistoryScreen() {
  const c = useColors();
  const styles = useStyles();
  const history = useSendHistory();

  if (history.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.red} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={history.data ?? []}
      keyExtractor={(s) => String(s.id)}
      renderItem={({ item }) => <SendRow item={item} />}
      refreshControl={
        <RefreshControl
          refreshing={history.isRefetching}
          onRefresh={() => {
            history.refetch();
          }}
          tintColor={c.red}
        />
      }
      ListEmptyComponent={
        <Text style={styles.empty}>
          {history.error
            ? 'Could not load the history. Pull down to try again.'
            : 'Nothing sent yet. Notifications you send, and the automatic event reminders, will show up here.'}
        </Text>
      }
    />
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.three },
  center: {
    flex: 1,
    backgroundColor: c.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: 4,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { color: c.text, fontSize: 15, fontWeight: '700', marginTop: 4 },
  body: { color: c.textSecondary, fontSize: 13, lineHeight: 18 },
  meta: { color: c.textTertiary, fontSize: 12 },
  stats: { flexDirection: 'row', gap: Spacing.three, marginTop: 6 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { color: c.textSecondary, fontSize: 12 },
  note: { color: c.textTertiary, fontSize: 11, fontStyle: 'italic', marginTop: 2 },
  error: { color: c.error, fontSize: 11, marginTop: 2 },
  empty: {
    color: c.textTertiary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: Spacing.six,
  },
}));
