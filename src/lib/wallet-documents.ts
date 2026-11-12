// Wallet documents: photos/PDFs members keep in the app (AMA card, AMA minor
// release, etc.). Board action item, Q3 2026.
//
// Stored ONLY on this device, in the app's private documents directory, so
// they are always available offline (e.g. at a gate with no signal) and
// minors' release forms never leave the phone. Not synced or backed up by us;
// a new phone starts empty. Each signed-in profile gets its own folder, so
// two members sharing a device don't see each other's documents.
import { Directory, File, Paths } from 'expo-file-system';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

export type WalletDocKind = 'image' | 'pdf';

export type WalletDoc = {
  id: string;
  title: string;
  kind: WalletDocKind;
  /** File name inside the profile's folder */
  fileName: string;
  mimeType: string | null;
  size: number | null;
  createdAt: string;
};

/** Suggested titles shown as chips when adding a document. */
export const SUGGESTED_TITLES = ['AMA Card', 'AMA Minor Release', 'Insurance Card', 'Other'];

const INDEX_FILE = 'index.json';

function profileDir(profileId: string) {
  const dir = new Directory(Paths.document, 'wallet-documents', profileId);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function readIndex(profileId: string): WalletDoc[] {
  const index = new File(profileDir(profileId), INDEX_FILE);
  if (!index.exists) return [];
  try {
    const docs = JSON.parse(index.textSync()) as WalletDoc[];
    // Drop entries whose file was removed outside the app
    return docs.filter((d) => new File(profileDir(profileId), d.fileName).exists);
  } catch {
    return [];
  }
}

function writeIndex(profileId: string, docs: WalletDoc[]) {
  const index = new File(profileDir(profileId), INDEX_FILE);
  if (!index.exists) index.create();
  // SDK 58: File.write() is async; writeSync keeps the index update atomic
  // with the caller (callers re-read the index immediately after).
  index.writeSync(JSON.stringify(docs));
}

export function docUri(profileId: string, doc: WalletDoc) {
  return new File(profileDir(profileId), doc.fileName).uri;
}

function extensionFor(kind: WalletDocKind, mimeType: string | null, sourceName?: string | null) {
  if (kind === 'pdf') return 'pdf';
  const fromName = sourceName?.split('.').pop()?.toLowerCase();
  if (fromName && /^(jpe?g|png|heic|heif|webp)$/.test(fromName)) return fromName;
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/heic') return 'heic';
  return 'jpg';
}

export function kindForMime(mimeType: string | null | undefined): WalletDocKind {
  return mimeType === 'application/pdf' ? 'pdf' : 'image';
}

/** Copy a picked file (camera, photo library or document picker URI) into the wallet. */
export async function addWalletDoc(
  profileId: string,
  input: { sourceUri: string; title: string; mimeType: string | null; sourceName?: string | null },
): Promise<WalletDoc> {
  const kind = kindForMime(input.mimeType);
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const fileName = `${id}.${extensionFor(kind, input.mimeType, input.sourceName)}`;
  const dest = new File(profileDir(profileId), fileName);
  await new File(input.sourceUri).copy(dest);

  const doc: WalletDoc = {
    id,
    title: input.title.trim() || 'Document',
    kind,
    fileName,
    mimeType: input.mimeType ?? (kind === 'pdf' ? 'application/pdf' : 'image/jpeg'),
    size: dest.size ?? null,
    createdAt: new Date().toISOString(),
  };
  writeIndex(profileId, [doc, ...readIndex(profileId)]);
  return doc;
}

export function renameWalletDoc(profileId: string, id: string, title: string) {
  writeIndex(
    profileId,
    readIndex(profileId).map((d) => (d.id === id ? { ...d, title: title.trim() || d.title } : d)),
  );
}

export function deleteWalletDoc(profileId: string, id: string) {
  const docs = readIndex(profileId);
  const doc = docs.find((d) => d.id === id);
  if (doc) {
    const file = new File(profileDir(profileId), doc.fileName);
    if (file.exists) file.delete();
  }
  writeIndex(
    profileId,
    docs.filter((d) => d.id !== id),
  );
}

/**
 * Wallet documents for the signed-in profile, read from the device (never
 * the network). Re-reads whenever the screen comes into focus, so it picks up
 * documents added or deleted on other screens.
 */
export function useWalletDocs(profileId: string | undefined) {
  const [docs, setDocs] = useState<WalletDoc[]>([]);
  const reload = useCallback(() => {
    setDocs(profileId ? readIndex(profileId) : []);
  }, [profileId]);
  useFocusEffect(reload);
  return { docs, reload };
}

/** Look up one document by id (for the viewer screen). */
export function getWalletDoc(profileId: string, id: string): WalletDoc | undefined {
  return readIndex(profileId).find((d) => d.id === id);
}
