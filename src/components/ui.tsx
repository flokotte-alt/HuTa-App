// Gemeinsame Bausteine. Alle Farben kommen aus dem Theme, die Schriftgroesse folgt der Einstellung des Handys.
import { type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({
  children,
  onRefresh,
  refreshing,
  safeTop,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  safeTop?: boolean;
}) {
  const { colors } = useTheme();
  const scroll = (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 12, width: '100%', maxWidth: 720, alignSelf: 'center' }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
    >
      {children}
    </ScrollView>
  );
  return safeTop ? (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.bg }}>
      {scroll}
    </SafeAreaView>
  ) : (
    scroll
  );
}

type TextProps = {
  children: ReactNode;
  muted?: boolean;
  color?: string;
  bold?: boolean;
  small?: boolean;
  center?: boolean;
  lines?: number;
};

export function T({ children, muted, color, bold, small, center, lines }: TextProps) {
  const { colors } = useTheme();
  return (
    <Text
      numberOfLines={lines}
      style={{
        fontSize: small ? 14 : 16,
        color: color ?? (muted ? colors.muted : colors.text),
        fontWeight: bold ? '700' : '400',
        textAlign: center ? 'center' : undefined,
        flexShrink: 1,
      }}
    >
      {children}
    </Text>
  );
}

export function H1({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text accessibilityRole="header" style={{ fontSize: 26, fontWeight: '800', color: colors.text }}>
      {children}
    </Text>
  );
}

export function H2({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text accessibilityRole="header" style={{ fontSize: 19, fontWeight: '700', color: colors.text, marginTop: 6 }}>
      {children}
    </Text>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: ViewStyle; onPress?: () => void }) {
  const { colors } = useTheme();
  const base: ViewStyle = {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.line,
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [base, style, pressed && { opacity: 0.75 }]}>
      {children}
    </Pressable>
  );
}

export function Btn({
  title,
  onPress,
  kind = 'primary',
  disabled,
  busy,
  icon,
  big,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  busy?: boolean;
  icon?: IconName;
  big?: boolean;
}) {
  const { colors } = useTheme();
  const bg = kind === 'primary' ? colors.primary : kind === 'danger' ? colors.danger : kind === 'secondary' ? colors.primarySoft : 'transparent';
  const fg = kind === 'primary' ? colors.onPrimary : kind === 'danger' ? colors.onDanger : kind === 'secondary' ? colors.text : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!busy }}
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => ({
        minHeight: big ? 84 : 50,
        borderRadius: big ? 18 : 10,
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: bg,
        borderWidth: kind === 'ghost' ? 1 : 0,
        borderColor: colors.line,
        opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={big ? 28 : 20} color={fg} />}
          <Text style={{ color: fg, fontSize: big ? 22 : 16, fontWeight: '700', textAlign: 'center', flexShrink: 1 }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconBtn({ icon, label, onPress, disabled, color }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean; color?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => ({
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.3 : pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={icon} size={24} color={color ?? colors.primary} />
    </Pressable>
  );
}

export function Chip({ title, active, onPress }: { title: string; active?: boolean; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 13,
        paddingVertical: 9,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.line,
        backgroundColor: active ? colors.primary : colors.field,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Text style={{ color: active ? colors.onPrimary : colors.text, fontSize: 15, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  const { colors, dark } = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 14, color: colors.muted, fontWeight: '600' }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardAppearance={dark ? 'dark' : 'light'}
        {...props}
        placeholderTextColor={colors.faint}
        style={{
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 11,
          fontSize: 16,
          backgroundColor: colors.field,
          color: colors.text,
          minHeight: props.multiline ? 80 : undefined,
          textAlignVertical: props.multiline ? 'top' : 'center',
        }}
      />
    </View>
  );
}

export function SwitchRow({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
      <View style={{ flex: 1 }}>
        <T>{label}</T>
        {hint ? (
          <T small muted>
            {hint}
          </T>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.line, true: colors.primary }}
        thumbColor={Platform.OS === 'ios' ? undefined : '#FFFFFF'}
        ios_backgroundColor={colors.line}
        {...(Platform.OS === 'web' ? { activeThumbColor: '#FFFFFF' } : {})}
      />
    </View>
  );
}

// Zeile mit Pfeil, zum Beispiel in den Einstellungen
export function LinkRow({ title, hint, icon, onPress, badge }: { title: string; hint?: string; icon?: IconName; onPress: () => void; badge?: number }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, opacity: pressed ? 0.6 : 1 })}
    >
      {icon && <Ionicons name={icon} size={22} color={colors.primary} />}
      <View style={{ flex: 1 }}>
        <T bold>{title}</T>
        {hint ? (
          <T small muted>
            {hint}
          </T>
        ) : null}
      </View>
      {badge ? <Badge text={`${badge} neu`} /> : null}
      <Ionicons name="chevron-forward" size={20} color={colors.faint} />
    </Pressable>
  );
}

export function Badge({ text, color, background }: { text: string; color?: string; background?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: background ?? colors.primarySoft, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ color: color ?? colors.text, fontSize: 13, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

export const Divider = () => {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.line }} />;
};

// Auswahlfenster von unten
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityLabel="Schließen" onPress={onClose} style={{ flex: 1, minHeight: 40, backgroundColor: 'rgba(0,0,0,0.4)' }} />
        <SafeAreaView
          edges={['bottom']}
          style={{ backgroundColor: colors.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '88%' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 6, paddingTop: 8 }}>
            <View style={{ flex: 1 }}>
              <H2>{title}</H2>
            </View>
            <IconBtn icon="close" label="Schließen" onPress={onClose} />
          </View>
          <ScrollView
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ padding: 16, gap: 10, width: '100%', maxWidth: 720, alignSelf: 'center' }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export const Row = ({ children, wrap }: { children: ReactNode; wrap?: boolean }) => (
  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: wrap ? 'wrap' : 'nowrap' }}>{children}</View>
);

export const Grow = ({ children }: { children: ReactNode }) => <View style={{ flex: 1 }}>{children}</View>;

export function Center({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg }}>{children}</View>;
}

export function Spinner() {
  const { colors } = useTheme();
  return (
    <Center>
      <ActivityIndicator size="large" color={colors.primary} />
    </Center>
  );
}
