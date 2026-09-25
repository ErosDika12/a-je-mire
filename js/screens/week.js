// My Week: një histori private e javës, jo një panel statistikash.
// Fotot mbeten në pajisje, pa njohje fytyre dhe pa "lexim" të tyre. Asgjë nuk ndahet pa u zgjedhur.
import { icon, toast, copyText } from '../ui.js';
import { escapeHtml, formatDateLong, formatWeekday } from '../format.js';
import { t } from '../i18n/index.js';
import { PHOTO_TAGS, WEEK_FIELDS, weekStart, weekDates, weekOf, photosIn } from '../week-data.js';
import { addPhoto, photoUrl, deletePhoto } from '../photos.js';
import { STYLES, collectFacts, composeStory } from '../story.js';
import { collectStars, layout, links, textSummary } from '../stars.js';
import { shiftIso } from '../life.js';

const EXPORT_SECTIONS = ['title', 'story', 'photos', 'moments', 'people', 'notes', 'constellation'];
let current = null;
let storyStyle = 'simple';
let removed = new Set();
let editingStory = false;
let exportPick = new Set(['title', 'story', 'photos']);

export async function renderWeek(container, app) {
  const profile = app.profile;
  current = current || weekStart(app.today);
  const start = current;
  const dates = weekDates(start);
  const week = weekOf(profile, start);
  const photos = photosIn(profile, start);
  const urls = Object.fromEntries(await Promise.all(photos.map(async p => [p.id, await photoUrl(p)])));
  const cover = photos.find(p => p.id === week.coverId) || photos.find(p => p.best) || photos[0] || null;
  const facts = collectFacts(profile, start);
  const snaps = ((profile.stars && profile.stars.snapshots) || []).filter(s => s.inWeek && s.to >= start && s.from <= dates[6]);
  const sessions = ((profile.focus && profile.focus.sessions) || []).filter(s => dates.includes(s.date));
  const people = peopleOfWeek(profile, dates, photos);
  const stored = profile.consent && profile.consent.store === true;

  container.innerHTML = `
    <header class="week-hero ${cover ? 'has-cover' : ''}" ${cover && urls[cover.id] ? `style="--cover:url('${escapeHtml(urls[cover.id])}')"` : ''}>
      <div class="week-hero-inner">
        <div class="week-nav">
          <button type="button" class="icon-btn" data-week="-7" aria-label="${escapeHtml(t('week.prev'))}">${icon('back', 18)}</button>
          <span class="eyebrow">${escapeHtml(formatDateLong(dates[0]))} – ${escapeHtml(formatDateLong(dates[6]))}</span>
          <button type="button" class="icon-btn" data-week="7" aria-label="${escapeHtml(t('week.next'))}" ${dates[6] >= app.today ? 'disabled' : ''}>${icon('next', 18)}</button>
        </div>
        <label class="sr-only" for="week-title">${t('week.titleLabel')}</label>
        <input id="week-title" class="week-title" type="text" maxlength="80" value="${escapeHtml(week.title)}" placeholder="${escapeHtml(t('week.titlePlaceholder'))}">
        <p class="week-private">${icon('lock', 14)} ${t('week.private')}</p>
        <button type="button" class="btn btn-primary mt-3" data-immersive ${facts.length || photos.length ? '' : 'disabled'}>${icon('play', 15)} ${t('week.immersive')}</button>
      </div>
    </header>
    ${stored ? '' : `<p class="card-note">${t('week.noConsent')}</p>`}

    <section class="card" aria-labelledby="week-photos">
      <div class="row-between"><h2 id="week-photos" class="card-title">${t('week.photos')}</h2>
        <label class="btn btn-sm">${icon('upload', 14)} ${t('week.upload')}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple data-upload class="sr-only"></label></div>
      <p class="card-sub">${t('week.photoNote')}</p>
      ${photos.length ? `<div class="week-mosaic mt-3">${photos.map((p, i) => photoCard(p, urls[p.id], i, photos.length, dates, profile, week)).join('')}</div>`
        : `<p class="card-sub mt-3">${t('week.noPhotos')}</p>`}
    </section>

    <div class="week-grid">
      <section class="card card-accent" aria-labelledby="week-best"><h2 id="week-best" class="card-title">${t('week.best')}</h2>
        ${photos.filter(p => p.best).length ? `<ul class="mira-read">${photos.filter(p => p.best).map(p => `<li>${escapeHtml(p.caption || formatDateLong(p.date))}</li>`).join('')}</ul>` : `<p class="card-sub">${t('week.bestEmpty')}</p>`}</section>
      <section class="card card-lav" aria-labelledby="week-people"><h2 id="week-people" class="card-title">${t('week.people')}</h2>
        ${people.length ? `<div class="tag-wrap mt-2">${people.map(n => `<span class="pill pill-lav">${escapeHtml(n)}</span>`).join('')}</div>` : `<p class="card-sub">${t('week.peopleEmpty')}</p>`}</section>
      <section class="card" aria-labelledby="week-focus"><h2 id="week-focus" class="card-title">${t('week.focus')}</h2>
        <p class="today-big">${t('week.focusCount', { n: sessions.length, done: sessions.filter(s => s.outcome === 'completed').length })}</p>
        <button type="button" class="btn-link" data-go="focus">${t('nav.focus')} ${icon('next', 14)}</button></section>
      <section class="card week-stars" aria-labelledby="week-sky"><h2 id="week-sky" class="card-title">${t('week.constellation')}</h2>
        ${miniSky(profile, dates)}
        ${snaps.length ? `<p class="card-sub">${t('week.snapshots', { n: snaps.length })}</p>` : ''}
        <button type="button" class="btn-link" data-go="constellation">${t('nav.constellation')} ${icon('next', 14)}</button></section>
    </div>

    <section class="card" aria-labelledby="week-notes"><h2 id="week-notes" class="card-title">${t('week.notesTitle')}</h2>
      <div class="week-fields">${WEEK_FIELDS.filter(f => f !== 'title').map(f => `
        <label class="field"><span class="card-sub">${t(`week.f.${f}`)}</span>
          <textarea data-field="${f}" maxlength="400" placeholder="${escapeHtml(t(`week.ph.${f}`))}">${escapeHtml(week[f])}</textarea></label>`).join('')}</div>
      <button type="button" class="btn btn-primary mt-3" data-save-notes>${t('common.save')}</button>
    </section>

    ${storySection(week, facts)}
    ${exportSection()}`;

  wire(container, app, { start, week, photos, facts, urls, dates });
}

function peopleOfWeek(profile, dates, photos) {
  const set = new Set();
  for (const d of dates) { const day = profile.days && profile.days[d]; if (day && day.person && day.person.name) set.add(day.person.name); }
  for (const c of profile.connections || []) if (dates.includes(c.date)) set.add(c.personName);
  for (const p of photos) p.people.forEach(n => set.add(n));
  return [...set];
}

function photoCard(p, url, i, total, dates, profile, week) {
  const names = (profile.my5 || []).map(x => x.name);
  return `<figure class="week-photo ${p.best ? 'is-best' : ''}">
    ${url ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(p.caption || t('week.photoAlt', { date: formatDateLong(p.date) }))}" loading="lazy">` : `<div class="week-photo-missing">${t('stars.photoMissing')}</div>`}
    ${p.synthetic ? `<span class="pill pill-amber week-synth">${t('week.synthetic')}</span>` : ''}
    <figcaption>
      <label class="sr-only" for="cap-${p.id}">${t('week.caption')}</label>
      <input id="cap-${p.id}" type="text" maxlength="200" data-caption="${p.id}" value="${escapeHtml(p.caption)}" placeholder="${escapeHtml(t('week.caption'))}">
      <label class="sr-only" for="date-${p.id}">${t('week.date')}</label>
      <select id="date-${p.id}" data-date="${p.id}">${dates.map(d => `<option value="${d}" ${d === p.date ? 'selected' : ''}>${escapeHtml(formatWeekday(d))}</option>`).join('')}</select>
      <details><summary>${t('week.tagsPeople')}</summary>
      <div class="tag-wrap">${PHOTO_TAGS.map(tag => `<button type="button" class="tag tag-xs" data-tag="${p.id}:${tag}" aria-pressed="${p.tags.includes(tag)}">${t(`week.tags.${tag}`)}</button>`).join('')}</div>
      ${names.length ? `<div class="tag-wrap">${names.map(n => `<button type="button" class="tag tag-xs" data-person="${p.id}:${escapeHtml(n)}" aria-pressed="${p.people.includes(n)}">${escapeHtml(n)}</button>`).join('')}</div>` : ''}
      </details>
      <div class="week-photo-actions">
        <button type="button" class="btn btn-sm ${p.best ? 'is-done' : ''}" data-best="${p.id}" aria-pressed="${p.best}">${icon('star', 13)} ${t('week.markBest')}</button>
        <button type="button" class="btn btn-sm ${week.coverId === p.id ? 'is-done' : ''}" data-cover="${p.id}">${t('week.cover')}</button>
        <button type="button" class="icon-btn" data-move="${p.id}:-1" ${i === 0 ? 'disabled' : ''} aria-label="${escapeHtml(t('week.moveUp'))}">${icon('back', 15)}</button>
        <button type="button" class="icon-btn" data-move="${p.id}:1" ${i === total - 1 ? 'disabled' : ''} aria-label="${escapeHtml(t('week.moveDown'))}">${icon('next', 15)}</button>
        <button type="button" class="icon-btn" data-del="${p.id}" aria-label="${escapeHtml(t('week.deletePhoto'))}">${icon('trash', 15)}</button>
      </div>
    </figcaption>
  </figure>`;
}

function miniSky(profile, dates) {
  const stars = layout(collectStars(profile, dates[0], dates[6]), dates[6], 7, 300);
  if (!stars.length) return `<p class="card-sub">${t('stars.empty')}</p>`;
  const summary = textSummary(stars).map(r => `${t(`stars.k.${r.kind}`)}: ${r.count}`).join(', ');
  return `<svg class="mini-sky" viewBox="0 0 300 300" role="img" aria-label="${escapeHtml(summary)}">
    <rect width="300" height="300" rx="16" fill="#101730"/>
    ${links(stars).map(([a, b]) => `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="rgba(255,255,255,.18)"/>`).join('')}
    ${stars.map(s => `<circle cx="${s.x}" cy="${s.y}" r="${Math.max(2, s.r * 0.7)}" fill="#fff" opacity="${s.glow.toFixed(2)}"/>`).join('')}
    <circle cx="150" cy="150" r="9" fill="#fff"/></svg>`;
}

function storySection(week, facts) {
  const story = week.story;
  return `<section class="card week-story" aria-labelledby="week-story">
    <span class="mira-orb mira-orb-sm" aria-hidden="true"></span>
    <h2 id="week-story" class="card-title">${t('week.storyTitle')}</h2>
    <p class="card-sub">${t('week.storyIntro')}</p>
    <p class="pill pill-lav pill-wrap mt-2"><span class="pill-dot"></span>${t('mira.localBadge')}</p>
    ${facts.length ? `<fieldset class="story-facts mt-3"><legend class="card-sub">${t('week.storyFacts')}</legend>
      ${facts.map(f => `<label class="story-fact"><input type="checkbox" data-fact="${f.id}" ${removed.has(f.id) ? '' : 'checked'}>
        <span>${escapeHtml(f.text)}<small>${escapeHtml(t('week.source', { source: f.source }))}</small></span></label>`).join('')}</fieldset>` : `<p class="mt-3">${t('week.storyNoFacts')}</p>`}
    <div class="seg-control mt-3" role="group" aria-label="${escapeHtml(t('week.styleLabel'))}">
      ${STYLES.map(s => `<button type="button" data-style="${s}" aria-pressed="${storyStyle === s}">${t(`week.style.${s}`)}</button>`).join('')}
    </div>
    <div class="mira-actions">
      <button type="button" class="btn btn-primary" data-generate ${facts.length ? '' : 'disabled'}>${story ? t('week.regenerate') : t('week.generate')}</button>
      ${story ? `<button type="button" class="btn" data-edit-story>${editingStory ? t('common.save') : t('week.editStory')}</button>
      <button type="button" class="btn btn-ghost" data-delete-story>${t('common.delete')}</button>` : ''}
    </div>
    ${story ? (editingStory
      ? `<label class="sr-only" for="story-text">${t('week.storyTitle')}</label><textarea id="story-text" class="story-text mt-3" maxlength="3000">${escapeHtml(story.text)}</textarea>`
      : `<blockquote class="story-quote mt-3">${escapeHtml(story.text).replace(/\n/g, '<br>')}</blockquote>`) : ''}
  </section>`;
}

function exportSection() {
  return `<section class="card" aria-labelledby="week-export"><h2 id="week-export" class="card-title">${t('week.exportTitle')}</h2>
    <p class="card-sub">${t('week.exportIntro')}</p>
    <div class="tag-wrap mt-3" role="group" aria-label="${escapeHtml(t('week.exportTitle'))}">
      ${EXPORT_SECTIONS.map(s => `<button type="button" class="tag tag-sm" data-export="${s}" aria-pressed="${exportPick.has(s)}">${t(`week.ex.${s}`)}</button>`).join('')}
    </div>
    <p class="card-note">${t('week.exportNote')}</p>
    <div class="mira-actions">
      <button type="button" class="btn" data-export-copy>${icon('copy', 14)} ${t('week.exportCopy')}</button>
      <button type="button" class="btn" data-export-file>${icon('download', 14)} ${t('week.exportFile')}</button>
    </div>
  </section>`;
}

// ---------- Pamja imersive e historisë ----------
function openImmersive(app, ctx) {
  const { week, photos, urls, dates } = ctx;
  const cover = photos.find(p => p.id === week.coverId) || photos.find(p => p.best) || photos[0];
  const feelings = dates.map(d => ({ d, f: app.profile.days && app.profile.days[d] && app.profile.days[d].feeling }));
  const snaps = ((app.profile.stars && app.profile.stars.snapshots) || []).filter(s => s.inWeek && s.to >= dates[0] && s.from <= dates[6]);
  const layer = document.createElement('div');
  layer.className = 'story-view';
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-modal', 'true');
  layer.setAttribute('aria-label', week.title || t('week.storyTitle'));
  layer.innerHTML = `
    <button type="button" class="icon-btn story-close" data-close aria-label="${escapeHtml(t('common.close'))}">${icon('close', 20)}</button>
    <section class="story-cover" ${cover && urls[cover.id] ? `style="--cover:url('${escapeHtml(urls[cover.id])}')"` : ''}>
      <span class="eyebrow">${escapeHtml(formatDateLong(dates[0]))} – ${escapeHtml(formatDateLong(dates[6]))}</span>
      <h2>${escapeHtml(week.title || t('week.titlePlaceholder'))}</h2>
    </section>
    ${week.story ? `<section class="story-block"><p class="story-lead">${escapeHtml(week.story.text).replace(/\n/g, '<br>')}</p></section>` : ''}
    ${photos.length ? `<section class="story-block story-mosaic">${photos.map(p => urls[p.id] ? `<figure class="${p.best ? 'is-best' : ''}"><img src="${escapeHtml(urls[p.id])}" alt="${escapeHtml(p.caption || '')}"><figcaption>${escapeHtml(p.caption)}</figcaption></figure>` : '').join('')}</section>` : ''}
    <section class="story-block"><h3>${t('week.timeline')}</h3><ol class="story-timeline">
      ${feelings.map(({ d, f }) => `<li><span>${escapeHtml(formatWeekday(d))}</span><strong>${f ? escapeHtml(f.word) : '·'}</strong></li>`).join('')}</ol></section>
    ${['difficult', 'helped', 'completed', 'learned'].filter(f => week[f]).length ? `<section class="story-block story-notes">${['difficult', 'helped', 'completed', 'learned'].filter(f => week[f]).map(f => `<div><h3>${t(`week.f.${f}`)}</h3><p>${escapeHtml(week[f])}</p></div>`).join('')}</section>` : ''}
    ${snaps.length ? `<section class="story-block story-sky">${snaps[snaps.length - 1].svg}</section>` : `<section class="story-block story-sky">${miniSky(app.profile, dates)}</section>`}
    <section class="story-block story-close-msg"><h3>${t('week.nextWeek')}</h3><p>${escapeHtml(week.intention || t('week.closingDefault'))}</p></section>`;
  document.body.appendChild(layer);
  document.body.classList.add('no-scroll');
  const last = document.activeElement;
  const close = () => { layer.remove(); document.body.classList.remove('no-scroll'); document.removeEventListener('keydown', onKey); if (last) last.focus(); };
  const onKey = event => { if (event.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  layer.querySelector('[data-close]').addEventListener('click', close);
  layer.querySelector('[data-close]').focus();
}

// ---------- Eksporti: vetëm seksionet e zgjedhura; kurrë matjet private ----------
function exportText(app, ctx) {
  const { week, photos, dates } = ctx;
  const parts = [];
  if (exportPick.has('title')) parts.push(`${week.title || t('week.titlePlaceholder')} (${formatDateLong(dates[0])} – ${formatDateLong(dates[6])})`);
  if (exportPick.has('story') && week.story) parts.push(week.story.text);
  if (exportPick.has('moments')) { const b = photos.filter(p => p.best).map(p => p.caption).filter(Boolean); if (b.length) parts.push(`${t('week.best')}: ${b.join(', ')}`); }
  if (exportPick.has('people')) { const ppl = peopleOfWeek(app.profile, dates, photos); if (ppl.length) parts.push(`${t('week.people')}: ${ppl.join(', ')}`); }
  if (exportPick.has('notes')) ['difficult', 'helped', 'completed', 'learned', 'intention'].forEach(f => { if (week[f]) parts.push(`${t(`week.f.${f}`)}: ${week[f]}`); });
  return parts.join('\n\n');
}

async function blobToDataUrl(url) {
  const blob = await (await fetch(url)).blob();
  return new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); });
}

async function exportFile(app, ctx) {
  const text = exportText(app, ctx);
  let images = '';
  if (exportPick.has('photos')) {
    for (const p of ctx.photos) {
      if (!ctx.urls[p.id]) continue;
      const src = ctx.urls[p.id].startsWith('data:') ? ctx.urls[p.id] : await blobToDataUrl(ctx.urls[p.id]);
      images += `<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(p.caption)}" style="max-width:100%"><figcaption>${escapeHtml(p.caption)}</figcaption></figure>`;
    }
  }
  const sky = exportPick.has('constellation') ? miniSky(app.profile, ctx.dates) : '';
  const html = `<!doctype html><meta charset="utf-8"><title>${escapeHtml(ctx.week.title || 'My Week')}</title>
<body style="font-family:system-ui;max-width:720px;margin:40px auto;padding:0 16px">${escapeHtml(text).replace(/\n/g, '<br>')}${images}${sky}</body>`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  link.download = `my-week-${ctx.start}.html`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}

function wire(root, app, ctx) {
  const profile = app.profile;
  const rerender = () => renderWeek(root, app);
  const photoById = id => profile.week.photos.find(p => p.id === id);
  const on = (selector, fn) => root.querySelectorAll(selector).forEach(el => el.addEventListener('click', () => fn(el)));

  on('[data-week]', el => { current = shiftIso(current, Number(el.dataset.week)); removed = new Set(); editingStory = false; rerender(); });
  const title = root.querySelector('#week-title');
  title.addEventListener('change', () => { ctx.week.title = title.value.trim().slice(0, 80); app.save(); });

  root.querySelector('[data-upload]').addEventListener('change', async event => {
    const files = [...event.target.files].slice(0, 12);
    let added = 0;
    for (const file of files) {
      try {
        const id = await addPhoto(profile, file);
        const date = ctx.dates.includes(app.today) ? app.today : ctx.dates[0];
        profile.week.photos.push({ id, date, caption: '', tags: [], people: [], best: false, order: Date.now() + added, synthetic: false, src: '' });
        added += 1;
      } catch (error) {
        toast(error.message === 'too-large' ? t('week.tooLarge') : t('week.notImage'));
      }
    }
    if (added) { app.save(); toast(t('week.added', { n: added }), 'success'); }
    rerender();
  });
  root.querySelectorAll('[data-caption]').forEach(input => input.addEventListener('change', () => { photoById(input.dataset.caption).caption = input.value.trim().slice(0, 200); app.save(); }));
  root.querySelectorAll('[data-date]').forEach(sel => sel.addEventListener('change', () => { photoById(sel.dataset.date).date = sel.value; app.save(); }));
  on('[data-tag]', el => { const [id, tag] = el.dataset.tag.split(':'); const p = photoById(id); p.tags = p.tags.includes(tag) ? p.tags.filter(x => x !== tag) : [...p.tags, tag].slice(0, 5); el.setAttribute('aria-pressed', String(p.tags.includes(tag))); app.save(); });
  on('[data-person]', el => { const i = el.dataset.person.indexOf(':'); const p = photoById(el.dataset.person.slice(0, i)); const name = el.dataset.person.slice(i + 1); p.people = p.people.includes(name) ? p.people.filter(x => x !== name) : [...p.people, name].slice(0, 5); el.setAttribute('aria-pressed', String(p.people.includes(name))); app.save(); });
  on('[data-best]', el => { const p = photoById(el.dataset.best); p.best = !p.best; app.save(); rerender(); });
  on('[data-cover]', el => { ctx.week.coverId = el.dataset.cover; app.save(); rerender(); });
  on('[data-move]', el => {
    const [id, dir] = el.dataset.move.split(':');
    const list = ctx.photos;
    const i = list.findIndex(p => p.id === id);
    const j = i + Number(dir);
    if (j < 0 || j >= list.length) return;
    const a = list[i].order; list[i].order = list[j].order; list[j].order = a;
    if (list[i].order === list[j].order) list[j].order += Number(dir);
    app.save(); rerender();
  });
  on('[data-del]', async el => {
    const id = el.dataset.del;
    await deletePhoto(id);
    profile.week.photos = profile.week.photos.filter(p => p.id !== id);
    if (ctx.week.coverId === id) ctx.week.coverId = null;
    app.save(); toast(t('week.deleted')); rerender();
  });

  on('[data-save-notes]', () => {
    root.querySelectorAll('[data-field]').forEach(area => { ctx.week[area.dataset.field] = area.value.trim().slice(0, 400); });
    app.save(); toast(t('week.notesSaved'), 'success'); rerender();
  });

  root.querySelectorAll('[data-fact]').forEach(box => box.addEventListener('change', () => { if (box.checked) removed.delete(box.dataset.fact); else removed.add(box.dataset.fact); }));
  on('[data-style]', el => { storyStyle = el.dataset.style; root.querySelectorAll('[data-style]').forEach(b => b.setAttribute('aria-pressed', String(b === el))); });
  on('[data-generate]', () => {
    ctx.week.story = { text: composeStory(collectFacts(profile, ctx.start), [...removed], storyStyle), style: storyStyle, removed: [...removed] };
    editingStory = false; app.save(); rerender();
  });
  on('[data-edit-story]', () => {
    if (editingStory) { ctx.week.story.text = root.querySelector('#story-text').value.slice(0, 3000); app.save(); }
    editingStory = !editingStory; rerender();
  });
  on('[data-delete-story]', () => { ctx.week.story = null; editingStory = false; app.save(); rerender(); });

  on('[data-immersive]', () => openImmersive(app, ctx));
  on('[data-export]', el => { const s = el.dataset.export; if (exportPick.has(s)) exportPick.delete(s); else exportPick.add(s); el.setAttribute('aria-pressed', String(exportPick.has(s))); });
  on('[data-export-copy]', async () => { const text = exportText(app, ctx); if (!text) { toast(t('week.exportEmpty')); return; } await copyText(text); toast(t('week.exportCopied'), 'success'); });
  on('[data-export-file]', () => exportFile(app, ctx));
}
