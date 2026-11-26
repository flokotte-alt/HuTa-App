// Bildschirm aktuell halten: beim Oeffnen, bei Aenderungen in der Datenbank (Supabase Realtime),
// beim Zurueckkehren in die App und zur Sicherheit in festen Abstaenden.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from './supabase';

let channelNo = 0;

export function useLive(load: () => Promise<unknown> | unknown, tables: string[], pollMs = 30000) {
  const [refreshing, setRefreshing] = useState(false);
  const loadRef = useRef(load);
  loadRef.current = load;
  const key = tables.join(',');

  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const soon = () => {
        clearTimeout(timer);
        timer = setTimeout(() => loadRef.current(), 350);
      };
      loadRef.current();
      const channel = supabase.channel(`huta-live-${++channelNo}`);
      for (const table of key ? key.split(',') : []) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table }, soon);
      }
      channel.subscribe();
      const poll = setInterval(() => loadRef.current(), pollMs);
      const sub = AppState.addEventListener('change', (s) => {
        if (s === 'active') loadRef.current();
      });
      return () => {
        clearTimeout(timer);
        clearInterval(poll);
        sub.remove();
        supabase.removeChannel(channel);
      };
    }, [key, pollMs]),
  );

  // Neu laden, wenn sich die Anfrage aendert (zum Beispiel andere Woche)
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    loadRef.current();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRef.current();
    setRefreshing(false);
  }, []);

  return { refreshing, onRefresh };
}
