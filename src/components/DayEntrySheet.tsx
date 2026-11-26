// Auswahl zu einem Hund an einem Tag. Alles hier gilt nur fuer diesen Tag und ist zunaechst ein Entwurf.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Btn, Chip, Divider, Row, Sheet, T } from './ui';
import { addDays, dayLabel, iso, mondayOf, parseIso, rangeLabel } from '@/lib/dates';
import { notify } from '@/lib/dialog';
import { discardDay, setDay, type DayValues, type PlanRow } from '@/lib/plan';
import { supabase } from '@/lib/supabase';
import { HANDOVER_LABEL, PERIOD_LABEL, useTheme } from '@/lib/theme';

export type Station = { id: string; label: string };
export type Rule = { dog_id: string; period: 'morning' | 'afternoon'; handover: string; station_id: string | null };

export function DayEntrySheet({
  dog,
  day,
  row,
  rules,
  stations,
  vacation,
  closed,
  onDay,
  onChanged,
  onClose,
}: {
  dog: { id: string; name: string };
  day: string;
  row: PlanRow | undefined;
  rules: Rule[];
  stations: Station[];
  vacation: { date_from: string; date_to: string } | undefined;
  closed: (day: string) => boolean;
  onDay: (day: string) => void;
  onChanged: () => Promise<unknown>;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [moving, setMoving] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => setMoving(false), [dog.id, day]);

  const status = row?.w_status ?? null;
  const present = status === 'registered' || status === 'cancelled_billed';

  async function run(action: PromiseLike<{ error: { message: string } | null }>, close = false) {
    setBusy(true);
    const { error } = await action;
    if (error) notify('Fehler', error.message);
    await onChanged();
    setBusy(false);
    if (close && !error) onClose();
  }

  const set = (values: Partial<DayValues>) => run(setDay(dog.id, day, status === 'cancelled_billed' ? status : 'registered', { ...row, ...values }));

  const monday = mondayOf(parseIso(day));
  const targets = Array.from({ length: 28 }, (_, i) => addDays(monday, i))
    .filter((d) => d.getDay() !== 0 && d.getDay() !== 6)
    .map(iso)
    .filter((d) => d !== day && !closed(d));

  // Nur diese Woche als schnelle Wahl beim Hinzufuegen
  const week = Array.from({ length: 5 }, (_, i) => iso(addDays(monday, i)));

  return (
    <Sheet visible title={`${dog.name}, ${dayLabel(parseIso(day))}`} onClose={onClose}>
      {row?.draft && (
        <View style={{ backgroundColor: colors.draftBg, borderRadius: 8, padding: 10, gap: 8 }}>
          <T bold color={colors.draftText}>
            Noch nicht veröffentlicht
          </T>
          <Btn kind="ghost" title="Diese Änderung verwerfen" onPress={() => run(discardDay(dog.id, day), true)} disabled={busy} />
        </View>
      )}
      {closed(day) && <T bold>An diesem Tag ist geschlossen.</T>}
      {vacation && present && (
        <T color={colors.vacation} bold>
          Urlaub eingetragen: {rangeLabel(vacation.date_from, vacation.date_to)}. Zum Austragen "Kostenlos stornieren" wählen.
        </T>
      )}

      {!present && (
        <>
          <T muted>{dog.name} ist an diesem Tag nicht eingetragen.</T>
          <Row wrap>
            {week.map((d) => (
              <Chip key={d} title={dayLabel(parseIso(d))} active={d === day} onPress={() => onDay(d)} />
            ))}
          </Row>
          <Btn title={`Am ${dayLabel(parseIso(day))} hinzufügen`} icon="add" busy={busy} onPress={() => run(setDay(dog.id, day, 'registered'), true)} />
        </>
      )}

      {present && (
        <>
          <Btn kind="secondary" title="Auf anderen Tag verschieben" icon="swap-horizontal" onPress={() => setMoving(!moving)} />
          {moving && (
            <Row wrap>
              {targets.map((d) => (
                <Chip
                  key={d}
                  title={dayLabel(parseIso(d))}
                  onPress={() => run(supabase.rpc('move_plan_entry', { p_dog: dog.id, p_from_day: day, p_to_day: d }), true)}
                />
              ))}
            </Row>
          )}
          <Btn
            kind="secondary"
            title="Kostenlos stornieren (verschwindet)"
            icon="close"
            disabled={busy}
            onPress={() => run(setDay(dog.id, day, 'removed'), true)}
          />
          {status === 'cancelled_billed' ? (
            <Btn kind="secondary" title="Doch dabei (Absage zurücknehmen)" icon="checkmark" disabled={busy} onPress={() => run(setDay(dog.id, day, 'registered', row), true)} />
          ) : (
            <Btn
              kind="secondary"
              title="Abgesagt, wird berechnet (bleibt grau)"
              icon="remove-circle-outline"
              disabled={busy}
              onPress={() => run(setDay(dog.id, day, 'cancelled_billed', row), true)}
            />
          )}
          <Divider />
          <T bold>Nur für diesen Tag</T>
          {(['morning', 'afternoon'] as const).map((period) => {
            const rule = rules.find((r) => r.dog_id === dog.id && r.period === period);
            const stationKey = period === 'morning' ? 'w_station_id' : 'w_station_id_afternoon';
            const handoverKey = period === 'morning' ? 'w_handover_morning' : 'w_handover_afternoon';
            const handover = row?.[handoverKey] ?? rule?.handover ?? 'station';
            const ruleStation = stations.find((s) => s.id === rule?.station_id)?.label ?? 'keine Station';
            return (
              <View key={period} style={{ gap: 8 }}>
                <T bold>{PERIOD_LABEL[period]}</T>
                <T small muted>
                  Übergabe
                </T>
                <Row wrap>
                  <Chip
                    title={`Regel (${HANDOVER_LABEL[rule?.handover ?? 'station']})`}
                    active={!row?.[handoverKey]}
                    onPress={() => set({ [handoverKey]: null })}
                  />
                  {(['station', 'apartment', 'self'] as const).map((h) => (
                    <Chip key={h} title={HANDOVER_LABEL[h]} active={row?.[handoverKey] === h} onPress={() => set({ [handoverKey]: h })} />
                  ))}
                </Row>
                {handover !== 'self' && (
                  <>
                    <T small muted>
                      Station
                    </T>
                    <Row wrap>
                      <Chip title={`Regel (${ruleStation})`} active={!row?.[stationKey]} onPress={() => set({ [stationKey]: null })} />
                      {stations.map((s) => (
                        <Chip key={s.id} title={s.label} active={row?.[stationKey] === s.id} onPress={() => set({ [stationKey]: s.id })} />
                      ))}
                    </Row>
                  </>
                )}
              </View>
            );
          })}
        </>
      )}
    </Sheet>
  );
}
