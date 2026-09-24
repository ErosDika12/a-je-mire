// Përkthimet e ekraneve të Fazës 1, secili ekran në skedarin e vet me shqipen dhe anglishten krah për krah.
import core from './core.js';
import dash from './dash.js';
import checkin from './checkin.js';
import normal from './normal.js';
import changed from './changed.js';
import why from './why.js';
import pat from './pat.js';
import helps from './helps.js';
import my5 from './my5.js';
import compose from './compose.js';
import kafe from './kafe.js';
import wall from './wall.js';
import comp from './comp.js';
import data from './data.js';
import acct from './acct.js';
import privacy from './privacy.js';
import consent from './consent.js';
import seed from './seed.js';
import mira from './mira.js';

const SCREENS = { core, dash, checkin, normal, changed, why, pat, helps, my5, compose, kafe, wall, comp, data, acct, privacy, consent, seed, mira };

function pick(lang) {
  return Object.fromEntries(Object.entries(SCREENS).map(([name, pair]) => [name, pair[lang]]));
}

export const screensSq = pick('sq');
export const screensEn = pick('en');
