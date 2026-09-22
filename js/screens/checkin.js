import { icon, metricIcon, toast } from '../ui.js';
import { escapeHtml, formatWeekday } from '../format.js';
import {
  METRICS, METRIC_LABELS, METRIC_UNITS, METRIC_ENDS, METRIC_RANGES,
  SUGGESTED_TAGS, allTags, tagLabel
} from '../patterns.js';

const DEFAULTS = { mood: 6, sleep: 7.5, energy: 6, social: 6, joy: 6, load: 5 };

export function renderCheckin(container, app) {
  const profile = app.profile;
  const existing = profile.checkins.find(entry => entry.date === app.today) || null;
  const values = { ...DEFAULTS, ...(existing || {}) };
  const chosen = existing ? [...(existing.activities || [])] : [];

  container.innerHTML = markup(app.today, values, tagChoices(profile), chosen, existing);
  // Shënimi vendoset si veti, jo si HTML: teksti i përdoruesit nuk interpretohet kurrë.
  container.querySelector('#checkin-note').value = existing ? existing.note || '' : '';

  wireSliders(container);
  wireTags(container, chosen);
  container.querySelector('#checkin-save').addEventListener('click', () => save(container, app, chosen));
}

function tagChoices(profile) {
  return [...new Set([...SUGGESTED_TAGS, ...allTags(profile.checkins)])];
}

function markup(today, values, tags, chosen, existing) {
  return `
    <header class="page-head">
      <span class="eyebrow">${escapeHtml(formatWeekday(today))}</span>
      <h1 class="page-title mt-2">Check-in</h1>
      <p class="page-sub">Gjashtë rrëshqitës. Plotësohet për më pak se 20 sekonda.</p>
      ${existing ? `<p class="pill pill-accent pill-wrap mt-3">${icon('info', 13)}<span>Ke një check-in të ruajtur sot. Ruajtja e re e zëvendëson të njëjtën ditë.</span></p>` : ''}
    </header>

    <div class="g-12">
      <section class="card card-accent span-7" aria-labelledby="sliders-title">
        <span class="eyebrow">Gjashtë matjet</span>
        <h2 class="card-title" id="sliders-title">Si ishte dita</h2>
        <p class="card-sub">Me gisht, me mi ose me shigjetat e tastierës.</p>
        <div class="mt-4">${METRICS.map(metric => sliderMarkup(metric, values[metric])).join('')}</div>
      </section>

      <div class="span-5 stack">
        <section class="card" aria-labelledby="tags-title">
          <span class="eyebrow">Opsionale</span>
          <h2 class="card-title" id="tags-title">Aktivitetet e sotme</h2>
          <p class="card-sub">Përdoren te What Helps Me?</p>
          <div class="tag-wrap mt-4" id="checkin-tags">${tags.map(tag => tagMarkup(tag, chosen.includes(tag))).join('')}</div>
          <div class="field mt-4">
            <label for="new-tag">Shto aktivitet tëndin</label>
            <div class="row" style="flex-wrap:nowrap;gap:var(--s2)">
              <input type="text" id="new-tag" maxlength="24" placeholder="p.sh. kitarë" autocomplete="off" enterkeyhint="done">
              <button type="button" class="icon-btn" id="add-tag" aria-label="Shto aktivitetin">${icon('plus', 18)}</button>
            </div>
          </div>
        </section>

        <section class="panel" aria-labelledby="note-title">
          <span class="eyebrow">Opsionale</span>
          <h2 class="card-title" id="note-title"><label for="checkin-note">Shënim</label></h2>
          <p class="card-sub">Mbetet në këtë pajisje. Përdoret vetëm për fjalët kryesore.</p>
          <textarea id="checkin-note" class="mt-3" maxlength="300" rows="3" placeholder="Çfarë ndodhi sot?"></textarea>
        </section>
      </div>
    </div>

    <div class="row-between mt-5">
      <p class="status" id="checkin-status" role="status" aria-live="polite"></p>
      <button type="button" class="btn btn-primary" id="checkin-save">
        ${icon('check', 16)} <span>${existing ? 'Përditëso check-in' : 'Ruaj check-in'}</span>
      </button>
    </div>`;
}

function fillPercent(metric, value) {
  const range = METRIC_RANGES[metric];
  return `${(((value - range.min) / (range.max - range.min)) * 100).toFixed(1)}%`;
}

function sliderMarkup(metric, value) {
  const range = METRIC_RANGES[metric];
  const ends = METRIC_ENDS[metric];
  return `<div class="slider-card">
    <div class="slider-top">
      ${metricIcon(metric)}
      <label class="slider-name" for="slider-${metric}">${METRIC_LABELS[metric]}</label>
      <span class="slider-read">
        <output class="slider-val" id="out-${metric}" for="slider-${metric}">${value}</output>
        <span class="slider-unit">${METRIC_UNITS[metric]}</span>
      </span>
    </div>
    <input type="range" id="slider-${metric}" data-metric="${metric}" style="--fill:${fillPercent(metric, value)}"
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
      slider.style.setProperty('--fill', fillPercent(metric, Number(slider.value)));
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
  const add = () => addTag(field, list, chosen);
  container.querySelector('#add-tag').addEventListener('click', add);
  field.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); add(); }
  });
}

function addTag(field, list, chosen) {
  const tag = field.value.trim().toLowerCase().slice(0, 24);
  field.value = '';
  if (tag === '') return;
  // Krahasoj tekstin e ruajtur, jo me selektor, që thonjëzat të mos e prishin kërkimin.
  const existing = [...list.querySelectorAll('.tag')].find(button => button.dataset.tag === tag);
  if (!chosen.includes(tag)) chosen.push(tag);
  if (existing) existing.setAttribute('aria-pressed', 'true');
  else list.insertAdjacentHTML('beforeend', tagMarkup(tag, true));
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

  const stored = app.save();
  const button = container.querySelector('#checkin-save');
  button.classList.add('is-done');
  button.querySelector('span').textContent = isNew ? 'U ruajt' : 'U përditësua';
  setTimeout(() => {
    button.classList.remove('is-done');
    button.querySelector('span').textContent = 'Përditëso check-in';
  }, 1600);

  container.querySelector('#checkin-status').textContent = stored
    ? (isNew ? `Check-in-i u ruajt. Gjithsej ${checkins.length} ditë.` : 'Check-in-i i sotëm u përditësua.')
    : 'Check-in-i u regjistrua për këtë sesion, por pajisja nuk lejoi ruajtjen.';
  toast(stored ? (isNew ? 'Check-in-i u ruajt' : 'Check-in-i u përditësua') : 'Pajisja nuk lejoi ruajtjen', stored ? 'ok' : 'err');
}
