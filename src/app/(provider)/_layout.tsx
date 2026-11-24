import { useEffect } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { registerPush } from '@/lib/push';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';

export default function ProviderLayout() {
  const { session, profile, loading } = useAuth();
  useEffect(() => {
    if (profile?.role === 'provider') registerPush(true);
  }, [profile?.role]);
  if (loading || (session && !profile)) return <Spinner />;
  if (!session) return <Redirect href="/login" />;
  if (profile?.role !== 'provider') return <Redirect href="/(customer)/home" />;
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
      <Tabs.Screen name="today" options={{ title: 'Heute', tabBarLabel: 'Heute' }} />
      <Tabs.Screen name="week" options={{ title: 'Wochenplan', tabBarLabel: 'Woche' }} />
      <Tabs.Screen name="manage" options={{ title: 'Verwaltung', tabBarLabel: 'Verwaltung' }} />
      <Tabs.Screen name="more" options={{ title: 'Mehr', tabBarLabel: 'Mehr' }} />
    </Tabs>
  );
}
