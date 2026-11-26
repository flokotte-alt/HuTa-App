// Dateien lesen, hochladen und oeffnen
import { Linking, Platform } from 'react-native';
import { File } from 'expo-file-system';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

export const randomName = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const safeFileName = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .slice(-80) || 'datei';

export async function readFile(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') return (await fetch(uri)).arrayBuffer();
  return new File(uri).arrayBuffer();
}

export const sizeLabel = (bytes: number | null | undefined) =>
  !bytes ? '' : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;

// Private Datei ueber einen kurz gueltigen Link oeffnen
export async function openStored(bucket: string, path: string) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
  if (error || !data) throw error ?? new Error('Datei nicht gefunden');
  if (Platform.OS === 'web') window.open(data.signedUrl, '_blank');
  else await WebBrowser.openBrowserAsync(data.signedUrl).catch(() => Linking.openURL(data.signedUrl));
}
