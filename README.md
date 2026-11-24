# Huta (Arbeitstitel)

Abhol-App für die Hundetagesstätte Dogworker Dresden. Diese App ist eigenständig: eigenes Repo, eigenes
Supabase-Projekt, eigene App-Kennung (`de.dogworker.huta`).

Stand: **Prototyp**. Enthalten sind Anmeldung mit Rollen, Verwaltung (Kunden, Hunde, Stationen, Regeln),
Wochenplan mit Veröffentlichen, Dienstplan, Schließzeiten, Kunden-Dashboard mit Countdown, Daumen-Check,
Krankmeldung, Wohnungs-Knopf, Kontakt-Knöpfe und eine einfache Fahrt mit Live-Standort.

## Noch nicht enthalten

- Push-Nachrichten (Code-Gerüst für Berechtigung und Token fehlt noch, braucht den Apple-Push-Schlüssel)
- Navigation in der App (Google Navigation SDK). Stattdessen öffnet der Knopf "Navigation starten" Apple Karten
  beziehungsweise Google Maps.
- Routen mit Verkehrsdaten. Die Reihenfolge ist ein Vorschlag nach Luftlinie, die Ankunftszeiten sind Schätzungen.
- Standort im Hintergrund und automatische Erkennung der Ankunft. Der Standort wird nur gesendet, solange die App offen ist.

## Einrichtung

1. `.env.example` nach `.env` kopieren und Supabase-Adresse und öffentlichen Schlüssel eintragen.
2. `npm install`
3. `npm start` (Entwicklung) oder Build über EAS (siehe unten).

## Datenbank

Das Schema liegt in `supabase/migrations`, die Beispieldaten in `supabase/seed.sql`
(erfundene Kunden und Hunde, die sechs bekannten Stationen). Alles ist später in der App änderbar.

Dienstleister-Konten werden **serverseitig** freigeschaltet. Nach der Registrierung in der App:

```sql
update public.profiles set role = 'provider' where email = 'name@beispiel.de';
```

Kunden werden vorher vom Dienstleister mit E-Mail angelegt. Registriert sich der Kunde mit dieser E-Mail,
wird sein Konto automatisch mit den Hunden verknüpft.

## Builds (EAS)

```powershell
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform ios --profile preview
npx eas-cli submit --platform ios
```

Für iOS muss vorher in App Store Connect ein App-Eintrag mit der Bundle-ID `de.dogworker.huta` existieren.
