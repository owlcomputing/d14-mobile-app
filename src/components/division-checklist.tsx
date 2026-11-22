import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useDivisions } from '@/lib/queries';
import { makeStyles, useColors } from '@/lib/theme';

/**
 * "All Divisions" plus one checkbox per division. `value` null = all
 * divisions; unticking one while "all" is on keeps every other division.
 */
export function DivisionChecklist({
  value,
  onChange,
}: {
  value: string[] | null;
  onChange: (value: string[] | null) => void;
}) {
  const c = useColors();
  const styles = useStyles();
  const divisions = useDivisions();
  const all = divisions.data?.map((d) => d.name).filter((n): n is string => !!n) ?? [];
  const allSelected = value === null;

  const toggle = (name: string) => {
    const current = value ?? all;
    const next = current.includes(name) ? current.filter((n) => n !== name) : [...current, name];
    onChange(next.length === all.length ? null : next);
  };

  return (
    <>
      <Pressable
        style={styles.row}
        onPress={() => onChange(null)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: allSelected }}>
        <Ionicons
          name={allSelected ? 'checkbox' : 'square-outline'}
          size={22}
          color={allSelected ? c.red : c.textTertiary}
        />
        <Text style={styles.rowText}>All Divisions</Text>
      </Pressable>
      {divisions.isPending ? <Text style={styles.loading}>Loading divisions…</Text> : null}
      {all.map((name) => {
        const checked = allSelected || value.includes(name);
        return (
          <Pressable
            key={name}
            style={styles.row}
            onPress={() => toggle(name)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}>
            <Ionicons
              name={checked ? 'checkbox' : 'square-outline'}
              size={22}
              color={checked ? c.red : c.textTertiary}
            />
            <Text style={styles.rowText}>{name}</Text>
          </Pressable>
        );
      })}
    </>
  );
}

const useStyles = makeStyles((c) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: 11,
  },
  rowText: { color: c.text, fontSize: 14 },
  loading: { color: c.textTertiary, fontSize: 13, paddingVertical: Spacing.two },
}));
