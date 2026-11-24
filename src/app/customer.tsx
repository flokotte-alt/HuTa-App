import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Btn, Field, Screen } from '@/components/ui';
import { notify } from '@/lib/dialog';
import { supabase } from '@/lib/supabase';

export default function CustomerForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('customers')
      .select('name, email, phone')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setName(data.name);
          setEmail(data.email);
          setPhone(data.phone ?? '');
        }
      });
  }, [id]);

  async function save() {
    setBusy(true);
    const values = { name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim() || null };
    const { error } = id ? await supabase.from('customers').update(values).eq('id', id) : await supabase.from('customers').insert(values);
    setBusy(false);
    if (error) return notify('Fehler', error.message);
    router.back();
  }

  return (
    <Screen>
      <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
      <Field label="E-Mail (für die Verknüpfung beim Registrieren)" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Field label="Telefon" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Btn title="Speichern" onPress={save} busy={busy} disabled={!name.trim() || !email.trim()} />
      <Btn kind="ghost" title="Abbrechen" onPress={() => router.back()} />
    </Screen>
  );
}
