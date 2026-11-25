# Einrichtung: was du selbst machen musst

Reihenfolge von wichtig nach später. Schlüssel gibst du nur in die Webseiten und in dein Terminal ein, **nicht in den Chat**.

Alle Befehle laufen im Huta-Ordner. Am Windows-Rechner:

```powershell
cd C:\Users\Kotte\Desktop\Huta
```

## Am Mac

Einmalig [Node.js](https://nodejs.org) (LTS) installieren. Dann im Programm "Terminal" nacheinander:

```bash
git clone https://github.com/flokotte-alt/HuTa-App.git ~/Desktop/Huta
```

```bash
cd ~/Desktop/Huta
```

```bash
npm install
```

```bash
npx eas-cli login
```

Fragt Git beim ersten Befehl nach einer Anmeldung, nimm dein GitHub-Konto (am einfachsten mit der App "GitHub Desktop").
Gibt es den Ordner schon, statt `git clone` im Ordner `git pull` und danach `npm install`.

In allen Befehlen unten heißt es am Mac **`npx`** statt `npx.cmd`. Nur der Befehl für die Firebase-Datei (B, Schritt 3)
sieht am Mac so aus:

```bash
npx eas-cli env:set --name GOOGLE_SERVICES_JSON --type file --value "$HOME/Downloads/google-services.json" --visibility sensitive --environment preview --environment production
```

## A. Google Cloud (Pflicht vor dem nächsten Build)

1. [console.cloud.google.com](https://console.cloud.google.com), neues Projekt **Huta** (nicht das von anderen Apps).
2. Abrechnung verknüpfen.
3. "APIs und Dienste", "Bibliothek": diese vier aktivieren:
   **Navigation SDK**, **Maps SDK for Android**, **Maps SDK for iOS**, **Routes API**.
4. "APIs und Dienste", "Anmeldedaten", "Anmeldedaten erstellen", "API-Schlüssel". Drei Stück:

| Name | Anwendungs-Einschränkung | API-Einschränkung |
|---|---|---|
| Huta iPhone | iOS-Apps, Bundle-ID `de.dogworker.huta` | Navigation SDK, Maps SDK for iOS |
| Huta Android | Android-Apps, Paket `de.dogworker.huta` und beide SHA-1 (siehe unten) | Navigation SDK, Maps SDK for Android |
| Huta Server | keine | Routes API |

Die beiden SHA-1 stehen in der Play Console: App Huta, "App-Integrität" (unter "Testen und veröffentlichen"),
App-Signatur. Beide eintragen: "App-Signaturschlüssel" und "Uploadschlüssel". Fehlt einer, bleibt die Karte leer.

5. iPhone- und Android-Schlüssel bei Expo hinterlegen. Jeder Befehl fragt nach dem Wert, dort den Schlüssel einfügen:

```powershell
npx.cmd eas-cli env:set --name GOOGLE_MAPS_IOS_KEY --visibility sensitive --environment preview --environment production
```

```powershell
npx.cmd eas-cli env:set --name GOOGLE_MAPS_ANDROID_KEY --visibility sensitive --environment preview --environment production
```

6. Server-Schlüssel: Supabase, Projekt **Huta**, "Edge Functions", "Secrets": `GOOGLE_MAPS_KEY` = der dritte Schlüssel.
   Damit rechnet die Fahrt-Planung mit Verkehrsdaten.

## B. Firebase (Push auf Android, vor dem Android-Build)

1. [console.firebase.google.com](https://console.firebase.google.com), "Projekt hinzufügen", das Google-Cloud-Projekt **Huta** auswählen.
2. Android-App hinzufügen, Paketname `de.dogworker.huta`, Datei `google-services.json` herunterladen (landet in "Downloads").
3. Datei bei Expo hinterlegen:

```powershell
npx.cmd eas-cli env:set --name GOOGLE_SERVICES_JSON --type file --value "$env:USERPROFILE\Downloads\google-services.json" --visibility sensitive --environment preview --environment production
```

4. Firebase, Projekteinstellungen, "Dienstkonten", "Neuen privaten Schlüssel generieren" (JSON-Datei).
5. Diesen Schlüssel bei Expo hochladen:

```powershell
npx.cmd eas-cli credentials --platform android
```

   Auswählen: Profil `preview`, "Google Service Account", dann der Punkt für **Push Notifications (FCM V1)**, Datei hochladen.
   Danach die JSON-Datei aus "Downloads" löschen.

## C. Apple (iPhone-Build)

Erst wenn A erledigt ist. Der Befehl fragt nach deinem Apple-Login (Code tippst du selbst ein). Fragen zu neuen
Zertifikaten, Profilen und der Erweiterung `ExpoWidgetsTarget` mit **Ja** beantworten.

```powershell
npx.cmd eas-cli build --platform ios --profile preview
```

Wenn der Build fertig ist, zu Apple hochladen:

```powershell
npx.cmd eas-cli submit --platform ios --profile preview --latest
```

In TestFlight Tester einladen (bis 100 intern, extern mit kurzer Prüfung durch Apple).

## D. Google Play (Android)

1. Claude startet den Build (oder `npx.cmd eas-cli build --platform android --profile preview`).
2. Die `.aab`-Datei in der Play Console in den internen Test hochladen.
3. Wegen "Standort immer" verlangt Google eine Erklärung mit kurzem Video ("App-Inhalte", Standortberechtigungen),
   spätestens vor einer Veröffentlichung außerhalb des internen Tests.
4. Prüfen, ob für diese App die 14-Tage-Regel mit Testern gilt.
5. Google testet jeden Upload automatisch. Solche Konten (zum Beispiel `crawlerrobo@gmail.com`) stammen vom Testroboter.

## E. Sentry (Fehlerberichte, geht jederzeit, auch nach dem Build)

1. [sentry.io](https://sentry.io), Konto in der Region **EU**, neues Projekt "React Native", Name `huta`.
2. Die angezeigte **DSN** hinterlegen:

```powershell
npx.cmd eas-cli env:set --name EXPO_PUBLIC_SENTRY_DSN --visibility plaintext --environment preview --environment production
```

3. Für lesbare Fehlerstellen zusätzlich `SENTRY_ORG`, `SENTRY_PROJECT` und `SENTRY_AUTH_TOKEN` (Organisations-Token,
   Sichtbarkeit `sensitive`) genauso hinterlegen. Diese wirken erst ab dem nächsten Build.

## F. E-Mail-Versand (Pflicht vor echten Kunden)

Das eingebaute Supabase-System schickt nur sehr wenige Mails. Für Bestätigungs-Mails und "Passwort vergessen":

1. Supabase, Projekt "Huta", Authentication, SMTP Settings, eigenen SMTP-Zugang eintragen (Absender-Adresse von Dogworker).
2. Authentication, URL Configuration: eigene Adresse eintragen, damit Bestätigungslinks sinnvoll öffnen.
3. "Confirm email" besser an lassen. Die Zuordnung zu Hunden läuft über die E-Mail.

## G. Dienstleister-Konto freischalten

1. In der App "Neu hier? Konto anlegen".
2. Claude Bescheid sagen oder im SQL-Editor von Supabase "Huta":
   `update public.profiles set role = 'provider' where email = 'DEINE@MAIL';`

## H. Vor dem Start mit echten Kunden

- Datenschutztexte in `src/lib/legal.ts` rechtlich prüfen lassen und die Kontakt-E-Mail eintragen.
- Echte Stationen, Kunden und Hunde eintragen. Beispieldaten in der Verwaltung löschen.
- Station "Jacobistraße 5": Schreibweise prüfen (Kartendaten kennen nur "Jacobistraße").
- App-Name und App-Symbol festlegen (`name` und `icon` in `app.json`, `APP_NAME` in `src/lib/theme.ts`). Braucht einen neuen Build.
- Damit Links von `dogworker-dresden.de/huta-app` die App öffnen: zwei kleine Dateien auf der Website ablegen (Claude erstellt sie).
