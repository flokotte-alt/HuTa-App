// Neue Urlaubseintraege fallen auf: Zaehler am Tab "Einstellungen" und Markierung in der Uebersicht.
// "Gesehen" gilt je Geraet.
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { iso } from './dates';
import { supabase } from './supabase';

const KEY = 'huta:vacationsSeen';
const listeners = new Set<() => void>();
let channelNo = 0;

export const lastSeenVacations = async () => (await AsyncStorage.getItem(KEY)) ?? '1970-01-01T00:00:00Z';

export async function markVacationsSeen(newest: string) {
  await AsyncStorage.setItem(KEY, newest);
  listeners.forEach((l) => l());
}

export function useNewVacations() {
  const [count, setCount] = useState(0);
  const load = useCallback(async () => {
    const seen = await lastSeenVacations();
    const { count: n } = await supabase
      .from('vacations')
      .select('id', { count: 'exact', head: true })
      .gt('created_at', seen)
      .gte('date_to', iso(new Date()));
    setCount(n ?? 0);
  }, []);

  useEffect(() => {
    load();
    listeners.add(load);
    const channel = supabase
      .channel(`huta-vacations-${++channelNo}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vacations' }, () => load())
      .subscribe();
    const timer = setInterval(load, 60_000);
    return () => {
      listeners.delete(load);
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  return count;
}
