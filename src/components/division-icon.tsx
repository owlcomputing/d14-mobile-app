import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useColors } from '@/lib/theme';

type MCIName = keyof typeof MaterialCommunityIcons.glyphMap;

/**
 * Discipline glyphs for the division buttons. Matched by keywords so new
 * divisions gracefully fall back to the checkered flag.
 */
const ICON_RULES: { match: RegExp; icon: MCIName }[] = [
  { match: /atv/i, icon: 'atv' },
  { match: /vintage/i, icon: 'engine' },
  { match: /sprint/i, icon: 'timer' },
  { match: /enduro/i, icon: 'pine-tree' },
  { match: /hare/i, icon: 'rabbit' },
  { match: /hill/i, icon: 'slope-uphill' },
  { match: /ice/i, icon: 'snowflake' },
  { match: /flat/i, icon: 'flag-checkered' },
  { match: /motocross|mx/i, icon: 'motorbike' },
];

export function divisionIconName(divisionName: string | null | undefined): MCIName {
  if (divisionName) {
    for (const rule of ICON_RULES) {
      if (rule.match.test(divisionName)) return rule.icon;
    }
  }
  return 'flag-checkered';
}

export function DivisionIcon({
  name,
  size = 24,
  color,
}: {
  name: string | null | undefined;
  size?: number;
  /** Defaults to brand red */
  color?: string;
}) {
  const c = useColors();
  return <MaterialCommunityIcons name={divisionIconName(name)} size={size} color={color ?? c.red} />;
}
