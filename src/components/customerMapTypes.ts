import type { Pt } from '@/lib/trip';

export type CustomerMapProps = { station: Pt & { label: string }; vehicle: Pt | null };
