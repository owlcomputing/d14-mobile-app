import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  MEMBER_DIRECTORY_COLUMNS,
  MemberResult,
  type MemberResultData,
} from '@/components/member-result';
import { D14Colors, Radius, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

function useMemberSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ['member-search', q],
    enabled: q.length >= 2,
    queryFn: async (): Promise<MemberResultData[]> => {
      const filters = [`first_name.ilike.%${q}%`, `last_name.ilike.%${q}%`];
      // d14_number is numeric — only filter on it for numeric queries
      if (/^\d+$/.test(q)) filters.push(`d14_number.eq.${q}`);
      // "First Last" style search
      const parts = q.split(/\s+/);
      // member_directory exposes only gate-check fields; profiles itself is
      // limited to the signed-in user's own family.
      let builder = supabase.from('member_directory').select(MEMBER_DIRECTORY_COLUMNS).limit(25);
      if (parts.length >= 2) {
        builder = builder
          .ilike('first_name', `%${parts[0]}%`)
          .ilike('last_name', `%${parts.slice(1).join(' ')}%`);
      } else {
        builder = builder.or(filters.join(','));
      }
      const { data, error } = await builder;
      if (error) throw error;
      return data;
    },
  });
}

export default function LookupScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const search = useMemberSearch(query);

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={D14Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name or D14 number…"
          placeholderTextColor={D14Colors.textTertiary}
          autoCapitalize="words"
          autoCorrect={false}
          autoFocus
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={D14Colors.textTertiary} />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={search.data ?? []}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <MemberResult member={item} />}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={styles.hint}>
            {query.trim().length < 2
              ? 'Type at least 2 characters to search'
              : search.isLoading
                ? 'Searching…'
                : 'No members found'}
          </Text>
        }
        ListHeaderComponent={
          search.data?.length ? (
            <Text style={styles.count}>
              {search.data.length} result{search.data.length === 1 ? '' : 's'}
            </Text>
          ) : undefined
        }
      />

      <Pressable
        style={({ pressed }) => [styles.scanButton, pressed && { opacity: 0.85 }]}
        onPress={() => router.push('/scanner')}>
        <Ionicons name="qr-code" size={18} color={D14Colors.white} />
        <Text style={styles.scanButtonText}>Scan QR Code</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: D14Colors.black, padding: Spacing.three },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: D14Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: D14Colors.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    marginBottom: Spacing.three,
  },
  searchInput: { flex: 1, color: D14Colors.white, fontSize: 14, padding: 0 },
  list: { paddingBottom: 90 },
  count: { color: D14Colors.textTertiary, fontSize: 12, marginBottom: Spacing.two },
  hint: { color: D14Colors.textTertiary, textAlign: 'center', marginTop: Spacing.five },
  scanButton: {
    position: 'absolute',
    bottom: Spacing.four,
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: D14Colors.red,
    borderRadius: Radius.md,
    paddingVertical: 14,
  },
  scanButtonText: { color: D14Colors.white, fontSize: 14, fontWeight: '700' },
});
