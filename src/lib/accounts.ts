// Kundenzugaenge: laeuft ueber die Edge Function customer-account (Admin-Rechte nur auf dem Server)
import { supabase } from './supabase';

export type AccountAction = 'create' | 'reset' | 'update_email' | 'remove_access' | 'delete_customer';

export async function customerAccount(
  action: AccountAction,
  customerId: string,
  email?: string,
): Promise<{ error?: string; password?: string; email?: string }> {
  const { data, error } = await supabase.functions.invoke('customer-account', { body: { action, customerId, email } });
  if (error) return { error: 'Der Server hat nicht geantwortet. Bitte Verbindung prüfen und noch einmal versuchen.' };
  return data ?? {};
}

export const isPlaceholderEmail = (email: string) => email.endsWith('.invalid');
