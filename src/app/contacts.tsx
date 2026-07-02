import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Widget } from '@/components/widget';
import { D14Colors, Spacing } from '@/constants/theme';
import { useContacts } from '@/lib/queries';

export default function ContactsScreen() {
  const contacts = useContacts();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {contacts.data?.map((c, i) => (
        <Widget key={`${c.name}-${i}`}>
          <Text style={styles.name}>{c.name}</Text>
          <Text style={styles.title}>{c.title}</Text>
          <View style={styles.actions}>
            {c.email ? (
              <Pressable style={styles.action} onPress={() => Linking.openURL(`mailto:${c.email}`)}>
                <Ionicons name="mail" size={15} color={D14Colors.red} />
                <Text style={styles.actionText}>{c.email}</Text>
              </Pressable>
            ) : null}
            {c.phone ? (
              <Pressable style={styles.action} onPress={() => Linking.openURL(`tel:${c.phone}`)}>
                <Ionicons name="call" size={15} color={D14Colors.red} />
                <Text style={styles.actionText}>{c.phone}</Text>
              </Pressable>
            ) : null}
          </View>
        </Widget>
      ))}
      {contacts.isLoading ? <Text style={styles.loading}>Loading…</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: D14Colors.black },
  content: { padding: Spacing.three, paddingBottom: Spacing.five },
  name: { color: D14Colors.white, fontSize: 16, fontWeight: '700' },
  title: { color: D14Colors.textSecondary, fontSize: 12, marginTop: 2 },
  actions: { marginTop: Spacing.two, gap: Spacing.two },
  action: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  actionText: { color: D14Colors.white, fontSize: 13 },
  loading: { color: D14Colors.textSecondary, textAlign: 'center' },
});
