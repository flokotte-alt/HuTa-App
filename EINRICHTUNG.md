# Einrichtung: was du selbst machen musst

Reihenfolge von wichtig nach später. Alles in einfachem Deutsch, Schritt für Schritt.

## 1. Dein Dienstleister-Konto freischalten (vor dem ersten Test)
1. App starten, "Neu hier? Konto anlegen", mit deiner E-Mail registrieren.
2. Das Konto ist zuerst ein Kunden-Konto. Sag Claude Bescheid oder führe im Supabase-Projekt "Huta" unter SQL-Editor aus:
   `update public.profiles set role = 'provider' where email = 'DEINE@MAIL';`
3. Für die Mitarbeiterin genauso.

## 2. E-Mail-Versand (Pflicht vor echten Kunden)
Das eingebaute Supabase-System schickt nur sehr wenige Mails und vermutlich nur an Teammitglieder. Für Bestätigungs-Mails und
"Passwort vergessen" brauchst du einen eigenen Mail-Zugang:
1. Supabase, Projekt "Huta", Authentication, SMTP Settings, eigenen SMTP-Zugang eintragen (Absender-Adresse von Dogworker).
2. Authentication, URL Configuration: eigene Adresse eintragen, damit Bestätigungslinks sinnvoll öffnen.
3. Wenn du keine Bestätigungs-Mail willst: Authentication, Providers, Email, "Confirm email" ausschalten. Dann kann sich jeder mit
   fremder E-Mail registrieren. Die Zuordnung zu Hunden läuft über die E-Mail, deshalb besser an lassen.

## 3. Google Maps Platform (für Verkehrsdaten)
1. console.cloud.google.com, neues Projekt "Huta" (nicht das von anderen Apps).
2. Abrechnungskonto verknüpfen. Dienste aktivieren: **Routes API**.
3. API-Schlüssel erstellen und auf "Routes API" beschränken.
4. In Supabase, Edge Functions, Secrets: `GOOGLE_MAPS_KEY` = dein Schlüssel.
5. Ab dann nutzt die Fahrt-Planung Verkehrsdaten. Ohne Schlüssel rechnet die App mit einer Schätzung.
6. Prüfen, ob du bei Google als normaler Kunde abgerechnet wirst (Gratisgrenzen ändern sich).

## 4. Apple
1. In App Store Connect eine App anlegen: Name, Bundle-ID `de.dogworker.huta`. Wenn die Bundle-ID nicht auswählbar ist,
   registriert Expo sie beim ersten Build mit deinem Apple-Login (Code tippst du selbst ein).
2. `npx eas-cli build --platform ios --profile preview`, dann `npx eas-cli submit --platform ios`.
3. In TestFlight Tester einladen (bis 100 intern, extern mit kurzer Prüfung durch Apple).
4. Push für iOS: Beim ersten Build legt Expo den Push-Schlüssel an, wenn du danach gefragt wirst.

## 5. Google Play
1. Die App mit Paketname `de.dogworker.huta` ist angelegt.
2. `npx eas-cli build --platform android --profile preview` erzeugt ein App-Bundle. Den ersten Upload machst du von Hand in der
   Play Console (interner oder geschlossener Test).
3. Push für Android: Firebase-Projekt anlegen, `google-services.json` herunterladen und mit
   `npx eas-cli credentials` als FCM-Schlüssel bei Expo hinterlegen. Ohne diesen Schritt kommen auf Android keine Push-Nachrichten.
4. Prüfen, ob für die zweite App wieder die 14-Tage-Regel mit Testern gilt.

## 6. Vor dem Start mit echten Kunden
- Datenschutztexte in `src/lib/legal.ts` rechtlich prüfen lassen und die Kontakt-E-Mail eintragen.
- Echte Stationen, Kunden und Hunde in der App eintragen. Die Beispieldaten kannst du in der Verwaltung löschen.
- Station "Jacobistraße 5": Schreibweise prüfen (Kartendaten kennen nur "Jacobistraße").
- App-Name festlegen: `APP_NAME` in `src/lib/theme.ts` und `name` in `app.json`.
