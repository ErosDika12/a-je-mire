import { icon, toast, formatDateLong } from '../ui.js';
import { escapeHtml } from '../chart.js';
import {
  METRICS, METRIC_LABELS, METRIC_UNITS, METRIC_ENDS, METRIC_RANGES,
  SUGGESTED_TAGS, allTags, tagLabel
} from '../patterns.js';

const DEFAULTS = { mood: 6, sleep: 7.5, energy: 6, social: 6, joy: 6, load: 5 };

export function renderCheckin(container, app) {
  const profile = app.profile;
  const existing = profile.checkins.find(entry => entry.date === app.today) || null;
  const values = existing || DEFAULTS;
  const chosen = existing ? [...(existing.activities || [])] : [];

  container.innerHTML = markup(app.today, values, tagChoices(profile), chosen, existing);
  // Shënimi vendoset si veti, jo si HTML: teksti i përdoruesit nuk interpretohet kurrë.
  container.querySelector('#checkin-note').value = existing ? existing.note || '' : '';

  wireSliders(container);
  wireTags(container, chosen);
  container.querySelector('#checkin-save')
    .addEventListener('click', () => save(container, app, chosen));
}

function tagChoices(profile) {
  const used = allTags(profile.checkins);
  return [...new Set([...SUGGESTED_TAGS, ...used])];
}

function markup(today, values, tags, chosen, existing) {
  return `
    <header class="page-head">
      <h1 class="page-title">Check-in</h1>
      <p class="page-sub">Gjashtë rrëshqitës për ${formatDateLong(today)}. Nën njëzet sekonda.</p>
      ${existing ? `<p class="pill pill-accent pill-wrap" style="margin-top:var(--s3)">${icon('info', 13)} <span>Ke një check-in të ruajtur sot — ruajtja e re e zëvendëson</span></p>` : ''}
    </header>

    <section class="card">
      <div class="card-head"><div>
        <h2 class="card-title">Si ishte dita</h2>
        <p class="card-sub">Lëviz me gisht, me mi, ose me shigjetat e tastierës</p>
      </div></div>
      ${METRICS.map(metric => sliderMarkup(metric, values[metric])).join('')}
    </section>

    <section class="card" style="margin-top:var(--s4)">
      <div class="card-head"><div>
        <h2 class="card-title">Aktivitetet e sotme</h2>
        <p class="card-sub">Zgjidh sa të duash. Këto përdoren te "What Helps Me?"</p>
      </div></div>
      <div class="tag-wrap" id="checkin-tags">
        ${tags.map(tag => tagMarkup(tag, chosen.includes(tag))).join('')}
      </div>
      <div class="field" style="margin-top:var(--s4)">
        <label for="new-tag">Shto aktivitet tëndin</label>
        <div class="row" style="flex-wrap:nowrap;gap:var(--s2)">
          <input type="text" id="new-tag" maxlength="24" placeholder="p.sh. not, kitarë, vullnetarizëm"
                 autocomplete="off" enterkeyhint="done">
          <button type="button" class="btn" id="add-tag">${icon('plus', 16)}<span class="sr-only">Shto aktivitetin</span></button>
        </div>
      </div>
    </section>

    <section class="card" style="margin-top:var(--s4)">
      <div class="card-head"><div>
        <h2 class="card-title">Shënim, nëse do</h2>
        <p class="card-sub">Opsional. Përdoret vetëm për fjalët kryesore, lokalisht.</p>
      </div></div>
      <label class="sr-only" for="checkin-note">Shënimi i ditës</label>
      <textarea id="checkin-note" maxlength="300" rows="3" placeholder="Çfarë ndodhi sot?"></textarea>
    </section>

    <div class="row-between" style="margin-top:var(--s5)">
      <p class="status" id="checkin-status" role="status" aria-live="polite"></p>
      <button type="button" class="btn btn-primary" id="checkin-save">
        ${icon('check', 16)} ${existing ? 'Përditëso check-in-in' : 'Ruaj check-in-in'}
      </button>
    </div>`;
}

function sliderMarkup(metric, value) {
  const range = METRIC_RANGES[metric];
  const ends = METRIC_ENDS[metric];
  return `<div class="slider-card">
    <div class="slider-top">
      <label class="slider-name" for="slider-${metric}">${METRIC_LABELS[metric]}</label>
      <span class="slider-read">
        <output class="slider-val" id="out-${metric}" for="slider-${metric}">${value}</output>
        <span class="slider-unit">${METRIC_UNITS[metric]}</span>
      </span>
    </div>
    <input type="range" id="slider-${metric}" data-metric="${metric}"
           min="${range.min}" max="${range.max}" step="${range.step}" value="${value}"
           aria-describedby="ends-${metric}" aria-valuetext="${value} ${METRIC_UNITS[metric]}">
    <div class="slider-ends" id="ends-${metric}">
      <span>${range.min} · ${ends.low}</span><span>${ends.high} · ${range.max}</span>
    </div>
  </div>`;
}

function tagMarkup(tag, isOn) {
  return `<button type="button" class="tag" aria-pressed="${isOn}" data-tag="${escapeHtml(tag)}">${escapeHtml(tagLabel(tag))}</button>`;
}

function wireSliders(container) {
  for (const slider of container.querySelectorAll('input[type="range"]')) {
    const metric = slider.dataset.metric;
    const output = container.querySelector('#out-' + metric);
    slider.addEventListener('input', () => {
      output.textContent = slider.value;
      slider.setAttribute('aria-valuetext', `${slider.value} ${METRIC_UNITS[metric]}`);
    });
  }
}

function wireTags(container, chosen) {
  const list = container.querySelector('#checkin-tags');
  list.addEventListener('click', event => {
    const button = event.target.closest('.tag');
    if (!button) return;
    const tag = button.dataset.tag;
    const position = chosen.indexOf(tag);
    if (position === -1) chosen.push(tag); else chosen.splice(position, 1);
    button.setAttribute('aria-pressed', String(position === -1));
  });

  const field = container.querySelector('#new-tag');
  const addButton = container.querySelector('#add-tag');
  const add = () => addTag(field, list, chosen);
  addButton.addEventListener('click', add);
  field.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); add(); }
  });
}

function addTag(field, list, chosen) {
  const tag = field.value.trim().toLowerCase();
  field.value = '';
  if (tag === '') return;
  // Krahasoj tekstin e ruajtur, jo me selektor, që thonjëzat të mos e prishin kërkimin.
  const existing = [...list.querySelectorAll('.tag')].find(button => button.dataset.tag === tag);
  if (existing) {
    if (!chosen.includes(tag)) chosen.push(tag);
    existing.setAttribute('aria-pressed', 'true');
    existing.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return;
  }
  chosen.push(tag);
  list.insertAdjacentHTML('beforeend', tagMarkup(tag, true));
}

function save(container, app, chosen) {
  const entry = { date: app.today };
  for (const metric of METRICS) {
    entry[metric] = Number(container.querySelector('#slider-' + metric).value);
  }
  entry.activities = [...chosen];
  entry.note = container.querySelector('#checkin-note').value.trim();

  // Një check-in për ditë: ai i sotmi e mbishkruan atë ekzistues.
  const checkins = app.profile.checkins;
  const index = checkins.findIndex(item => item.date === app.today);
  const isNew = index === -1;
  if (isNew) checkins.push(entry); else checkins[index] = entry;
  checkins.sort((left, right) => left.date.localeCompare(right.date));

  app.save();
  container.querySelector('#checkin-status').textContent =
    isNew ? `U ruajt. Tani ke ${checkins.length} ditë.` : 'Check-in-i i sotëm u përditësua.';
  toast(isNew ? 'Check-in-i u ruajt' : 'Check-in-i u përditësua', 'ok');
  app.refreshShell();
}
