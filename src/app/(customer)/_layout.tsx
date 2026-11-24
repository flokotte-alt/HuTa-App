import { Redirect, Tabs } from 'expo-router';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';

export default function CustomerLayout() {
  const { session, profile, loading } = useAuth();
  if (loading || (session && !profile)) return <Spinner />;
  if (!session) return <Redirect href="/login" />;
  if (profile?.role === 'provider') return <Redirect href="/(provider)" />;
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.dark },
        headerTintColor: '#fff',
        tabBarActiveTintColor: colors.primary,
        tabBarLabelStyle: { fontSize: 14, fontWeight: '700' },
        tabBarIconStyle: { display: 'none' },
        tabBarStyle: { height: 56 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Start', tabBarLabel: 'Start' }} />
      <Tabs.Screen name="account" options={{ title: 'Mein Hund', tabBarLabel: 'Mein Hund' }} />
    </Tabs>
  );
}
