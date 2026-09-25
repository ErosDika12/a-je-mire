// Emotional Constellations: ti je në qendër; rreth teje janë vetëm gjërat që regjistrove vetë.
// Afër = më e re, më i madh = e shënove si të rëndësishme, më i ndritshëm = e shënove si më të fortë.
import { icon, toast, openModal } from '../ui.js';
import { escapeHtml, formatDateLong } from '../format.js';
import { t } from '../i18n/index.js';
import { KINDS, collectStars, layout, links, trail, compare, textSummary } from '../stars.js';
import { shiftIso } from '../life.js';
import { photoUrl } from '../photos.js';

// Ngjyrat dallojnë vetëm kategoritë — asnjë ngjyrë nuk do të thotë "mirë" ose "keq".
const COLORS = { feeling: '#b8a9ff', moment: '#ffd29d', school: '#8fd3ff', friends: '#ffb3c7', family: '#ffc98b', sleep: '#9fb4ff',
  sport: '#86e3b5', music: '#f5a3ff', goal: '#ffe680', pressure: '#ff9f8a', focus: '#7ee0d6', photo: '#ffffff', activity: '#b5e48c', person: '#f7c6a3' };

const view = { period: 7, from: null, to: null, hidden: new Set(), selected: null, compareA: 'feeling', compareB: 'friends', playing: false, revealDay: null };
let playTimer = null;

function range(app) {
  if (view.period === 'custom' && view.from && view.to) return { from: view.from, to: view.to };
  return { from: shiftIso(app.today, -(view.period - 1)), to: app.today };
}

export function renderConstellation(container, app) {
  if (!view.playing) clearInterval(playTimer);
  const { from, to } = range(app);
  const days = Math.max(1, Math.round((new Date(`${to}T12:00:00`) - new Date(`${from}T12:00:00`)) / 86400000) + 1);
  const all = collectStars(app.profile, from, to);
  const placed = layout(all, to, days).filter(s => !view.hidden.has(s.kind));
  const selected = placed.find(s => s.id === view.selected) || null;
  const summary = textSummary(all);
  const cmp = compare(all, view.compareA, view.compareB);
  const presentKinds = KINDS.filter(k => all.some(s => s.kind === k));

  container.innerHTML = `
    <header class="page-head">
      <span class="eyebrow">${t('stars.eyebrow')}</span>
      <h1 class="page-title mt-2">${t('stars.title')}</h1>
      <p class="page-sub">${t('stars.subtitle')}</p>
    </header>
    <p class="stars-disclaimer">${icon('info', 15)} ${t('stars.disclaimer')}</p>

    <div class="stars-controls">
      <div class="seg-control" role="group" aria-label="${escapeHtml(t('stars.period'))}">
        ${[7, 30].map(n => `<button type="button" data-period="${n}" aria-pressed="${view.period === n}">${t('stars.days', { n })}</button>`).join('')}
        <button type="button" data-period="custom" aria-pressed="${view.period === 'custom'}">${t('stars.custom')}</button>
      </div>
      ${view.period === 'custom' ? `<div class="stars-dates">
        <label>${t('stars.from')} <input type="date" data-from value="${from}" max="${app.today}"></label>
        <label>${t('stars.to')} <input type="date" data-to value="${to}" max="${app.today}"></label></div>` : ''}
      <div class="mira-actions">
        <button type="button" class="btn btn-sm" data-play ${all.length ? '' : 'disabled'}>${icon('play', 14)} ${t('stars.play')}</button>
        <button type="button" class="btn btn-sm" data-snapshot ${all.length ? '' : 'disabled'}>${icon('download', 14)} ${t('stars.save')}</button>
      </div>
    </div>

    <div class="stars-stage">
      <div class="stars-sky" data-sky>
        ${all.length ? skySvg(placed, links(placed, view.hidden), trail(placed), selected) : `<div class="stars-empty"><p>${t('stars.empty')}</p>
          <div class="mira-actions"><button type="button" class="btn btn-sm" data-go="dashboard">${t('nav.dashboard')}</button><button type="button" class="btn btn-sm" data-go="checkin">${t('nav.checkin')}</button></div></div>`}
      </div>
      <aside class="card stars-detail" aria-live="polite">${selected ? detailHtml(selected, app) : `<p class="card-sub">${t('stars.pick')}</p>`}</aside>
    </div>

    ${presentKinds.length ? `<section class="card" aria-labelledby="stars-filter">
      <h2 id="stars-filter" class="card-title">${t('stars.categories')}</h2>
      <p class="card-sub">${t('stars.hideHint')}</p>
      <div class="tag-wrap mt-3">${presentKinds.map(k => `<button type="button" class="tag tag-sm stars-kind" data-kind="${k}" aria-pressed="${!view.hidden.has(k)}"><i style="background:${COLORS[k]}"></i>${t(`stars.k.${k}`)}</button>`).join('')}</div>
    </section>

    <section class="card" aria-labelledby="stars-compare">
      <h2 id="stars-compare" class="card-title">${t('stars.compare')}</h2>
      <div class="stars-compare mt-3">
        <select data-cmp="A" aria-label="${escapeHtml(t('stars.themeA'))}">${KINDS.map(k => `<option value="${k}" ${k === view.compareA ? 'selected' : ''}>${t(`stars.k.${k}`)}</option>`).join('')}</select>
        <span>+</span>
        <select data-cmp="B" aria-label="${escapeHtml(t('stars.themeB'))}">${KINDS.map(k => `<option value="${k}" ${k === view.compareB ? 'selected' : ''}>${t(`stars.k.${k}`)}</option>`).join('')}</select>
      </div>
      <p class="mira-voice mt-3">${t('stars.compareText', { a: t(`stars.k.${view.compareA}`), b: t(`stars.k.${view.compareB}`), both: cmp.both, onlyA: cmp.onlyA, onlyB: cmp.onlyB })}</p>
      <p class="card-note">${t('stars.compareNote')}</p>
    </section>` : ''}

    <section class="card" aria-labelledby="stars-text">
      <h2 id="stars-text" class="card-title">${t('stars.textTitle')}</h2>
      ${summary.length ? `<ul class="mira-read">${summary.map(row => `<li>${escapeHtml(t('stars.textRow', { kind: t(`stars.k.${row.kind}`), n: row.count, examples: row.examples.join(', ') }))}</li>`).join('')}</ul>`
        : `<p class="card-sub">${t('stars.empty')}</p>`}
      <p class="card-note">${t('stars.textNote', { from: formatDateLong(from), to: formatDateLong(to) })}</p>
    </section>

    ${snapshotsHtml(app)}`;

  wire(container, app, { from, to, placed, all });
}

function skySvg(placed, pairs, feelingTrail, selected) {
  const reveal = star => view.revealDay === null || star.date <= view.revealDay;
  const lines = pairs.map(([a, b]) => `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="sky-link ${reveal(a) && reveal(b) ? '' : 'is-hidden'}"/>`).join('');
  const trailPath = feelingTrail.length > 1 ? `<polyline class="sky-trail" points="${feelingTrail.filter(reveal).map(s => `${s.x},${s.y}`).join(' ')}"/>` : '';
  const stars = placed.map(s => `
    <g class="sky-star ${reveal(s) ? '' : 'is-hidden'} ${selected && selected.id === s.id ? 'is-selected' : ''}" data-star="${escapeHtml(s.id)}"
       tabindex="0" role="button" aria-label="${escapeHtml(`${t(`stars.k.${s.kind}`)}: ${s.label}, ${formatDateLong(s.date)}`)}">
      <circle cx="${s.x}" cy="${s.y}" r="${s.r * 2.6}" fill="${COLORS[s.kind]}" opacity="${(s.glow * 0.22).toFixed(2)}"/>
      <circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="${COLORS[s.kind]}" opacity="${s.glow.toFixed(2)}"/>
      ${s.kind === 'photo' ? `<circle cx="${s.x}" cy="${s.y}" r="${s.r + 2.5}" fill="none" stroke="${COLORS.photo}" stroke-width="1"/>` : ''}
    </g>`).join('');
  return `<svg class="sky" viewBox="0 0 600 600" role="group" aria-label="${escapeHtml(t('stars.skyLabel'))}">
    <defs><radialGradient id="sky-bg" cx="50%" cy="50%" r="60%"><stop offset="0%" stop-color="#27315a"/><stop offset="100%" stop-color="#0b1022"/></radialGradient></defs>
    <rect width="600" height="600" rx="24" fill="url(#sky-bg)"/>
    ${[90, 170, 250].map(r => `<circle cx="300" cy="300" r="${r}" class="sky-orbit"/>`).join('')}
    ${trailPath}${lines}${stars}
    <g class="sky-me" aria-hidden="true"><circle cx="300" cy="300" r="26" class="sky-me-glow"/><circle cx="300" cy="300" r="18" fill="#fff"/>
      <text x="300" y="305" text-anchor="middle">${escapeHtml(t('stars.me'))}</text></g>
    ${view.revealDay ? `<text x="300" y="585" text-anchor="middle" class="sky-day">${escapeHtml(formatDateLong(view.revealDay))}</text>` : ''}
  </svg>`;
}

function detailHtml(star, app) {
  const helped = (app.profile.days && app.profile.days[star.date] && app.profile.days[star.date].pause && app.profile.days[star.date].pause.done)
    ? [app.profile.days[star.date].pause.id === 'custom' ? app.profile.days[star.date].pause.custom : t(`today.p.${app.profile.days[star.date].pause.id}`)] : [];
  return `<span class="stars-dot" style="background:${COLORS[star.kind]}"></span>
    <span class="eyebrow">${t(`stars.k.${star.kind}`)}</span>
    <h2 class="card-title mt-2">${escapeHtml(star.label)}</h2>
    <p class="card-sub">${escapeHtml(formatDateLong(star.date))}</p>
    ${star.kind === 'feeling' ? `<p class="card-sub">${t('today.strength')} ${t(`today.s${star.strength}`)}</p>` : ''}
    ${star.people.length ? `<p class="mt-2"><strong>${t('stars.people')}</strong> ${escapeHtml(star.people.join(', '))}</p>` : ''}
    ${helped.length ? `<p class="mt-2"><strong>${t('stars.helped')}</strong> ${escapeHtml(helped.join(', '))}</p>` : ''}
    ${star.photoId ? `<button type="button" class="btn btn-sm mt-3" data-photo="${escapeHtml(star.photoId)}">${t('stars.openPhoto')}</button>` : ''}
    <label class="field mt-3" for="star-note"><span class="card-sub">${t('stars.note')}</span>
      <textarea id="star-note" maxlength="500">${escapeHtml(star.note)}</textarea></label>
    <div class="mira-actions">
      <button type="button" class="btn btn-sm" data-note-save>${t('common.save')}</button>
      <button type="button" class="btn btn-sm ${star.important ? 'is-done' : ''}" data-important aria-pressed="${star.important}">${icon('star', 14)} ${t('stars.important')}</button>
    </div>`;
}

function snapshotsHtml(app) {
  const snaps = (app.profile.stars && app.profile.stars.snapshots) || [];
  if (!snaps.length) return '';
  return `<section class="card" aria-labelledby="stars-snaps"><h2 id="stars-snaps" class="card-title">${t('stars.snapshots')}</h2>
    <div class="snap-grid mt-3">${snaps.slice().reverse().map(s => `<figure class="snap-item">
      <div class="snap-svg" aria-hidden="true">${s.svg}</div>
      <figcaption>${escapeHtml(formatDateLong(s.from))} – ${escapeHtml(formatDateLong(s.to))}
        <button type="button" class="btn btn-sm ${s.inWeek ? 'is-done' : ''}" data-to-week="${escapeHtml(s.id)}">${s.inWeek ? t('stars.inWeek') : t('stars.addWeek')}</button>
        <button type="button" class="btn btn-ghost btn-sm" data-snap-del="${escapeHtml(s.id)}">${t('common.delete')}</button></figcaption>
    </figure>`).join('')}</div></section>`;
}

function wire(root, app, ctx) {
  const rerender = () => renderConstellation(root, app);
  const stars = () => (app.profile.stars = app.profile.stars || { notes: {}, important: {}, snapshots: [] });
  const on = (selector, fn) => root.querySelectorAll(selector).forEach(el => el.addEventListener('click', () => fn(el)));

  on('[data-period]', el => { view.period = el.dataset.period === 'custom' ? 'custom' : Number(el.dataset.period); view.selected = null; view.revealDay = null; rerender(); });
  const fromIn = root.querySelector('[data-from]');
  const toIn = root.querySelector('[data-to]');
  if (fromIn) fromIn.addEventListener('change', () => { view.from = fromIn.value; view.to = toIn.value; if (view.from > view.to) view.to = view.from; rerender(); });
  if (toIn) toIn.addEventListener('change', () => { view.from = fromIn.value; view.to = toIn.value; if (view.from > view.to) view.from = view.to; rerender(); });

  root.querySelectorAll('[data-star]').forEach(g => {
    const select = () => { view.selected = g.dataset.star; rerender(); const again = root.querySelector(`[data-star="${CSS.escape(view.selected)}"]`); if (again) again.focus(); };
    g.addEventListener('click', select);
    g.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } });
  });
  on('[data-kind]', el => { const k = el.dataset.kind; if (view.hidden.has(k)) view.hidden.delete(k); else view.hidden.add(k); rerender(); });
  root.querySelectorAll('[data-cmp]').forEach(sel => sel.addEventListener('change', () => { view[`compare${sel.dataset.cmp}`] = sel.value; rerender(); }));

  on('[data-note-save]', () => {
    const text = root.querySelector('#star-note').value.trim();
    if (text) stars().notes[view.selected] = text.slice(0, 500); else delete stars().notes[view.selected];
    app.save(); toast(t('stars.noteSaved'), 'success'); rerender();
  });
  on('[data-important]', () => {
    if (stars().important[view.selected]) delete stars().important[view.selected]; else stars().important[view.selected] = true;
    app.save(); rerender();
  });
  on('[data-photo]', async el => {
    const photo = (app.profile.week.photos || []).find(p => p.id === el.dataset.photo);
    const url = await photoUrl(photo);
    openModal(photo.caption || t('stars.photoLabel'), url ? `<img class="modal-photo" src="${escapeHtml(url)}" alt="${escapeHtml(photo.caption || t('stars.photoLabel'))}">` : `<p>${t('stars.photoMissing')}</p>`);
  });

  // Luaj javën: yjet shfaqen dita pas dite. Me "reduced motion" shfaqen të gjitha menjëherë.
  on('[data-play]', () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { view.revealDay = null; toast(t('stars.reducedMotion')); rerender(); return; }
    let day = ctx.from;
    view.revealDay = day;
    view.playing = true;
    rerender();
    const stop = () => { clearInterval(playTimer); view.playing = false; view.revealDay = null; };
    playTimer = setInterval(() => {
      day = shiftIso(day, 1);
      // Ndalet kur mbaron periudha ose kur përdoruesi kalon në një ekran tjetër.
      if (root.hidden || !root.isConnected) { stop(); return; }
      if (day > ctx.to) { stop(); rerender(); return; }
      view.revealDay = day;
      renderConstellation(root, app);
    }, 700);
  });

  on('[data-snapshot]', () => {
    const svg = root.querySelector('.sky');
    if (!svg) return;
    const s = stars();
    s.snapshots = [...s.snapshots, {
      id: `s${Date.now().toString(36)}`, date: app.today, from: ctx.from, to: ctx.to,
      svg: svg.outerHTML.replace(/\s(tabindex|role|data-star|aria-label)="[^"]*"/g, '').slice(0, 60000),
      summary: textSummary(ctx.all).map(row => `${t(`stars.k.${row.kind}`)}: ${row.count}`).join(', '), inWeek: false
    }].slice(-12);
    app.save(); toast(t('stars.saved'), 'success'); rerender();
  });
  on('[data-to-week]', el => {
    const snap = stars().snapshots.find(x => x.id === el.dataset.toWeek);
    if (snap) { snap.inWeek = !snap.inWeek; app.save(); toast(snap.inWeek ? t('stars.addedWeek') : t('stars.removedWeek')); rerender(); }
  });
  on('[data-snap-del]', el => { stars().snapshots = stars().snapshots.filter(x => x.id !== el.dataset.snapDel); app.save(); rerender(); });
}
