// Ist diese App mit einem echten Google-Schluessel gebaut? Der Wert kommt aus app.config.js.
// Wenn nicht (Test-Version ohne Google), darf nichts aus dem Navigationspaket angezeigt oder aufgerufen werden.
import { Platform } from 'react-native';
import Constants from 'expo-constants';

export const hasGoogleMaps: boolean = Constants.expoConfig?.extra?.googleMaps?.[Platform.OS] === true;
