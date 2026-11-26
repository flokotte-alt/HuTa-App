import { useRouter } from 'expo-router';
import { PasswordForm } from '@/components/PasswordForm';
import { Screen } from '@/components/ui';
import { notify } from '@/lib/dialog';

export default function Password() {
  const router = useRouter();
  return (
    <Screen>
      <PasswordForm
        askCurrent
        submitTitle="Passwort ändern"
        onDone={() => {
          notify('Passwort geändert');
          router.back();
        }}
      />
    </Screen>
  );
}
