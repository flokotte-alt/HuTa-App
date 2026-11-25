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
  Reihenfolge ändern, Start-Knopf, Standort wird geteilt (auch im Hintergrund, "Standort immer erlauben"),
  Navigation in der App (oder in der Karten-App), Display bleibt an, Stopp-Leiste mit Daumen-Status,
  "Nächster Stopp" und automatische Erkennung der Ankunft, Wohnungs-Wünsche übernehmen, Nachzügler erinnern, Fahrt beenden.

**Kunden**
- Wochenliste (nur Hundenamen), eigene Regeln, Schließzeiten, Urlaub eintragen.
- Während der Fahrt: Countdown (Stopps, Minuten, Uhrzeit), Karte mit der eigenen Station, Daumen-Check, Krankmeldung,
  Wohnungs-Wunsch, Anrufen und WhatsApp.
- Einwilligung beim ersten Start, Datenschutzseite, Konto und Daten löschen.

**Push-Nachrichten:** Fahrt gestartet, "Gleich bist du dran" 15 Minuten vorher (eigener Ton, auf dem iPhone als dringende
Mitteilung), neue Zeit bei mehr als 10 Minuten Verschiebung, Wochenplan veröffentlicht oder geändert, Krankmeldung und
Wohnungs-Wunsch an die Dienstleister, Erinnerung an Nachzügler.

## Im Build vorbereitet, Funktion folgt später per Update

Kamera, Fotos und Code-Scan, Dokumente, PDF und Teilen, Countdown auf dem iPhone-Sperrbildschirm (Live-Aktivität),
Netz-Erkennung und lokale Datenbank, Animationen, Gesten, Symbole, Schriften, Datumsauswahl, Vibration, Dunkelmodus,
Fehlerberichte (aktiv sobald die Sentry-DSN hinterlegt ist), Links von der Website in die App.

## Noch nicht enthalten

- Karte mit Live-Standort für Kunden (bewusst nicht Teil der ersten Version, später ohne neuen Build möglich).
- CarPlay und Android Auto, Bezahlen, Google- oder Apple-Login.

## Updates und Builds

Alles, was du selbst anlegen musst, steht in **EINRICHTUNG.md**. Die App braucht iOS 17 oder neuer.

**Änderung nur an Bildschirmen, Texten oder Logik:** Update ohne neuen Build.

```powershell
npm run update -- --message "Was geändert wurde"
```

**Neuer nativer Baustein oder Änderung an `app.json`:** Versionsnummer in `app.json` erhöhen, dann neu bauen.

```powershell
npx.cmd eas-cli build --platform android --profile preview
```

```powershell
npx.cmd eas-cli build --platform ios --profile preview
```

Prüf-Build ohne echte Schlüssel (nur ob alles zusammenbaut): `--profile kompiliertest`.

## Datenbank

Schema in `supabase/migrations`, Beispieldaten in `supabase/seed.sql` (erfundene Kunden und Hunde, sechs Stationen),
Routenberechnung in `supabase/functions/plan-route`.

Dienstleister-Konten werden **serverseitig** freigeschaltet. Nach der Registrierung in der App:

```sql
update public.profiles set role = 'provider' where email = 'name@beispiel.de';
```

Kunden werden vorher vom Dienstleister mit E-Mail angelegt. Registriert sich der Kunde mit dieser E-Mail,
wird sein Konto automatisch mit den Hunden verknüpft.
