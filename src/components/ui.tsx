import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors } from '@/lib/theme';

export function Screen({
  children,
  onRefresh,
  refreshing,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 12 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

export const H1 = ({ children }: { children: ReactNode }) => <Text style={s.h1}>{children}</Text>;
export const H2 = ({ children }: { children: ReactNode }) => <Text style={s.h2}>{children}</Text>;
export const T = ({
  children,
  muted,
  color,
  bold,
  small,
}: {
  children: ReactNode;
  muted?: boolean;
  color?: string;
  bold?: boolean;
  small?: boolean;
}) => (
  <Text
    style={{
      fontSize: small ? 14 : 17,
      color: color ?? (muted ? colors.grey : colors.dark),
      fontWeight: bold ? '700' : '400',
    }}
  >
    {children}
  </Text>
);

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Btn({
  title,
  onPress,
  kind = 'primary',
  disabled,
  busy,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'dark' | 'ghost' | 'danger';
  disabled?: boolean;
  busy?: boolean;
}) {
  const bg =
    kind === 'primary' ? colors.primary : kind === 'dark' ? colors.dark : kind === 'danger' ? colors.red : 'transparent';
  const fg = kind === 'ghost' ? colors.dark : '#fff';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        kind === 'ghost' && { borderWidth: 1.5, borderColor: colors.line },
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Chip({ title, active, onPress }: { title: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
    >
      <Text style={{ color: active ? '#fff' : colors.dark, fontSize: 15, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 14, color: colors.grey, fontWeight: '600' }}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.muted}
        style={[s.input, props.multiline && { minHeight: 80, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

export const Row = ({ children, wrap }: { children: ReactNode; wrap?: boolean }) => (
  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: wrap ? 'wrap' : 'nowrap' }}>
    {children}
  </View>
);

export const Center = ({ children }: { children: ReactNode }) => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>{children}</View>
);

export const Spinner = () => (
  <Center>
    <ActivityIndicator size="large" color={colors.primary} />
  </Center>
);

const s = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '800', color: colors.dark },
  h2: { fontSize: 20, fontWeight: '700', color: colors.dark, marginTop: 4 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  btn: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  btnText: { fontSize: 17, fontWeight: '700' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: '#fff',
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 17,
    backgroundColor: '#fff',
    color: colors.dark,
  },
});
