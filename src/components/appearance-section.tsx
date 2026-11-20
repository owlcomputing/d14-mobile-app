import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { Widget } from '@/components/widget';
import { Radius, Spacing } from '@/constants/theme';
import { makeStyles, useAppearance, useColors, type AppearancePreference } from '@/lib/theme';

const OPTIONS: {
  value: AppearancePreference;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}[] = [
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'light', label: 'Light', icon: 'sunny' },
  { value: 'system', label: 'Match phone', icon: 'phone-portrait-outline' },
];

/** Profile → Appearance: Dark (default) / Light / Match phone. Applies immediately. */
export function AppearanceSection() {
  const c = useColors();
  const styles = useStyles();
  const { preference, setPreference } = useAppearance();

  return (
    <Widget header="Appearance">
      <View style={styles.segments} accessibilityRole="radiogroup">
        {OPTIONS.map((o) => {
          const active = preference === o.value;
          return (
            <Pressable
              key={o.value}
              style={({ pressed }) => [
                styles.segment,
                active && styles.segmentActive,
                pressed && !active && { opacity: 0.7 },
              ]}
              onPress={() => setPreference(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${o.label} appearance`}>
              <Ionicons name={o.icon} size={15} color={active ? c.onAccent : c.textSecondary} />
              <Text
                style={[styles.segmentText, active && styles.segmentTextActive]}
                numberOfLines={1}
                adjustsFontSizeToFit>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>
        {preference === 'system'
          ? "Follows your phone's light or dark setting."
          : 'Choose how the app looks on this phone.'}
      </Text>
    </Widget>
  );
}

const useStyles = makeStyles((c) => ({
  segments: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: c.surfaceRaised,
    borderRadius: Radius.md,
    padding: 4,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Radius.sm,
    paddingVertical: 9,
  },
  segmentActive: { backgroundColor: c.red },
  segmentText: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  segmentTextActive: { color: c.onAccent },
  hint: { color: c.textTertiary, fontSize: 11, marginTop: Spacing.two },
}));
