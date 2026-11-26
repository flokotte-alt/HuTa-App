// Urlaubsuebersicht: alle Kunden mit ihren Urlaubszeitraeumen, neue Eintraege sind markiert
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Badge, Card, Grow, LinkRow, Row, Screen, Spinner, T } from '@/components/ui';
import { iso, rangeLabel } from '@/lib/dates';
import { useLive } from '@/lib/live';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { lastSeenVacations, markVacationsSeen } from '@/lib/vacationNews';

type Vac = {
  id: string;
  customer_id: string;
  date_from: string;
  date_to: string;
  created_at: string;
  customers: { name: string; dogs: { name: string; active: boolean }[] } | null;
};

export default function Vacations() {
  const router = useRouter();
  const { colors } = useTheme();
  const [list, setList] = useState<Vac[] | null>(null);
  const [seen, setSeen] = useState<string | null>(null);
  const newest = useRef('');

  // Beim Oeffnen merken, was bisher gesehen war, beim Verlassen alles als gesehen markieren
  useEffect(() => {
    lastSeenVacations().then(setSeen);
    return () => {
      if (newest.current) markVacationsSeen(newest.current);
    };
  }, []);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('vacations')
      .select('id, customer_id, date_from, date_to, created_at, customers(name, dogs(name, active))')
      .gte('date_to', iso(new Date()))
      .order('date_from');
    if (error) return;
    const rows = data as unknown as Vac[];
    newest.current = rows.reduce((max, v) => (v.created_at > max ? v.created_at : max), newest.current);
    setList(rows);
  }, []);

  const live = useLive(load, ['vacations']);
  if (!list || seen === null) return <Spinner />;

  const isNew = (v: Vac) => new Date(v.created_at) > new Date(seen);
  const customers = Array.from(new Set(list.map((v) => v.customer_id)))
    .map((id) => list.filter((v) => v.customer_id === id))
    // Kunden mit neuen Eintraegen zuerst, sonst nach dem naechsten Beginn
    .sort((a, b) => Number(b.some(isNew)) - Number(a.some(isNew)) || a[0].date_from.localeCompare(b[0].date_from));

  return (
    <Screen onRefresh={live.onRefresh} refreshing={live.refreshing}>
      <T small muted>
        Laufende und kommende Urlaube. In der Wochentabelle steht ein blaues U, ausgetragen wird dort von Hand. Antippen öffnet die Woche.
      </T>
      {customers.length === 0 && <T muted>Zurzeit ist kein Urlaub eingetragen.</T>}
      {customers.map((entries) => {
        const c = entries[0].customers;
        return (
          <Card key={entries[0].customer_id} style={entries.some(isNew) ? { borderColor: colors.primary, borderWidth: 2 } : undefined}>
            <Row>
              <Grow>
                <T bold>{c?.dogs.filter((d) => d.active).map((d) => d.name).join(', ') || 'kein Hund'}</T>
                <T small muted>
                  {c?.name}
                </T>
              </Grow>
              {entries.some(isNew) && <Badge text="neu" />}
            </Row>
            {entries.map((v) => (
              <LinkRow
                key={v.id}
                title={rangeLabel(v.date_from, v.date_to)}
                hint={isNew(v) ? 'neu eingetragen' : undefined}
                onPress={() => {
                  const target = v.date_from > iso(new Date()) ? v.date_from : iso(new Date());
                  router.dismissTo(`/(provider)/home?week=${target}`);
                }}
              />
            ))}
          </Card>
        );
      })}
    </Screen>
  );
}
