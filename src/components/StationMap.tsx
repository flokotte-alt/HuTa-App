// Kleine Karte mit der eigenen Station. Die Web-Vorschau nutzt StationMap.web.tsx.
import { useRef } from 'react';
import { View } from 'react-native';
import { MapColorScheme, MapView, type MapViewController } from '@googlemaps/react-native-navigation-sdk';

export type StationMapProps = { lat: number; lng: number; label: string };

export function StationMap({ lat, lng, label }: StationMapProps) {
  const map = useRef<MapViewController | null>(null);
  return (
    <View style={{ height: 180, borderRadius: 12, overflow: 'hidden' }}>
      <MapView
        key={`${lat},${lng}`}
        style={{ flex: 1 }}
        initialCameraPosition={{ target: { lat, lng }, zoom: 15 }}
        mapColorScheme={MapColorScheme.LIGHT}
        scrollGesturesEnabled={false}
        rotateGesturesEnabled={false}
        tiltGesturesEnabled={false}
        onMapViewControllerCreated={(controller) => {
          map.current = controller;
        }}
        onMapReady={() => {
          map.current?.addMarker({ id: 'station', position: { lat, lng }, title: label }).catch(() => {});
        }}
      />
    </View>
  );
}
