// Kundenliste mit Hunden, Dauer der Kundschaft, Zugang und Dateien
import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { Badge, Btn, Card, Field, Grow, H1, Row, Screen, Spinner, T } from '@/components/ui';
import { isPlaceholderEmail } from '@/lib/accounts';
import { sinceLabel } from '@/lib/dates';
import { useLive } from '@/lib/live';
import { supabase } from '@/lib/supabase';

type Customer = {
  id: string;
  name: string;
  email: string;
  user_id: string | null;
  customer_since: string | null;
  dogs: { id: string; name: string; active: boolean }[];
  customer_files: { id: string }[];
};

export default function Customers() {
  const router = useRouter();
  const [list, setList] = useState<Customer[] | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const [c, p] = await Promise.all([
      supabase.from('customers').select('id, name, email, user_id, customer_since, dogs(id, name, active), customer_files(id)').order('name'),
      supabase.from('profiles').select('id').eq('must_change_password', true),
    ]);
    if (c.error) return;
    setList(c.data as unknown as Customer[]);
    setPending(new Set((p.data ?? []).map((x) => x.id)));
  }, []);

  const live = useLive(load, ['dogs']);
  if (!list) return <Spinner />;

  const term = search.trim().toLowerCase();
  const shown = term
    ? list.filter((c) => c.name.toLowerCase().includes(term) || c.dogs.some((d) => d.name.toLowerCase().includes(term)))
    : list;

  return (
    <Screen safeTop onRefresh={live.onRefresh} refreshing={live.refreshing}>
      <H1>Kunden</H1>
      <Btn title="Neuer Kunde" icon="add" onPress={() => router.push('/customer')} />
      <Field label="Suche (Kunde oder Hund)" value={search} onChangeText={setSearch} autoCapitalize="none" />
      {shown.length === 0 && <T muted>Keine Treffer.</T>}
      {shown.map((c) => {
        const dogs = c.dogs.filter((d) => d.active).map((d) => d.name);
        return (
          <Card key={c.id} onPress={() => router.push(`/customer?id=${c.id}`)}>
            <Row>
              <Grow>
                <T bold>{c.name}</T>
              </Grow>
              <Badge text={!c.user_id ? 'kein Zugang' : pending.has(c.user_id) ? 'Einmalpasswort offen' : 'Zugang aktiv'} />
            </Row>
            <T>{dogs.length ? dogs.join(', ') : 'kein Hund'}</T>
            <T small muted>
              {sinceLabel(c.customer_since)}
              {c.customer_files.length ? `, ${c.customer_files.length} ${c.customer_files.length === 1 ? 'Datei' : 'Dateien'}` : ''}
              {isPlaceholderEmail(c.email) ? ', E-Mail noch offen' : ''}
            </T>
          </Card>
        );
      })}
    </Screen>
  );
}
