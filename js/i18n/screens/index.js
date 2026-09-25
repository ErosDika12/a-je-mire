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
import today from './today.js';
import focus from './focus.js';
import fric from './fric.js';
import prof from './prof.js';
import coach from './coach.js';
import mmode from './mmode.js';
import tool from './tool.js';
import sup from './sup.js';
import stars from './stars.js';
import week from './week.js';
import cm from './cm.js';
import d60 from './d60.js';
import seed3 from './seed3.js';

const SCREENS = { core, dash, checkin, normal, changed, why, pat, helps, my5, compose, kafe, wall, comp, data, acct, privacy, consent, seed, mira, today, focus, fric, prof, coach, mmode, tool, sup, stars, week, cm, d60, seed3 };

function pick(lang) {
  return Object.fromEntries(Object.entries(SCREENS).map(([name, pair]) => [name, pair[lang] || {}]));
}

export const screensSq = pick('sq');
export const screensEn = pick('en');
export const screensDe = pick('de');
