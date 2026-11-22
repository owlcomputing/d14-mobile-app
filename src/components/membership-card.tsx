import { Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { darkPalette, Radius, Spacing, withAlpha } from '@/constants/theme';
import { makeStyles } from '@/lib/theme';

/** Membership card colors: the same in Dark and Light. */
const card = darkPalette;

export function formatCardDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * The digital D14 membership card with the gate QR code (verified by the
 * lookup/scanner screen). Used for the member's own card and for the family
 * members they manage.
 */
export function MembershipCard({
  profileId,
  name,
  d14Number,
  amaNumber,
  memberType,
  expiration,
  now,
}: {
  profileId: string;
  name: string;
  d14Number: number | string | null | undefined;
  amaNumber: string | null | undefined;
  memberType: string | null | undefined;
  expiration: string | null | undefined;
  /** Current time, read once by the screen (reading the clock during render isn't allowed) */
  now: number;
}) {
  const styles = useStyles();
  const active = expiration ? new Date(expiration).getTime() >= now : false;
  const qrValue = JSON.stringify({
    v: 1,
    t: 'd14-member',
    id: profileId,
    d14: d14Number ?? null,
  });

  return (
    <View style={styles.card}>
      <View style={styles.cardDecorCircle} />
      <View style={styles.cardDecorCircle2} />
      <Text style={styles.cardLogo}>AMA DISTRICT 14</Text>
      <Text style={styles.cardName}>{name || 'Member'}</Text>
      <Text style={styles.cardNumber}>
        D14 #{d14Number ?? '—'}
        {amaNumber ? `  •  AMA #${amaNumber}` : ''}
      </Text>
      <View style={styles.cardRow}>
        <View style={styles.cardDetails}>
          <View>
            <Text style={styles.cardDetailLabel}>Type</Text>
            <Text style={styles.cardDetailValue}>{memberType ?? '—'}</Text>
          </View>
          <View>
            <Text style={styles.cardDetailLabel}>Expires</Text>
            <Text style={styles.cardDetailValue}>{formatCardDate(expiration)}</Text>
          </View>
          <View>
            <Text style={styles.cardDetailLabel}>Status</Text>
            <Text style={[styles.cardDetailValue, { color: active ? card.success : card.error }]}>
              {active ? 'Active' : expiration ? 'Expired' : 'Not active'}
            </Text>
          </View>
        </View>
        <View style={styles.qrBox}>
          <QRCode value={qrValue} size={92} backgroundColor="#FFFFFF" />
        </View>
      </View>
    </View>
  );
}

// The membership card keeps its dark, branded look in both appearances
const useStyles = makeStyles(() => ({
  card: {
    backgroundColor: card.surfaceRaised,
    borderRadius: Radius.xl,
    padding: Spacing.four,
    overflow: 'hidden',
    marginBottom: Spacing.four,
    borderWidth: 1,
    borderColor: card.border,
  },
  cardDecorCircle: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: withAlpha(card.red, 0.35),
  },
  cardDecorCircle2: {
    position: 'absolute',
    bottom: -40,
    right: -20,
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: withAlpha(card.red, 0.18),
  },
  cardLogo: {
    color: card.red,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 3,
    marginBottom: Spacing.three,
  },
  cardName: { color: card.text, fontSize: 20, fontWeight: '700' },
  cardNumber: {
    color: card.textSecondary,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    marginTop: 4,
    marginBottom: Spacing.three,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  cardDetails: { gap: Spacing.two },
  cardDetailLabel: {
    color: card.textTertiary,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardDetailValue: {
    color: card.text,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 1,
  },
  qrBox: { backgroundColor: '#FFFFFF', borderRadius: Radius.md, padding: 8 },
}));
