// Wochenplan der Dienstleister: feste Tage plus Ausnahmen. Aenderungen sind erst Entwuerfe.
import { supabase } from './supabase';

export type Status = 'registered' | 'cancelled_billed' | 'removed';

export type PlanRow = {
  dog_id: string;
  day: string;
  draft: boolean;
  w_status: Status | null;
  w_station_id: string | null;
  w_station_id_afternoon: string | null;
  w_handover_morning: string | null;
  w_handover_afternoon: string | null;
};

export type DayValues = Pick<PlanRow, 'w_station_id' | 'w_station_id_afternoon' | 'w_handover_morning' | 'w_handover_afternoon'>;

// Aendert genau diesen Tag. Die festen Regeln bleiben unberuehrt.
export const setDay = (dogId: string, day: string, status: Status, values?: Partial<DayValues> | null) =>
  supabase.rpc('set_plan_entry', {
    p_dog: dogId,
    p_day: day,
    p_status: status,
    p_station_morning: values?.w_station_id ?? null,
    p_station_afternoon: values?.w_station_id_afternoon ?? null,
    p_handover_morning: values?.w_handover_morning ?? null,
    p_handover_afternoon: values?.w_handover_afternoon ?? null,
  });

export const discardDay = (dogId: string, day: string) => supabase.rpc('set_plan_entry', { p_dog: dogId, p_day: day, p_status: null });
