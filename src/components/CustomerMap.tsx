// Karte im Live-Banner der Kunden: eigene Station und Fahrzeug. Die Web-Vorschau nutzt CustomerMap.web.tsx.
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { MapColorScheme, MapView, type MapViewController } from '@googlemaps/react-native-navigation-sdk';
import { useTheme } from '@/lib/theme';
import type { CustomerMapProps } from './customerMapTypes';

export function CustomerMap({ station, vehicle }: CustomerMapProps) {
  const map = useRef<MapViewController | null>(null);
  const marker = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const { dark } = useTheme();

  const drawVehicle = useCallback(async () => {
    if (!map.current) return;
    if (marker.current) await map.current.removeMarker(marker.current);
    marker.current = null;
    if (!vehicle) return;
    const m = await map.current.addMarker({ id: 'vehicle', position: vehicle, title: 'Fahrzeug' });
    marker.current = m.id;
  }, [vehicle?.lat, vehicle?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (ready) drawVehicle().catch(() => {});
  }, [ready, drawVehicle]);

  return (
    <View style={{ height: 220, borderRadius: 10, overflow: 'hidden' }}>
      <MapView
        key={`${station.lat},${station.lng}`}
        style={{ flex: 1 }}
        initialCameraPosition={{ target: station, zoom: 13 }}
        mapColorScheme={dark ? MapColorScheme.DARK : MapColorScheme.LIGHT}
        rotateGesturesEnabled={false}
        tiltGesturesEnabled={false}
        onMapViewControllerCreated={(controller) => {
          map.current = controller;
        }}
        onMapReady={() => {
          map.current?.addMarker({ id: 'station', position: station, title: station.label }).catch(() => {});
          setReady(true);
        }}
      />
    </View>
  );
}
