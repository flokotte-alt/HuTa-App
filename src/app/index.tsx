import { Redirect } from 'expo-router';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function Index() {
  const { session, profile, loading } = useAuth();
  if (loading || (session && !profile)) return <Spinner />;
  if (!session) return <Redirect href="/login" />;
  return <Redirect href={profile?.role === 'provider' ? '/(provider)/today' : '/(customer)/home'} />;
}
