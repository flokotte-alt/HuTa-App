# Huta: Stand und Aufgaben

Zuletzt aktualisiert: 25.11.2026 (nachmittags)

## Kurzfassung

Version 0.2.0 ist vorbereitet: alle nativen Bausteine für den nächsten Build sind eingebaut (Commit `ff932cc`).
Die echten Builds fehlen noch, weil Florians Google-Schlüssel fehlen. Zwei Prüf-Builds mit Platzhalter-Schlüsseln
laufen bei Expo. Auf einem Gerät ist von 0.2.0 noch nichts getestet. Optik und Änderungswünsche folgen später per Update.

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
- Dienstleister-Konto von Florian: `info@dogworker-dresden.de` (Passwort nur Florian bekannt, vorläufig und schwach, siehe Aufgaben).

## Builds

- Installiert sind noch die alten Test-Builds 0.1.0 (Commit `66ff3e0`) in TestFlight und im internen Play-Test.
  Sie können **keine** Updates empfangen. Datenbank-Änderungen wirken auch dort.
- Prüf-Builds 0.2.0 (Profil `kompiliertest`, nicht zum Verteilen, Karte und Navi ohne echte Schlüssel):
  iOS-Simulator `f4baff71-b16f-40a1-a8fc-1cbe706a3113`, Android-APK `25f415e6-40ae-426f-8840-50d1686965eb`.
  **Ergebnis prüfen.**

## Was in 0.2.0 neu ist

- OTA-Updates (`expo-updates`, Kanäle `preview` und `production`, `runtimeVersion` = App-Version).
- Navigation in der App (Google Navigation SDK, Beta, 0.19.1), Karte mit eigener Station für Kunden. iOS ab 17.
- "Standort immer erlauben" für Dienstleister (Erklärung vor der Abfrage, Knopf unter "Mehr").
- "Gleich bist du dran": eigener Ton, Android-Kanal `bald`, iPhone dringende Mitteilung (Migration 0006, angewendet).
- Display bleibt während der Fahrt an, Querformat nur in der Navigation.
- Bausteine ohne Funktion: Kamera, Fotos, Dokumente, PDF, Teilen, Live-Aktivität, Netz, SQLite, Animationen, Gesten,
  SVG, Schriften, Datumsauswahl, Vibration, Dunkelmodus, Sentry, App-Links `dogworker-dresden.de/huta-app`.
- Umgebungsvariablen liegen in Expo statt in `eas.json`. Datenschutztext um Karten, Navigation und Fehlerberichte ergänzt.

Geprüft: Typprüfung, `expo-doctor` 20/20, Bundles für iOS, Android und Web bauen, erzeugte native Einstellungen,
Migration 0006 mit zurückgerollten Testdaten (Kunde sieht nur eigene Station, ohne Anmeldung kein Zugriff).
Nicht geprüft: Web-Vorschau im Browser, alles auf echten Geräten.

## Aufgaben für Claude

1. Ergebnis der Prüf-Builds ansehen und Baufehler beheben.
2. Wenn Florian A (Google) und B (Firebase) aus `EINRICHTUNG.md` erledigt hat: mit `env:list` prüfen, Android-Build
   (`preview`) starten, Florian beim iOS-Build begleiten, Upload.
3. Auf Geräten testen (Liste unten). Danach Änderungswünsche von Florian per Update umsetzen.
4. Später: Dateien für App-Links auf der Website, Live-Aktivität (braucht eigenen Versand vom Server), Foto-Funktionen.
5. Optional: Zwei-Wochen-Übersicht für Dienstleister (Florian hat noch nicht geantwortet).

## Aufgaben für Florian

- `EINRICHTUNG.md` A: Google-Schlüssel (Pflicht für den Build).
- B: Firebase (Push auf Android). C: iPhone-Build mit Apple-Login. E: Sentry (jederzeit).
- Eigenen **Mail-Zugang (SMTP)** für Huta in Supabase hinterlegen, danach das schwache Passwort ändern.
- **Straße bestätigen:** "Jacobistraße 5" oder "Jakobistraße 5" (Kartendaten kennen nur "Jacobistraße").
- **App-Name und App-Symbol** bestätigen (brauchen einen Build).
- **Datenschutztext und Einwilligung** rechtlich prüfen lassen, Kontakt-E-Mail in `src/lib/legal.ts` ersetzen.
- Echte Stationen und Kunden eintragen, wenn der Test vorbei ist (Beispieldaten sind erfunden).
- Entscheiden: Testroboter-Konto `crawlerrobo@gmail.com` löschen?

## Noch nicht auf einem echten Gerät getestet

Navigation, Kundenkarte, Updates ohne Build, "Standort immer", Standort im Hintergrund und automatische Ankunft,
Push auf dem Handy samt eigenem Ton, Öffnen der Karten-App, Anrufen und WhatsApp, kleine Bildschirme und große Schrift,
Route mit echten Verkehrsdaten.

## Entscheidungen

- Zwei Apps, null Verbindung: Huta ist von der Millo-App komplett getrennt (siehe `CLAUDE.md`).
- Kein Live-Standort für Kunden (bewusst, Datenschutz). Kunden sehen Countdown, Stopps, Uhrzeit und die eigene Station.
- 25.11.: "Standort immer" kommt mit in den Build. CarPlay, Android Auto, Bezahlen, Social-Login, Kontakte und Kalender nicht.
- Daumen-Check öffnet 15 Minuten vor Ankunft. Wohnungs-Wunsch bis 20 Minuten vorher und nur für freigegebene Hunde.
- Automatische Ankunft: 80 Meter, 45 Sekunden Verweildauer.
- Dienstleister-Konten nur per SQL (`update public.profiles set role = 'provider' where email = ...`).
- Testroboter-Konto `crawlerrobo@gmail.com` stammt von Google (Zugriffe von Google-Adressen am 24.11., nie eingeloggt).
