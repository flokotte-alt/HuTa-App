// Untere Tab-Leiste mit Symbolen
import { Ionicons } from '@expo/vector-icons';
import { Platform, type ColorValue } from 'react-native';
import type { Colors } from './theme';

type Base = 'home' | 'people' | 'images' | 'settings' | 'person';

export const tabIcon =
  (name: Base) =>
  ({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) => (
    <Ionicons name={focused ? name : `${name}-outline`} color={color as string} size={size} />
  );

export const tabOptions = (colors: Colors) => ({
  headerShown: false,
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.muted,
  tabBarStyle: { backgroundColor: colors.header, borderTopColor: colors.line, ...(Platform.OS === 'web' ? { height: 60 } : null) },
  tabBarLabelStyle: { fontSize: 11, lineHeight: 15, fontWeight: '600' as const },
  tabBarBadgeStyle: { backgroundColor: colors.primary, color: colors.onPrimary },
  sceneStyle: { backgroundColor: colors.bg },
});
