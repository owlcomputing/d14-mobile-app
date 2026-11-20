import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { Widget } from '@/components/widget';
import { Spacing } from '@/constants/theme';
import { useContacts } from '@/lib/queries';
import { makeStyles, useColors } from '@/lib/theme';

export default function ContactsScreen() {
  const c = useColors();
  const styles = useStyles();
  const contacts = useContacts();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {contacts.data?.map((contact, i) => (
        <Widget key={`${contact.name}-${i}`}>
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
      ))}
      {contacts.isLoading ? <Text style={styles.loading}>Loading…</Text> : null}
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: Spacing.three, paddingBottom: Spacing.five },
  name: { color: c.text, fontSize: 16, fontWeight: '700' },
  title: { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  actions: { marginTop: Spacing.two, gap: Spacing.two },
  action: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  actionText: { color: c.text, fontSize: 13 },
  loading: { color: c.textSecondary, textAlign: 'center' },
}));
