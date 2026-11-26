// Routenplanung und Fahrbildschirm
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { DriveMap } from '@/components/DriveMap';
import type { DriveMapHandle } from '@/components/driveMapTypes';
import { RouteSketch } from '@/components/RouteSketch';
import { Btn, Card, Chip, Grow, H2, IconBtn, Row, Screen, Sheet, Spinner, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { confirmDialog, notify } from '@/lib/dialog';
import { dayLabel, iso, parseIso, timeLabel } from '@/lib/dates';
import { useLive } from '@/lib/live';
import { askAlwaysLocationOnce } from '@/lib/locationPermission';
import { bestLeg, planRoute, type Leg, type RouteSource } from '@/lib/route';
import { supabase } from '@/lib/supabase';
import { PERIOD_LABEL, useTheme } from '@/lib/theme';
import { startTracking, stopTracking, stopTrackingFor } from '@/lib/tracking';
import { apartmentExtra, type Pt } from '@/lib/trip';
import { arriveStop, isConfirmed, loadStops, type RunStop, type Trip } from '@/lib/tripOps';

type Direction = 'morning' | 'afternoon';
type Cand = {
  dog_id: string;
  dog_name: string;
  customer_id: string;
  station_id: string | null;
  station_label: string | null;
  lat: number | null;
  lng: number | null;
  handover: 'station' | 'apartment' | 'self';
  apartment_minutes: number;
};
type PlanStop = Pt & { station_id: string; label: string; dogs: Cand[]; extra: number };
type Point = Pt & { id: string; label: string; is_start: boolean; is_end: boolean };

const HERE = 'here';

export default function TripScreen() {
  const params = useLocalSearchParams<{ direction?: string; day?: string }>();
  const direction: Direction = params.direction === 'afternoon' ? 'afternoon' : 'morning';
  const today = iso(new Date());
  const day = params.day || today;
  const { session } = useAuth();

  const [trip, setTrip] = useState<Trip | null | undefined>(undefined);
  const [stops, setStops] = useState<RunStop[]>([]);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('trips').select('*').eq('day', day).eq('direction', direction).maybeSingle();
    if (error) return;
    const t = (data as Trip | null) ?? null;
    if (t) {
      const s = await loadStops(t.id);
      if (s) setStops(s);
    } else setStops([]);
    setTrip(t);
  }, [day, direction]);

  useLive(load, ['trips', 'trip_stops', 'trip_dogs'], 8000);

  const title = `${PERIOD_LABEL[direction]} ${dayLabel(parseIso(day))}`;

  if (trip === undefined) return <Spinner />;
  return (
    <>
      <Stack.Screen options={{ title }} />
      {trip?.state === 'running' ? (
        // Standort, Navigation und Weiterschalten gibt es nur auf dem Handy der Person, die faehrt
        trip.driver_id === session?.user.id ? (
          <Drive trip={trip} stops={stops} reload={load} />
        ) : (
          <Watch trip={trip} stops={stops} reload={load} />
        )
      ) : trip?.state === 'done' ? (
        <Done trip={trip} stops={stops} reload={load} />
      ) : (
        <Planning day={day} direction={direction} isToday={day === today} onStarted={load} />
      )}
    </>
  );
}

// ---------------------------------------------------------------- Planung

function Planning({ day, direction, isToday, onStarted }: { day: string; direction: Direction; isToday: boolean; onStarted: () => Promise<void> }) {
  const [points, setPoints] = useState<Point[]>([]);
  const [candidates, setCandidates] = useState<Cand[] | null>(null);
  const [startId, setStartId] = useState<string | null>(null);
  const [endId, setEndId] = useState<string | null>(null);
  const [here, setHere] = useState<Pt | null>(null);
  const [plan, setPlan] = useState<PlanStop[]>([]);
  const [etas, setEtas] = useState<Date[]>([]);
  const [source, setSource] = useState<RouteSource>('estimate');
  const [manual, setManual] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [busy, setBusy] = useState(false);
  const request = useRef(0);

  const load = useCallback(async () => {
    const [c, s] = await Promise.all([
      supabase.rpc('trip_candidates', { p_day: day, p_direction: direction }),
      supabase.from('stations').select('id, label, lat, lng, is_start, is_end').eq('archived', false).order('label'),
    ]);
    if (c.error) return notify('Fehler', c.error.message);
    setCandidates((prev) => {
      const next = (c.data as Cand[]) ?? [];
      return prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
    });
    setPoints((s.data as Point[]) ?? []);
  }, [day, direction]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const point = (id: string | null): (Pt & { label: string }) | null =>
    id === HERE ? (here ? { ...here, label: 'Aktueller Standort' } : null) : (points.find((p) => p.id === id) ?? null);
  const start = point(startId);
  const end = point(endId);

  // Stationen mit ihren Hunden. Selbstabholer und Hunde ohne Station sind nicht in der Route.
  const group = useCallback((): PlanStop[] => {
    const by = new Map<string, PlanStop>();
    for (const c of candidates ?? []) {
      if (c.handover === 'self' || !c.station_id || c.lat == null || c.lng == null) continue;
      const stop = by.get(c.station_id) ?? { station_id: c.station_id, label: c.station_label ?? '', lat: c.lat, lng: c.lng, dogs: [], extra: 0 };
      stop.dogs.push(c);
      stop.extra = apartmentExtra(stop.dogs);
      by.set(c.station_id, stop);
    }
    return [...by.values()];
  }, [candidates]);

  const calculate = useCallback(async (list: PlanStop[], from: Pt, to: Pt, optimize: boolean) => {
    const me = ++request.current;
    setCalculating(true);
    const r = await planRoute(from, to, list, optimize);
    if (me !== request.current) return;
    setPlan(r.ordered);
    setEtas(r.etas);
    setSource(r.source);
    setCalculating(false);
  }, []);

  // Sobald Start, Ziel und Hunde bekannt sind: beste Reihenfolge vorschlagen
  const startKey = start ? `${start.lat},${start.lng}` : '';
  const endKey = end ? `${end.lat},${end.lng}` : '';
  useEffect(() => {
    if (!start || !end || candidates === null) return;
    setManual(false);
    calculate(group(), start, end, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startKey, endKey, group, calculate]);

  async function chooseHere() {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return notify('Standort aus', 'Bitte den Standort erlauben oder einen gespeicherten Startpunkt wählen.');
    const p = await Location.getCurrentPositionAsync({});
    setHere({ lat: p.coords.latitude, lng: p.coords.longitude });
    setStartId(HERE);
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (!start || !end || j < 0 || j >= plan.length) return;
    const list = [...plan];
    [list[i], list[j]] = [list[j], list[i]];
    setPlan(list);
    setManual(true);
    calculate(list, start, end, false);
  }

  async function startTrip() {
    if (!start || !end) return;
    setBusy(true);
    // Zeiten ab jetzt rechnen, die Reihenfolge bleibt wie angezeigt
    const fresh = await planRoute(start, end, plan, false);
    const { error } = await supabase.rpc('start_trip', {
      p_day: day,
      p_direction: direction,
      p_start_label: start.label,
      p_start_lat: start.lat,
      p_start_lng: start.lng,
      p_end_label: end.label,
      p_end_lat: end.lat,
      p_end_lng: end.lng,
      p_stops: fresh.ordered.map((s, i) => ({
        station_id: s.station_id,
        eta: fresh.etas[i].toISOString(),
        dogs: s.dogs.map((d) => ({ dog_id: d.dog_id, handover: d.handover, apartment_minutes: d.apartment_minutes })),
      })),
    });
    if (error) notify('Start nicht möglich', error.message);
    await onStarted();
    setBusy(false);
  }

  if (candidates === null) return <Spinner />;
  const self = candidates.filter((c) => c.handover === 'self').map((c) => c.dog_name);
  const noStation = candidates.filter((c) => c.handover !== 'self' && !c.station_id).map((c) => c.dog_name);
  const starts = points.filter((p) => p.is_start);
  const ends = points.filter((p) => p.is_end);
  const sketch = [
    ...plan.map((s, i) => ({ lat: s.lat, lng: s.lng, label: s.label, number: i + 1 })),
    ...(end && plan.length ? [{ ...end, label: `Ziel: ${end.label}` }] : []),
  ];

  return (
    <Screen>
      <H2>Start</H2>
      <Row wrap>
        {starts.map((p) => (
          <Chip key={p.id} title={p.label} active={startId === p.id} onPress={() => setStartId(p.id)} />
        ))}
        <Chip title="Aktueller Standort" active={startId === HERE} onPress={chooseHere} />
      </Row>
      <H2>Ziel</H2>
      <Row wrap>
        {ends.map((p) => (
          <Chip key={p.id} title={p.label} active={endId === p.id} onPress={() => setEndId(p.id)} />
        ))}
      </Row>
      {(starts.length === 0 || ends.length === 0) && (
        <T muted>Markiere in den Einstellungen unter Stationen mindestens einen Startpunkt und einen Zielpunkt.</T>
      )}

      {(!start || !end) && <T muted>Wähle Start und Ziel, dann wird die Route vorgeschlagen.</T>}
      {start && end && (
        <>
          <H2>{manual ? 'Reihenfolge (von Hand)' : 'Vorgeschlagene Route'}</H2>
          <T small muted>
            {calculating
              ? 'Route wird berechnet.'
              : source === 'google'
                ? 'Berechnet mit aktuellen Verkehrsdaten.'
                : 'Näherung ohne Verkehrsdaten (Reihenfolge nach Entfernung, Zeiten geschätzt).'}
          </T>
          {plan.length > 0 && (
            <View style={{ height: 220, borderRadius: 12, overflow: 'hidden' }}>
              <RouteSketch stops={sketch} vehicle={start} />
            </View>
          )}
          {plan.length === 0 && !calculating && <T muted>Für diese Fahrt ist kein Hund an einer Station eingetragen.</T>}
          {plan.map((s, i) => (
            <Card key={s.station_id}>
              <Row>
                <Grow>
                  <T bold>
                    {i + 1}. {s.label}
                  </T>
                  <T small muted>
                    {s.dogs.map((d) => `${d.dog_name}${d.handover === 'apartment' ? ' (Wohnung)' : ''}`).join(', ')}
                  </T>
                  {etas[i] && !calculating && (
                    <T small muted>
                      Ankunft gegen {timeLabel(etas[i])} Uhr
                      {s.extra ? `, plus ${s.extra} Minuten für die Wohnung` : ''}
                    </T>
                  )}
                </Grow>
                <IconBtn icon="arrow-up" label={`${s.label} nach oben`} onPress={() => move(i, -1)} disabled={i === 0} />
                <IconBtn icon="arrow-down" label={`${s.label} nach unten`} onPress={() => move(i, 1)} disabled={i === plan.length - 1} />
              </Row>
            </Card>
          ))}
          {manual && (
            <Btn
              kind="ghost"
              title="Beste Reihenfolge neu vorschlagen"
              onPress={() => {
                setManual(false);
                calculate(group(), start, end, true);
              }}
            />
          )}
        </>
      )}
      {self.length > 0 && (
        <T small muted>
          Selbstabholung, nicht in der Route: {self.join(', ')}
        </T>
      )}
      {noStation.length > 0 && (
        <Card>
          <T bold>Ohne Station, nicht in der Route</T>
          <T>{noStation.join(', ')}</T>
          <T small muted>
            Station bei den festen Regeln des Hundes (Kunden) oder nur für diesen Tag in der Wochentabelle eintragen.
          </T>
        </Card>
      )}
      <Btn big title="Fahrt starten" icon="play" onPress={startTrip} busy={busy} disabled={!isToday || !start || !end || plan.length === 0 || calculating} />
      {!isToday && (
        <T small muted center>
          Starten geht erst am Fahrtag.
        </T>
      )}
    </Screen>
  );
}

// ---------------------------------------------------------------- Fahrt

type Offer = Leg & { saved: number };

function Drive({ trip, stops, reload }: { trip: Trip; stops: RunStop[]; reload: () => Promise<void> }) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const wide = width > height && width > 560;
  const map = useRef<DriveMapHandle>(null);
  const [vehicle, setVehicle] = useState<Pt | null>(trip.start_lat != null ? { lat: trip.start_lat, lng: trip.start_lng! } : null);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [offer, setOffer] = useState<Offer | null>(null);
  const [locationHint, setLocationHint] = useState('');
  const lastShift = useRef(0);

  const current = stops.find((s) => !s.arrived_at) ?? null;
  const currentRef = useRef(current);
  currentRef.current = current;
  const vehicleRef = useRef(vehicle);
  vehicleRef.current = vehicle;

  // Standort teilen (auch im Hintergrund), Display bleibt an, Querformat erlaubt
  useEffect(() => {
    startTracking(trip.id).then((r) => {
      if (r === 'denied') setLocationHint('Standort ist nicht erlaubt. Die Kunden sehen nur geschätzte Zeiten.');
      if (r === 'ok') askAlwaysLocationOnce();
    });
  }, [trip.id]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    activateKeepAwakeAsync('huta-fahrt').catch(() => {});
    ScreenOrientation.unlockAsync().catch(() => {});
    return () => {
      deactivateKeepAwake('huta-fahrt').catch(() => {});
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  // Eigene Position fuer Karte und Neuberechnung
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let sub: Location.LocationSubscription | undefined;
    let alive = true;
    Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 20, timeInterval: 5000 }, (p) =>
      setVehicle({ lat: p.coords.latitude, lng: p.coords.longitude }),
    )
      .then((s) => (alive ? (sub = s) : s.remove()))
      .catch(() => {});
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);

  // Ankunftszeit der naechsten Station weitergeben, wenn sie sich um mindestens eine Minute aendert
  const publishEta = useCallback(async (seconds: number) => {
    const stop = currentRef.current;
    if (!stop) return;
    const eta = Date.now() + seconds * 1000;
    if (Math.abs(eta - new Date(stop.eta).getTime()) < 60_000 || Date.now() - lastShift.current < 20_000) return;
    lastShift.current = Date.now();
    await supabase.rpc('shift_etas', { p_stop: stop.id, p_eta: new Date(eta).toISOString() });
  }, []);

  // Laufend die Strecke zum naechsten Stopp pruefen
  const stopId = current?.id;
  useEffect(() => {
    setOffer(null);
    if (!stopId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    let seconds = 120;
    let ask = 1;
    let auto = 4;
    const check = async () => {
      const stop = currentRef.current;
      const from = vehicleRef.current;
      if (stop?.stations && from) {
        const remaining = await map.current?.remainingSeconds();
        const leg = await bestLeg(from, stop.stations);
        if (!alive) return;
        if (remaining != null && leg.routeToken) {
          const saved = Math.round((remaining - leg.seconds) / 60);
          if (saved >= auto) {
            if (await map.current?.applyRoute(leg.routeToken)) {
              setNotice(`Bessere Strecke gewählt, etwa ${saved} Minuten schneller.`);
              await publishEta(leg.seconds);
            }
          } else if (saved >= ask) {
            setOffer({ ...leg, saved });
          } else setOffer(null);
        } else if (remaining == null && Platform.OS !== 'web') {
          // ohne Navigation wenigstens die Ankunftszeit aktuell halten
          await publishEta(leg.seconds);
        }
      }
      if (alive) timer = setTimeout(check, seconds * 1000);
    };
    (async () => {
      const { data } = await supabase.from('app_settings').select('key, value').like('key', 'reroute_%');
      const get = (k: string, d: number) => Number(data?.find((x) => x.key === k)?.value) || d;
      seconds = Math.max(30, get('reroute_check_seconds', 120));
      ask = Math.max(1, get('reroute_ask_minutes', 1));
      auto = Math.max(ask, get('reroute_auto_minutes', 4));
      if (alive) timer = setTimeout(check, seconds * 1000);
    })();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [stopId, publishEta]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 12_000);
    return () => clearTimeout(t);
  }, [notice]);

  // Neuer Wohnungs-Wunsch waehrend der Fahrt: kurz hinweisen
  const requests = stops.flatMap((s) => s.trip_dogs.filter((d) => d.apartment_requested_at && !s.arrived_at).map((d) => `${d.dogs?.name} (${s.stations?.label})`));
  const known = useRef<string | null>(null);
  const requestKey = requests.join(', ');
  useEffect(() => {
    if (known.current !== null) {
      const fresh = requests.filter((r) => !known.current!.includes(r));
      if (fresh.length) setNotice(`In die Wohnung bringen: ${fresh.join(', ')}`);
    }
    known.current = requestKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  async function next() {
    if (!current) return;
    setBusy(true);
    try {
      if (await arriveStop(trip.id, current)) await stopTracking();
      await reload();
    } catch (e) {
      notify('Das hat nicht geklappt', e instanceof Error ? e.message : 'Bitte noch einmal tippen.');
    } finally {
      setBusy(false);
    }
  }

  async function accept() {
    if (!offer?.routeToken) return;
    if (await map.current?.applyRoute(offer.routeToken)) await publishEta(offer.seconds);
    else notify('Wechsel nicht möglich', 'Die Navigation bleibt auf der bisherigen Strecke.');
    setOffer(null);
  }

  async function end() {
    setMenu(false);
    const { error } = await supabase.rpc('finish_trip', { p_trip: trip.id });
    if (error) return notify('Fehler', error.message);
    await stopTracking();
    await reload();
  }

  const dogs = current?.trip_dogs ?? [];
  const confirmed = dogs.filter(isConfirmed).length;
  const apartment = dogs.filter((d) => d.handover === 'apartment').length;
  const last = !!current && stops.filter((s) => !s.arrived_at).length === 1;
  const target = current?.stations ? { id: current.id, ...current.stations } : null;
  const sketch = stops.map((s, i) => ({
    lat: s.stations?.lat ?? 0,
    lng: s.stations?.lng ?? 0,
    label: s.stations?.label ?? '',
    number: i + 1,
    done: !!s.arrived_at,
    current: s.id === current?.id,
  }));

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.bg, flexDirection: wide ? 'row' : 'column' }}>
      <View style={{ flex: 1 }}>
        <DriveMap ref={map} target={target} stops={sketch} vehicle={vehicle} onRemaining={publishEta} />
      </View>
      <View style={{ padding: 12, gap: 8, width: wide ? 340 : undefined, backgroundColor: colors.card, justifyContent: 'flex-end' }}>
        {notice !== '' && (
          <View style={{ backgroundColor: colors.primarySoft, borderRadius: 8, padding: 10 }}>
            <T bold>{notice}</T>
          </View>
        )}
        {offer && (
          <View style={{ backgroundColor: colors.primarySoft, borderRadius: 8, padding: 10, gap: 8 }}>
            <T bold>
              Andere Strecke ist {offer.saved} {offer.saved === 1 ? 'Minute' : 'Minuten'} schneller. Wechseln?
            </T>
            <Row>
              <Grow>
                <Btn title="Wechseln" onPress={accept} />
              </Grow>
              <Grow>
                <Btn kind="ghost" title="Bleiben" onPress={() => setOffer(null)} />
              </Grow>
            </Row>
          </View>
        )}
        {locationHint !== '' && <T small muted>{locationHint}</T>}
        {current ? (
          <>
            <Row>
              <Grow>
                <H2>{current.stations?.label}</H2>
                <T bold>
                  {dogs.length} {dogs.length === 1 ? 'Hund' : 'Hunde'}, {confirmed} bestätigt
                  {apartment ? `, ${apartment} in die Wohnung` : ''}
                </T>
                <T small muted>
                  {dogs.map((d) => `${d.dogs?.name}${d.handover === 'apartment' ? ' (Wohnung)' : d.thumb_at ? ' (bestätigt)' : ''}`).join(', ')}
                </T>
              </Grow>
              <View style={{ alignItems: 'flex-end' }}>
                <T small muted>
                  Ankunft
                </T>
                <H2>{timeLabel(current.eta)}</H2>
              </View>
              <IconBtn icon="menu" label="Alle Stopps und Fahrt beenden" onPress={() => setMenu(true)} />
            </Row>
            <Btn big title={last ? 'Übergeben, Fahrt beenden' : 'Nächster Stopp'} icon="checkmark" onPress={next} busy={busy} />
          </>
        ) : (
          <Btn big title="Fahrt beenden" onPress={end} />
        )}
      </View>

      <Sheet visible={menu} onClose={() => setMenu(false)} title="Alle Stopps">
        <StopList stops={stops} />
        <Btn
          kind="danger"
          title="Fahrt abbrechen"
          onPress={() => confirmDialog('Fahrt beenden?', 'Der Countdown bei den Kunden verschwindet.', 'Beenden', end, true)}
        />
      </Sheet>
    </SafeAreaView>
  );
}

function StopList({ stops }: { stops: RunStop[] }) {
  return (
    <>
      {stops.map((s, i) => (
        <Card key={s.id} style={{ opacity: s.arrived_at ? 0.55 : 1 }}>
          <Row>
            <Grow>
              <T bold>
                {i + 1}. {s.stations?.label}
              </T>
              <T small muted>
                {s.trip_dogs.map((d) => `${d.dogs?.name}${d.handover === 'apartment' ? ' (Wohnung)' : d.thumb_at ? ' (bestätigt)' : ''}`).join(', ')}
              </T>
            </Grow>
            <T small muted>
              {s.arrived_at ? `erledigt ${timeLabel(s.arrived_at)}` : `gegen ${timeLabel(s.eta)}`}
            </T>
          </Row>
        </Card>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- Zuschauen (jemand anderes faehrt)

function Watch({ trip, stops, reload }: { trip: Trip; stops: RunStop[]; reload: () => Promise<void> }) {
  const { session } = useAuth();
  const [driver, setDriver] = useState('');

  useEffect(() => {
    stopTrackingFor(trip.id);
    if (!trip.driver_id) return;
    supabase
      .from('profiles')
      .select('name, email')
      .eq('id', trip.driver_id)
      .maybeSingle()
      .then(({ data }) => setDriver(data?.name || data?.email || ''));
  }, [trip.id, trip.driver_id]);

  return (
    <Screen>
      <H2>Die Fahrt läuft</H2>
      <T muted>{driver ? `${driver} fährt gerade.` : 'Gerade fährt jemand anderes.'} Du siehst hier den Stand mit.</T>
      <Btn
        kind="secondary"
        title="Fahrt auf diesem Handy übernehmen"
        onPress={() =>
          confirmDialog('Fahrt übernehmen?', 'Dann teilt dieses Handy den Standort und führt die Navigation.', 'Übernehmen', async () => {
            const { error } = await supabase.from('trips').update({ driver_id: session!.user.id }).eq('id', trip.id);
            if (error) notify('Fehler', error.message);
            reload();
          })
        }
      />
      <StopList stops={stops} />
    </Screen>
  );
}

// ---------------------------------------------------------------- Beendet

function Done({ trip, stops, reload }: { trip: Trip; stops: RunStop[]; reload: () => Promise<void> }) {
  const router = useRouter();
  const today = iso(new Date());
  const [toEnd, setToEnd] = useState(false);

  useEffect(() => {
    stopTrackingFor(trip.id);
  }, [trip.id]);

  if (toEnd && trip.end_lat != null) {
    const end = { id: 'end', lat: trip.end_lat, lng: trip.end_lng!, label: trip.end_label ?? 'Ziel' };
    return (
      <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <DriveMap target={end} stops={[{ ...end, current: true }]} vehicle={null} />
        </View>
        <View style={{ padding: 12 }}>
          <Btn big title="Angekommen" onPress={() => setToEnd(false)} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <Screen>
      <H2>Die Fahrt ist beendet</H2>
      {trip.end_label && trip.day === today && <Btn title={`Zum Ziel navigieren: ${trip.end_label}`} icon="navigate" onPress={() => setToEnd(true)} />}
      {trip.direction === 'morning' && (
        <Btn kind="secondary" title="Weiter zur Nachmittagsfahrt" onPress={() => router.replace(`/trip?direction=afternoon&day=${trip.day}`)} />
      )}
      <Btn kind="ghost" title="Zur Tagesliste" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <StopList stops={stops} />
      {trip.day === today && (
        <Btn
          kind="ghost"
          title="Diese Fahrt neu planen"
          onPress={() =>
            confirmDialog('Fahrt neu planen?', 'Die beendete Fahrt wird verworfen, damit du sie neu starten kannst.', 'Neu planen', async () => {
              await supabase.from('trips').delete().eq('id', trip.id);
              reload();
            })
          }
        />
      )}
    </Screen>
  );
}
