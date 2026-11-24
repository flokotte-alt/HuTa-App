import { useCallback, useEffect, useState } from 'react';
import { confirmDialog, notify } from '@/lib/dialog';
import { AppState, Linking, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Btn, Card, H2, Row, Screen, T } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { STATUS_COLOR, STATUS_LABEL, colors } from '@/lib/theme';
import { addDays, dayLabel, iso, mondayOf, parseIso, timeLabel } from '@/lib/dates';

type TripRow = {
  trip_dog_id: string;
  dog_id: string;
  dog_name: string;
  direction: 'morning' | 'afternoon';
  stops_before: number;
  eta: string;
  thumb_at: string | null;
  thumb_open: boolean;
  apartment_allowed: boolean;
  apartment_open: boolean;
  apartment_requested: boolean;
  handover: 'station' | 'apartment';
  sick: boolean;
  arrived: boolean;
  driver_name: string | null;
};
type WeekRow = { day: string; dog_name: string; status: string };
type Dog = { id: string; name: string };
type Contact = { name: string; phone: string | null };

export default function CustomerHome() {
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [week, setWeek] = useState<WeekRow[]>([]);
  const [myDogs, setMyDogs] = useState<Dog[]>([]);
  const [contact, setContact] = useState<Contact | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    const from = mondayOf(new Date());
    const [t, w, d, c] = await Promise.all([
      supabase.rpc('my_trip_status'),
      supabase.rpc('week_names', { p_from: iso(from), p_to: iso(addDays(from, 13)) }),
      supabase.from('dogs').select('id, name'),
      supabase.rpc('todays_contact', {}),
    ]);
    setTrips((t.data as TripRow[]) ?? []);
    setWeek((w.data as WeekRow[]) ?? []);
    setMyDogs((d.data as Dog[]) ?? []);
    setContact(((c.data as Contact[]) ?? [])[0] ?? null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, 15000);
      return () => clearInterval(t);
    }, [load]),
  );
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20000);
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') load();
    });
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, [load]);

  async function run(label: string, fn: () => PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await fn();
    if (error) notify(label, error.message);
    load();
  }

  const mine = new Set(myDogs.map((d) => d.name));
  const todayIso = iso(new Date());
  const days = Array.from(new Set(week.map((w) => w.day))).filter((d) => d >= todayIso).sort();
  const weekBlock = (
    <>
      <H2>Wochenliste</H2>
      {days.length === 0 && <T muted>Noch keine Woche veröffentlicht.</T>}
      {days.map((d) => (
        <Card key={d}>
          <T bold>{dayLabel(parseIso(d))}</T>
          <Row wrap>
            {week
              .filter((w) => w.day === d)
              .map((w, i) => (
                <T
                  key={i}
                  bold={mine.has(w.dog_name)}
                  color={STATUS_COLOR[w.status] ?? colors.dark}
                  small
                >
                  {w.dog_name}
                  {w.status !== 'registered' ? ` (${STATUS_LABEL[w.status]})` : ''}
                </T>
              ))}
          </Row>
        </Card>
      ))}
    </>
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
      {trips.map((t) => {
        const minutes = Math.max(0, Math.round((new Date(t.eta).getTime() - now) / 60000));
        return (
          <Card key={t.trip_dog_id} style={{ borderColor: colors.primary, borderWidth: 2 }}>
            <T bold color={colors.primary}>
              {t.direction === 'morning' ? 'Abholung' : 'Rückfahrt'} läuft · {t.dog_name}
            </T>
            {t.sick ? (
              <T>{t.dog_name} ist krank gemeldet und wird nicht abgeholt.</T>
            ) : t.arrived ? (
              <T bold>Station ist erledigt.</T>
            ) : (
              <>
                <T bold>
                  {t.stops_before === 0 ? 'Du bist als Nächstes dran' : `Noch ${t.stops_before} Stopp${t.stops_before === 1 ? '' : 's'} vor dir`}
                </T>
                <T>
                  Ankunft in ca. {minutes} Min · {timeLabel(t.eta)} Uhr
                </T>
              </>
            )}
            {!t.sick && !t.arrived && (
              <View style={{ gap: 8, marginTop: 4 }}>
                {t.thumb_at ? (
                  <T bold color={colors.green}>
                    Daumen bestätigt
                  </T>
                ) : (
                  <Btn
                    title={t.thumb_open ? 'Daumen hoch: Ich bin bereit' : 'Daumen (kurz vor Ankunft)'}
                    disabled={!t.thumb_open}
                    onPress={() => run('Daumen', () => supabase.rpc('customer_thumb', { p_trip_dog: t.trip_dog_id }))}
                  />
                )}
                {t.handover === 'apartment' && <T small muted>Übergabe in der Wohnung.</T>}
                {t.apartment_allowed && t.handover !== 'apartment' && (
                  <Btn
                    kind="dark"
                    title={
                      t.apartment_requested
                        ? 'Wohnungs-Wunsch gesendet'
                        : t.apartment_open
                          ? 'Bitte in die Wohnung bringen oder holen'
                          : 'Wohnungs-Wunsch nicht mehr möglich'
                    }
                    disabled={!t.apartment_open}
                    onPress={() => run('Wohnung', () => supabase.rpc('customer_apartment', { p_trip_dog: t.trip_dog_id }))}
                  />
                )}
                {t.apartment_allowed && t.handover !== 'apartment' && !t.apartment_open && !t.apartment_requested && (
                  <T small muted>
                    Bitte melde den Wunsch jetzt per WhatsApp.
                  </T>
                )}
                <Btn
                  kind="danger"
                  title="Hund ist krank, bitte nicht abholen"
                  onPress={() =>
                    confirmDialog(`${t.dog_name} krank melden?`, 'Der Hund wird für heute abgemeldet.', 'Krank melden', () =>
                      run('Krankmeldung', () => supabase.rpc('customer_sick', { p_dog: t.dog_id })),
                    true)
                  }
                />
              </View>
            )}
          </Card>
        );
      })}

      {contact && (
        <Card>
          <T bold>Heute fährt: {contact.name}</T>
          {contact.phone ? (
            <Row>
              <View style={{ flex: 1 }}>
                <Btn title="Anrufen" kind="dark" onPress={() => Linking.openURL(`tel:${contact.phone!.replace(/\s/g, '')}`)} />
              </View>
              <View style={{ flex: 1 }}>
                <Btn
                  title="WhatsApp"
                  kind="dark"
                  onPress={() => Linking.openURL(`https://wa.me/${contact.phone!.replace(/[^0-9]/g, '').replace(/^0/, '49')}`)}
                />
              </View>
            </Row>
          ) : (
            <T muted small>
              Keine Nummer hinterlegt.
            </T>
          )}
        </Card>
      )}

      {weekBlock}
    </Screen>
  );
}
