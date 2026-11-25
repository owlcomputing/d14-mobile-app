import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { Widget } from '@/components/widget';
import { Spacing } from '@/constants/theme';
import { useContacts, useDivision } from '@/lib/queries';
import { makeStyles, useColors } from '@/lib/theme';

type Contact = NonNullable<ReturnType<typeof useContacts>['data']>[number];

/**
 * District officers and division chairs. Opened from a division's page
 * (`?division=<id>`), that division's chair comes first, then the officers.
 */
export default function ContactsScreen() {
  const styles = useStyles();
  const { division: divisionParam } = useLocalSearchParams<{ division?: string }>();
  const divisionId = divisionParam ? Number(divisionParam) : null;
  const division = useDivision(divisionId ?? 0, { enabled: !!divisionId });
  const contacts = useContacts();

  const all = contacts.data ?? [];
  const officers = all.filter((x) => x.type === 'officer');
  const chairs = all.filter((x) => x.type !== 'officer');
  const divisionChairs = divisionId ? all.filter((x) => x.division_id === divisionId) : [];
  // No chair linked to this division yet: fall back to the full list
  const focused = divisionId !== null && divisionChairs.length > 0;
  const divisionName = division.data?.name;

  return (
    <>
      {divisionId ? (
        <Stack.Screen options={{ title: divisionName ? `${divisionName} Contacts` : 'Contacts' }} />
      ) : null}
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {focused ? (
          <>
            <Section title={divisionName ? `${divisionName} Chair` : 'Division Chair'} contacts={divisionChairs} />
            <Section title="District Officers" contacts={officers} />
          </>
        ) : (
          <>
            <Section title="District Officers" contacts={officers} />
            <Section title="Division Chairs" contacts={chairs} />
          </>
        )}
        {contacts.isLoading ? <Text style={styles.loading}>Loading…</Text> : null}
      </ScrollView>
    </>
  );
}

function Section({ title, contacts }: { title: string; contacts: Contact[] }) {
  const styles = useStyles();
  if (!contacts.length) return null;
  return (
    <>
      <Text style={styles.sectionTitle}>{title}</Text>
      {contacts.map((contact) => (
        <ContactCard key={contact.id} contact={contact} />
      ))}
    </>
  );
}

function ContactCard({ contact }: { contact: Contact }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <Widget>
      <Text style={styles.name}>{contact.name}</Text>
      <Text style={styles.title}>{contact.title}</Text>
      <View style={styles.actions}>
        {contact.email ? (
          <Pressable style={styles.action} onPress={() => Linking.openURL(`mailto:${contact.email}`)}>
            <Ionicons name="mail" size={15} color={c.red} />
            <Text style={styles.actionText}>{contact.email}</Text>
          </Pressable>
        ) : null}
        {contact.phone ? (
          <Pressable style={styles.action} onPress={() => Linking.openURL(`tel:${contact.phone}`)}>
            <Ionicons name="call" size={15} color={c.red} />
            <Text style={styles.actionText}>{contact.phone}</Text>
          </Pressable>
        ) : null}
      </View>
    </Widget>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: Spacing.three, paddingBottom: Spacing.five },
  sectionTitle: {
    color: c.textTertiary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: Spacing.two,
    marginTop: Spacing.one,
  },
  name: { color: c.text, fontSize: 16, fontWeight: '700' },
  title: { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  actions: { marginTop: Spacing.two, gap: Spacing.two },
  action: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  actionText: { color: c.text, fontSize: 13 },
  loading: { color: c.textSecondary, textAlign: 'center' },
}));
