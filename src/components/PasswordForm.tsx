// Eigenes Passwort setzen oder aendern
import { useState } from 'react';
import { Btn, Field, T } from './ui';
import { useAuth } from '@/lib/auth';
import { notify } from '@/lib/dialog';
import { supabase } from '@/lib/supabase';

const MIN = 8;

export function PasswordForm({ askCurrent, submitTitle, onDone }: { askCurrent: boolean; submitTitle: string; onDone: () => void }) {
  const { profile, refresh } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (next !== again) return notify('Passwörter prüfen', 'Die beiden neuen Passwörter sind nicht gleich.');
    setBusy(true);
    try {
      if (askCurrent) {
        const { error } = await supabase.auth.signInWithPassword({ email: profile!.email!, password: current });
        if (error) return notify('Aktuelles Passwort stimmt nicht', 'Bitte noch einmal eingeben.');
      }
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) {
        const same = error.code === 'same_password' || error.message.toLowerCase().includes('different');
        return notify('Das hat nicht geklappt', same ? 'Das neue Passwort muss sich vom bisherigen unterscheiden.' : error.message);
      }
      await refresh();
      setCurrent('');
      setNext('');
      setAgain('');
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {askCurrent && (
        <Field label="Aktuelles Passwort" value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" textContentType="password" />
      )}
      <Field label="Neues Passwort" value={next} onChangeText={setNext} secureTextEntry autoCapitalize="none" textContentType="newPassword" />
      <Field label="Neues Passwort wiederholen" value={again} onChangeText={setAgain} secureTextEntry autoCapitalize="none" textContentType="newPassword" />
      <T small muted>
        Mindestens {MIN} Zeichen.
      </T>
      <Btn title={submitTitle} onPress={submit} busy={busy} disabled={next.length < MIN || !again || (askCurrent && !current)} />
    </>
  );
}
