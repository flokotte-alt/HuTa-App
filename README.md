# Huta (Arbeitstitel)

Abhol-App für die Hundetagesstätte Dogworker Dresden. Diese App ist eigenständig: eigenes Repo, eigenes
Supabase-Projekt, eigene App-Kennung (`de.dogworker.huta`).

## Was die App kann

**Dienstleister**
- Verwaltung: Kunden, Hunde (feste Tage, Wohnungs-Knopf), Stationen (mit Koordinaten-Suche), Regeln für morgens und nachmittags.
- Wochenplan: aus festen Tagen füllen, Status ändern, Station und Übergabe nur für einen Tag ändern, veröffentlichen (mit Push).
  Urlaub der Kunden und Schließzeiten werden zur Information angezeigt.
- Dienstplan (wer fährt), Schließzeiten, eigene Telefonnummer, Zusatzzeit für Wohnungs-Übergabe.
- Fahrt: Startpunkt wählen, Route mit Verkehrsdaten (sobald der Google-Schlüssel eingetragen ist, sonst Schätzung),
  Reihenfolge ändern, Start-Knopf, Standort wird geteilt (auch im Hintergrund), Stopp-Leiste mit Daumen-Status,
  "Nächster Stopp" und automatische Erkennung der Ankunft, Wohnungs-Wünsche übernehmen, Nachzügler erinnern, Fahrt beenden.

**Kunden**
- Wochenliste (nur Hundenamen), eigene Regeln, Schließzeiten, Urlaub eintragen.
- Während der Fahrt: Countdown (Stopps, Minuten, Uhrzeit), Daumen-Check, Krankmeldung, Wohnungs-Wunsch, Anrufen und WhatsApp.
- Einwilligung beim ersten Start, Datenschutzseite, Konto und Daten löschen.

**Push-Nachrichten:** Fahrt gestartet, "Gleich bist du dran" 15 Minuten vorher, neue Zeit bei mehr als 10 Minuten Verschiebung,
Wochenplan veröffentlicht oder geändert, Krankmeldung und Wohnungs-Wunsch an die Dienstleister, Erinnerung an Nachzügler.

## Noch nicht enthalten

- Navigation direkt in der App (Google Navigation SDK). Stattdessen öffnet der Knopf "Navigation starten" Apple Karten
  beziehungsweise Google Maps. Das SDK braucht ein Google-Cloud-Konto und eine eigene native Anbindung.
- Karte mit Live-Standort für Kunden (bewusst nicht Teil der ersten Version).

## Einrichtung und Builds

Alles, was du selbst anlegen musst, steht in **EINRICHTUNG.md**.

```powershell
npm install
npm start
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform ios --profile preview
npx eas-cli submit --platform ios
```

## Datenbank

Schema in `supabase/migrations`, Beispieldaten in `supabase/seed.sql` (erfundene Kunden und Hunde, sechs Stationen),
Routenberechnung in `supabase/functions/plan-route`.

Dienstleister-Konten werden **serverseitig** freigeschaltet. Nach der Registrierung in der App:

```sql
update public.profiles set role = 'provider' where email = 'name@beispiel.de';
```

Kunden werden vorher vom Dienstleister mit E-Mail angelegt. Registriert sich der Kunde mit dieser E-Mail,
wird sein Konto automatisch mit den Hunden verknüpft.
