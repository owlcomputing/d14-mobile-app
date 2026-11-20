import { Text, View } from 'react-native';

import { Radius, Spacing, withAlpha } from '@/constants/theme';
import { makeStyles, useColors } from '@/lib/theme';

export type MemberResultData = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  d14_number: number | null;
  disciplines: string[] | null;
  member_type: string | null;
  // From the member_directory view (one membership row per profile)
  expiration: string | null;
};

/** Columns to select from member_directory for lookup / scanner results. */
export const MEMBER_DIRECTORY_COLUMNS =
  'id, first_name, last_name, d14_number, disciplines, member_type, expiration';

/** member_directory is a view, so generated types mark every column nullable; rows always have an id. */
export function hasId<T extends { id: string | null }>(row: T): row is T & { id: string } {
  return row.id != null;
}

export function membershipActive(m: MemberResultData): boolean {
  return m.expiration ? new Date(m.expiration) >= new Date() : false;
}

export function MemberResult({ member }: { member: MemberResultData }) {
  const c = useColors();
  const styles = useStyles();
  const active = membershipActive(member);
  const initials = [member.first_name?.[0], member.last_name?.[0]].filter(Boolean).join('');
  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials || '?'}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>
          {[member.first_name, member.last_name].filter(Boolean).join(' ')}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {member.d14_number ? `D14 #${member.d14_number}` : 'No D14 number'}
          {member.disciplines?.length ? ` • ${member.disciplines.join(', ')}` : ''}
        </Text>
      </View>
      <View style={[styles.badge, active ? styles.badgeActive : styles.badgeExpired]}>
        <Text style={[styles.badgeText, { color: active ? c.success : c.error }]}>
          {active ? 'Active' : 'Expired'}
        </Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: c.surface,
    borderRadius: Radius.md,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: c.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: c.onAccent, fontWeight: '800', fontSize: 15 },
  info: { flex: 1 },
  name: { color: c.text, fontSize: 14, fontWeight: '600' },
  meta: { color: c.textSecondary, fontSize: 11, marginTop: 2 },
  badge: {
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  badgeActive: { borderColor: withAlpha(c.success, 0.4), backgroundColor: withAlpha(c.success, 0.08) },
  badgeExpired: { borderColor: withAlpha(c.error, 0.4), backgroundColor: withAlpha(c.error, 0.08) },
  badgeText: { fontSize: 11, fontWeight: '700' },
}));
