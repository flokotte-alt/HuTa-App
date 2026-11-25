import { Linking, Platform } from 'react-native';
import type { Pt } from './trip';

// Externe Karten-App (Apple Karten bzw. Google Maps) als Ausweichweg
export function openMaps(p: Pt) {
  const url = Platform.OS === 'ios' ? `http://maps.apple.com/?daddr=${p.lat},${p.lng}&dirflg=d` : `google.navigation:q=${p.lat},${p.lng}`;
  Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`));
}
