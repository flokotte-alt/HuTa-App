// Einfache Uebersicht ohne Kartendienst: Stopps, Reihenfolge und Fahrzeug massstaeblich gezeichnet.
// Dient in der Web-Vorschau und als Ausweichloesung, wenn die Karte nicht verfuegbar ist.
import { useState } from 'react';
import { Platform, View } from 'react-native';
import Svg, { Circle, G, Polyline, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/lib/theme';
import type { Pt } from '@/lib/trip';

export type SketchStop = Pt & { label: string; number?: number; done?: boolean; current?: boolean };

const PAD = 34;
// In der Web-Vorschau sonst eine Schrift mit Serifen
const FONT = Platform.OS === 'web' ? 'sans-serif' : undefined;

export function RouteSketch({ stops, vehicle }: { stops: SketchStop[]; vehicle?: Pt | null }) {
  const { colors } = useTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const points: Pt[] = [...stops, ...(vehicle ? [vehicle] : [])];

  let project = (p: Pt) => ({ x: p.lng, y: p.lat });
  if (points.length && size.w) {
    const k = Math.cos((points[0].lat * Math.PI) / 180); // Laengengrade stauchen
    const xs = points.map((p) => p.lng * k);
    const ys = points.map((p) => p.lat);
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const scale = Math.min((size.w - 2 * PAD) / Math.max(maxX - minX, 0.004), (size.h - 2 * PAD) / Math.max(maxY - minY, 0.004));
    const offX = (size.w - (maxX - minX) * scale) / 2;
    const offY = (size.h - (maxY - minY) * scale) / 2;
    project = (p) => ({ x: offX + (p.lng * k - minX) * scale, y: size.h - offY - (p.lat - minY) * scale });
  }

  const open = stops.filter((s) => !s.done);
  const line = [...(vehicle ? [vehicle] : []), ...open].map(project).map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <View
      accessibilityLabel={`Routenskizze mit ${stops.length} Punkten`}
      style={{ flex: 1, minHeight: 160, backgroundColor: colors.primarySoft }}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {size.w > 0 && (
        <Svg width={size.w} height={size.h} style={{ position: 'absolute' }}>
          {open.length > 0 && <Polyline points={line} fill="none" stroke={colors.primary} strokeWidth={3} strokeLinejoin="round" />}
          {stops.map((s, i) => {
            const p = project(s);
            return (
              <G key={`${s.label}-${i}`}>
                <Circle
                  cx={p.x}
                  cy={p.y}
                  r={s.current ? 15 : 11}
                  fill={s.done ? colors.faint : s.current ? colors.primary : colors.card}
                  stroke={colors.primary}
                  strokeWidth={2}
                />
                {s.number !== undefined && (
                  <SvgText
                    x={p.x}
                    y={p.y + 4}
                    fontSize={12}
                    fontFamily={FONT}
                    fontWeight="bold"
                    textAnchor="middle"
                    fill={s.done || s.current ? colors.onPrimary : colors.text}
                  >
                    {s.number}
                  </SvgText>
                )}
                {(s.current || stops.length <= 4) && (
                  <SvgText
                    x={Math.min(Math.max(p.x, 70), size.w - 70)}
                    y={p.y > size.h - 40 ? p.y - 20 : p.y + 30}
                    fontSize={12}
                    fontFamily={FONT}
                    textAnchor="middle"
                    fill={colors.text}
                  >
                    {s.label}
                  </SvgText>
                )}
              </G>
            );
          })}
          {vehicle && <Circle cx={project(vehicle).x} cy={project(vehicle).y} r={8} fill={colors.text} stroke={colors.card} strokeWidth={3} />}
        </Svg>
      )}
    </View>
  );
}
