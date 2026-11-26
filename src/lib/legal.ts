// PLATZHALTER: Datenschutzerklaerung und AGB werden spaeter geliefert und rechtlich geprueft.
export const CONSENT_VERSION = '2026-11-platzhalter-3';

export const PRIVACY_NOTE = 'Platzhaltertext. Das endgültige Datenschutzdokument folgt vor dem Einsatz.';

export const PRIVACY_TEXT: { title: string; body: string }[] = [
  {
    title: 'Wer ist verantwortlich?',
    body: 'Dogworker Dresden, Florian Kotte. Die App dient allein der Organisation der Hundetagesstätte und der Hundeabholung für Kundinnen und Kunden von Dogworker Dresden.',
  },
  {
    title: 'Welche Daten werden verarbeitet?',
    body: 'Name, E-Mail-Adresse und Telefonnummer, Beginn der Kundschaft, Verträge und andere Dateien zu deinem Kundenkonto, Name und Regeln deines Hundes (feste Tage, Station, Übergabe, Wohnungsschlüssel, Notizen), dein Wochenplan, dein Urlaub, deine Bestätigungen und Wohnungs-Wünsche sowie deine Reaktionen im Album. Kontaktdaten, Dateien und Regeln sieht nur Dogworker. Andere Kunden sehen von dir nur den Namen deines Hundes in der Wochenliste.',
  },
  {
    title: 'Standort',
    body: 'Während einer laufenden Fahrt wird der Standort des Fahrzeugs vom Gerät des Fahrers übertragen, auch bei gesperrtem Handy oder wenn die App im Hintergrund ist. Kunden, die zu dieser Fahrt gehören und noch nicht an der Reihe waren, sehen den Standort des Fahrzeugs und die Ankunftszeit live. Gespeichert wird nur der aktuelle Wert, nach dem Ende der Fahrt wird er gelöscht. Dein eigener Standort wird nicht erfasst.',
  },
  {
    title: 'Fotos und Videos',
    body: 'Fotos und Videos im Album stellt nur Dogworker ein. Alle Kundinnen und Kunden sehen sie und können sie auf ihr Handy speichern. Sie werden nach wenigen Tagen automatisch gelöscht. Deine Reaktion sieht Dogworker mit deinem Namen, andere Kunden sehen nur die Anzahl.',
  },
  {
    title: 'Karten und Navigation',
    body: 'Karten, Navigation und Routenberechnung kommen von Google Maps. Beim Anzeigen einer Karte erhält Google technische Daten wie IP-Adresse und Geräteangaben, bei der Navigation zusätzlich den Standort des Fahrergeräts und das Ziel.',
  },
  {
    title: 'Fehlerberichte',
    body: 'Stürzt die App ab, kann ein technischer Fehlerbericht (Gerätetyp, Systemversion, Fehlerstelle) an den Dienst Sentry übermittelt werden.',
  },
  {
    title: 'Push-Nachrichten',
    body: 'Mit deiner Erlaubnis schickt die App Nachrichten, zum Beispiel kurz bevor wir bei dir sind. Du kannst das jederzeit in den Einstellungen deines Telefons ausschalten. Dafür wird ein Geräte-Kennzeichen an den Push-Dienst von Expo, Apple und Google übermittelt.',
  },
  {
    title: 'Dienstleister, die wir nutzen',
    body: 'Supabase (Datenbank, Anmeldung und Dateispeicher, Rechenzentrum in Frankfurt), Google (Karten, Navigation und Routenberechnung, ohne Namen oder Hundedaten), Sentry (Fehlerberichte) und die Push-Dienste von Expo, Apple und Google. Es gibt keine Werbung und keine Weitergabe zu anderen Zwecken.',
  },
  {
    title: 'Deine Rechte',
    body: 'Du kannst Auskunft, Berichtigung und Löschung deiner Daten und deines Zugangs verlangen. Wende dich dazu an Dogworker Dresden (Kontakt-E-Mail hier noch eintragen).',
  },
];

export const CONSENT_SUMMARY =
  'Ich habe das Datenschutzdokument gelesen und bin einverstanden, dass Dogworker Dresden die Daten meines Hundes und meine Kontaktdaten in dieser App verarbeitet.';
