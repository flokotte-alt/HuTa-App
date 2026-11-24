import { useEffect, useState } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { registerPush } from '@/lib/push';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export default function CustomerLayout() {
  const { session, profile, loading } = useAuth();
  const [consent, setConsent] = useState<'unknown' | 'yes' | 'no'>('unknown');

  useEffect(() => {
    if (!session) return;
    supabase
      .from('consents')
      .select('user_id')
      .maybeSingle()
      .then(({ data }) => {
        setConsent(data ? 'yes' : 'no');
        if (data) registerPush(false); // Token still erneuern, wenn schon erlaubt
      });
  }, [session]);

  if (loading || (session && !profile)) return <Spinner />;
  if (!session) return <Redirect href="/login" />;
  if (profile?.role === 'provider') return <Redirect href="/(provider)/today" />;
  if (consent === 'unknown') return <Spinner />;
  if (consent === 'no') return <Redirect href="/consent" />;
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
      <Tabs.Screen name="home" options={{ title: 'Start', tabBarLabel: 'Start' }} />
      <Tabs.Screen name="account" options={{ title: 'Mein Hund', tabBarLabel: 'Mein Hund' }} />
    </Tabs>
  );
}
