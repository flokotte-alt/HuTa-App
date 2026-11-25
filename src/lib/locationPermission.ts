// Standort "Immer erlauben" fuer Dienstleister. Die Erklaerung vor der Abfrage verlangt Google Play.
import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { confirmDialog } from './dialog';

const ASKED_KEY = 'huta:askedAlways';

const EXPLANATION =
  'Huta erfasst deinen Standort während einer Fahrt, auch wenn die App geschlossen ist oder nicht benutzt wird, zum Beispiel bei gesperrtem Handy. So sehen die Kunden die Ankunftszeiten. Außerhalb einer Fahrt wird nichts übertragen. Wähle im nächsten Schritt "Immer erlauben".';

export type AlwaysState = 'granted' | 'missing' | 'unavailable';

export async function alwaysLocationState(): Promise<AlwaysState> {
  if (Platform.OS === 'web') return 'unavailable';
  const p = await Location.getBackgroundPermissionsAsync();
  return p.status === 'granted' ? 'granted' : 'missing';
}

export function requestAlwaysLocation(onDone?: () => void) {
  confirmDialog('Standort immer erlauben', EXPLANATION, 'Weiter', async () => {
    const front = await Location.requestForegroundPermissionsAsync();
    if (front.status === 'granted') {
      const result = await Location.requestBackgroundPermissionsAsync();
      if (result.status !== 'granted' && !result.canAskAgain) await Linking.openSettings();
    } else if (!front.canAskAgain) {
      await Linking.openSettings();
    }
    onDone?.();
  });
}

// Beim ersten Start einer Fahrt einmal nachfragen
export async function askAlwaysLocationOnce() {
  if ((await alwaysLocationState()) !== 'missing') return;
  if (await AsyncStorage.getItem(ASKED_KEY)) return;
  await AsyncStorage.setItem(ASKED_KEY, '1');
  requestAlwaysLocation();
}
