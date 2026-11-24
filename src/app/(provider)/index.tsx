import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Btn, Card, H2, Row, Screen, T } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { HANDOVER_LABEL, STATUS_COLOR, STATUS_LABEL } from '@/lib/theme';
import { dayLabel, iso } from '@/lib/dates';

type Cand = { dog_id: string; dog_name: string; station_label: string | null; handover: string };
type Entry = { id: string; status: string; dogs: { name: string } | null };
type TripInfo = { direction: string; state: string };

export default function Today() {
  const router = useRouter();
  const [morning, setMorning] = useState<Cand[]>([]);
  const [afternoon, setAfternoon] = useState<Cand[]>([]);
  const [others, setOthers] = useState<Entry[]>([]);
  const [trips, setTrips] = useState<TripInfo[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const today = iso(new Date());

  const load = useCallback(async () => {
    const [m, a, e, t] = await Promise.all([
      supabase.rpc('trip_candidates', { p_day: today, p_direction: 'morning' }),
      supabase.rpc('trip_candidates', { p_day: today, p_direction: 'afternoon' }),
      supabase.from('week_entries').select('id, status, dogs(name)').eq('day', today).neq('status', 'registered'),
      supabase.from('trips').select('direction, state').eq('day', today),
    ]);
    setMorning((m.data as Cand[]) ?? []);
    setAfternoon((a.data as Cand[]) ?? []);
    setOthers((e.data as unknown as Entry[]) ?? []);
    setTrips((t.data as TripInfo[]) ?? []);
  }, [today]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const stateOf = (d: string) => trips.find((t) => t.direction === d)?.state;
  const label = (d: string) =>
    stateOf(d) === 'running' ? 'Fahrt läuft: öffnen' : stateOf(d) === 'done' ? 'Fahrt beendet: ansehen' : 'Fahrt planen';

  const list = (rows: Cand[]) =>
    rows.length === 0 ? (
      <T muted>Keine Hunde angemeldet.</T>
    ) : (
      rows.map((r) => (
        <Row key={r.dog_id}>
          <View2>
            <T bold>{r.dog_name}</T>
          </View2>
          <T small muted>
            {r.handover === 'self' ? HANDOVER_LABEL.self : `${r.station_label ?? 'ohne Station'} · ${HANDOVER_LABEL[r.handover]}`}
          </T>
        </Row>
      ))
    );

  return (
    <Screen
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
      refreshing={refreshing}
    >
      <T muted>{dayLabel(new Date())}</T>
      <H2>Morgens einsammeln</H2>
      <Card>
        {list(morning)}
        <Btn title={label('morning')} onPress={() => router.push('/(provider)/trip?direction=morning')} />
      </Card>
      <H2>Nachmittags zurückbringen</H2>
      <Card>
        {list(afternoon)}
        <Btn title={label('afternoon')} onPress={() => router.push('/(provider)/trip?direction=afternoon')} />
      </Card>
      {others.length > 0 && (
        <>
          <H2>Heute nicht dabei</H2>
          <Card>
            {others.map((o) => (
              <T key={o.id} color={STATUS_COLOR[o.status]}>
                {o.dogs?.name} · {STATUS_LABEL[o.status]}
              </T>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

function View2({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
