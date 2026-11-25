import { useCallback, useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Btn, Card, Chip, H2, Row, Screen, Spinner, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { confirmDialog, notify } from '@/lib/dialog';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { dayLabel, iso, timeLabel } from '@/lib/dates';
import { computeEtas, orderStops, type Pt } from '@/lib/trip';
import { arriveCurrentStop, currentOrigin, recomputeEtas } from '@/lib/tripOps';
import { startTracking, stopTracking } from '@/lib/tracking';
import { askAlwaysLocationOnce } from '@/lib/locationPermission';
import { openMaps } from '@/lib/maps';

type Direction = 'morning' | 'afternoon';
type Cand = { dog_id: string; dog_name: string; station_id: string | null; station_label: string | null; lat: number | null; lng: number | null; handover: string };
type PlanStop = Pt & { station_id: string; label: string; dogs: { dog_id: string; name: string; handover: 'station' | 'apartment' }[]; extra: number };
type RunDog = { id: string; dog_id: string; handover: string; thumb_at: string | null; apartment_requested_at: string | null; sick: boolean; dogs: { name: string } | null };
type RunStop = { id: string; position: number; eta: string; arrived_at: string | null; extra_minutes: number; stations: { label: string; lat: number; lng: number } | null; trip_dogs: RunDog[] };
type Trip = { id: string; state: string; start_label: string | null; start_lat: number | null; start_lng: number | null };
type Start = Pt & { label: string };

const HUTA: Start = { label: 'Huta (Halsbrücke)', lat: 50.9785012, lng: 13.4082957 };
const STARTS: Start[] = [{ label: 'Tolkewitzer Straße 70', lat: 51.0349783, lng: 13.8227082 }, HUTA];
const DWELL_MIN = 2;

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
  const [start, setStart] = useState<Start | null>(null);
  const [candidates, setCandidates] = useState<PlanStop[]>([]);
  const [planList, setPlanList] = useState<PlanStop[]>([]);
  const [etaList, setEtaList] = useState<Date[]>([]);
  const [source, setSource] = useState<'google' | 'estimate'>('estimate');
  const [extraMin, setExtraMin] = useState(5);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');

  const loadRun = useCallback(async () => {
    const { data: t } = await supabase.from('trips').select('*').eq('day', today).eq('direction', direction).maybeSingle();
    setTrip((t as Trip) ?? null);
    if (t && t.state !== 'planned') {
      const { data: s } = await supabase
        .from('trip_stops')
        .select('id, position, eta, arrived_at, extra_minutes, stations(label, lat, lng), trip_dogs(id, dog_id, handover, thumb_at, apartment_requested_at, sick, dogs(name))')
        .eq('trip_id', t.id)
        .order('position');
      const list = (s as unknown as RunStop[]) ?? [];
      setStops(list);
      // Alles erledigt (oder nur noch Stationen ohne gesunden Hund): Fahrt automatisch beenden
      if (t.state === 'running' && list.length > 0 && list.every((x) => x.arrived_at || !x.trip_dogs.some((d) => !d.sick))) {
        await supabase.from('trips').update({ state: 'done', ended_at: new Date().toISOString() }).eq('id', t.id);
        await supabase.from('trip_location').delete().eq('trip_id', t.id);
        await stopTracking();
        setTrip({ ...(t as Trip), state: 'done' });
      }
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
    setCandidates([...by.values()]);
  }, [today, direction]);

  useFocusEffect(
    useCallback(() => {
      loadRun();
      loadPlan();
      const t = setInterval(loadRun, 8000);
      return () => clearInterval(t);
    }, [loadRun, loadPlan]),
  );

  // Standort teilen, solange die Fahrt laeuft (auch im Hintergrund)
  useEffect(() => {
    if (trip?.state === 'running') {
      startTracking(trip.id).then((r) => {
        if (r === 'denied') setInfo('Standort ist nicht erlaubt. Die Kunden sehen dann nur die geschätzten Zeiten.');
        if (r === 'ok') askAlwaysLocationOnce();
      });
    } else if (trip?.state === 'done') {
      stopTracking();
    }
  }, [trip?.id, trip?.state]);

  // Display bleibt waehrend der Fahrt an
  useEffect(() => {
    if (Platform.OS === 'web' || trip?.state !== 'running') return;
    activateKeepAwakeAsync('huta-fahrt').catch(() => {});
    return () => {
      deactivateKeepAwake('huta-fahrt').catch(() => {});
    };
  }, [trip?.state]);

  // Reihenfolge und Zeiten berechnen: mit Verkehrsdaten (Google), sonst Naeherung
  const recalc = useCallback(
    async (list: PlanStop[], from: Start, optimize: boolean) => {
      if (list.length === 0) {
        setPlanList([]);
        setEtaList([]);
        return;
      }
      const end = direction === 'morning' ? HUTA : from;
      try {
        const { data, error } = await supabase.functions.invoke('plan-route', {
          body: { start: { lat: from.lat, lng: from.lng }, end: { lat: end.lat, lng: end.lng }, stops: list.map((s) => ({ lat: s.lat, lng: s.lng })), optimize },
        });
        if (!error && data?.available) {
          const ordered: PlanStop[] = (data.order as number[]).map((i) => list[i]);
          const legs = data.legSeconds as number[];
          let t = Date.now();
          const etas = ordered.map((s, i) => {
            t += (legs[i] ?? 0) * 1000;
            const eta = new Date(t);
            t += (DWELL_MIN + s.extra) * 60000;
            return eta;
          });
          setPlanList(ordered);
          setEtaList(etas);
          setSource('google');
          return;
        }
      } catch {
        /* Rueckfall unten */
      }
      const ordered = optimize ? orderStops(from, list) : list;
      setPlanList(ordered);
      setEtaList(computeEtas(from, ordered, new Date()));
      setSource('estimate');
    },
    [direction],
  );

  async function chooseStart(s: Start) {
    setStart(s);
    await recalc(candidates, s, true);
  }

  async function pickCurrentLocation() {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return notify('Standort aus', 'Bitte Standort erlauben oder einen festen Startpunkt wählen.');
    const p = await Location.getCurrentPositionAsync({});
    await chooseStart({ label: 'Aktueller Standort', lat: p.coords.latitude, lng: p.coords.longitude });
  }

  async function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (!start || j < 0 || j >= planList.length) return;
    const list = [...planList];
    [list[i], list[j]] = [list[j], list[i]];
    await recalc(list, start, false);
  }

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
      for (let i = 0; i < planList.length; i++) {
        const s = planList[i];
        const { data: row, error: e2 } = await supabase
          .from('trip_stops')
          .insert({ trip_id: t.id, station_id: s.station_id, position: i, eta: etaList[i].toISOString(), extra_minutes: s.extra })
          .select('id')
          .single();
        if (e2 || !row) throw e2 ?? new Error('Station konnte nicht angelegt werden');
        const { error: e3 } = await supabase.from('trip_dogs').insert(s.dogs.map((d) => ({ stop_id: row.id, dog_id: d.dog_id, handover: d.handover })));
        if (e3) throw e3;
      }
      await supabase.rpc('trip_started', { p_trip: t.id });
      await loadRun();
    } catch (e) {
      notify('Start nicht möglich', e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setBusy(false);
    }
  }

  async function nextStop() {
    if (!trip) return;
    setBusy(true);
    await arriveCurrentStop(trip.id);
    setBusy(false);
    loadRun();
  }

  async function adoptApartment(stop: RunStop, dog: RunDog) {
    if (!trip) return;
    await supabase.from('trip_dogs').update({ handover: 'apartment' }).eq('id', dog.id);
    await supabase.from('trip_stops').update({ extra_minutes: stop.extra_minutes || extraMin }).eq('id', stop.id);
    const from = await currentOrigin(trip.id);
    if (from) await recomputeEtas(trip.id, from, new Date());
    loadRun();
  }

  async function remind() {
    if (!trip) return;
    const { data, error } = await supabase.rpc('remind_laggards', { p_trip: trip.id });
    setInfo(error ? error.message : `Erinnerung an ${data ?? 0} Kunden gesendet.`);
  }

  async function endTrip() {
    if (!trip) return;
    await supabase.from('trips').update({ state: 'done', ended_at: new Date().toISOString() }).eq('id', trip.id);
    await supabase.from('trip_location').delete().eq('trip_id', trip.id);
    await stopTracking();
    loadRun();
  }

  if (loading) return <Spinner />;

  const title = `${direction === 'morning' ? 'Morgens einsammeln' : 'Nachmittags zurückbringen'} · ${dayLabel(new Date())}`;

  // ---------- Laufende oder beendete Fahrt ----------
  if (trip && trip.state !== 'planned') {
    const active = (s: RunStop) => s.trip_dogs.some((d) => !d.sick);
    const current = stops.find((s) => !s.arrived_at && active(s));
    const finished = trip.state === 'done' || !current;
    const hints = stops.flatMap((s) => s.trip_dogs.filter((d) => d.apartment_requested_at && d.handover !== 'apartment' && !s.arrived_at).map((d) => ({ s, d })));
    const sick = stops.flatMap((s) => s.trip_dogs.filter((d) => d.sick).map((d) => d.dogs?.name));
    const missing = stops.flatMap((s) => (s.arrived_at ? [] : s.trip_dogs.filter((d) => !d.thumb_at && !d.sick)));
    return (
      <Screen>
        <H2>{title}</H2>
        {trip.state === 'done' && <T bold>Alle Stopps erledigt. Die Fahrt ist beendet.</T>}
        {info !== '' && <T small muted>{info}</T>}
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
            {current.stations && (
              <>
                <Btn
                  kind="dark"
                  title="Navigation starten"
                  onPress={() =>
                    router.push({
                      pathname: '/navigate',
                      params: { lat: String(current.stations!.lat), lng: String(current.stations!.lng), label: current.stations!.label },
                    })
                  }
                />
                <Btn kind="ghost" title="In Karten-App öffnen" onPress={() => openMaps(current.stations!)} />
              </>
            )}
            <Btn title="Nächster Stopp (Hunde sind da)" onPress={nextStop} busy={busy} />
            <T small muted>
              Der Stopp wird auch automatisch erkannt, wenn du kurz an der Station hältst.
            </T>
          </Card>
        )}

        {trip.state === 'running' && missing.length > 0 && (
          <Btn kind="ghost" title={`Nachzügler erinnern (${missing.length})`} onPress={remind} />
        )}

        <H2>Alle Stopps</H2>
        {stops.map((s) => (
          <Card key={s.id} style={{ opacity: s.arrived_at || !active(s) ? 0.5 : 1 }}>
            <Row>
              <T bold>
                {s.position + 1}. {s.stations?.label}
              </T>
              <T small muted>
                {s.arrived_at ? `erledigt ${timeLabel(s.arrived_at)}` : !active(s) ? 'entfällt (krank)' : `ca. ${timeLabel(s.eta)}`}
              </T>
            </Row>
            <T small muted>
              {s.trip_dogs.map((d) => `${d.dogs?.name}${d.sick ? ' (krank)' : ''}${d.thumb_at ? ' ✓' : ''}${d.handover === 'apartment' ? ' (Wohnung)' : ''}`).join(', ')}
            </T>
          </Card>
        ))}
        {trip.state === 'running' && (
          <Btn
            kind="danger"
            title="Fahrt beenden (Notfall oder fertig)"
            onPress={() => confirmDialog('Fahrt beenden?', 'Der Countdown bei den Kunden verschwindet.', 'Beenden', endTrip, true)}
          />
        )}
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
          <Chip key={s.label} title={s.label} active={start?.label === s.label} onPress={() => chooseStart(s)} />
        ))}
        <Chip title="Aktueller Standort" active={start?.label === 'Aktueller Standort'} onPress={pickCurrentLocation} />
      </Row>
      {start && (
        <T small muted>
          {source === 'google'
            ? 'Reihenfolge und Zeiten mit aktuellen Verkehrsdaten berechnet.'
            : 'Reihenfolge nach Entfernung, Zeiten geschätzt (ohne Verkehrsdaten).'}{' '}
          Mit den Pfeilen kannst du die Reihenfolge ändern.
        </T>
      )}

      {!start && <T muted>Bitte zuerst den Startpunkt wählen.</T>}
      {start && planList.length === 0 && <T muted>Heute keine Hunde für die Route angemeldet.</T>}
      {start &&
        planList.map((s, i) => (
          <Card key={s.station_id}>
            <Row>
              <View style={{ flex: 1 }}>
                <T bold>
                  {i + 1}. {s.label}
                </T>
                <T small muted>
                  {s.dogs.map((d) => `${d.name}${d.handover === 'apartment' ? ' (Wohnung)' : ''}`).join(', ')}
                </T>
                {etaList[i] && (
                  <T small muted>
                    ca. {timeLabel(etaList[i].toISOString())} Uhr
                  </T>
                )}
              </View>
              <Chip title="▲" onPress={() => move(i, -1)} />
              <Chip title="▼" onPress={() => move(i, 1)} />
            </Row>
          </Card>
        ))}
      {selfDogs.length > 0 && <T small muted>Selbstbringer (nicht in der Route): {selfDogs.join(', ')}</T>}
      <T small muted>
        Mit dem Start sehen die Kunden den Countdown und bekommen eine Nachricht.
      </T>
      <Btn title="Fahrt starten" onPress={startTrip} busy={busy} disabled={!start || planList.length === 0} />
    </Screen>
  );
}
