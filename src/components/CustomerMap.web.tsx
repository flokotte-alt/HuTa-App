// Web-Vorschau: Skizze statt Karte
import { View } from 'react-native';
import { RouteSketch } from './RouteSketch';
import type { CustomerMapProps } from './customerMapTypes';

export function CustomerMap({ station, vehicle }: CustomerMapProps) {
  return (
    <View style={{ height: 180, borderRadius: 10, overflow: 'hidden' }}>
      <RouteSketch stops={[{ ...station, current: true }]} vehicle={vehicle} />
    </View>
  );
}
