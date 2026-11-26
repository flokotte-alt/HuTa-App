// Datumsauswahl (iPhone und Android). Die Web-Vorschau nutzt DateField.web.tsx.
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Btn, IconBtn, Sheet } from '@/components/ui';
import { iso, longDateLabel, parseIso } from '@/lib/dates';
import { useTheme } from '@/lib/theme';
import type { DateFieldProps } from './dateFieldTypes';

export function DateField({ label, value, onChange, min, clearable }: DateFieldProps) {
  const { colors, dark } = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(new Date());
  const current = value ? parseIso(value) : min ? parseIso(min) : new Date();

  const picker = (onPick: (d: Date) => void, shown: Date) => (
    <DateTimePicker
      value={shown}
      mode="date"
      display={Platform.OS === 'ios' ? 'inline' : 'default'}
      locale="de-DE"
      minimumDate={min ? parseIso(min) : undefined}
      themeVariant={dark ? 'dark' : 'light'}
      accentColor={Platform.OS === 'ios' ? colors.primary : undefined}
      onValueChange={(_event, date) => onPick(date)}
      onDismiss={() => setOpen(false)}
    />
  );

  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 14, color: colors.muted, fontWeight: '600' }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value ? longDateLabel(value) : 'Datum wählen'}`}
          onPress={() => {
            setDraft(current);
            setOpen(true);
          }}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: 10,
            backgroundColor: colors.field,
            paddingHorizontal: 12,
            paddingVertical: 12,
          }}
        >
          <Text style={{ fontSize: 16, color: value ? colors.text : colors.faint }}>{value ? longDateLabel(value) : 'Datum wählen'}</Text>
        </Pressable>
        {clearable && value ? <IconBtn icon="close-circle-outline" label={`${label} entfernen`} onPress={() => onChange('')} /> : null}
      </View>
      {open &&
        (Platform.OS === 'ios' ? (
          <Sheet visible title={label} onClose={() => setOpen(false)}>
            {picker(setDraft, draft)}
            <Btn
              title="Übernehmen"
              onPress={() => {
                onChange(iso(draft));
                setOpen(false);
              }}
            />
          </Sheet>
        ) : (
          picker((d) => {
            setOpen(false);
            onChange(iso(d));
          }, current)
        ))}
    </View>
  );
}
