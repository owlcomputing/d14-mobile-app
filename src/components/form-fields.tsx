// Small form building blocks for the Join flow.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { D14Colors, Radius, Spacing } from '@/constants/theme';

export function Field({
  label,
  required,
  error,
  style,
  ...input
}: TextInputProps & { label: string; required?: boolean; error?: string | null }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        placeholderTextColor={D14Colors.textTertiary}
        {...input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function Chips({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <Pressable key={o} style={[styles.chip, on && styles.chipOn]} onPress={() => onToggle(o)}>
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A field that opens a searchable list (e.g. US states). */
export function PickerField({
  label,
  value,
  options,
  onChange,
  required,
  error,
  placeholder = 'Select…',
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  required?: boolean;
  error?: string | null;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <Pressable
        style={[styles.input, styles.pickerInput, error ? styles.inputError : null]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || placeholder}`}>
        <Text style={value ? styles.pickerValue : styles.pickerPlaceholder}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={D14Colors.textTertiary} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{label}</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color={D14Colors.textSecondary} />
            </Pressable>
          </View>
          <TextInput
            style={[styles.input, { marginHorizontal: Spacing.three }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor={D14Colors.textTertiary}
            autoFocus
          />
          <FlatList
            data={filtered}
            keyExtractor={(o) => o}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={styles.option}
                onPress={() => {
                  onChange(item);
                  setOpen(false);
                  setQuery('');
                }}>
                <Text style={styles.optionText}>{item}</Text>
                {item === value ? (
                  <Ionicons name="checkmark" size={18} color={D14Colors.red} />
                ) : null}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// --- Date input (MM/DD/YYYY) ------------------------------------------------

/** Auto-insert slashes while typing a date. */
export function formatDateInput(text: string) {
  const d = text.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** "MM/DD/YYYY" → "YYYY-MM-DD", or null if it isn't a real past date after 1900. */
export function parseBirthdate(text: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  const valid =
    date.getUTCFullYear() === Number(yyyy) &&
    date.getUTCMonth() === Number(mm) - 1 &&
    date.getUTCDate() === Number(dd) &&
    Number(yyyy) >= 1900 &&
    date.getTime() <= Date.now();
  return valid ? `${yyyy}-${mm}-${dd}` : null;
}

/** "YYYY-MM-DD" → "MM/DD/YYYY" */
export function isoToDateInput(iso: string | null | undefined) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[2]}/${m[3]}/${m[1]}` : '';
}

/** Format a US phone number as (555) 555-5555 while typing. */
export function formatPhoneInput(text: string) {
  const d = text.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export const isPhone = (text: string) => text.replace(/\D/g, '').length === 10;

const styles = StyleSheet.create({
  field: { marginTop: Spacing.three },
  label: {
    color: D14Colors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.two,
  },
  required: { color: D14Colors.red },
  input: {
    backgroundColor: D14Colors.surface,
    borderColor: D14Colors.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    color: D14Colors.white,
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: 13,
  },
  inputError: { borderColor: D14Colors.error },
  error: { color: D14Colors.error, fontSize: 12, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: D14Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: D14Colors.border,
  },
  chipOn: { backgroundColor: D14Colors.red, borderColor: D14Colors.red },
  chipText: { color: D14Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextOn: { color: D14Colors.white },
  pickerInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerValue: { color: D14Colors.white, fontSize: 16 },
  pickerPlaceholder: { color: D14Colors.textTertiary, fontSize: 16 },
  modal: { flex: 1, backgroundColor: D14Colors.black },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
  },
  modalTitle: { color: D14Colors.white, fontSize: 18, fontWeight: '700' },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: D14Colors.border,
  },
  optionText: { color: D14Colors.white, fontSize: 15 },
});
