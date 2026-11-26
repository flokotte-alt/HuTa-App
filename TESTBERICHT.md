# Testbericht (26.11.2026, neues Konzept, Version 0.3.0)

- Typprüfung ohne Fehler. Bundles für iOS, Android und Web bauen. Native Einstellungen werden fehlerfrei erzeugt.
- `expo-doctor`: ein Hinweis (neuere Patch-Versionen einiger Pakete verfügbar), sonst bestanden.
- Datenbank: 94 Rechte- und Logikprüfungen in einer lokalen Datenbank (PGlite) mit allen Migrationen. Spalten,
  Funktionen und Zugriffsregeln im Huta-Projekt stimmen nach Migration 0007 damit überein.
- Web-Vorschau in Handygröße gegen einen lokalen Test-Server (keine Testdaten im echten Projekt): Anmeldung,
  Tagesliste, Wochentabelle, Veröffentlichen, Route, Fahrt, Live-Banner, Wohnungs-Button, Bestätigen, Album,
  Kundenzugang, erster Login, Urlaub, Hunderegeln, Einstellungen, Dunkelmodus.
- Server-Funktionen im Projekt: starten, Aufrufe ohne Anmeldung abgewiesen, Aufräum-Auftrag antwortet.

Nicht getestet: alles auf echten Geräten, Google-Dienste, Live-Aktualisierung, Datei- und Foto-Upload, echtes Anmelden.

---

# Älter: Testbericht (24.11.2026, Version 0.1.0, überholt)

Getestet mit einem Dienstleister-Konto und drei Kunden-Konten. Danach wurden alle Testkonten und Testdaten gelöscht.

## Dienstleister
- Kunde anlegen, bearbeiten. Hund anlegen mit festen Tagen, Wohnungs-Knopf, Regeln morgens und nachmittags
  (Station, Wohnung, Selbstbringer). Regeln werden richtig gespeichert und beim Öffnen geladen.
- Station anlegen mit Koordinaten-Suche, archivieren.
- Wochenplan: aus festen Tagen füllen (keine Doppelten), Veröffentlichen, Status ändern, Station und Übergabe nur für einen Tag ändern.
  Die Tagesabweichung gewinnt gegen die feste Regel (morgens und nachmittags getrennt geprüft).
- Dienstplan, Schließzeit anlegen und löschen, Zusatzzeit für Wohnungs-Übergabe speichern.
- Fahrt morgens und nachmittags: Startpunkt, Reihenfolge mit Pfeilen, Zeiten, Start. Selbstbringer erscheinen nicht in der Route,
  kranke Hunde fehlen nachmittags, Wohnungs-Übergaben verlängern die Station.
- Während der Fahrt: Daumen-Status, Wohnungs-Wunsch übernehmen (Zeiten werden neu gerechnet), Nachzügler erinnern,
  Nächster Stopp, Stationen mit nur kranken Hunden entfallen, Fahrt endet automatisch nach der letzten Station, manuelles Beenden.

## Kunde
- Einwilligung beim ersten Start, danach Startseite.
- Countdown (Stopps, Minuten, Uhrzeit), Daumen erst 15 Minuten vor Ankunft, Wohnungs-Wunsch nur bis 20 Minuten vorher
  und nur bei erlaubten Hunden, bei Wohnungs-Übergabe kein Knopf mehr, Krankmeldung, Anrufen und WhatsApp mit dem Fahrer des Tages.
- Wochenliste ab heute: rot = Absage mit Berechnung, grau = Urlaub, gestrichen oder krank, eigene Hunde fett.
- Urlaub eintragen und löschen, Datenschutzseite, Konto löschen (Datenbank getestet).

## Datenbank
- 28 Rechte-Prüfungen (Kunden sehen nur Eigenes, kein Rollen-Upgrade, keine fremden Aktionen, Anonyme sehen nichts).
- Push-Versand bis zum Expo-Dienst, Zeitsteuerung "Gleich bist du dran".

## Nicht getestet (braucht ein echtes Gerät oder deine Zugänge)
- Standort im Hintergrund und automatische Ankunftserkennung, Push auf dem Handy, Öffnen der Karten-App, Anrufen und WhatsApp auf dem Handy.
- Route mit echten Verkehrsdaten (Google-Schlüssel fehlt).
- Anmelden mit echter E-Mail-Bestätigung (eigener Mail-Zugang fehlt).
- Aussehen auf kleinen Bildschirmen und mit großer Schrift.
