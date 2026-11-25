// Standort waehrend einer laufenden Fahrt (auch im Hintergrund) und automatische Ankunftserkennung.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from './supabase';
import { distKm } from './trip';
import { arriveCurrentStop } from './tripOps';

export const TRACK_TASK = 'huta-trip-location';
export const ACTIVE_KEY = 'huta:activeTrip';
const DWELL_KEY = 'huta:dwell';
const ARRIVE_RADIUS_KM = 0.08; // 80 Meter
const DWELL_MS = 45_000; // so lange muss das Auto dort stehen

if (Platform.OS !== 'web') {
  TaskManager.defineTask(TRACK_TASK, async ({ data, error }) => {
    if (error) return;
    const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
    const loc = locations?.[locations.length - 1];
    const tripId = await AsyncStorage.getItem(ACTIVE_KEY);
    if (!loc || !tripId) return;

    await supabase.from('trip_location').upsert({
      trip_id: tripId,
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      updated_at: new Date().toISOString(),
    });

    // Ankunft: lange genug nahe an der naechsten Station
    const { data: stop } = await supabase
      .from('trip_stops')
      .select('id, stations(lat, lng), trip_dogs(sick)')
      .eq('trip_id', tripId)
      .is('arrived_at', null)
      .order('position');
    const open = (stop as unknown as { id: string; stations: { lat: number; lng: number } | null; trip_dogs: { sick: boolean }[] }[]) ?? [];
    const st = open.find((s) => s.trip_dogs.some((d) => !d.sick)) ?? null;
    if (!st?.stations) return;
    const near = distKm({ lat: loc.coords.latitude, lng: loc.coords.longitude }, st.stations) <= ARRIVE_RADIUS_KM;
    if (!near) {
      await AsyncStorage.removeItem(DWELL_KEY);
      return;
    }
    const raw = await AsyncStorage.getItem(DWELL_KEY);
    const saved = raw ? (JSON.parse(raw) as { stopId: string; since: number }) : null;
    if (!saved || saved.stopId !== st.id) {
      await AsyncStorage.setItem(DWELL_KEY, JSON.stringify({ stopId: st.id, since: Date.now() }));
    } else if (Date.now() - saved.since >= DWELL_MS) {
      await AsyncStorage.removeItem(DWELL_KEY);
      await arriveCurrentStop(tripId);
    }
  });
}

export async function startTracking(tripId: string): Promise<'ok' | 'denied' | 'unavailable'> {
  if (Platform.OS === 'web') return 'unavailable';
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') return 'denied';
  await AsyncStorage.setItem(ACTIVE_KEY, tripId);
  const running = await Location.hasStartedLocationUpdatesAsync(TRACK_TASK).catch(() => false);
  if (!running) {
    await Location.startLocationUpdatesAsync(TRACK_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 15_000,
      distanceInterval: 25,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Huta: Fahrt läuft',
        notificationBody: 'Dein Standort wird für die Ankunftszeiten geteilt.',
      },
    });
  }
  return 'ok';
}

export async function stopTracking() {
  if (Platform.OS === 'web') return;
  await AsyncStorage.multiRemove([ACTIVE_KEY, DWELL_KEY]);
  const running = await Location.hasStartedLocationUpdatesAsync(TRACK_TASK).catch(() => false);
  if (running) await Location.stopLocationUpdatesAsync(TRACK_TASK);
}
