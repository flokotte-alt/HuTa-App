import { useCallback, useState } from 'react';
import { confirmDialog, notify } from '@/lib/dialog';
import { useFocusEffect, useRouter } from 'expo-router';
import { Btn, Card, Chip, Field, H2, Row, Screen, T } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Cust = { id: string; name: string; email: string; phone: string | null; user_id: string | null; dogs: { id: string; name: string; active: boolean }[] };
type Station = { id: string; label: string; address: string; lat: number; lng: number; archived: boolean };

export default function Manage() {
  const router = useRouter();
  const [tab, setTab] = useState<'customers' | 'stations'>('customers');
  const [customers, setCustomers] = useState<Cust[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [nc, setNc] = useState({ name: '', email: '', phone: '' });
  const [ns, setNs] = useState({ label: '', address: '', lat: '', lng: '' });

  const load = useCallback(async () => {
    const [c, s] = await Promise.all([
      supabase.from('customers').select('id, name, email, phone, user_id, dogs(id, name, active)').order('name'),
      supabase.from('stations').select('*').order('label'),
    ]);
    setCustomers((c.data as unknown as Cust[]) ?? []);
    setStations((s.data as Station[]) ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function addCustomer() {
    const { error } = await supabase
      .from('customers')
      .insert({ name: nc.name.trim(), email: nc.email.trim().toLowerCase(), phone: nc.phone.trim() || null });
    if (error) return notify('Fehler', error.message);
    setNc({ name: '', email: '', phone: '' });
    load();
  }

  async function geocode() {
    try {
      const u = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=de&q=${encodeURIComponent(ns.address)}`;
      const r = await fetch(u, { headers: { 'User-Agent': 'huta-app/0.1' } });
      const j = (await r.json()) as { lat: string; lon: string }[];
      if (!j.length) return notify('Nicht gefunden', 'Bitte Adresse genauer eingeben oder Koordinaten von Hand eintragen.');
      setNs({ ...ns, lat: j[0].lat, lng: j[0].lon });
    } catch {
      notify('Kein Netz', 'Die Suche hat nicht geklappt.');
    }
  }

  async function addStation() {
    const { error } = await supabase.from('stations').insert({
      label: ns.label.trim() || ns.address.trim(),
      address: ns.address.trim(),
      lat: Number(ns.lat.replace(',', '.')),
      lng: Number(ns.lng.replace(',', '.')),
    });
    if (error) return notify('Fehler', error.message);
    setNs({ label: '', address: '', lat: '', lng: '' });
    load();
  }

  return (
    <Screen>
      <Row>
        <Chip title="Kunden und Hunde" active={tab === 'customers'} onPress={() => setTab('customers')} />
        <Chip title="Stationen" active={tab === 'stations'} onPress={() => setTab('stations')} />
      </Row>

      {tab === 'customers' && (
        <>
          {customers.map((c) => (
            <Card key={c.id}>
              <T bold>{c.name}</T>
              <T small muted>
                {c.email}
                {c.phone ? ` · ${c.phone}` : ''}
                {c.user_id ? ' · Konto verknüpft' : ' · noch kein Konto'}
              </T>
              <Row wrap>
                {c.dogs
                  .filter((d) => d.active)
                  .map((d) => (
                    <Chip key={d.id} title={d.name} onPress={() => router.push(`/dog?id=${d.id}`)} />
                  ))}
                <Chip title="+ Hund" onPress={() => router.push(`/dog?customer=${c.id}`)} />
              </Row>
              <Btn kind="ghost" title="Kunde bearbeiten" onPress={() => router.push(`/customer?id=${c.id}`)} />
              <Btn
                kind="ghost"
                title="Kunde löschen"
                onPress={() =>
                  confirmDialog(`${c.name} löschen?`, 'Alle Hunde und Wochenpläne dieses Kunden werden ebenfalls gelöscht.', 'Löschen', async () => {
                    await supabase.from('customers').delete().eq('id', c.id);
                    load();
                  }, true)
                }
              />
            </Card>
          ))}
          <H2>Neuer Kunde</H2>
          <Card>
            <Field label="Name" value={nc.name} onChangeText={(v) => setNc({ ...nc, name: v })} />
            <Field label="E-Mail (für die Verknüpfung beim Registrieren)" value={nc.email} onChangeText={(v) => setNc({ ...nc, email: v })} autoCapitalize="none" keyboardType="email-address" />
            <Field label="Telefon" value={nc.phone} onChangeText={(v) => setNc({ ...nc, phone: v })} keyboardType="phone-pad" />
            <Btn title="Kunde anlegen" onPress={addCustomer} disabled={!nc.name || !nc.email} />
          </Card>
        </>
      )}

      {tab === 'stations' && (
        <>
          {stations.map((s) => (
            <Card key={s.id}>
              <T bold color={s.archived ? colors.muted : colors.dark}>
                {s.label}
                {s.archived ? ' (archiviert)' : ''}
              </T>
              <T small muted>
                {s.address} · {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
              </T>
              <Btn
                kind="ghost"
                title={s.archived ? 'Wieder aktivieren' : 'Archivieren'}
                onPress={async () => {
                  await supabase.from('stations').update({ archived: !s.archived }).eq('id', s.id);
                  load();
                }}
              />
            </Card>
          ))}
          <H2>Neue Station</H2>
          <Card>
            <Field label="Bezeichnung" value={ns.label} onChangeText={(v) => setNs({ ...ns, label: v })} />
            <Field label="Adresse" value={ns.address} onChangeText={(v) => setNs({ ...ns, address: v })} placeholder="Straße Nr, Dresden" />
            <Btn kind="dark" title="Koordinaten suchen" onPress={geocode} disabled={!ns.address} />
            <Row>
              <View50>
                <Field label="Breite" value={ns.lat} onChangeText={(v) => setNs({ ...ns, lat: v })} keyboardType="numeric" />
              </View50>
              <View50>
                <Field label="Länge" value={ns.lng} onChangeText={(v) => setNs({ ...ns, lng: v })} keyboardType="numeric" />
              </View50>
            </Row>
            <Btn title="Station anlegen" onPress={addStation} disabled={!ns.address || !ns.lat || !ns.lng} />
          </Card>
        </>
      )}
    </Screen>
  );
}

import { View } from 'react-native';
function View50({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1 }}>{children}</View>;
}
