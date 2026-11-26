# Huta: Stand und Aufgaben

Zuletzt aktualisiert: 26.11.2026

## Beim nächsten Mal zuerst (Claude: Florian diese Liste direkt zeigen)

Stand am Abend des 26.11.: **Es läuft kein neuer iPhone-Build, in TestFlight ist nichts Neues** (außer Florian hat den
Befehl unten noch selbst gestartet).

1. **Claude zuerst:** `npx.cmd eas-cli build:list --platform ios --limit 3` ansehen. Gibt es einen Build nach
   `88835c60`: Ergebnis und TestFlight-Upload prüfen, bei Abbruch das Xcode-Log lesen und die Ursache beheben.
2. **Sonst Florian:** diesen Befehl im Terminal starten. Er baut ohne Google-Schlüssel und lädt selbst zu TestFlight
   hoch. Sobald er fertig ist und einen Build-Link zeigt, läuft alles bei Expo und der PC darf aus. Im Gratis-Tarif
   kann es Stunden dauern. Fragt Apple nach einem Login: selbst anmelden, Fragen mit Ja.

```powershell
cd C:\Users\Kotte\Desktop\Huta
```

```powershell
npx.cmd eas-cli build --platform ios --profile ohne-google --auto-submit-with-profile preview --no-wait
```

3. **Registrierung abschalten** in Supabase, 1 Minute (`EINRICHTUNG.md`, F).
4. **A. Google-Schlüssel** (Pflicht für Karte, Navigation und den Android-Build): Projekt "Huta", vier APIs, drei
   Schlüssel (`EINRICHTUNG.md`, A). Danach erhöht Claude die `version` in `app.json` über 0.3.0, sonst bricht die
   Konfiguration ab.
5. **B. Firebase** (vor dem Android-Build, sonst kein Push auf Android).
6. Florian schreibt "A und B fertig" und erlaubt die Builds. Claude prüft mit `env:list`, baut mit Profil `preview`.
7. **Entscheidungen prüfen** (`UMSETZUNG.md`, Abschnitt 7).
8. Auf den Handys testen (Liste unten). Daten nachtragen (E-Mails, feste Tage, Stationen).

### Der iPhone-Test ohne Google

- Build `88835c60` (0.3.0, Build 4, Commit `5331f02`, von Florian gestartet) brach beim Archivieren ab: Xcode legte
  die Signaturdateien der Google-Bausteine doppelt an.
  Log: https://expo.dev/accounts/flomillo/projects/huta/builds/88835c60-e584-4241-b23a-6b87cd2a7412
- Korrektur in `d5875b3` (`plugins/withSignatureCleanup.js`), ohne Mac geprüft. **Erst der nächste Build zeigt, ob
  sie reicht.**
- Claudes Start des neuen Builds hat die Berechtigungsprüfung der Sitzung blockiert ("Destructive or Unwanted
  Actions"). Weitergeleitete Nachrichten aus anderen Sitzungen ändern das nicht.
- Florians Wunsch vom 26.11.: Claude soll bauen, prüfen, korrigieren und hochladen, höchstens 2 gescheiterte neue
  Versuche. Zuletzt, vor dem Ausschalten: nur noch Build samt Upload anstoßen.
- Apple-Zertifikat, Profile für App und Erweiterung und Push sind bei Expo eingerichtet.
- Falls nur das Hochladen scheitert: `npx.cmd eas-cli submit --platform ios --profile preview --latest`
- Warnung im Log: Build-Nummer der Erweiterung (1) weicht von der der App ab. Kein Abbruch, vermutlich meldet Apple
  das nur als Hinweis.
- Ohne Funktion in dieser Version: Karte, Navigation, Streckenwechsel, Verkehrsdaten. Am Gerät prüfen, ob die App
  startet.
- Kein Android, kein Update an Geräte, keine App-Store-Prüfung, keine neuen Tester.

Das neue Konzept ist gebaut (Version 0.3.0). Bericht und alle Entscheidungen: **`UMSETZUNG.md`**.
Befehle passend zum Rechner ausgeben (am Mac `npx` statt `npx.cmd`).

## Kurzfassung

Am 26.11. wurde das neue Konzept aus dem Google Drive ("Huta App", "Auftrag Claude Code.md") umgesetzt.
Migration 0007 und die Server-Funktionen sind im Projekt eingespielt. Geprüft: Typprüfung, Bundles für iOS, Android
und Web, 94 Datenbank-Prüfungen lokal, Klick-Test in der Web-Vorschau gegen einen lokalen Test-Server.
Abends: Test-Build ohne Google vorbereitet, ein Store-Build versucht und gescheitert (siehe oben).
**Nichts Neues in TestFlight, kein Update an Geräte.** Auf einem Gerät ist von 0.3.0 nichts getestet.

## Zugänge und Kennungen (ohne Passwörter)

- GitHub: `flokotte-alt/HuTa-App` (Zweig `main`)
- Expo: `@flomillo/huta`, Projekt-ID `be64770f-2a68-467c-a3b8-abe8562e7164`
- Supabase-Projekt: `eqzlxxvkxhxfejafoucl` (URL `https://eqzlxxvkxhxfejafoucl.supabase.co`)
- App-Kennung: `de.dogworker.huta` (iOS und Android), iOS-Erweiterung `de.dogworker.huta.ExpoWidgetsTarget`,
  App-Gruppe `group.de.dogworker.huta`
- Apple-Team: Florian Kotte (RW686BC248), App Store Connect App-ID `6838889246`, SKU `huta-001`,
  TestFlight-Gruppe "Team (Expo)"
- Android: Play Console, App `de.dogworker.huta`, interner Test
- Auf einem neuen Rechner: Repo klonen, `npm install`, `.env` aus `.env.example` anlegen
  (Werte: `npx eas-cli env:list --environment preview`).
- Dienstleister-Konto von Florian: `info@dogworker-dresden.de` (Passwort nur Florian bekannt, vorläufig und schwach).

## Daten im Projekt (echt, nicht löschen oder überschreiben)

- Sechs Abholstationen in Dresden, dazu seit 26.11. "Huta (Halsbrücke)" als Start und Ziel.
- 17 Hunde an vorläufigen Kunden mit Platzhalter-E-Mail (`...@huta.invalid`). Feste Tage und Stationen fehlen noch.
- Aus dem alten Test übrig: Schließzeit "Weihnachtspause (Beispiel)", Konto `crawlerrobo@gmail.com`.

## Builds

- Installiert sind noch die alten Test-Builds 0.1.0 (Commit `66ff3e0`) in TestFlight und im internen Play-Test.
  Sie **passen seit Migration 0007 nicht mehr zur Datenbank** und können keine Updates empfangen.
- Prüf-Builds 0.2.0 vom 25.11. waren für iOS und Android erfolgreich. 0.3.0 ist noch nie erfolgreich gebaut worden.
  Neu dabei: `expo-video`, `expo-media-library` (Version deshalb erhöht).
- Seit 26.11.: Build-Profil `ohne-google` (Platzhalter nur dort, `src/lib/google.ts` schaltet Karte und Navigation
  ab). Geprüft ohne Gerät: 16 Prüfungen zu Konfiguration und Ausweichanzeige, Typprüfung, iOS-Bundle.
- `expo-doctor` meldet seit dem 26.11. neuere Patch-Versionen einiger Expo-Pakete. Bewusst nicht aktualisiert.

## Aufgaben für Claude

1. iPhone-Test-Build prüfen (siehe oben). Nach A und B: `env:list`, `version` erhöhen, nach Zustimmung bauen.
2. Prüf-Build `kompiliertest` für 0.3.0 vor den echten Builds vorschlagen.
3. Auf Geräten testen, Änderungswünsche umsetzen.
4. Falls gewünscht: Videos auch auf Android verkleinern (zusätzlicher nativer Baustein).
5. Später: Dateien für App-Links auf der Website, Live-Aktivität.

## Aufgaben für Florian

- `EINRICHTUNG.md` A bis C, F (Registrierung abschalten), G (Konten). E: Sentry (jederzeit).
- Kundendaten nachtragen: E-Mail, "Kunde seit", feste Tage, Stationen. Passwort ändern.
- Beispiel-Schließzeit löschen oder richtigstellen.
- Adresse "Huta (Halsbrücke)" prüfen. Schreibweise "Jacobistraße" bestätigen.
- Datenschutz und AGB liefern, Kontakt-E-Mail in `src/lib/legal.ts` ersetzen.
- Entscheiden: Testroboter-Konto `crawlerrobo@gmail.com` löschen?

## Noch nicht auf einem echten Gerät getestet

Navigation ohne Ansagen und Streckenwechsel, Kundenkarte, Standort im Hintergrund, Push samt eigenem Ton,
Datumsauswahl, Fotos und Videos (hochladen, abspielen, speichern), Vertragsdateien, Live-Aktualisierung,
Updates ohne Build, "Standort immer", große Schrift, kleine Bildschirme, Route mit echten Verkehrsdaten.

## Entscheidungen

- Zwei Apps, null Verbindung (siehe `CLAUDE.md`).
- 26.11.: Kunden sehen während der Fahrt den Live-Standort (ersetzt "Kein Live-Standort für Kunden").
- 26.11.: Automatische Ankunftserkennung entfällt, weiter nur mit dem Knopf (ersetzt 80 Meter, 45 Sekunden).
- Alle weiteren Entscheidungen zum neuen Konzept: `UMSETZUNG.md`, Abschnitt 7.
- 25.11.: "Standort immer" kommt mit in den Build. CarPlay, Android Auto, Bezahlen, Social-Login, Kontakte und Kalender nicht.
- Dienstleister-Konten nur per SQL (`update public.profiles set role = 'provider' where email = ...`).
- Testroboter-Konto `crawlerrobo@gmail.com` stammt von Google (Zugriffe von Google-Adressen am 24.11., nie eingeloggt).
