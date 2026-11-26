import { useEffect } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { registerPush } from '@/lib/push';
import { tabOptions, tabIcon } from '@/lib/tabs';
import { useTheme } from '@/lib/theme';

export default function CustomerLayout() {
  const { session, profile, consent, loading } = useAuth();
  const { colors } = useTheme();
  const ready = profile?.role === 'customer' && !profile.must_change_password && consent;

  useEffect(() => {
    if (ready) registerPush(false); // Token still erneuern, wenn schon erlaubt
  }, [ready]);

  if (loading) return <Spinner />;
  // Anmeldung, eigenes Passwort und Datenschutz regelt die Startweiche
  if (!session || !ready) return <Redirect href="/" />;
  return (
    <Tabs screenOptions={tabOptions(colors)}>
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="album" options={{ title: 'Album', tabBarIcon: tabIcon('images') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: tabIcon('person') }} />
    </Tabs>
  );
}
