// Updates ohne neuen Build: beim Start und beim Zurueckkehren in die App laden und sofort anwenden.
// Waehrend einer laufenden Fahrt wird nie neu gestartet.
import { useCallback, useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { ACTIVE_KEY } from './tracking';

const enabled = !__DEV__ && Platform.OS !== 'web' && Updates.isEnabled;

export function useAutoUpdates() {
  const { isUpdatePending } = Updates.useUpdates();

  const reloadIfIdle = useCallback(async () => {
    if (await AsyncStorage.getItem(ACTIVE_KEY)) return;
    await Updates.reloadAsync();
  }, []);

  useEffect(() => {
    if (enabled && isUpdatePending) reloadIfIdle().catch(() => {});
  }, [isUpdatePending, reloadIfIdle]);

  useEffect(() => {
    if (!enabled) return;
    const check = async () => {
      try {
        const found = await Updates.checkForUpdateAsync();
        if (found.isAvailable) await Updates.fetchUpdateAsync();
      } catch {
        /* ohne Netz einfach spaeter */
      }
    };
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, []);
}
