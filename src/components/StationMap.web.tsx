// Web-Vorschau: Platzhalter statt Karte
import { Card, T } from '@/components/ui';
import type { StationMapProps } from './StationMap';

export function StationMap({ label }: StationMapProps) {
  return (
    <Card>
      <T small muted>
        Karte (nur auf dem Handy): {label}
      </T>
    </Card>
  );
}
