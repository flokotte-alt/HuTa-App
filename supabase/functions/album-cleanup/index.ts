// Huta: abgelaufene Fotos und Videos loeschen (Dateien und Eintraege). Wird taeglich von der Datenbank
// aufgerufen. Statt eines Nutzer-Tokens prueft die Funktion selbst ein Geheimnis aus dem Datenbank-Tresor.
import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const secret = req.headers.get('x-cron-secret') ?? '';
  const { data: allowed } = await admin.rpc('check_cron_secret', { p_secret: secret });
  if (!secret || !allowed) return json({ error: 'Nicht erlaubt' }, 401);

  const bucket = admin.storage.from('album');
  let removed = 0;

  for (let round = 0; round < 20; round++) {
    const { data: items, error } = await admin
      .from('album_items')
      .select('id, path')
      .lte('expires_at', new Date().toISOString())
      .limit(100);
    if (error) return json({ error: error.message }, 500);
    if (!items?.length) break;
    const rm = await bucket.remove(items.map((i) => i.path));
    if (rm.error) return json({ error: rm.error.message }, 500);
    const del = await admin.from('album_items').delete().in('id', items.map((i) => i.id));
    if (del.error) return json({ error: del.error.message }, 500);
    removed += items.length;
  }

  // Reste ohne Eintrag (abgebrochene Uploads), aelter als ein Tag
  let orphans = 0;
  const { data: files } = await bucket.list('', { limit: 1000, sortBy: { column: 'created_at', order: 'asc' } });
  const old = (files ?? []).filter((f) => f.created_at && Date.now() - Date.parse(f.created_at) > 86_400_000);
  if (old.length) {
    const { data: known } = await admin.from('album_items').select('path').in('path', old.map((f) => f.name));
    const keep = new Set((known ?? []).map((k) => k.path));
    const drop = old.map((f) => f.name).filter((n) => !keep.has(n));
    if (drop.length) {
      await bucket.remove(drop);
      orphans = drop.length;
    }
  }

  return json({ removed, orphans });
});
