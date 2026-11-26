// Naeherung ohne Verkehrsdaten (Ausweichloesung, solange kein Google-Schluessel hinterlegt ist)
export type Pt = { lat: number; lng: number };

export function distKm(a: Pt, b: Pt) {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function routeKm(start: Pt, stops: Pt[], end: Pt) {
  const points = [start, ...stops, end];
  return points.slice(1).reduce((sum, p, i) => sum + distKm(points[i], p), 0);
}

// Reihenfolge: erst naechster Nachbar, dann Teilstuecke umdrehen, solange der Gesamtweg bis zum Ziel kuerzer wird
export function orderStops<T extends Pt>(start: Pt, stops: T[], end: Pt): T[] {
  const rest = [...stops];
  let best: T[] = [];
  let cur = start;
  while (rest.length) {
    let n = 0;
    for (let i = 1; i < rest.length; i++) if (distKm(cur, rest[i]) < distKm(cur, rest[n])) n = i;
    const [next] = rest.splice(n, 1);
    best.push(next);
    cur = next;
  }
  let length = routeKm(start, best, end);
  for (let improved = true; improved; ) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const candidate = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
        const l = routeKm(start, candidate, end);
        if (l < length - 0.001) {
          best = candidate;
          length = l;
          improved = true;
        }
      }
    }
  }
  return best;
}

const SPEED_KMH = 28; // Stadtverkehr, Naeherung
const DETOUR = 1.3; // Luftlinie -> Strasse
export const DWELL_MIN = 2; // Standard-Halt pro Station

export const driveSeconds = (a: Pt, b: Pt) => ((distKm(a, b) * DETOUR) / SPEED_KMH) * 3600;

// Ankunftszeiten aus Fahrzeiten je Abschnitt. "extra" sind die Minuten fuer Wohnungs-Uebergaben.
export function etasFromLegs(stops: { extra: number }[], legSeconds: number[], from: Date): Date[] {
  let t = from.getTime();
  return stops.map((s, i) => {
    t += (legSeconds[i] ?? 0) * 1000;
    const eta = new Date(t);
    t += (DWELL_MIN + s.extra) * 60000;
    return eta;
  });
}

export function computeEtas(start: Pt, stops: (Pt & { extra: number })[], from: Date): Date[] {
  return etasFromLegs(
    stops,
    stops.map((s, i) => driveSeconds(i === 0 ? start : stops[i - 1], s)),
    from,
  );
}

// Wohnungszeit an einer Station: je Kunde der laengste Puffer, mehrere Kunden addiert (wie in der Datenbank)
export function apartmentExtra(dogs: { customer_id: string; handover: string; apartment_minutes: number }[]) {
  const per = new Map<string, number>();
  for (const d of dogs) {
    if (d.handover !== 'apartment') continue;
    per.set(d.customer_id, Math.max(per.get(d.customer_id) ?? 0, d.apartment_minutes));
  }
  return [...per.values()].reduce((a, b) => a + b, 0);
}
