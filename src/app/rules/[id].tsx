import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HtmlContent } from '@/components/html-content';
import { D14Colors, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

function useRule(id: number) {
  return useQuery({
    queryKey: ['rules', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('rules').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
  });
}

export default function RuleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const rule = useRule(Number(id));

  if (rule.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={D14Colors.red} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: rule.data?.name ?? 'Rules' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {rule.data?.content?.trim() ? (
          <HtmlContent html={rule.data.content} collapsible={false} />
        ) : (
          <Text style={styles.empty}>
            This rules document hasn&apos;t been published yet. Check the division page on
            ama-d14.org or contact the division chairman.
          </Text>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: D14Colors.black },
  content: { padding: Spacing.three, paddingBottom: Spacing.six },
  center: {
    flex: 1,
    backgroundColor: D14Colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { color: D14Colors.textSecondary, lineHeight: 21 },
});
