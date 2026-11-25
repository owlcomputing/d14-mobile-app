import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, Text, View } from 'react-native';

import { darkPalette, Spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/lib/theme';

export type SocialNetwork = 'facebook' | 'instagram' | 'tiktok' | 'youtube';

const NETWORKS: Record<SocialNetwork, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  facebook: { label: 'Facebook', icon: 'logo-facebook' },
  instagram: { label: 'Instagram', icon: 'logo-instagram' },
  tiktok: { label: 'TikTok', icon: 'logo-tiktok' },
  youtube: { label: 'YouTube', icon: 'logo-youtube' },
};

/**
 * A usable profile link, or null for blanks and placeholders such as
 * "www.instagram.com" (no page after the domain). Adds https:// if missing.
 */
export function socialUrl(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  const url = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  // host, then a page: something after the domain other than slashes
  const m = /^https?:\/\/[^/?#\s]+\.[^/?#\s]+([/?#]\S*)?$/i.exec(url);
  if (!m || !m[1] || /^[/?#]*$/.test(m[1])) return null;
  return url;
}

/**
 * Row of labeled social buttons. `tone="hero"` uses the always-dark colors of
 * the division header; the default follows the app's appearance.
 */
export function SocialLinks({
  links,
  tone = 'default',
}: {
  links: { network: SocialNetwork; url: string | null | undefined }[];
  tone?: 'default' | 'hero';
}) {
  const themed = useColors();
  const c: Palette = tone === 'hero' ? darkPalette : themed;
  const valid = links
    .map((l) => ({ ...l, url: socialUrl(l.url) }))
    .filter((l): l is { network: SocialNetwork; url: string } => l.url !== null);
  if (!valid.length) return null;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.two }}>
      {valid.map(({ network, url }) => {
        const n = NETWORKS[network];
        return (
          <Pressable
            key={network}
            onPress={() => WebBrowser.openBrowserAsync(url)}
            accessibilityRole="link"
            accessibilityLabel={`${n.label} page`}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: 999,
              backgroundColor: c.surfaceRaised,
              borderWidth: 1,
              borderColor: c.border,
              opacity: pressed ? 0.7 : 1,
            })}>
            <Ionicons name={n.icon} size={18} color={c.text} />
            <Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>{n.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
