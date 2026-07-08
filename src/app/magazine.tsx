import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { D14Colors, Radius, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

function useMagazineIssues() {
  return useQuery({
    queryKey: ['magazine-issues'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('magazine_issues')
        .select('*')
        .order('date_created', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export default function MagazineScreen() {
  const issues = useMagazineIssues();

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={issues.data ?? []}
      keyExtractor={(i) => String(i.id)}
      ListEmptyComponent={
        <Text style={styles.empty}>{issues.isLoading ? 'Loading…' : 'No issues available'}</Text>
      }
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
          onPress={() =>
            item.magazine_storage_url && WebBrowser.openBrowserAsync(item.magazine_storage_url)
          }>
          <View style={styles.icon}>
            <Ionicons name="book" size={20} color={D14Colors.red} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.issue_name ?? 'Issue'}</Text>
            {item.date_created ? (
              <Text style={styles.date}>
                {new Date(item.date_created).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            ) : null}
          </View>
          <Ionicons name="open-outline" size={18} color={D14Colors.textTertiary} />
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: D14Colors.black },
  content: { padding: Spacing.three, paddingBottom: Spacing.five },
  empty: { color: D14Colors.textSecondary, textAlign: 'center', marginTop: Spacing.five },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: D14Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: D14Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: D14Colors.white, fontSize: 14, fontWeight: '600' },
  date: { color: D14Colors.textSecondary, fontSize: 11, marginTop: 2 },
});
