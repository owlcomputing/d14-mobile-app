import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { HtmlContent } from '@/components/html-content';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { makeStyles, useColors } from '@/lib/theme';

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
  const c = useColors();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const rule = useRule(Number(id));

  if (rule.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.red} />
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

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: Spacing.three, paddingBottom: Spacing.six },
  center: {
    flex: 1,
    backgroundColor: c.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { color: c.textSecondary, lineHeight: 21 },
}));
