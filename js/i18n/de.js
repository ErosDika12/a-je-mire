// Deutsch. Nur Text, keine Logik. Fehlende Texte fallen auf Englisch zurück (siehe i18n/index.js).
// Rechtliche Texte sind ungeprüfte Übersetzungen. Nur für Mitarbeitende sichtbare oder in Produktion
// ausgeschaltete Module (Verwaltung, Abo, Mentor, KI, Benachrichtigungen, Server-Community) nutzen Englisch.
import { screensDe } from './screens/index.js';
import older from './de-screens.js';

export default {
  ...screensDe,
  ...older,
  common: {
    save: 'Speichern', cancel: 'Abbrechen', confirm: 'Bestätigen', close: 'Schließen', delete: 'Löschen', back: 'Zurück', more: 'Mehr',
    actions: 'Aktionen', loading: 'Wird geladen…', loadMore: 'Mehr anzeigen'
  },
  nav: {
    dashboard: 'Heute', mira: 'MIRA', week: 'My Week', constellation: 'Constellation', profile: 'Profil',
    focus: 'Focus Space', toolkits: 'Situations-Toolkits', support: 'Ich brauche Unterstützung', forum: 'Pilot-Community', demo60: 'Eine Woche in 60 Sekunden',
    group_main: 'Haupt', group_insights: 'Insights',
    short_community: 'Community', short_week: 'Woche', short_constellation: 'Sterne', short_profile: 'Profil',
    checkin: 'Check-in', challenges: 'Challenges', normal: 'My Normal', changed: 'Something Changed', why: 'Why?', patterns: 'Patterns',
    helps: 'What Helps Me?', assistant: 'Assistent', connect: 'Meine Menschen', community: 'Community', network: 'Netzwerk', mentor: 'Mentor',
    data: 'Meine Daten', account: 'Konto', notifications: 'Benachrichtigungen', subscription: 'Plus', privacy: 'Privatsphäre', admin: 'Verwaltung',
    group_you: 'Meine Werkzeuge', group_patterns: 'Patterns', group_people: 'Menschen', group_privacy: 'Privatsphäre', group_staff: 'Team',
    short_dashboard: 'Heute', short_mira: 'MIRA', short_normal: 'Normal', short_patterns: 'Patterns', short_connect: 'Menschen',
    more: 'Mehr', settings: 'Einstellungen', tour: 'Geführte Tour', theme: 'Design'
  },
  shell: {
    mainNav: 'Hauptnavigation', quickNav: 'Schnellnavigation', skip: 'Zum Inhalt springen', helpShort: 'Hilfe',
    demoProfile: 'Synthetisches Demo-Profil', privateProfile: 'Privates Profil', deviceOnly: 'nur auf diesem Gerät',
    days: { one: '{n} Tag', other: '{n} Tage' },
    privateCreated: 'Privates Profil erstellt', demoLoaded: 'Synthetisches Profil geladen', deleted: 'Alle Daten gelöscht',
    updateAvailable: 'Eine neue Version der App ist verfügbar.', updateTitle: 'Neue Version', refresh: 'Neu laden'
  },
  metrics: { mood: 'Stimmung', sleep: 'Schlaf', energy: 'Energie', social: 'Soziale Verbindung', joy: 'Freude', load: 'Belastung' },
  errors: {
    generic: 'Etwas ist schiefgelaufen. Deine lokalen Daten sind unverändert.', network: 'Der Server ist nicht erreichbar. Versuch es wieder, wenn du online bist.',
    rate_limited: 'Zu viele Aktionen in kurzer Zeit. Versuch es gleich noch einmal.', not_found: 'Nicht gefunden, oder du hast keinen Zugriff.',
    feature_disabled: 'Dieses Modul ist gerade nicht aktiv.', nickname_reserved: 'Dieser Spitzname ist reserviert. Wähl bitte einen anderen.',
    nickname_taken: 'Dieser Spitzname (oder ein sehr ähnlicher) ist vergeben.', duplicate_content: 'Diesen Text hast du heute schon gepostet.',
    too_many_links: 'Zu viele Links in einem Text.', reauth_required: 'Für diese Aktion musst du dein Passwort noch einmal eingeben.',
    reauth_failed: 'Das Passwort wurde nicht angenommen.', forbidden: 'Du hast keine Berechtigung für diese Aktion.', forbidden_self: 'Du kannst deine eigenen Rollen nicht ändern.',
    invalid_code: 'Der Code ist ungültig, abgelaufen oder schon benutzt.', profile_required: 'Erstell zuerst deinen Spitznamen.',
    suspended: 'Dein Konto ist für diese Aktion vorübergehend gesperrt.', not_connected: 'Nachrichten sind nur zwischen angenommenen Verbindungen erlaubt.',
    cannot_report_self: 'Du kannst dich nicht selbst melden.', grant_inactive: 'Diese Freigabe ist abgelaufen oder wurde widerrufen.',
    outside_range: 'Dieses Datum liegt außerhalb des freigegebenen Zeitraums.', invalid_timezone: 'Unbekannte Zeitzone.', not_configured: 'Dieser Dienst ist noch nicht eingerichtet.',
    unsafe_output: 'Die Antwort wurde von den Sicherheitsregeln blockiert. Probier die Alternative ohne KI.', provider_error: 'Der Anbieter hat nicht geantwortet. Versuch es später.',
    provider_unreachable: 'Der Anbieter ist gerade nicht erreichbar.', invalid_endpoint: 'Dieser Browser unterstützt keine Benachrichtigungen.',
    challenge_ended: 'Diese Challenge ist beendet.', no_customer: 'Es gibt noch kein Abrechnungskonto.', no_subscription: 'Kein aktives Abo.',
    passphrase: 'Die Sync-Passphrase öffnet diese Sicherung nicht.'
  },
  account: { password: 'Passwort' },
  social: {
    profileTitle: 'Erstell deinen Spitznamen', profileTitleEdit: 'Dein öffentliches Profil',
    profileIntro: 'Community und Verbindungen brauchen nur einen Spitznamen. Dein Avatar ist eine abstrakte Form, kein Foto.',
    nickname: 'Spitzname', nicknameHint: '3–24 Zeichen: Buchstaben, Zahlen, _ . -', bio: 'Ein Satz über dich', optional: 'optional',
    profilePrivacy: 'Deine E-Mail, MY 5 und Check-ins werden nie gezeigt. Du kannst dein Profil jederzeit löschen.', profileSaved: 'Profil gespeichert',
    goToAccount: 'Konto öffnen', block: 'Blockieren', blockTitle: 'Diese Person blockieren',
    blockExplain: 'Ihr seht euch nicht mehr, könnt keine Anfragen oder Nachrichten senden, und eure Verbindung wird entfernt. Die Person wird nicht benachrichtigt.',
    blocked: 'Blockiert', mute: 'Stummschalten', muted: 'Stummgeschaltet — ihre Beiträge werden dir nicht mehr angezeigt'
  },
  report: {
    title: 'Melden', short: 'Melden', reason: 'Grund', details: 'Details', send: 'Meldung senden', sent: 'Meldung gesendet. Danke.',
    privacyWarning: 'Füg keine privaten Notizen oder persönlichen Daten in die Meldung ein.', note: 'Moderatoren sehen nur den gemeldeten Inhalt, nicht deinen Namen.',
    privateNote: 'Ein Moderator sieht nur die gemeldete(n) Nachricht(en). Jedes Öffnen wird protokolliert.',
    safetyNote: 'Wenn gerade jemand in Gefahr ist, sprich mit einem Erwachsenen, dem du vertraust, oder wende dich an den örtlichen Notdienst. Diese App kontaktiert nie von selbst jemanden.',
    reasons: { spam: 'Spam oder Werbung', harassment: 'Belästigung oder Beleidigungen', hate: 'Hass', safety_concern: 'Sorge um die Sicherheit einer Person', sexual: 'Sexuelle Inhalte',
      privacy: 'Gibt private Daten preis', impersonation: 'Gibt sich als jemand anderes aus', other: 'Anderes' },
    status: { open: 'Offen', actioned: 'Maßnahme ergriffen', dismissed: 'Ohne Maßnahme geschlossen' },
    types: { post: 'Beitrag', reply: 'Antwort', profile: 'Profil', message: 'Nachricht', conversation: 'Gespräch' }
  },
  challenges: {
    title: 'Challenges', subtitle: 'Kleine Mitmach-Challenges. Keine Ranglisten, keine Strafen, kein Druck.', private: 'Meine Challenges',
    privateNote: 'Privat: Sie bleiben nur auf diesem Gerät. Der Fortschritt zählt, wie oft du etwas gemacht hast, nicht die eingetragenen Werte.',
    new: 'Neue Challenge', newFriends: 'Challenge mit Freunden', none: 'Keine aktiven Challenges. Starte eine, wann du willst.', past: 'Vergangene Challenges',
    template: 'Art', titleLabel: 'Titel', start: 'Beginnt', end: 'Endet', target: 'Wie oft', create: 'Erstellen', created: 'Challenge erstellt',
    invalidDates: 'Das Enddatum muss nach dem Startdatum liegen.', done: 'Erledigt', ongoing: 'Läuft', progress: '{n} von {target}', range: '{start} → {end}',
    leave: 'Verlassen', left: 'Du hast die Challenge verlassen', tickRoutine: 'Heute gemacht', tickReach: 'Heute habe ich mich selbst gemeldet', tickedToday: 'Heute markiert',
    reachNote: 'Die App kontaktiert nie jemanden. Du machst es selbst und markierst es dann hier.', celebrate: 'Gut gemacht! Du hast „{name}“ geschafft.',
    t_checkins_5_in_7: 'Fünf Check-ins in sieben Tagen', t_activities_3_days: 'Aktivitäten an drei verschiedenen Tagen', t_weekly_snapshot: 'Wochenübersicht ansehen',
    t_export_backup: 'Eine persönliche Sicherung exportieren', t_routine: 'Eine Routine, die du wählst', t_reach_out: 'Dich selbst bei einer Person melden',
    friends: 'Mit Freunden', friendsOff: 'Challenges mit Freunden sind gerade nicht aktiv.', friendsSignIn: 'Challenges mit Freunden brauchen ein Konto.',
    friendsExplain: 'Nur deine angenommenen Verbindungen können sie sehen. Geteilt wird nur, wie oft du es gemacht hast — nie Check-in-Werte.',
    friendsNote: 'Deine Verbindungen können sie sehen und mitmachen. Es gibt keine Rangliste.', noneFriends: 'Keine Challenges mit Freunden.', join: 'Mitmachen',
    sendProgress: 'Meinen Fortschritt senden', progressSent: 'Gesendet: {n}', participants: 'Teilnehmende', boardNote: 'Nach Spitzname sortiert, nicht nach Fortschritt.',
    yours: 'deine', createdAt: 'Erstellt am {date}', achievements: 'Erfolge', achievementsNote: 'Nur für dich. Du kannst sie jederzeit ausblenden.',
    ach_first_checkin: 'Erster Check-in', ach_seven_checkins: 'Sieben Check-ins', ach_baseline_ready: 'Basis gebildet (14 Tage)', ach_first_challenge: 'Erste Challenge geschafft',
    ach_three_challenges: 'Drei Challenges geschafft', ach_backup_exported: 'Erste persönliche Sicherung', hiddenAchievement: 'Verborgener Erfolg', hide: 'Ausblenden', show: 'Anzeigen', notYet: 'Noch nicht'
  }
};
