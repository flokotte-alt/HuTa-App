# Huta: Stand und Aufgaben

Zuletzt aktualisiert: 26.11.2026

## Beim nächsten Mal zuerst (Claude: Florian diese Liste direkt zeigen)

Das neue Konzept ist gebaut (Version 0.3.0). Bericht und alle Entscheidungen: **`UMSETZUNG.md`**.
Befehle passend zum Rechner ausgeben.

1. **Entscheidungen prüfen** (`UMSETZUNG.md`, Abschnitt 7).
2. **Registrierung abschalten** in Supabase (`EINRICHTUNG.md`, F).
3. **A. Google-Schlüssel** (Pflicht für den Build): Projekt "Huta", vier APIs, drei Schlüssel.
4. **B. Firebase** (vor dem Android-Build, sonst kein Push auf Android).
5. Florian schreibt "A und B fertig" und erlaubt den Build. Claude prüft mit `env:list` und startet den Android-Build.
6. **C. iPhone-Build** mit Florians Apple-Login, danach Upload zu TestFlight.
7. Auf den Handys testen (Liste unten). Daten nachtragen (E-Mails, feste Tage, Stationen).

## Kurzfassung

Am 26.11. wurde das neue Konzept aus dem Google Drive ("Huta App", "Auftrag Claude Code.md") umgesetzt.
Migration 0007 und die Server-Funktionen sind im Projekt eingespielt. Geprüft: Typprüfung, Bundles für iOS, Android
und Web, 94 Datenbank-Prüfungen lokal, Klick-Test in der Web-Vorschau gegen einen lokalen Test-Server.
**Kein EAS-Build, kein Upload, kein Update an Geräte.** Auf einem Gerät ist von 0.3.0 nichts getestet.

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
- Prüf-Builds 0.2.0 vom 25.11. waren für iOS und Android erfolgreich. 0.3.0 wurde noch nie gebaut.
  Neu dabei: `expo-video`, `expo-media-library` (Version deshalb erhöht).
- `expo-doctor` meldet seit dem 26.11. neuere Patch-Versionen einiger Expo-Pakete. Bewusst nicht aktualisiert.

## Aufgaben für Claude

1. Nach A und B: `env:list` prüfen, nach Florians Zustimmung Android-Build (`preview`), iOS-Build begleiten.
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
