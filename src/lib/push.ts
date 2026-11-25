import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export type PushState = 'granted' | 'denied' | 'unavailable';

// ask = true: Berechtigung abfragen. ask = false: nur still erneuern, wenn schon erlaubt.
export async function registerPush(ask: boolean): Promise<PushState> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'unavailable';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Huta',
      importance: Notifications.AndroidImportance.HIGH,
    });
    // "Gleich bist du dran" mit eigenem Ton
    await Notifications.setNotificationChannelAsync('bald', {
      name: 'Gleich bist du dran',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'huta_bald.wav',
      vibrationPattern: [0, 300, 200, 300],
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && ask) status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return 'denied';
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  try {
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    await supabase.rpc('save_push_token', { p_token: token });
    return 'granted';
  } catch {
    return 'unavailable';
  }
}
