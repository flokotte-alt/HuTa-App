// Huta: Kundenzugaenge anlegen und verwalten. Laeuft mit Admin-Rechten, deshalb nur auf dem Server.
// Aufruf nur durch angemeldete Dienstleister.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
// Fachliche Fehler kommen mit Status 200 und { error }, damit die App den Text anzeigen kann.
const refuse = (error: string) => json({ error });

// Einmalpasswort ohne leicht verwechselbare Zeichen, zum Abtippen: xxxx-xxxx-99
function oneTimePassword() {
  const letters = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const rnd = new Uint32Array(10);
  crypto.getRandomValues(rnd);
  const pick = (set: string, i: number) => set[rnd[i] % set.length];
  const part = (from: number) => Array.from({ length: 4 }, (_, i) => pick(letters, from + i)).join('');
  return `${part(0)}-${part(4)}-${pick(digits, 8)}${pick(digits, 9)}`;
}

const validMail = (m: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m) && !m.endsWith('.invalid');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Nicht erlaubt' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: isProvider } = await caller.rpc('is_provider');
  if (!isProvider) return json({ error: 'Nicht erlaubt' }, 403);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let input: { action?: string; customerId?: string; email?: string };
  try {
    input = await req.json();
  } catch {
    return json({ error: 'Ungueltige Eingabe' }, 400);
  }
  const { action, customerId } = input;
  if (!customerId) return json({ error: 'Ungueltige Eingabe' }, 400);

  const { data: customer } = await admin.from('customers').select('*').eq('id', customerId).maybeSingle();
  if (!customer) return refuse('Kunde nicht gefunden.');
  const email = (input.email ?? customer.email ?? '').trim().toLowerCase();

  const emailTaken = async () => {
    const { data } = await admin.from('customers').select('id').eq('email', email).neq('id', customerId).maybeSingle();
    return !!data;
  };

  async function flagMustChange(userId: string) {
    const { error } = await admin
      .from('profiles')
      .update({ must_change_password: true, name: customer.name, phone: customer.phone, email })
      .eq('id', userId);
    if (error) throw error;
  }

  try {
    if (action === 'create') {
      if (customer.user_id) return refuse('Dieser Kunde hat schon einen Zugang.');
      if (!validMail(email)) return refuse('Bitte zuerst eine echte E-Mail-Adresse eintragen.');
      if (await emailTaken()) return refuse('Diese E-Mail-Adresse gehört schon zu einem anderen Kunden.');

      const password = oneTimePassword();
      let userId: string;
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: customer.name },
      });
      if (created.data.user) {
        userId = created.data.user.id;
      } else {
        // Adresse ist schon registriert: nur ein freies Kundenkonto darf uebernommen werden
        const { data: existing } = await admin.from('profiles').select('id, role').eq('email', email).maybeSingle();
        if (!existing) return refuse(created.error?.message ?? 'Konto konnte nicht angelegt werden.');
        if (existing.role !== 'customer') return refuse('Diese Adresse gehört zu einem Dienstleister-Konto.');
        const { data: linked } = await admin.from('customers').select('id').eq('user_id', existing.id).maybeSingle();
        if (linked) return refuse('Diese Adresse ist schon einem anderen Kunden zugeordnet.');
        const upd = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
        if (upd.error) throw upd.error;
        await admin.from('consents').delete().eq('user_id', existing.id);
        userId = existing.id;
      }
      await flagMustChange(userId);
      const { error } = await admin.from('customers').update({ email, user_id: userId }).eq('id', customerId);
      if (error) throw error;
      return json({ password, email });
    }

    if (action === 'reset') {
      if (!customer.user_id) return refuse('Dieser Kunde hat noch keinen Zugang.');
      const password = oneTimePassword();
      const upd = await admin.auth.admin.updateUserById(customer.user_id, { password });
      if (upd.error) throw upd.error;
      await flagMustChange(customer.user_id);
      return json({ password, email: customer.email });
    }

    if (action === 'update_email') {
      if (!validMail(email)) return refuse('Bitte eine gültige E-Mail-Adresse eingeben.');
      if (await emailTaken()) return refuse('Diese E-Mail-Adresse gehört schon zu einem anderen Kunden.');
      if (customer.user_id) {
        const upd = await admin.auth.admin.updateUserById(customer.user_id, { email, email_confirm: true });
        if (upd.error) throw upd.error;
        await admin.from('profiles').update({ email }).eq('id', customer.user_id);
      }
      const { error } = await admin.from('customers').update({ email }).eq('id', customerId);
      if (error) throw error;
      return json({ email });
    }

    if (action === 'remove_access' || action === 'delete_customer') {
      if (customer.user_id) {
        const { data: profile } = await admin.from('profiles').select('role').eq('id', customer.user_id).maybeSingle();
        if (profile?.role === 'provider') return refuse('Dienstleister-Konten werden hier nicht gelöscht.');
        const del = await admin.auth.admin.deleteUser(customer.user_id);
        if (del.error) throw del.error;
      }
      if (action === 'delete_customer') {
        const { data: files } = await admin.from('customer_files').select('path').eq('customer_id', customerId);
        if (files?.length) {
          const rm = await admin.storage.from('contracts').remove(files.map((f) => f.path));
          if (rm.error) throw rm.error;
        }
        const { error } = await admin.from('customers').delete().eq('id', customerId);
        if (error) throw error;
      }
      return json({ ok: true });
    }

    return json({ error: 'Unbekannte Aktion' }, 400);
  } catch (e) {
    console.error(e);
    return refuse(e instanceof Error ? e.message : 'Das hat nicht geklappt.');
  }
});
