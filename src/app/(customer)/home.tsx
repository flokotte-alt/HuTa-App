// Home der Kunden: oben die laufende Fahrt, dann Schliesszeiten, darunter die Wochenliste (nur lesen)
import { useCallback, useEffect, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import { CustomerMap } from '@/components/CustomerMap';
import { Badge, Btn, Card, Grow, H2, IconBtn, Row, Screen, Spinner, T } from '@/components/ui';
import { addDays, currentWeekMonday, dayLabel, iso, parseIso, rangeLabel, shortDate, timeLabel } from '@/lib/dates';
import { notify } from '@/lib/dialog';
import { useLive } from '@/lib/live';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

type TripRow = {
  trip_dog_id: string;
  stop_id: string;
  dog_name: string;
  direction: 'morning' | 'afternoon';
  stops_before: number;
  eta: string;
  handover: 'station' | 'apartment';
  thumb_at: string | null;
  thumb_open: boolean;
  apartment_open: boolean;
  apartment_requested: boolean;
  arrived: boolean;
  station_label: string;
  lat: number;
  lng: number;
  vehicle_lat: number | null;
  vehicle_lng: number | null;
};
type WeekRow = { day: string; dog_name: string; own: boolean; status: 'registered' | 'cancelled_billed' };
type Closure = { id: string; date_from: string; date_to: string; note: string | null };

const WEEKS_AHEAD = 1; // diese Woche und eine weiter (in der Datenbank genauso begrenzt)

const names = (rows: TripRow[]) => rows.map((r) => r.dog_name).join(' und ');

export default function CustomerHome() {
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [offset, setOffset] = useState(0);
  const [week, setWeek] = useState<{ monday: string; rows: WeekRow[] } | null>(null);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [dogs, setDogs] = useState<number | null>(null);
  const monday = iso(addDays(currentWeekMonday(), offset * 7));

  const load = useCallback(async () => {
    const [t, w, c, d] = await Promise.all([
      supabase.rpc('my_trip_status'),
      supabase.rpc('customer_week', { p_monday: monday }),
      supabase.from('closures').select('*').gte('date_to', iso(new Date())).lte('date_from', iso(addDays(new Date(), 28))).order('date_from'),
      supabase.rpc('my_dogs'),
    ]);
    if (!t.error) setTrips((t.data as TripRow[]) ?? []);
    if (!w.error) setWeek({ monday, rows: (w.data as WeekRow[]) ?? [] });
    if (!c.error) setClosures((c.data as Closure[]) ?? []);
    if (!d.error) setDogs(((d.data as unknown[]) ?? []).length);
  }, [monday]);

  const live = useLive(load, ['app_settings', 'trip_location'], 15000);

  // Wischen blaettert die Woche
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_e, g) => {
        if (g.dx < -50) setOffset((o) => Math.min(WEEKS_AHEAD, o + 1));
        if (g.dx > 50) setOffset((o) => Math.max(0, o - 1));
      },
    }),
  ).current;

  const stops = Array.from(new Set(trips.map((t) => t.stop_id))).map((id) => trips.filter((t) => t.stop_id === id));
  const days = Array.from({ length: 5 }, (_, i) => iso(addDays(parseIso(monday), i)));

  return (
    <Screen safeTop onRefresh={live.onRefresh} refreshing={live.refreshing}>
      {stops.map((rows) => (
        <LiveBanner key={rows[0].stop_id} rows={rows} reload={load} />
      ))}

      {closures.map((c) => (
        <ClosureNotice key={c.id} closure={c} />
      ))}

      {dogs === 0 && (
        <Card>
          <T>Deinem Konto ist noch kein Hund zugeordnet. Bitte melde dich bei Dogworker.</T>
        </Card>
      )}

      <H2>Wochenliste</H2>
      <View {...swipe.panHandlers} style={{ gap: 10 }}>
        <Row>
          <IconBtn icon="chevron-back" label="Diese Woche" onPress={() => setOffset(offset - 1)} disabled={offset === 0} />
          <Grow>
            <T bold center>
              {offset === 0 ? 'Diese Woche' : 'Nächste Woche'}
            </T>
            <T small muted center>
              {shortDate(parseIso(days[0]))} bis {shortDate(parseIso(days[4]))}
            </T>
          </Grow>
          <IconBtn icon="chevron-forward" label="Eine Woche weiter" onPress={() => setOffset(offset + 1)} disabled={offset === WEEKS_AHEAD} />
        </Row>
        {week?.monday !== monday ? (
          <View style={{ height: 160 }}>
            <Spinner />
          </View>
        ) : (
          days.map((day) => (
            <DayCard
              key={day}
              day={day}
              rows={week.rows.filter((r) => r.day === day)}
              closed={closures.find((c) => c.date_from <= day && c.date_to >= day)}
            />
          ))
        )}
      </View>
    </Screen>
  );
}

function DayCard({ day, rows, closed }: { day: string; rows: WeekRow[]; closed?: Closure }) {
  const { colors } = useTheme();
  const today = day === iso(new Date());
  return (
    <Card style={today ? { borderColor: colors.primary } : undefined}>
      <T bold>
        {dayLabel(parseIso(day))}
        {today ? ', heute' : ''}
      </T>
      {rows.length === 0 && <T muted>{closed ? 'Geschlossen' : 'Kein Eintrag'}</T>}
      <Row wrap>
        {rows.map((r) => {
          const cancelled = r.status === 'cancelled_billed';
          return (
            <View
              key={r.dog_name + String(r.own)}
              accessibilityLabel={`${r.dog_name}${r.own ? ', dein Hund' : ''}${cancelled ? ', abgesagt' : ''}`}
              style={{
                paddingHorizontal: r.own ? 10 : 2,
                paddingVertical: 4,
                borderRadius: 6,
                backgroundColor: cancelled ? colors.cancelledBg : r.own ? colors.primary : 'transparent',
              }}
            >
              <T small bold={r.own} color={cancelled ? colors.cancelledText : r.own ? colors.onPrimary : undefined}>
                {r.dog_name}
                {cancelled ? ' (abgesagt)' : ''}
              </T>
            </View>
          );
        })}
      </Row>
    </Card>
  );
}

function ClosureNotice({ closure }: { closure: Closure }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 14, gap: 4 }}>
      <T bold color={colors.onPrimary}>
        Wir haben geschlossen
      </T>
      <T color={colors.onPrimary}>
        {rangeLabel(closure.date_from, closure.date_to)}
        {closure.note ? `, ${closure.note}` : ''}
      </T>
    </View>
  );
}

function LiveBanner({ rows, reload }: { rows: TripRow[]; reload: () => Promise<void> }) {
  const { colors } = useTheme();
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState('');
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  const first = rows[0];
  const morning = first.direction === 'morning';
  const toDoor = rows.filter((r) => r.handover === 'apartment');
  const atStation = rows.filter((r) => r.handover === 'station');
  const arrived = rows.every((r) => r.arrived);
  const minutes = Math.max(1, Math.round((new Date(first.eta).getTime() - now) / 60000));
  const apartment = rows.find((r) => r.apartment_open);
  const toConfirm = atStation.find((r) => r.thumb_open);
  const confirmed = atStation.length > 0 && atStation.every((r) => r.thumb_at);
  const n = first.stops_before + 1;

  async function call(name: 'customer_thumb' | 'customer_apartment', id: string) {
    setBusy(name);
    const { error } = await supabase.rpc(name, { p_trip_dog: id });
    if (error) notify('Nicht möglich', error.message);
    await reload();
    setBusy('');
  }

  return (
    <Card style={{ borderColor: colors.primary, borderWidth: 2, gap: 10 }}>
      <Row>
        <Grow>
          <T bold color={colors.primary}>
            {morning ? 'Abholung' : 'Rückfahrt'} läuft: {names(rows)}
          </T>
        </Grow>
        <Badge text="live" background={colors.primary} color={colors.onPrimary} />
      </Row>
      {arrived ? (
        <H2>Erledigt, bis bald</H2>
      ) : (
        <>
          <H2>{first.stops_before === 0 ? 'Du bist als Nächstes dran' : `In ${n} Stopps sind wir bei dir`}</H2>
          <T bold>
            ca. {minutes} {minutes === 1 ? 'Minute' : 'Minuten'}, Ankunft gegen {timeLabel(first.eta)} Uhr
          </T>
          {toDoor.length > 0 && (
            <T>
              {morning ? 'Wir holen' : 'Wir bringen'} {names(toDoor)} {morning ? 'in der Wohnung ab.' : 'in die Wohnung.'}
              {toDoor.some((r) => r.apartment_requested) ? ' Dein Wunsch ist angekommen.' : ''}
            </T>
          )}
          {apartment && (
            <Btn
              kind="secondary"
              icon="home-outline"
              title={morning ? 'Bitte in der Wohnung abholen' : 'Bitte in die Wohnung bringen'}
              busy={busy === 'customer_apartment'}
              onPress={() => call('customer_apartment', apartment.trip_dog_id)}
            />
          )}
          {toConfirm ? (
            <Btn
              big
              icon="thumbs-up"
              title="Bestätigen"
              busy={busy === 'customer_thumb'}
              onPress={() => call('customer_thumb', toConfirm.trip_dog_id)}
            />
          ) : confirmed ? (
            <T bold color={colors.primary}>
              Bestätigt, danke.
            </T>
          ) : atStation.length > 0 ? (
            <T small muted>
              Kurz vor der Ankunft bitten wir dich um eine Bestätigung.
            </T>
          ) : null}
          {atStation.length > 0 && (
            <>
              <T small muted>
                Treffpunkt: {first.station_label}
              </T>
              <CustomerMap
                station={{ lat: first.lat, lng: first.lng, label: first.station_label }}
                vehicle={first.vehicle_lat != null ? { lat: first.vehicle_lat, lng: first.vehicle_lng! } : null}
              />
            </>
          )}
        </>
      )}
    </Card>
  );
}
