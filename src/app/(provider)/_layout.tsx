import { useEffect } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { registerPush } from '@/lib/push';
import { tabOptions, tabIcon } from '@/lib/tabs';
import { useTheme } from '@/lib/theme';
import { useNewVacations } from '@/lib/vacationNews';

export default function ProviderLayout() {
  const { session, profile, loading } = useAuth();
  useEffect(() => {
    if (profile?.role === 'provider') registerPush(true);
  }, [profile?.role]);
  if (loading) return <Spinner />;
  if (!session || !profile || profile.role !== 'provider') return <Redirect href="/" />;
  return <ProviderTabs />;
}

function ProviderTabs() {
  const { colors } = useTheme();
  const news = useNewVacations();
  return (
    <Tabs screenOptions={tabOptions(colors)}>
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="customers" options={{ title: 'Kunden', tabBarIcon: tabIcon('people') }} />
      <Tabs.Screen name="album" options={{ title: 'Album', tabBarIcon: tabIcon('images') }} />
      <Tabs.Screen name="settings" options={{ title: 'Einstellungen', tabBarIcon: tabIcon('settings'), tabBarBadge: news || undefined }} />
    </Tabs>
  );
}
