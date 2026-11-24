import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Platform, View } from 'react-native';
import * as Location from 'expo-location';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Btn, Card, Chip, H2, Row, Screen, Spinner, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, HANDOVER_LABEL } from '@/lib/theme';
import { dayLabel, iso, timeLabel } from '@/lib/dates';
import { computeEtas, orderStops, type Pt } from '@/lib/trip';

type Direction = 'morning' | 'afternoon';
type Cand = { dog_id: string; dog_name: string; station_id: string | null; station_label: string | null; lat: number | null; lng: number | null; handover: string };

type PlanStop = Pt & { station_id: string; label: string; dogs: { dog_id: string; name: string; handover: 'station' | 'apartment' }[]; extra: number };

type RunDog = { id: string; dog_id: string; handover: string; thumb_at: string | null; apartment_requested_at: string | null; sick: boolean; dogs: { name: string } | null };
type RunStop = { id: string; position: number; eta: string; arrived_at: string | null; extra_minutes: number; stations: { label: string; lat: number; lng: number } | null; trip_dogs: RunDog[] };
type Trip = { id: string; state: string; start_label: string | null; start_lat: number | null; start_lng: number | null };

const HUTA: Pt & { label: string } = { label: 'Huta (Halsbrücke)', lat: 50.9785012, lng: 13.4082957 };
const STARTS: (Pt & { label: string })[] = [
  { label: 'Tolkewitzer Straße 70', lat: 51.0349783, lng: 13.8227082 },
  HUTA,
];

export default function TripScreen() {
  const { direction: dirParam } = useLocalSearchParams<{ direction?: string }>();
  const direction: Direction = dirParam === 'afternoon' ? 'afternoon' : 'morning';
  const router = useRouter();
  const { session } = useAuth();
  const today = iso(new Date());

  const [loading, setLoading] = useState(true);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [stops, setStops] = useState<RunStop[]>([]);
  const [selfDogs, setSelfDogs] = useState<string[]>([]);
  const [start, setStart] = useState<(Pt & { label: string }) | null>(null);
  const [plan, setPlan] = useState<PlanStop[]>([]);
  const [extraMin, setExtraMin] = useState(5);
  const [busy, setBusy] = useState(false);
  const watcher = useRef<Location.LocationSubscription | null>(null);
  const lastSent = useRef(0);

  const loadRun = useCallback(async () => {
    const { data: t } = await supabase.from('trips').select('*').eq('day', today).eq('direction', direction).maybeSingle();
    setTrip((t as Trip) ?? null);
    if (t && t.state !== 'planned') {
      const { data: s } = await supabase
        .from('trip_stops')
        .select('id, position, eta, arrived_at, extra_minutes, stations(label, lat, lng), trip_dogs(id, dog_id, handover, thumb_at, apartment_requested_at, sick, dogs(name))')
        .eq('trip_id', t.id)
        .order('position');
      setStops((s as unknown as RunStop[]) ?? []);
    } else setStops([]);
    setLoading(false);
  }, [today, direction]);

  const loadPlan = useCallback(async () => {
    const [{ data: c }, { data: set }] = await Promise.all([
      supabase.rpc('trip_candidates', { p_day: today, p_direction: direction }),
      supabase.from('app_settings').select('value').eq('key', 'apartment_extra_minutes').maybeSingle(),
    ]);
    const em = Number(set?.value ?? 5) || 5;
    setExtraMin(em);
    const rows = (c as Cand[]) ?? [];
    setSelfDogs(rows.filter((r) => r.handover === 'self' || !r.station_id).map((r) => r.dog_name));
    const by = new Map<string, PlanStop>();
    for (const r of rows) {
      if (r.handover === 'self' || !r.station_id || r.lat == null || r.lng == null) continue;
      const st = by.get(r.station_id) ?? { station_id: r.station_id, label: r.station_label ?? '', lat: r.lat, lng: r.lng, dogs: [], extra: 0 };
      const h = r.handover === 'apartment' ? 'apartment' : 'station';
      st.dogs.push({ dog_id: r.dog_id, name: r.dog_name, handover: h });
      if (h === 'apartment') st.extra = em;
      by.set(r.station_id, st);
    }
    setPlan([...by.values()]);
  }, [today, direction]);

  useFocusEffect(
    useCallback(() => {
      loadRun();
      loadPlan();
      const t = setInterval(loadRun, 8000);
      return () => clearInterval(t);
    }, [loadRun, loadPlan]),
  );

  // Live-Standort nur waehrend die Fahrt laeuft
  useEffect(() => {
    if (trip?.state !== 'running') return;
    let cancelled = false;
    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted' || cancelled) return;
      watcher.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 30 },
        (pos) => {
          if (Date.now() - lastSent.current < 10000) return;
          lastSent.current = Date.now();
          supabase.from('trip_location').upsert({ trip_id: trip.id, lat: pos.coords.latitude, lng: pos.coords.longitude, updated_at: new Date().toISOString() });
        },
      );
    })();
    return () => {
      cancelled = true;
      watcher.current?.remove();
      watcher.current = null;
    };
  }, [trip?.id, trip?.state]);

  async function pickCurrentLocation() {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return Alert.alert('Standort aus', 'Bitte Standort erlauben oder einen festen Startpunkt wählen.');
    const p = await Location.getCurrentPositionAsync({});
    setStart({ label: 'Aktueller Standort', lat: p.coords.latitude, lng: p.coords.longitude });
  }

  const ordered = start ? orderStops(start, plan) : plan;
  const etas = start ? computeEtas(start, ordered, new Date()) : [];

  function move(i: number, dir: -1 | 1) {
    const list = [...ordered];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setPlan(list);
    // Reihenfolge fixieren: Start-Sortierung nicht mehr automatisch anwenden
    setStart((s) => (s ? { ...s } : s));
    manual.current = true;
  }
  const manual = useRef(false);
  const shown = manual.current ? plan : ordered;
  const shownEtas = start ? computeEtas(start, shown, new Date()) : [];

  async function startTrip() {
    if (!start || !session) return;
    setBusy(true);
    try {
      await supabase.from('trips').delete().eq('day', today).eq('direction', direction);
      const { data: t, error } = await supabase
        .from('trips')
        .insert({ day: today, direction, driver_id: session.user.id, start_label: start.label, start_lat: start.lat, start_lng: start.lng, state: 'running', started_at: new Date().toISOString() })
        .select('*')
        .single();
      if (error || !t) throw error ?? new Error('Fahrt konnte nicht angelegt werden');
      for (let i = 0; i < shown.length; i++) {
        const s = shown[i];
        const { data: row, error: e2 } = await supabase
          .from('trip_stops')
          .insert({ trip_id: t.id, station_id: s.station_id, position: i, eta: shownEtas[i].toISOString(), extra_minutes: s.extra })
          .select('id')
          .single();
        if (e2 || !row) throw e2 ?? new Error('Station konnte nicht angelegt werden');
        const { error: e3 } = await supabase.from('trip_dogs').insert(s.dogs.map((d) => ({ stop_id: row.id, dog_id: d.dog_id, handover: d.handover })));
        if (e3) throw e3;
      }
      manual.current = false;
      await loadRun();
    } catch (e) {
      Alert.alert('Start nicht möglich', e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setBusy(false);
    }
  }

  async function recompute(from: Pt, list: RunStop[], at: Date) {
    const open = list.filter((s) => !s.arrived_at && s.stations);
    const pts = open.map((s) => ({ lat: s.stations!.lat, lng: s.stations!.lng, extra: s.extra_minutes }));
    const e = computeEtas(from, pts, at);
    await Promise.all(open.map((s, i) => supabase.from('trip_stops').update({ eta: e[i].toISOString() }).eq('id', s.id)));
  }

  async function nextStop() {
    const cur = stops.find((s) => !s.arrived_at);
    if (!cur || !cur.stations) return;
    setBusy(true);
    const now = new Date();
    await supabase.from('trip_stops').update({ arrived_at: now.toISOString() }).eq('id', cur.id);
    const rest = stops.map((s) => (s.id === cur.id ? { ...s, arrived_at: now.toISOString() } : s));
    await recompute(cur.stations, rest, new Date(now.getTime() + (2 + cur.extra_minutes) * 60000));
    setBusy(false);
    loadRun();
  }

  async function adoptApartment(stop: RunStop, dog: RunDog) {
    await supabase.from('trip_dogs').update({ handover: 'apartment' }).eq('id', dog.id);
    const extra = stop.extra_minutes || extraMin;
    await supabase.from('trip_stops').update({ extra_minutes: extra }).eq('id', stop.id);
    const updated = stops.map((s) => (s.id === stop.id ? { ...s, extra_minutes: extra } : s));
    const done = [...updated].filter((s) => s.arrived_at && s.stations).pop();
    const from = done?.stations ?? (trip?.start_lat != null ? { lat: trip.start_lat, lng: trip.start_lng! } : null);
    if (from) await recompute(from, updated, new Date());
    loadRun();
  }

  async function endTrip() {
    if (!trip) return;
    await supabase.from('trips').update({ state: 'done', ended_at: new Date().toISOString() }).eq('id', trip.id);
    await supabase.from('trip_location').delete().eq('trip_id', trip.id);
    loadRun();
  }

  function openMaps(p: Pt) {
    const url = Platform.OS === 'ios' ? `http://maps.apple.com/?daddr=${p.lat},${p.lng}&dirflg=d` : `google.navigation:q=${p.lat},${p.lng}`;
    Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`));
  }

  if (loading) return <Spinner />;

  const title = `${direction === 'morning' ? 'Morgens einsammeln' : 'Nachmittags zurückbringen'} · ${dayLabel(new Date())}`;

  // ---------- Laufende oder beendete Fahrt ----------
  if (trip && trip.state !== 'planned') {
    const current = stops.find((s) => !s.arrived_at);
    const finished = trip.state === 'done' || !current;
    const hints = stops.flatMap((s) => s.trip_dogs.filter((d) => d.apartment_requested_at && d.handover !== 'apartment' && !s.arrived_at).map((d) => ({ s, d })));
    const sick = stops.flatMap((s) => s.trip_dogs.filter((d) => d.sick).map((d) => d.dogs?.name));
    return (
      <Screen>
        <H2>{title}</H2>
        {trip.state === 'done' && <T bold>Fahrt beendet.</T>}
        {hints.map(({ s, d }) => (
          <Card key={d.id} style={{ borderColor: colors.primary, borderWidth: 2 }}>
            <T bold>
              Wohnungs-Wunsch: {d.dogs?.name} ({s.stations?.label})
            </T>
            <Btn title={`Übernehmen (+${s.extra_minutes || extraMin} Min)`} onPress={() => adoptApartment(s, d)} />
          </Card>
        ))}
        {sick.length > 0 && <T color={colors.red} bold>Krank gemeldet: {sick.join(', ')}</T>}

        {!finished && current && (
          <Card style={{ borderColor: colors.primary, borderWidth: 2 }}>
            <T small muted>
              Nächster Stopp · ca. {timeLabel(current.eta)} Uhr
            </T>
            <H2>{current.stations?.label}</H2>
            {current.trip_dogs.map((d) => (
              <Row key={d.id}>
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: d.sick ? colors.red : d.thumb_at ? colors.green : colors.muted }} />
                <T bold>{d.dogs?.name}</T>
                <T small muted>
                  {d.sick ? 'krank' : d.thumb_at ? 'Daumen' : 'noch nicht bestätigt'}
                  {d.handover === 'apartment' ? ' · Wohnung' : ''}
                </T>
              </Row>
            ))}
            {current.stations && <Btn kind="dark" title="Navigation starten" onPress={() => openMaps(current.stations!)} />}
            <Btn title="Nächster Stopp (Hunde sind da)" onPress={nextStop} busy={busy} />
          </Card>
        )}

        <H2>Alle Stopps</H2>
        {stops.map((s) => (
          <Card key={s.id} style={{ opacity: s.arrived_at ? 0.5 : 1 }}>
            <Row>
              <T bold>
                {s.position + 1}. {s.stations?.label}
              </T>
              <T small muted>
                {s.arrived_at ? `erledigt ${timeLabel(s.arrived_at)}` : `ca. ${timeLabel(s.eta)}`}
              </T>
            </Row>
            <T small muted>
              {s.trip_dogs.map((d) => `${d.dogs?.name}${d.thumb_at ? ' ✓' : ''}`).join(', ')}
            </T>
          </Card>
        ))}
        {trip.state === 'running' && <Btn kind="danger" title="Fahrt beenden (Notfall oder fertig)" onPress={() =>
          Alert.alert('Fahrt beenden?', 'Der Countdown bei den Kunden verschwindet.', [
            { text: 'Abbrechen', style: 'cancel' },
            { text: 'Beenden', style: 'destructive', onPress: endTrip },
          ])} />}
        {trip.state === 'done' && <Btn kind="ghost" title="Zurück" onPress={() => router.back()} />}
      </Screen>
    );
  }

  // ---------- Planung ----------
  return (
    <Screen>
      <H2>{title}</H2>
      <T bold>Startpunkt</T>
      <Row wrap>
        {STARTS.map((s) => (
          <Chip key={s.label} title={s.label} active={start?.label === s.label} onPress={() => { manual.current = false; setStart(s); }} />
        ))}
        <Chip title="Aktueller Standort" active={start?.label === 'Aktueller Standort'} onPress={() => { manual.current = false; pickCurrentLocation(); }} />
      </Row>
      <T small muted>
        Die Reihenfolge ist ein Vorschlag nach Entfernung, ohne Verkehrsdaten. Du kannst sie mit den Pfeilen ändern.
      </T>

      {shown.length === 0 && <T muted>Heute keine Hunde für die Route angemeldet.</T>}
      {shown.map((s, i) => (
        <Card key={s.station_id}>
          <Row>
            <View style={{ flex: 1 }}>
              <T bold>
                {i + 1}. {s.label}
              </T>
              <T small muted>
                {s.dogs.map((d) => `${d.name}${d.handover === 'apartment' ? ' (Wohnung)' : ''}`).join(', ')}
              </T>
              {start && <T small muted>ca. {timeLabel(shownEtas[i].toISOString())} Uhr</T>}
            </View>
            <Chip title="▲" onPress={() => move(i, -1)} />
            <Chip title="▼" onPress={() => move(i, 1)} />
          </Row>
        </Card>
      ))}
      {selfDogs.length > 0 && <T small muted>Selbstbringer (nicht in der Route): {selfDogs.join(', ')}</T>}
      <T small muted>
        {HANDOVER_LABEL.station}: Hunde warten an der Station.
      </T>
      <Btn title="Fahrt starten" onPress={startTrip} busy={busy} disabled={!start || shown.length === 0} />
    </Screen>
  );
}
