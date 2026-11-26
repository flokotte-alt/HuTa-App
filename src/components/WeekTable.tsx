// Wochentabelle: Hunde in den Zeilen, Montag bis Freitag in den Spalten, pro Zelle der Name mit Status.
// Eine Zeile hat jeder Hund, der in dieser Woche mindestens einmal eingetragen ist.
// Farben nur fuer: unveroeffentlichte Aenderung, abgesagt (grau) und das blaue U bei Urlaub.
import { useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { T } from './ui';
import { shortDate, shortDay, parseIso } from '@/lib/dates';
import type { PlanRow } from '@/lib/plan';
import { useTheme } from '@/lib/theme';

export type Cell = { dogId: string; day: string };

export function WeekTable({
  days,
  today,
  dogs,
  rows,
  closed,
  onVacation,
  onPress,
}: {
  days: string[];
  today: string;
  dogs: { id: string; name: string }[];
  rows: PlanRow[];
  closed: (day: string) => boolean;
  onVacation: (dogId: string, day: string) => boolean;
  onPress: (cell: Cell) => void;
}) {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  // Groessere Schrift braucht breitere Spalten, dann laesst sich die Tabelle seitlich schieben
  const column = Math.max(width / 5, 62 * Math.max(1, fontScale));

  const byKey = new Map(rows.map((r) => [`${r.dog_id}|${r.day}`, r]));
  const count = (day: string) => rows.filter((r) => r.day === day && r.w_status === 'registered').length;

  return (
    <View
      style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.card }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width - 2)}
    >
      {width > 0 && (
        <ScrollView horizontal scrollEnabled={column * 5 > width + 1} bounces={false}>
          <View style={{ width: column * 5 }}>
            <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line }}>
              {days.map((d) => (
                <View key={d} style={{ width: column, alignItems: 'center', paddingVertical: 6 }}>
                  <Text style={{ color: colors.text, fontWeight: d === today ? '800' : '600', fontSize: 13, textDecorationLine: d === today ? 'underline' : 'none' }}>
                    {shortDay(parseIso(d))} {shortDate(parseIso(d))}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{closed(d) && count(d) === 0 ? 'geschlossen' : `${count(d)} ${count(d) === 1 ? 'Hund' : 'Hunde'}`}</Text>
                </View>
              ))}
            </View>
            {dogs.map((dog, i) => (
              <View key={dog.id} style={{ flexDirection: 'row', borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
                {days.map((day, n) => {
                  const r = byKey.get(`${dog.id}|${day}`);
                  const status = r?.w_status ?? null;
                  const present = status === 'registered' || status === 'cancelled_billed';
                  const draft = !!r?.draft;
                  const cancelled = status === 'cancelled_billed';
                  const vacation = present && onVacation(dog.id, day);
                  const changed = present && !!(r?.w_station_id || r?.w_station_id_afternoon || r?.w_handover_morning || r?.w_handover_afternoon);
                  const background = draft ? colors.draftBg : cancelled ? colors.cancelledBg : 'transparent';
                  const color = draft ? colors.draftText : cancelled ? colors.cancelledText : colors.text;
                  const label = [
                    dog.name,
                    shortDay(parseIso(day)),
                    present ? (cancelled ? 'abgesagt' : 'dabei') : 'nicht dabei',
                    vacation ? 'Urlaub eingetragen' : '',
                    draft ? 'noch nicht veröffentlicht' : '',
                  ]
                    .filter(Boolean)
                    .join(', ');
                  return (
                    <Pressable
                      key={day}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      onPress={() => onPress({ dogId: dog.id, day })}
                      style={({ pressed }) => ({
                        width: column,
                        minHeight: 42,
                        paddingHorizontal: 2,
                        paddingVertical: 4,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderLeftWidth: n ? 1 : 0,
                        borderLeftColor: colors.line,
                        backgroundColor: background,
                        opacity: pressed ? 0.6 : 1,
                      })}
                    >
                      {present || draft ? (
                        <>
                          <Text
                            numberOfLines={1}
                            style={{
                              color,
                              fontSize: 13,
                              fontWeight: cancelled ? '400' : '600',
                              textDecorationLine: !present ? 'line-through' : 'none',
                            }}
                          >
                            {dog.name}
                            {changed ? '*' : ''}
                            {vacation ? <Text style={{ color: colors.vacation, fontWeight: '900' }}> U</Text> : null}
                          </Text>
                          {cancelled && <Text style={{ color, fontSize: 11 }}>abgesagt</Text>}
                        </>
                      ) : (
                        <Text numberOfLines={1} style={{ color: colors.faint, fontSize: 13, opacity: 0.55 }}>
                          +
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
      {dogs.length === 0 && (
        <View style={{ padding: 14 }}>
          <T muted>In dieser Woche ist noch kein Hund eingetragen.</T>
        </View>
      )}
    </View>
  );
}
