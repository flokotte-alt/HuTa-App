// Web-Vorschau: keine Navigation, nur die Skizze
import { useImperativeHandle } from 'react';
import { View } from 'react-native';
import { RouteSketch } from './RouteSketch';
import { T } from './ui';
import type { DriveMapProps } from './driveMapTypes';

export function DriveMap({ ref, stops, vehicle }: DriveMapProps) {
  useImperativeHandle(ref, () => ({ remainingSeconds: async () => null, applyRoute: async () => false }), []);
  return (
    <View style={{ flex: 1 }}>
      <RouteSketch stops={stops} vehicle={vehicle} />
      <View style={{ position: 'absolute', left: 8, top: 8, right: 8 }}>
        <T small muted>
          Vorschau ohne Navigation. Auf dem Handy erscheint hier die Karte.
        </T>
      </View>
    </View>
  );
}
