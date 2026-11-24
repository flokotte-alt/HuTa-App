# Huta: Stand und Aufgaben

Zuletzt aktualisiert: 24.11.2026 (abends)

## Kurzfassung

Der Prototyp ist komplett gebaut, getestet (Web-Vorschau und Datenbank) und als Test-Build bei Apple (TestFlight) und
Google (interner Test) hochgeladen. Florian hat ihn auf dem iPhone, hat sich als Dienstleister angemeldet und eine Fahrt
ausprobiert. Urteil: passt im Grundsatz, es soll aber noch vieles geändert werden. Die Änderungswünsche sammelt Florian
und gibt sie in den nächsten Tagen durch.

## Zugänge und Kennungen (ohne Passwörter)

- GitHub: `flokotte-alt/HuTa-App` (Zweig `main`)
- Expo: `@flomillo/huta`, Projekt-ID `be64770f-2a68-467c-a3b8-abe8562e7164`
- Supabase-Projekt: `eqzlxxvkxhxfejafoucl` (URL `https://eqzlxxvkxhxfejafoucl.supabase.co`)
- App-Kennung: `de.dogworker.huta` (iOS und Android)
- Apple-Team: Florian Kotte (RW686BC248), App Store Connect App-ID `6838889246`, SKU `huta-001`,
  TestFlight-Gruppe "Team (Expo)"
- Android: Play Console, App `de.dogworker.huta`, interner Test
- Auf einem neuen Rechner: Repo klonen, `npm install`, `.env` aus `.env.example` anlegen (Werte stehen auch in `eas.json`).
- Dienstleister-Konto von Florian: `info@dogworker-dresden.de` (Passwort nur Florian bekannt, vorläufig und schwach, siehe Aufgaben).

## Builds (Stand 24.11.2026)

- Android (.aab, Profil preview): Build `059caac2-7100-4c93-89d7-b46a724f49bb`, in Play Console hochgeladen.
- iOS (Profil preview): Build `7bb8055f-85f3-41fa-8354-1f924e2300c1`, Version 0.1.0, Build-Nr. 2, bei Apple verarbeitet,
  in TestFlight installiert.
- Code-Stand der Builds: Commit `66ff3e0`.
- **Keine OTA-Updates eingebaut** (`expo-updates` fehlt). Code-Änderungen brauchen bisher immer einen neuen Build.
  Datenbank-Änderungen wirken sofort.

## Was gebaut ist

Alles aus `README.md` (Verwaltung, Wochenplan, Fahrt mit Route, Daumen-Check, Krankmeldung, Wohnungs-Übergabe,
Push, Hintergrund-Standort, Einwilligung, Konto löschen). Datenbank-Migrationen 0001 bis 0005 sind angewendet,
Edge Function `plan-route` ist deployt (ohne Google-Schlüssel nur Schätzung).
Beispieldaten sind eingespielt (8 erfundene Kunden, 12 Hunde, 6 Stationen, 2 Wochen Plan, 1 Schließzeit).

## Aufgaben für Claude

1. **OTA einbauen** (`expo-updates`, Kanal je Profil in `eas.json`, `runtimeVersion`), dann einen gemeinsamen neuen
   Build für iOS und Android mit allen Änderungswünschen von Florian. Ab dann Code-Änderungen per `eas update`.
2. **Änderungswünsche von Florian** aufnehmen und umsetzen (Liste kommt in den nächsten Tagen).
3. Optional: Zwei-Wochen-Übersicht für Dienstleister (Florian hat noch nicht geantwortet).
4. Navigation in der App (Google Navigation SDK) bleibt "später". Bis dahin öffnet der Knopf Apple Karten bzw. Google Maps.

## Aufgaben für Florian

- Eigenen **Mail-Zugang (SMTP)** für Huta in Supabase hinterlegen (Registrierung per E-Mail klappt sonst nicht
  zuverlässig: "email rate limit exceeded"). Danach "Passwort vergessen" nutzen und das schwache Passwort ändern.
- **Google Cloud: Routes API** aktivieren, Schlüssel als Supabase-Secret `GOOGLE_MAPS_KEY` setzen (Route mit Verkehrsdaten).
- **Firebase (FCM)**: Schlüssel für Push auf Android hinterlegen, danach neuer Android-Build. Schritte in `EINRICHTUNG.md`.
- **Straße bestätigen:** "Jacobistraße 5" oder "Jakobistraße 5" (Kartendaten kennen nur "Jacobistraße").
- **App-Name** bestätigen (Arbeitstitel "Huta").
- **Datenschutztext und Einwilligung** rechtlich prüfen lassen, Kontakt-E-Mail in `src/lib/legal.ts` ersetzen (steht dort als Platzhalter).
- Echte Stationen und Kunden eintragen, wenn der Test vorbei ist (Beispieldaten sind erfunden).
- Android-Test: Release im internen Test starten, sich als Tester eintragen, über den Test-Link installieren (Stand unbekannt).
- Unbekannte Registrierung `crawlerrobo@gmail.com` (unbestätigt) in der Datenbank: prüfen, ob sie bekannt ist, sonst löschen lassen.

## Noch nicht auf einem echten Gerät getestet

Standort im Hintergrund und automatische Ankunft, Push auf dem Handy, Öffnen der Karten-App, Anrufen und WhatsApp,
Aussehen auf kleinen Bildschirmen und mit großer Schrift, Route mit echten Verkehrsdaten.

## Entscheidungen

- Zwei Apps, null Verbindung: Huta ist von der Millo-App komplett getrennt (siehe `CLAUDE.md`).
- Kein Live-Standort für Kunden (bewusst, Datenschutz). Kunden sehen Countdown, Stopps und Uhrzeit.
- Daumen-Check öffnet 15 Minuten vor Ankunft. Wohnungs-Wunsch bis 20 Minuten vorher und nur für freigegebene Hunde.
- Automatische Ankunft: 80 Meter, 45 Sekunden Verweildauer.
- Dienstleister-Konten nur per SQL (`update public.profiles set role = 'provider' where email = ...`).
