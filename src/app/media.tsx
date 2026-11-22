import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, ScrollView, Text, View } from 'react-native';
import WebView from 'react-native-webview';

import { Widget } from '@/components/widget';
import { Radius, Spacing } from '@/constants/theme';
import { useMagazineIssues } from '@/lib/queries';
import { makeStyles, useColors } from '@/lib/theme';

const SPOTIFY_SHOW_ID = '2FGA4qJb5k1Zbx5QA4DgJ0';
const SPOTIFY_EMBED_URL = `https://open.spotify.com/embed/show/${SPOTIFY_SHOW_ID}?utm_source=generator&theme=0`;
const SPOTIFY_SHOW_URL = `https://open.spotify.com/show/${SPOTIFY_SHOW_ID}`;
// The channel's uploads playlist (channel ID with "UC" prefix -> "UU")
const YOUTUBE_PLAYLIST_ID = 'UUaENMUV8qyblQwBLhxnxNzA';
const YOUTUBE_EMBED_URL = `https://www.youtube.com/embed/videoseries?list=${YOUTUBE_PLAYLIST_ID}`;
const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/@TheDirtbikeDownload';

export default function MediaScreen() {
  const c = useColors();
  const styles = useStyles();
  // Back issues (PDFs we host); the section is hidden until there are any
  const issues = useMagazineIssues().data ?? [];
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>The Dirtbike Download</Text>
      <Text style={styles.subtitle}>
        The official AMA District 14 podcast — riders, race recaps, and district news.
      </Text>

      <Widget header="Listen on Spotify">
        <View style={styles.embed}>
          <WebView
            source={{ uri: SPOTIFY_EMBED_URL }}
            style={styles.webview}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
          />
        </View>
        <OpenLink label="Open in Spotify" url={SPOTIFY_SHOW_URL} icon="musical-notes" />
      </Widget>

      <Widget header="Watch on YouTube">
        <View style={[styles.embed, styles.videoEmbed]}>
          <WebView
            source={{ uri: YOUTUBE_EMBED_URL }}
            style={styles.webview}
            allowsInlineMediaPlayback
            allowsFullscreenVideo
          />
        </View>
        <OpenLink label="Open YouTube Channel" url={YOUTUBE_CHANNEL_URL} icon="logo-youtube" />
      </Widget>

      {issues.length ? (
        <Widget header="D14 Magazine Archive">
          <Text style={styles.archiveNote}>
            The D14 Magazine is no longer published — browse past issues below.
          </Text>
          {issues.map((issue, i) => (
            <Pressable
              key={issue.id}
              style={({ pressed }) => [
                styles.issueRow,
                i < issues.length - 1 && styles.issueRowBorder,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => WebBrowser.openBrowserAsync(issue.magazine_storage_url!)}>
              <Ionicons name="book" size={15} color={c.textTertiary} />
              <Text style={styles.issueLabel}>{issue.issue_name ?? 'Issue'}</Text>
              <Ionicons name="open-outline" size={14} color={c.textTertiary} />
            </Pressable>
          ))}
        </Widget>
      ) : null}
    </ScrollView>
  );
}

function OpenLink({ label, url, icon }: { label: string; url: string; icon: any }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <Pressable
      style={({ pressed }) => [styles.openLink, pressed && { opacity: 0.8 }]}
      onPress={() => WebBrowser.openBrowserAsync(url)}>
      <Ionicons name={icon} size={15} color={c.onAccent} />
      <Text style={styles.openLinkText}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: Spacing.three, paddingBottom: Spacing.six },
  title: { color: c.text, fontSize: 22, fontWeight: '800' },
  subtitle: {
    color: c.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
    marginBottom: Spacing.three,
  },
  embed: {
    height: 352,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: c.surfaceRaised,
  },
  videoEmbed: { height: 220 },
  webview: { flex: 1, backgroundColor: 'transparent' },
  openLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: c.red,
    borderRadius: Radius.md,
    paddingVertical: 12,
    marginTop: Spacing.two + 4,
  },
  openLinkText: { color: c.onAccent, fontSize: 13, fontWeight: '700' },
  archiveNote: {
    color: c.textTertiary,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: Spacing.two,
  },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 4,
    paddingVertical: 11,
  },
  issueRowBorder: { borderBottomWidth: 1, borderBottomColor: c.border },
  issueLabel: { color: c.text, fontSize: 14, flex: 1 },
}));
