// Home der Dienstleister: oben die Tagesliste, darunter die Wochentabelle
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Btn, Badge, Card, Chip, Grow, H1, H2, IconBtn, Row, Screen, Sheet, Spinner, T } from '@/components/ui';
import { DayEntrySheet, type Rule, type Station } from '@/components/DayEntrySheet';
import { WeekTable, type Cell } from '@/components/WeekTable';
import { addDays, fullDateLabel, iso, longDay, mondayOf, parseIso, rangeLabel, shortDate } from '@/lib/dates';
import { confirmDialog, notify } from '@/lib/dialog';
import { useLive } from '@/lib/live';
import type { PlanRow } from '@/lib/plan';
import { supabase } from '@/lib/supabase';
import { PERIOD_LABEL, useTheme } from '@/lib/theme';

type Direction = 'morning' | 'afternoon';
type Cand = { dog_id: string; dog_name: string; station_label: string | null; handover: string };
type DayData = { day: string; morning: Cand[]; afternoon: Cand[]; trips: { direction: Direction; state: string }[]; earlier: Direction[] };
type Dog = { id: string; name: string; customer_id: string };
type Vac = { customer_id: string; date_from: string; date_to: string };
type Closure = { date_from: string; date_to: string; note: string | null };
type WeekData = { monday: string; rows: PlanRow[]; dogs: Dog[]; rules: Rule[]; stations: Station[]; vacations: Vac[]; closures: Closure[]; drafts: number };

export default function ProviderHome() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ week?: string }>();
  const [monday, setMonday] = useState<string | null>(null);
  const [today, setToday] = useState<DayData | null>(null);
  const [week, setWeek] = useState<WeekData | null>(null);
  const [cell, setCell] = useState<Cell | null>(null);
  const [asking, setAsking] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Aus der Urlaubsuebersicht direkt zu einer Woche springen
  useEffect(() => {
    if (params.week) setMonday(iso(mondayOf(parseIso(params.week))));
  }, [params.week]);

  const loadDay = useCallback(async () => {
    const { data: day, error } = await supabase.rpc('home_day');
    if (error) return;
    const now = iso(new Date());
    const [m, a, t, e] = await Promise.all([
      supabase.rpc('trip_candidates', { p_day: day, p_direction: 'morning' }),
      supabase.rpc('trip_candidates', { p_day: day, p_direction: 'afternoon' }),
      supabase.from('trips').select('direction, state').eq('day', day),
      // Fahrten von heute bleiben erreichbar, auch wenn die Liste schon beim naechsten Betriebstag ist
      supabase.from('trips').select('direction').eq('day', now).eq('state', 'done').order('direction', { ascending: false }),
    ]);
    if (m.error || a.error || t.error) return;
    const earlier = day === now ? [] : (e.data ?? []).map((x) => x.direction as Direction);
    setToday({ day: day as string, morning: m.data as Cand[], afternoon: a.data as Cand[], trips: t.data as DayData['trips'], earlier });
    setMonday((current) => current ?? iso(mondayOf(parseIso(day as string))));
  }, []);

  const loadWeek = useCallback(async () => {
    if (!monday) return;
    const friday = iso(addDays(parseIso(monday), 4));
    // Fuer "Verschieben" werden auch die Schliesstage der Folgewochen gebraucht
    const horizon = iso(addDays(parseIso(monday), 27));
    const [p, d, r, s, v, c, n] = await Promise.all([
      supabase.rpc('plan_rows', { p_from: monday, p_to: friday }),
      supabase.from('dogs').select('id, name, customer_id').eq('active', true).order('name'),
      supabase.from('dog_rules').select('dog_id, period, handover, station_id'),
      supabase.from('stations').select('id, label').eq('archived', false).order('label'),
      supabase.from('vacations').select('customer_id, date_from, date_to').lte('date_from', friday).gte('date_to', monday),
      supabase.from('closures').select('date_from, date_to, note').lte('date_from', horizon).gte('date_to', monday).order('date_from'),
      supabase.from('week_entries').select('id', { count: 'exact', head: true }).eq('published', false),
    ]);
    if (p.error || d.error) return;
    setWeek({
      monday,
      rows: p.data as PlanRow[],
      dogs: d.data as Dog[],
      rules: (r.data as Rule[]) ?? [],
      stations: (s.data as Station[]) ?? [],
      vacations: (v.data as Vac[]) ?? [],
      closures: (c.data as Closure[]) ?? [],
      drafts: n.count ?? 0,
    });
  }, [monday]);

  const load = useCallback(async () => {
    await Promise.all([loadDay(), loadWeek()]);
  }, [loadDay, loadWeek]);

  const live = useLive(load, ['week_entries', 'dogs', 'vacations', 'closures', 'trips', 'app_settings']);

  if (!today) return <Spinner />;

  // ---------- Tagesliste ----------
  const stateOf = (d: Direction) => today.trips.find((t) => t.direction === d)?.state;
  const running = (['morning', 'afternoon'] as const).find((d) => stateOf(d) === 'running');
  const open = (d: Direction) => {
    setAsking(false);
    router.push(`/trip?direction=${d}&day=${today.day}`);
  };
  // Laeuft eine Fahrt oder ist die Morgenfahrt beendet, wird nicht mehr nach der Fahrtart gefragt
  const startPlanning = () => {
    if (running) open(running);
    else if (stateOf('morning') === 'done') open('afternoon');
    else setAsking(true);
  };
  const count = new Set([...today.morning, ...today.afternoon].map((c) => c.dog_id)).size;
  const date = parseIso(today.day);
  const isToday = today.day === iso(new Date());
  const next: Direction = stateOf('morning') === 'done' ? 'afternoon' : 'morning';

  const dayList = (direction: Direction) => {
    const rows = today[direction];
    const state = stateOf(direction);
    return (
      <Card onPress={startPlanning} style={!running && !state && direction === next ? { borderColor: colors.primary, borderWidth: 2 } : undefined}>
        <Row>
          <Grow>
            <T bold>{PERIOD_LABEL[direction]}</T>
          </Grow>
          {state === 'running' && <Badge text="läuft" background={colors.primary} color={colors.onPrimary} />}
          {state === 'done' && <Badge text="beendet" />}
        </Row>
        {rows.length === 0 && <T muted>Keine Hunde eingetragen.</T>}
        {rows.map((r) => (
          <View key={r.dog_id} style={{ flexDirection: 'row', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <T>{r.dog_name}</T>
            <T small muted>
              {r.handover === 'self'
                ? 'Selbstabholung'
                : `${r.station_label ?? 'ohne Station'}${r.handover === 'apartment' ? ', Wohnung' : ''}`}
            </T>
          </View>
        ))}
      </Card>
    );
  };

  // ---------- Wochentabelle ----------
  const shownMonday = monday ?? iso(mondayOf(date));
  const days = Array.from({ length: 5 }, (_, i) => iso(addDays(parseIso(shownMonday), i)));
  const w = week?.monday === shownMonday ? week : null;
  const closed = (d: string) => !!week?.closures.some((c) => c.date_from <= d && c.date_to >= d);
  const vacationOf = (dogId: string, d: string) => {
    const customer = w?.dogs.find((x) => x.id === dogId)?.customer_id;
    return w?.vacations.find((v) => v.customer_id === customer && v.date_from <= d && v.date_to >= d);
  };
  const listed = new Set(w?.rows.filter((r) => r.draft || r.w_status !== 'removed').map((r) => r.dog_id));
  const inTable = w?.dogs.filter((d) => listed.has(d.id)) ?? [];
  const others = w?.dogs.filter((d) => !listed.has(d.id)) ?? [];
  const closureThisWeek = w?.closures.filter((c) => c.date_from <= days[4] && c.date_to >= days[0]) ?? [];
  const cellDog = cell && w?.dogs.find((d) => d.id === cell.dogId);
  const thisMonday = iso(mondayOf(date));

  async function publish() {
    setPublishing(true);
    const { error } = await supabase.rpc('publish_plan');
    if (error) notify('Fehler', error.message);
    await load();
    setPublishing(false);
  }

  async function discard() {
    const { error } = await supabase.rpc('discard_drafts');
    if (error) notify('Fehler', error.message);
    await load();
  }

  const drafts = week?.drafts ?? 0;

  return (
    <Screen safeTop onRefresh={live.onRefresh} refreshing={live.refreshing}>
      <View>
        <H1>
          {longDay(date)}, {count} {count === 1 ? 'Hund' : 'Hunde'}
        </H1>
        <T muted>
          {fullDateLabel(date)}
          {isToday ? '' : ' (nächster Betriebstag)'}
        </T>
      </View>
      {dayList('morning')}
      {stateOf('morning') === 'done' && <Btn kind="ghost" title="Beendete Morgenfahrt ansehen" onPress={() => open('morning')} />}
      {dayList('afternoon')}
      {today.earlier.map((d) => (
        <Btn
          key={d}
          kind="ghost"
          title={`Heutige ${PERIOD_LABEL[d]} ansehen`}
          onPress={() => router.push(`/trip?direction=${d}&day=${iso(new Date())}`)}
        />
      ))}
      <Btn
        title={running ? 'Laufende Fahrt öffnen' : stateOf('morning') === 'done' ? 'Nachmittagsfahrt planen' : 'Route planen'}
        icon="navigate"
        onPress={startPlanning}
      />

      <H2>Wochentabelle</H2>
      <Row>
        <IconBtn icon="chevron-back" label="Woche zurück" onPress={() => setMonday(iso(addDays(parseIso(shownMonday), -7)))} />
        <Grow>
          <T bold center>
            {shortDate(parseIso(days[0]))} bis {shortDate(parseIso(days[4]))}
            {parseIso(days[0]).getFullYear() !== new Date().getFullYear() ? ` ${parseIso(days[0]).getFullYear()}` : ''}
          </T>
        </Grow>
        <IconBtn icon="chevron-forward" label="Woche vor" onPress={() => setMonday(iso(addDays(parseIso(shownMonday), 7)))} />
      </Row>
      <Row wrap>
        <Chip title="Diese Woche" active={shownMonday === thisMonday} onPress={() => setMonday(thisMonday)} />
        <Chip title="4 Wochen weiter" onPress={() => setMonday(iso(addDays(parseIso(shownMonday), 28)))} />
      </Row>

      {drafts > 0 && (
        <View style={{ backgroundColor: colors.draftBg, borderRadius: 10, padding: 12, gap: 8 }}>
          <T bold color={colors.draftText}>
            {drafts} {drafts === 1 ? 'Änderung ist' : 'Änderungen sind'} noch nicht veröffentlicht
          </T>
          <Row>
            <Grow>
              <Btn title="Veröffentlichen" onPress={publish} busy={publishing} />
            </Grow>
            <Grow>
              <Btn
                kind="secondary"
                title="Verwerfen"
                onPress={() =>
                  confirmDialog('Alle Änderungen verwerfen?', 'Alle noch nicht veröffentlichten Änderungen in allen Wochen werden zurückgenommen.', 'Verwerfen', discard, true)
                }
              />
            </Grow>
          </Row>
        </View>
      )}

      {closureThisWeek.map((c) => (
        <T key={c.date_from} bold>
          Geschlossen: {rangeLabel(c.date_from, c.date_to)}
          {c.note ? `, ${c.note}` : ''}
        </T>
      ))}

      {w ? (
        <>
          <WeekTable
            days={days}
            today={today.day}
            dogs={inTable}
            rows={w.rows}
            closed={closed}
            onVacation={(dogId, d) => !!vacationOf(dogId, d)}
            onPress={setCell}
          />
          <T small muted>
            Gelb: noch nicht veröffentlicht. Grau: abgesagt, wird berechnet. U: Urlaub eingetragen. *: an diesem Tag andere Station oder
            Übergabe.
          </T>
          {others.length > 0 && (
            <>
              <T bold>Hund hinzufügen</T>
              <Row wrap>
                {others.map((d) => (
                  <Chip
                    key={d.id}
                    title={d.name}
                    onPress={() => setCell({ dogId: d.id, day: days.includes(today.day) ? today.day : days[0] })}
                  />
                ))}
              </Row>
            </>
          )}
        </>
      ) : (
        <T muted>Woche wird geladen.</T>
      )}

      {cell && cellDog && w && (
        <DayEntrySheet
          dog={cellDog}
          day={cell.day}
          row={w.rows.find((r) => r.dog_id === cell.dogId && r.day === cell.day)}
          rules={w.rules}
          stations={w.stations}
          vacation={vacationOf(cell.dogId, cell.day)}
          closed={closed}
          onDay={(day) => setCell({ ...cell, day })}
          onChanged={load}
          onClose={() => setCell(null)}
        />
      )}

      <Sheet visible={asking} onClose={() => setAsking(false)} title="Welche Fahrt?">
        <Btn big title="Morgenfahrt" onPress={() => open('morning')} />
        <Btn big kind="secondary" title="Nachmittagsfahrt" onPress={() => open('afternoon')} />
      </Sheet>
    </Screen>
  );
}
