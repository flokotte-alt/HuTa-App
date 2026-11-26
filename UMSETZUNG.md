# Huta: Umsetzung des neuen Konzepts (26.11.2026)

Grundlage: "Auftrag Claude Code.md" aus dem Google-Drive-Ordner "Huta App".

## 1. Was schon da war (erweitert, nicht neu gebaut)

Anmeldung, Rollen mit Zugriffsregeln in der Datenbank, Kunden, Hunde, feste Regeln morgens und nachmittags,
Stationen, Schließzeiten, Urlaub, Fahrten mit Stopps, Routenberechnung (plan-route) mit Näherung als Ersatz,
Standort im Hintergrund, Google-Navigation als Baustein, Push über Expo, Einwilligung, OTA-Updates.

## 2. Was neu gebaut oder umgebaut ist

**Dienstleister** (Tabs Home, Kunden, Album, Einstellungen)
- Home: Tagesliste (Morgen und Nachmittag getrennt, springt nach der Nachmittagsfahrt zum nächsten Betriebstag),
  darunter die Wochentabelle Montag bis Freitag mit Blättern, blauem U, grauem "abgesagt" und gelben Entwürfen.
- Pro Hund und Tag: verschieben, kostenlos stornieren, absagen mit Berechnung, Station und Übergabe nur für den Tag.
- Veröffentlichen und Verwerfen. Die Woche füllt sich selbst aus den festen Tagen.
- Kunden: Liste mit "Kunde seit", Zugang mit Einmalpasswort, Vertragsdateien, Hunde mit Schlüssel und Wohnungs-Puffer.
- Einstellungen: Urlaubsübersicht mit "neu", Schließzeiten, Stationen mit Start- und Zielschalter, Standardwerte,
  Dunkelmodus, Name, Passwort.

**Fahrt**
- Fahrtart wählen, Start und Ziel aus Stationen, Vorschlag, Reihenfolge von Hand, Start.
- Ein ruhiger Fahrbildschirm: Karte mit Navigation ohne Ansagen, nächster Stopp, Hunde und Bestätigungen,
  Ankunftszeit, großer Knopf. Strecke wird laufend geprüft (kleine Verbesserung fragt, große wechselt selbst).

**Kunden** (Tabs Home, Album, Profil)
- Live-Banner mit Countdown, Wohnungs-Button, Bestätigen mit Daumen, Karte mit Station und Fahrzeug.
- Hinweis auf Schließzeiten vier Wochen vorher, Wochenliste (diese und nächste Woche, nur Veröffentlichtes).
- Erster Login: eigenes Passwort, dann Datenschutz (Platzhaltertext). Urlaub, Passwort, Dunkelmodus.

**Album:** Hochladen (nur Dienstleister), Ansehen, Herunterladen, Emoji-Reaktionen, Löschen nach 3 Tagen.

**Server:** Migration `0007_neues_konzept.sql` (angewendet), Funktionen `customer-account`, `album-cleanup`,
erweitertes `plan-route` (alle eingespielt). Nachrichten Stufe 1 und 2 laufen jede Minute auf dem Server.

**Design:** neues Logo (ein H unter einem Dach), Tannengrün auf Cremeweiß.

## 3. Geprüft

- Typprüfung ohne Fehler, Bundles für iPhone, Android und Web bauen.
- 94 Rechte- und Logikprüfungen in einer lokalen Datenbank mit den echten Migrationen. Das echte Projekt stimmt
  danach bei Spalten, Funktionen und Zugriffsregeln exakt damit überein.
- Klick-Test in der Web-Vorschau (Handygröße) gegen einen lokalen Test-Server: Anmeldung, Tagesliste, Wochentabelle
  (absagen, verschieben, veröffentlichen), Route und Fahrt, Live-Banner, Wohnungs-Button, Bestätigen, Album-Reaktion,
  Kundenzugang anlegen, erster Login, Urlaub, Hunderegeln, Stationen, Standardwerte, Dunkelmodus.
- Im echten Projekt: Funktionen starten und weisen Aufrufe ohne Anmeldung ab, der Aufräum-Auftrag antwortet.
  Dort wurden keine Testkonten oder Testdaten angelegt. Deine 17 Hunde, 17 Kunden und 6 Stationen sind unverändert.

## 4. Nicht getestet

- Alles auf echten Handys: Navigation, Karte, automatisches Wechseln der Strecke, Standort im Hintergrund,
  Push mit eigenem Ton, Datumsauswahl, Fotos und Videos hochladen, abspielen und speichern.
- Hochladen und Öffnen von Dateien auch nicht im Browser (nur die Zugriffsregeln dafür).
- Live-Aktualisierung (Supabase Realtime): Der Test-Server kann das nicht. Ersatzweise lädt die App regelmäßig neu.
- Alles mit Google: Verkehrsdaten, Route-Token, Kosten (Schlüssel fehlen).
- Zugang anlegen und Anmelden im echten Projekt.
- Sehr große Schrift und sehr kleine Bildschirme.
- Es gab keinen neuen EAS-Build, keinen Store-Upload und kein Update an Geräte.

## 5. Was du selbst tun musst

Die genauen Klicks stehen in `EINRICHTUNG.md`.

1. **Registrierung abschalten** (Supabase "Huta": "Allow new users to sign up" aus). Konten legt nur noch ihr an.
2. **Google-Schlüssel (A) und Firebase (B).**
3. Danach **neuen Build erlauben** (Version 0.3.0). Die alten Test-Apps 0.1.0 passen nicht mehr zur Datenbank.
4. **Daten nachtragen:** echte E-Mail, "Kunde seit", feste Tage und Stationen je Hund. Ohne feste Tage ist die Liste leer.
5. **Passwort deines Kontos ändern** (in der App unter Einstellungen). Konto der Mitarbeiterin anlegen.
6. Testeintrag **"Weihnachtspause (Beispiel)"** unter Schließzeiten löschen oder richtigstellen.
7. Station "Huta (Halsbrücke)" prüfen (genaue Adresse), Schreibweise "Jacobistraße".
8. **Datenschutz und AGB** liefern, Kontakt-E-Mail ergänzen.

## 6. Kosten

**Google** (Listenpreise laut Googles Preisseite, abgerufen am 26.11.2026, in US-Dollar):
Navigationsanfrage 25 je 1000 (1000 im Monat frei), Routenberechnung mit Verkehr 10 je 1000 (5000 frei),
Kartenanzeige in der App frei.
Rechenbeispiel mit 8 Stopps und 60 Minuten Fahrt: etwa 10 Navigationsanfragen und 33 Routenberechnungen,
ohne Freimengen rund 0,60 Dollar je Fahrt. Bei 2 Fahrten an 21 Tagen (420 und 1400 Anfragen) bleibt das innerhalb der
Freimengen. Ob Google jedes neue Ziel einzeln abrechnet, ist nicht am Gerät geprüft. Bitte in der Google-Konsole ein
Budget mit Warnung setzen. Sparen: unter Standardwerte "Strecke prüfen alle" erhöhen.

**Supabase** läuft im kostenlosen Tarif: höchstens 50 MB je Datei und 1 GB Speicher. Ein Full-HD-Video ist damit
nach etwa 30 bis 60 Sekunden zu groß. Wenn das stört, hilft nur ein Bezahltarif.

## 7. Meine Entscheidungen

Bitte prüfen. "Claude sagen" heißt: eine Nachricht genügt, ich ändere es.

| Nr. | Entscheidung | Warum | So änderst du es |
|---|---|---|---|
| 1 | **Live-Standort für Kunden** (bisher bewusst nicht). Sichtbar nur während der Fahrt und nur, solange der eigene Stopp offen ist. Datenschutz-Platzhalter angepasst. | Neues Konzept, von dir bestätigt. Die Begrenzung gibt so wenig preis wie möglich. | Claude sagen. Rechtstext vor dem Start prüfen lassen. |
| 2 | Karte und Navigation: Google Navigation SDK im Fahrbildschirm, ohne Ton. Karten-App nur als Notlösung, wenn die Navigation nicht startet. | War schon eingebaut und kann Live-Verkehr und Neuberechnen. | Claude sagen. |
| 3 | Strecke prüfen alle 120 Sekunden, ab 1 Minute Ersparnis fragen, ab 4 Minuten selbst wechseln. | Guter Start zwischen Ruhe und Kosten. | Einstellungen, Standardwerte. |
| 4 | Erste Nachricht 15 Minuten, dringende 5 Minuten vor Ankunft. | 15 war schon so, liegt im Rahmen "10 bis 15". | Einstellungen, Standardwerte. |
| 5 | Nachricht beim Start der Fahrt ist aus. | Im Konzept stehen nur zwei Stufen. | Einstellungen, Standardwerte, Schalter. |
| 6 | Entfernt: Nachrichten zu Wochenplan, neuer Uhrzeit, Erinnerung, Wohnungs-Wunsch an euch. Der Wunsch erscheint im Fahrbildschirm. | Laut Konzept keine Nachricht beim Veröffentlichen, kein Knopf für Fahrer. | Claude sagen. |
| 7 | Bestätigen geht ab dem Moment, in dem der Wohnungs-Button verschwindet (20 Minuten vorher). | "Danach muss der Kunde mit Daumen reagieren." | Standardwerte, "Wohnungs-Button bis". |
| 8 | Morgens heißt der Button "Bitte in der Wohnung abholen", nachmittags "Bitte in die Wohnung bringen". | "Bringen" wäre morgens verwirrend. | Claude sagen. |
| 9 | Wohnungs-Zeit: je Kunde der längste Puffer, mehrere Kunden an einer Station addiert. Folgende Zeiten verschieben sich sofort. | Geschwister brauchen nur einen Weg. | Claude sagen. |
| 10 | "3 Hunde, 2 bestätigt": Wohnungs-Hunde zählen als bestätigt. Darunter klein die Namen. | Sie sind laut Konzept bereits klar, Namen braucht man zur Übergabe. | Claude sagen. |
| 11 | Keine automatische Ankunftserkennung mehr, weiter nur mit dem großen Knopf. | Konzept: erst der Knopf schaltet weiter. | Claude sagen. |
| 12 | Nach dem letzten Stopp ist die Fahrt beendet, danach Knopf "Zum Ziel navigieren". Vergessene Fahrten enden nach 8 Stunden. | So rückt die Tagesliste weiter und kein Standort bleibt geteilt. | Claude sagen. |
| 13 | Nur das Handy der fahrenden Person teilt den Standort. Die zweite Person sieht zu und kann übernehmen. | Sonst springt das Fahrzeug auf der Karte. | Claude sagen. |
| 14 | Tagesliste und Route nutzen auch unveröffentlichte Änderungen. | Gefahren wird nach eurem aktuellen Stand. | Claude sagen. |
| 15 | "Veröffentlichen" und "Verwerfen" gelten für alle Wochen. Einzelne Änderung: Zelle antippen, verwerfen. | Nichts bleibt versehentlich liegen. | Claude sagen. |
| 16 | Wochentabelle zeigt nur Hunde, die in der Woche vorkommen. Andere unter "Hund hinzufügen". Stern bedeutet: an dem Tag abweichend. | Passt ohne Schieben aufs Handy. | Claude sagen. |
| 17 | Vergangene Tage werden nachts festgeschrieben. | Geänderte feste Tage sollen die Abrechnung nicht rückwirkend ändern. | Claude sagen. |
| 18 | Kunden sehen diese und die nächste Woche, am Wochenende gilt die kommende als aktuelle. Fremde Absagen sind unsichtbar, eigene grau. | "Eine Woche weiter", so wenig fremde Daten wie möglich. | Claude sagen. |
| 19 | Station "Huta (Halsbrücke)" neu angelegt, sie und "Tolkewitzer Straße 70" sind Start und Ziel. "Aktueller Standort" bleibt als Start. | Diese Punkte waren bisher fest in der App. | Einstellungen, Stationen. |
| 20 | Entfernt: Krankmeldung, Selbst-Registrierung, "Passwort vergessen" per Mail. | Konzept: WhatsApp, Konten nur durch euch. Neues Einmalpasswort beim Kunden. | Claude sagen. |
| 21 | Entfernt aus der App: Dienstplan, Telefonnummer, Anrufen und WhatsApp beim Kunden. Datenbank bleibt. | Nicht im Konzept. | Claude sagen, kommt schnell zurück. |
| 22 | Entfernt: "Konto löschen" beim Kunden. Löschen macht ihr beim Kunden. | Kunden ändern nur Urlaub und Passwort. Falls Apple oder Google das verlangen, baue ich es wieder ein. | Claude sagen. |
| 23 | Kundendaten erst nach eigenem Passwort und Datenschutz, in der Datenbank erzwungen. Konten werden nicht mehr über die E-Mail verknüpft. | Sicherheit: niemand kommt durch bloßes Registrieren an Daten. | Nicht ändern. |
| 24 | Album: sechs Emojis wie bei WhatsApp, eine Reaktion je Kunde. Kunden sehen Anzahlen, ihr auch Namen. | Wie im Konzept, ohne fremde Namen. | Claude sagen. |
| 25 | Videos: iPhone verkleinert auf Full HD, Android lädt das Original, Grenze 50 MB. | Zum Verkleinern auf Android bräuchte es einen Zusatzbaustein, den ich ohne Build nicht prüfen kann. | Claude sagen, vor einem Build. |
| 26 | Abgelaufenes ist sofort unsichtbar, gelöscht wird einmal nachts. Neue Frist gilt auch für vorhandene Dateien. | Täglicher Auftrag laut Konzept. | Standardwerte, "löschen nach". |
| 27 | Vertragsdateien höchstens 20 MB. "Kunde löschen" entfernt Zugang, Hunde und Dateien nach Rückfrage. | Übliche Vertragsgröße, keine Reste. | Claude sagen. |
| 28 | "Neu" in der Urlaubsübersicht und Dunkelmodus gelten je Handy. | Jede Person sieht selbst, was für sie neu ist. | Claude sagen. |
| 29 | Design: Tannengrün auf Cremeweiß, Blau nur Urlaub, Grau nur abgesagt, Gelb nur Entwurf. Das alte Dogworker-Logo liegt noch in `assets-src/logo.png`. | Ruhig, sachlich, kein Orange. | Claude sagen oder eigenes Logo geben (braucht einen Build). |
| 30 | App-Name bleibt "Huta", Version ist 0.3.0. | Neue Bausteine (Video, Fotos speichern) brauchen eine neue Version. | Name: Claude sagen. |

Zugänge, die ich bei der Vollständigkeitsprüfung ergänzt habe: "Alle Stopps" und "Fahrt abbrechen" im Menü des
Fahrbildschirms, "Fahrt übernehmen", "Zum Ziel navigieren", "Beendete Fahrt ansehen" auf Home, "Diese Fahrt neu planen".
