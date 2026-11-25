# Huta: Arbeitsregeln für Claude

Huta (Arbeitstitel) ist die Abhol-App für die Hundetagesstätte Dogworker Dresden. Betreiber: Florian Kotte.

## Wichtigste Regel: NIEMALS mit der Millo-App vermischen

Huta ist komplett eigenständig. Die Millo-App ist ein anderes Projekt und gehört nicht hierher.

- Nur in diesem Ordner (dem Huta-Repo) arbeiten. Nichts im Millo-Ordner lesen, ändern oder committen.
- Nur das Huta-Supabase-Projekt benutzen: Projekt-ID `eqzlxxvkxhxfejafoucl`. Bei jedem Supabase-Aufruf diese ID
  ausdrücklich angeben. Andere Projekte im selben Konto gehören nicht zu Huta und werden nie angefasst.
- Eigene App-Kennung `de.dogworker.huta`, eigenes Expo-Projekt `@flomillo/huta`, eigenes GitHub-Repo `flokotte-alt/HuTa-App`.
- Keine Schlüssel, Texte, Adressen, Namen oder Erinnerungen aus Millo übernehmen. Millo nie in Huta-Texten, Code,
  Rechtstexten oder Mails erwähnen.
- Geteilt ist nur, was auf Konto-Ebene gar nicht anders geht (Apple-Entwicklerkonto samt Distribution-Zertifikat,
  App-Store-Connect-API-Schlüssel, Google-Play-Konto, Expo-Konto). Die Apps selbst sind getrennt.

## Ablauf bei jedem Sitzungsbeginn

1. `git pull` im Huta-Ordner, `git status` und `git log --oneline -5` ansehen.
2. `STAND.md` lesen: Was ist gemacht, was fehlt, was sind die nächsten Schritte.
3. Kurz sagen, wo wir stehen und was als Nächstes ansteht. Bei Zweifeln im Repo und in der Datenbank nachsehen,
   nicht aus dem Gedächtnis antworten.

## Ablauf bei Sitzungsende (wenn Florian aufhört oder "Schluss" sagt)

1. `STAND.md` auf den Tagesstand bringen: erledigt, offen, Entscheidungen, nächste Schritte.
2. Neue Datenbank-Änderungen als Datei in `supabase/migrations` ablegen (nummeriert) und prüfen, dass sie angewendet sind.
3. `git add`, `git commit`, `git push` auf `main`.
4. In einer Zeile sagen, was gespeichert wurde.

## Arbeitsweise

- Florian ist kein Programmierer. Antworten auf Deutsch, kurz, in einfachen Worten, die nächsten Schritte klar nennen.
- Was er selbst tun muss (Apple, Google, Konten, Zugänge): genau sagen, welcher Klick oder Befehl. Befehle für PowerShell
  in einen eigenen Codeblock.
- Passwörter und Schlüssel nie in Dateien oder ins Repo schreiben.
- Der Anbieter (Dienstleister) und seine Mitarbeiter sind die Einzigen, die den Wochenplan ändern. Kunden sehen nur
  Eigenes und von anderen nur Hundenamen. Das ist über Zeilen-Sicherheit (RLS) in der Datenbank erzwungen. Nicht aufweichen.
- Dienstleister-Rechte werden nur serverseitig per SQL vergeben, nie über die App.
- Testen: Web-Vorschau mit `npx expo start --web --port 8091`, Testkonten per SQL, danach alle Testdaten wieder löschen.
- Builds: `npx eas-cli build --platform android|ios --profile preview`. iOS braucht Apples Login im Terminal von Florian.
  Upload iOS: `npx eas-cli submit --platform ios --profile preview --latest` (oder am Mac mit der Transporter-App).
- Updates ohne Build (OTA): nur bei reinen Code-, Text- oder Layout-Änderungen:
  `npm run update -- --message "..."`. Umgebungsvariablen kommen aus Expo (Umgebung `preview`), nicht aus `.env`.
- **Versionsregel:** Ein Update erreicht nur Builds mit derselben `version` in `app.json`. Bei neuem nativem Baustein oder
  Änderung an nativen Einstellungen die `version` erhöhen und neu bauen. Sonst die `version` nie ändern.
- Doku im Repo: `README.md` (was die App kann), `EINRICHTUNG.md` (was Florian anlegen muss), `TESTBERICHT.md`, `STAND.md`.
