// Burimet e ndihmës sipas vendit. RREGULL: këtu vendosen VETËM numra të verifikuar.
// Kur një numër nuk është verifikuar, fusha mbetet null dhe ekrani udhëzon te një i rritur i besuar
// ose te shërbimet lokale të emergjencës, pa shpikur numra.
//
// Si shtohet një burim: shkolla/organizata e verifikon numrin në burimin zyrtar, e shton këtu
// me `verified: 'YYYY-MM-DD'` dhe `source` (adresa zyrtare), dhe e rishikon çdo vit.
export const COUNTRIES = {
  XK: { emergency: null, helplines: [] },   // Kosova: plotësohet pasi të verifikohet nga një burim zyrtar.
  AL: { emergency: null, helplines: [] },   // Shqipëria: plotësohet pasi të verifikohet.
  // Numri i përbashkët evropian i emergjencës 112 funksionon në të gjitha vendet e BE-së.
  DE: { emergency: '112', helplines: [], verified: '2026-09-25', source: 'https://digital-strategy.ec.europa.eu/en/policies/112' },
  AT: { emergency: '112', helplines: [], verified: '2026-09-25', source: 'https://digital-strategy.ec.europa.eu/en/policies/112' },
  OTHER: { emergency: null, helplines: [] }
};

export const COUNTRY_CODES = Object.keys(COUNTRIES);

export function resourcesFor(code) {
  return COUNTRIES[code] || COUNTRIES.OTHER;
}

export const SUPPORT_OPTIONS = ['trusted', 'prepare', 'people', 'bullying', 'friend', 'unsafe', 'immediate'];
