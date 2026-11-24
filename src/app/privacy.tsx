import { Card, H2, Screen, T } from '@/components/ui';
import { PRIVACY_TEXT } from '@/lib/legal';

export default function Privacy() {
  return (
    <Screen>
      <T small muted>
        Entwurf, wird vor dem Einsatz rechtlich geprüft.
      </T>
      {PRIVACY_TEXT.map((p) => (
        <Card key={p.title}>
          <H2>{p.title}</H2>
          <T>{p.body}</T>
        </Card>
      ))}
    </Screen>
  );
}
