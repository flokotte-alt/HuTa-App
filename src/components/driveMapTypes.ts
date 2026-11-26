import type { Ref } from 'react';
import type { Pt } from '@/lib/trip';
import type { SketchStop } from './RouteSketch';

export type DriveMapHandle = {
  // Restfahrzeit laut Navigation, null ohne Navigation
  remainingSeconds: () => Promise<number | null>;
  // Auf die Strecke aus dem Route-Token wechseln
  applyRoute: (routeToken: string) => Promise<boolean>;
};

export type DriveMapProps = {
  ref?: Ref<DriveMapHandle>;
  target: (Pt & { id: string; label: string }) | null;
  stops: SketchStop[];
  vehicle: Pt | null;
  onRemaining?: (seconds: number) => void;
};
