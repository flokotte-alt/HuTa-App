// ENTWURF: Datenschutztexte vor dem echten Einsatz rechtlich pruefen lassen.
export const CONSENT_VERSION = '2026-11-entwurf-2';

export const PRIVACY_TEXT: { title: string; body: string }[] = [
  {
    title: 'Wer ist verantwortlich?',
    body: 'Dogworker Dresden, Florian Kotte. Die App dient allein der Organisation der Hundeabholung für Kundinnen und Kunden von Dogworker Dresden.',
  },
  {
    title: 'Welche Daten werden verarbeitet?',
    body: 'Name, E-Mail-Adresse und Telefonnummer, Name und Regeln deines Hundes (feste Tage, Station, Übergabe), dein Wochenplan, Urlaub, Krankmeldungen, Daumen-Bestätigungen und Wohnungs-Wünsche. Die Adresse deines Hundes und deine Kontaktdaten sieht nur Dogworker. Andere Kunden sehen von dir nur den Namen deines Hundes in der Wochenliste.',
  },
  {
    title: 'Standort',
    body: 'Der Standort des Fahrzeugs wird nur während einer laufenden Fahrt vom Gerät des Fahrers übertragen, auch bei gesperrtem Handy oder wenn die App im Hintergrund ist, und nur als aktueller Wert gespeichert. Nach dem Ende der Fahrt wird er gelöscht. Dein eigener Standort wird nicht erfasst. Andere Kunden sehen weder Standorte noch Adressen.',
  },
  {
    title: 'Karten und Navigation',
    body: 'Karten und die Navigation für die Fahrer kommen von Google Maps. Beim Anzeigen einer Karte erhält Google technische Daten wie IP-Adresse und Geräteangaben, bei der Navigation zusätzlich den Standort des Fahrergeräts und das Ziel.',
  },
  {
    title: 'Fehlerberichte',
    body: 'Stürzt die App ab, kann ein technischer Fehlerbericht (Gerätetyp, Systemversion, Fehlerstelle) an den Dienst Sentry übermittelt werden.',
  },
  {
    title: 'Push-Nachrichten',
    body: 'Mit deiner Erlaubnis schickt die App Nachrichten, zum Beispiel wenn die Abholung startet, wenn du bereit sein sollst oder wenn sich der Wochenplan ändert. Du kannst das jederzeit in den Einstellungen deines Telefons ausschalten. Dafür wird ein Geräte-Kennzeichen an den Push-Dienst von Expo, Apple und Google übermittelt.',
  },
  {
    title: 'Dienstleister, die wir nutzen',
    body: 'Supabase (Datenbank und Anmeldung, Rechenzentrum in Frankfurt), Google (Karten, Navigation und Routenberechnung, ohne Namen oder Hundedaten), Sentry (Fehlerberichte) und die Push-Dienste von Expo, Apple und Google. Es gibt keine Werbung und keine Weitergabe zu anderen Zwecken.',
  },
  {
    title: 'Deine Rechte',
    body: 'Du kannst Auskunft, Berichtigung und Löschung deiner Daten verlangen. In der App kannst du dein Konto unter "Mein Hund" jederzeit löschen. Dabei werden dein Konto, dein Kundeneintrag, dein Hund, dein Wochenplan und dein Urlaub gelöscht. Bei Fragen wende dich an Dogworker Dresden (Kontakt-E-Mail hier noch eintragen).',
  },
];

export const CONSENT_SUMMARY =
  'Ich bin damit einverstanden, dass Dogworker Dresden die Daten meines Hundes und meine Kontaktdaten in dieser App verarbeitet, damit die Abholung organisiert werden kann. Ich habe die Datenschutzerklärung gelesen.';
