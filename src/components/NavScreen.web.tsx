// Web-Vorschau: keine native Navigation
import { Btn, Screen, T } from '@/components/ui';
import type { NavProps } from './NavScreen';

export function NavScreen({ target, onClose, onExternal }: NavProps) {
  return (
    <Screen>
      <T bold>{target.label}</T>
      <T muted>Die Navigation in der App gibt es nur auf dem Handy.</T>
      <Btn title="Karten-App" onPress={onExternal} />
      <Btn kind="ghost" title="Zurück zur Fahrt" onPress={onClose} />
    </Screen>
  );
}
