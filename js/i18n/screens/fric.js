// Friction Map: arsyet pse diçka u shty. Vetëm numërime neutrale.
export default {
  sq: {
    summary: 'Zgjodhe “{reason}” në {count} nga {total} detyrat e fundit të shtyra.',
    r: { too_large: 'shumë e madhe', unclear: 'e paqartë', phone: 'shpërqendrim nga telefoni', tired: 'i/e lodhur', worried: 'i/e shqetësuar',
      interrupted: 'u ndërpreva', no_time: 's\'kisha kohë', low_motivation: 'motivim i ulët', waiting: 'po prisja dikë', priority: 'ndryshoi prioriteti' }
  },
  en: {
    summary: 'You selected “{reason}” during {count} of the last {total} delayed tasks.',
    r: { too_large: 'too large', unclear: 'unclear', phone: 'phone distraction', tired: 'tired', worried: 'worried',
      interrupted: 'interrupted', no_time: 'no time', low_motivation: 'low motivation', waiting: 'waiting for someone', priority: 'changed priority' }
  },
  de: {
    summary: 'Du hast „{reason}“ bei {count} der letzten {total} verschobenen Aufgaben gewählt.',
    r: { too_large: 'zu groß', unclear: 'unklar', phone: 'Ablenkung durchs Handy', tired: 'müde', worried: 'besorgt',
      interrupted: 'unterbrochen', no_time: 'keine Zeit', low_motivation: 'wenig Motivation', waiting: 'auf jemanden gewartet', priority: 'Priorität geändert' }
  }
};
