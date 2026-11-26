# Huta (Arbeitstitel)

App für die Hundetagesstätte Dogworker Dresden. Diese App ist eigenständig: eigenes Repo, eigenes
Supabase-Projekt, eigene App-Kennung (`de.dogworker.huta`).

## Was die App kann

**Dienstleister** (Tabs Home, Kunden, Album, Einstellungen)
- Home: Tagesliste (Morgenfahrt und Nachmittagsfahrt), darunter die Wochentabelle. Sie füllt sich aus den festen
  Tagen, eingetragen werden nur Ausnahmen: verschieben, stornieren, absagen, Station und Übergabe für einen Tag.
  Änderungen sind Entwürfe, bis "Veröffentlichen" gedrückt wird.
- Kunden: Stammdaten, "Kunde seit", Zugang mit Einmalpasswort, Vertragsdateien, Hunde mit festen Regeln,
  Schlüssel und Wohnungs-Puffer.
- Album: Fotos und Videos hochladen und löschen.
- Einstellungen: Urlaubsübersicht, Schließzeiten, Stationen (Start und Ziel), Standardwerte, Dunkelmodus, Konto.
- Fahrt: Route vorschlagen (mit Verkehrsdaten, sobald der Google-Schlüssel eingetragen ist, sonst Näherung),
  Reihenfolge anpassen, Navigation ohne Ansagen im selben Bildschirm, Strecke wird laufend geprüft,
  großer Knopf für den nächsten Stopp.

**Kunden** (Tabs Home, Album, Profil)
- Live-Banner mit Countdown, Karte, Wohnungs-Button (wenn freigeschaltet) und Bestätigung.
- Hinweis auf Schließzeiten, Wochenliste (nur lesen, nur Veröffentlichtes, eigene Hunde hervorgehoben).
- Album ansehen, speichern, mit Emojis reagieren.
- Urlaub eintragen, Passwort ändern, Dunkelmodus.

**Push-Nachrichten** (vom Server): etwa 15 Minuten vor Ankunft an alle, die zur Station kommen, und 5 Minuten vorher
dringend an alle, die noch nicht bestätigt haben. Zeiten und eine zusätzliche Start-Nachricht sind einstellbar.

## Noch nicht enthalten

CarPlay und Android Auto, Bezahlen, Google- oder Apple-Login, Anfragen oder Krankmeldungen (laufen über WhatsApp),
endgültige Datenschutzerklärung und AGB.

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

## Datenbank und Server

- Schema in `supabase/migrations`. `supabase/seed.sql` ist nur für eine leere Datenbank (erfundene Daten).
- `supabase/functions`: `plan-route` (Routen), `customer-account` (Kundenzugänge, nur Dienstleister),
  `album-cleanup` (löscht abgelaufene Album-Dateien, läuft nachts, prüft ein Geheimnis aus der Datenbank).
- Wochenplan: `week_entries` enthält nur Ausnahmen, je Hund und Tag eine veröffentlichte Zeile und höchstens
  einen Entwurf. Gelesen wird über die Funktionen `plan_rows` (Dienstleister) und `customer_week` (Kunden).

Dienstleister-Konten werden **serverseitig** freigeschaltet:

```sql
update public.profiles set role = 'provider' where email = 'name@beispiel.de';
```

Kundenkonten legt ein Dienstleister in der App an (Kunden, Kunde öffnen, Zugang anlegen).

## Logo

`node assets-src/make-icons.js` erzeugt Logo und App-Symbole neu.
