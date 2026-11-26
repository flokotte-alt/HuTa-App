// Web-Vorschau: Datumsauswahl des Browsers
import { createElement } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '@/lib/theme';
import type { DateFieldProps } from './dateFieldTypes';

export function DateField({ label, value, onChange, min }: DateFieldProps) {
  const { colors, dark } = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 14, color: colors.muted, fontWeight: '600' }}>{label}</Text>
      {createElement('input', {
        type: 'date',
        'aria-label': label,
        value,
        min,
        onChange: (e: { target: { value: string } }) => onChange(e.target.value),
        style: {
          border: `1px solid ${colors.line}`,
          borderRadius: 10,
          padding: '11px 12px',
          fontSize: 16,
          fontFamily: 'system-ui, sans-serif',
          background: colors.field,
          color: colors.text,
          colorScheme: dark ? 'dark' : 'light',
        },
      })}
    </View>
  );
}
