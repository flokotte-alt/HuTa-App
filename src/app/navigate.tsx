import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { NavScreen } from '@/components/NavScreen';
import { openMaps } from '@/lib/maps';

export default function Navigate() {
  const { lat, lng, label } = useLocalSearchParams<{ lat: string; lng: string; label?: string }>();
  const router = useRouter();
  const target = { lat: Number(lat), lng: Number(lng), label: label ?? 'Station' };
  return (
    <>
      <Stack.Screen options={{ title: target.label }} />
      <NavScreen target={target} onClose={() => router.back()} onExternal={() => openMaps(target)} />
    </>
  );
}
