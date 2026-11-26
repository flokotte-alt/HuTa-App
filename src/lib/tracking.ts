// Standort waehrend einer laufenden Fahrt (auch im Hintergrund). Weitergeschaltet wird nur mit dem Knopf.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from './supabase';

export const TRACK_TASK = 'huta-trip-location';
export const ACTIVE_KEY = 'huta:activeTrip';

if (Platform.OS !== 'web') {
  TaskManager.defineTask(TRACK_TASK, async ({ data, error }) => {
    if (error) return;
    const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
    const loc = locations?.[locations.length - 1];
    const tripId = await AsyncStorage.getItem(ACTIVE_KEY);
    if (!loc || !tripId) return;

    // Hat jemand die Fahrt beendet oder auf dem anderen Handy uebernommen, hoert die Erfassung auf
    const { data: trip, error: tripError } = await supabase.from('trips').select('state, driver_id').eq('id', tripId).maybeSingle();
    const me = (await supabase.auth.getSession()).data.session?.user.id;
    if (!tripError && (trip?.state !== 'running' || (me && trip.driver_id !== me))) {
      await stopTracking();
      return;
    }

    await supabase.from('trip_location').upsert({
      trip_id: tripId,
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      updated_at: new Date().toISOString(),
    });
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
      accuracy: Location.Accuracy.High,
      timeInterval: 10_000,
      distanceInterval: 20,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Huta: Fahrt läuft',
        notificationBody: 'Dein Standort wird mit den Kunden dieser Fahrt geteilt.',
      },
    });
  }
  return 'ok';
}

// Nur beenden, wenn gerade diese Fahrt erfasst wird (eine andere Fahrt laeuft sonst weiter)
export async function stopTrackingFor(tripId: string) {
  if (Platform.OS !== 'web' && (await AsyncStorage.getItem(ACTIVE_KEY)) === tripId) await stopTracking();
}

export async function stopTracking() {
  if (Platform.OS === 'web') return;
  await AsyncStorage.removeItem(ACTIVE_KEY);
  const running = await Location.hasStartedLocationUpdatesAsync(TRACK_TASK).catch(() => false);
  if (running) await Location.stopLocationUpdatesAsync(TRACK_TASK);
}
