// Ekrani MIRA — "Çka po ndodh?". Rruga e problemit në 6 hapa, e gjitha në pajisje.
// Asgjë nuk dërgohet; plani vetëm kopjohet në clipboard. Ruajtja kalon nga app.save() (vetëm me consent).
import { icon, toast, copyText, openModal } from '../ui.js';
import { escapeHtml } from '../format.js';
import { t } from '../i18n/index.js';
import {
  SITUATIONS, FEELINGS, NEEDS, FOLLOW_UPS, situationOf, looksUrgent,
  summarize, buildPlan, controlIdeas, planAsText, cleanPaths
} from '../mira.js';

const fresh = () => ({
  step: 0, situation: null, text: '', feelings: [], ownFeelings: [], need: null,
  can: [], cant: [], person: '', variant: 0, plan: null, followUp: null, savedId: null
});
let state = fresh();

export function renderMira(container, app) {
  const body = state.step === 0 ? startView(app) : stepView(app);
  container.innerHTML = `
    <header class="page-head mira-head">
      <div class="mira-id">
        <span class="mira-orb" aria-hidden="true"></span>
        <div>
          <span class="eyebrow">${t('mira.eyebrow')}</span>
          <h1 class="page-title mt-2">${t('mira.title')}</h1>
          <p class="page-sub">${t('mira.subtitle')}</p>
        </div>
      </div>
      <p class="pill pill-lav pill-wrap mt-3"><span class="pill-dot"></span>${t('mira.localBadge')}</p>
    </header>
    ${body}
    <p class="mira-urgent-row"><button type="button" class="btn btn-danger btn-sm" data-urgent>${t('mira.urgentBtn')}</button></p>`;
  wire(container, app);
}

// ---------- hapi 0: fillimi ----------

function startView(app) {
  const paths = pathsOf(app);
  const due = paths.filter(p => p.checkLater && p.checkLater <= app.today);
  return `
    <section class="card mira-intro" aria-labelledby="mira-who">
      <p id="mira-who" class="mira-voice">${t('mira.whoAmI')}</p>
      <p class="card-note">${t('mira.localNote')}</p>
    </section>
    ${due.map(p => `<div class="card card-lav mira-due"><p>${escapeHtml(t('mira.checkLaterDue', { situation: t(`mira.sit.${p.situation}`) }))}</p>
      <button type="button" class="btn btn-sm" data-open="${escapeHtml(p.id)}">${t('mira.openPath')}</button></div>`).join('')}
    <section class="card" aria-labelledby="mira-write">
      <label class="field" for="mira-text"><span id="mira-write" class="card-title">${t('mira.writeLabel')}</span>
        <textarea id="mira-text" maxlength="1200" placeholder="${escapeHtml(t('mira.writePlaceholder'))}">${escapeHtml(state.text)}</textarea>
      </label>
      <p class="card-sub mt-4">${t('mira.orPick')}</p>
      <div class="tag-wrap mt-2" role="group" aria-label="${escapeHtml(t('mira.orPick'))}">
        ${SITUATIONS.map(s => `<button type="button" class="tag" data-sit="${s.id}" aria-pressed="${state.situation === s.id}">${t(`mira.sit.${s.id}`)}</button>`).join('')}
      </div>
      <div class="mira-actions"><button type="button" class="btn btn-primary" data-start>${t('mira.start')} ${icon('next', 16)}</button></div>
    </section>
    ${historyView(paths)}`;
}

function historyView(paths) {
  const rows = paths.slice().reverse().map(p => `
    <li class="mira-hist-row">
      <div><strong>${escapeHtml(t(`mira.sit.${p.situation}`))}</strong><span class="card-sub">${escapeHtml(p.date)}</span></div>
      <div class="mira-hist-btns">
        <button type="button" class="btn btn-ghost btn-sm" data-open="${escapeHtml(p.id)}">${t('mira.openPath')}</button>
        <button type="button" class="btn btn-ghost btn-sm" data-del="${escapeHtml(p.id)}">${t('mira.deletePath')}</button>
      </div>
    </li>`).join('');
  return `<section class="card" aria-labelledby="mira-hist"><h2 id="mira-hist" class="card-title">${t('mira.historyTitle')}</h2>
    ${rows ? `<ul class="mira-hist">${rows}</ul>` : `<p class="card-sub mt-2">${t('mira.historyEmpty')}</p>`}</section>`;
}

// ---------- hapat 1–6 ----------

function stepView(app) {
  const titles = ['', 's1', 's2', 's3', 's4', 's5', 's6'];
  const views = [null, step1, step2, step3, step4, step5, step6];
  return `
    <section class="card mira-step" aria-labelledby="mira-step-title">
      <div class="mira-progress" aria-hidden="true">${[1, 2, 3, 4, 5, 6].map(n => `<span class="${n <= state.step ? 'on' : ''}"></span>`).join('')}</div>
      <span class="eyebrow">${t('mira.stepOf', { n: state.step })}</span>
      <h2 id="mira-step-title" class="mira-step-title" tabindex="-1">${t(`mira.${titles[state.step]}`)}</h2>
      ${views[state.step](app)}
    </section>
    ${situationOf(state.situation).adult ? `<div class="card card-amber"><p>${t('mira.adultCard')}</p></div>` : ''}
    <div class="mira-nav">
      <button type="button" class="btn btn-ghost" data-back>${icon('back', 16)} ${t('mira.back')}</button>
      <button type="button" class="btn btn-ghost" data-reset>${t('mira.newPath')}</button>
    </div>`;
}

function step1() {
  return `<p class="mira-voice">${escapeHtml(summarize(state))}</p>
    <p class="card-sub mt-4">${t('mira.understood')}</p>
    <div class="mira-actions">
      <button type="button" class="btn btn-primary" data-next>${t('mira.yes')}</button>
      <button type="button" class="btn" data-edit>${t('mira.notQuite')}</button>
    </div>`;
}

function step2() {
  const all = [...FEELINGS.map(id => ({ id, label: t(`mira.feel.${id}`) })), ...state.ownFeelings.map(word => ({ id: `own:${word}`, label: word }))];
  return `<p class="mira-voice">${t('mira.feelIntro')}</p>
    <div class="tag-wrap mt-4" role="group" aria-label="${escapeHtml(t('mira.s2'))}">
      ${all.map(f => `<button type="button" class="tag" data-feel="${escapeHtml(f.id)}" aria-pressed="${state.feelings.includes(f.id)}">${escapeHtml(f.label)}</button>`).join('')}
    </div>
    <form class="mira-inline mt-4" data-own-feel>
      <label class="sr-only" for="own-feel">${t('mira.feelOwn')}</label>
      <input id="own-feel" type="text" maxlength="30" placeholder="${escapeHtml(t('mira.feelOwn'))}">
      <button type="submit" class="btn">${t('mira.feelAdd')}</button>
    </form>
    <div class="mira-actions"><button type="button" class="btn btn-primary" data-next>${state.feelings.length ? t('mira.next') : t('mira.feelNone')}</button></div>`;
}

function step3() {
  return `<p class="mira-voice">${t('mira.needIntro')}</p>
    <div class="mira-choices mt-4" role="group" aria-label="${escapeHtml(t('mira.s3'))}">
      ${NEEDS.map(id => `<button type="button" class="mira-choice" data-need="${id}" aria-pressed="${state.need === id}">${t(`mira.need.${id}`)}</button>`).join('')}
    </div>`;
}

function step4() {
  const ideas = controlIdeas(state.situation);
  const column = (side, title, moveLabel) => `
    <div class="mira-col mira-col-${side}">
      <h3 class="card-title">${title}</h3>
      <ul class="mira-items">${state[side].length ? state[side].map((item, i) => `
        <li><span>${escapeHtml(item)}</span>
          <span class="mira-item-btns">
            <button type="button" class="btn btn-ghost btn-sm" data-move="${side}:${i}" aria-label="${escapeHtml(`${moveLabel}: ${item}`)}">⇄</button>
            <button type="button" class="btn btn-ghost btn-sm" data-remove="${side}:${i}" aria-label="${escapeHtml(`${t('mira.ctrlRemove')}: ${item}`)}">×</button>
          </span></li>`).join('') : `<li class="card-sub">${t('mira.ctrlEmpty')}</li>`}</ul>
      <form class="mira-inline" data-add="${side}">
        <label class="sr-only" for="add-${side}">${title}</label>
        <input id="add-${side}" type="text" maxlength="80" placeholder="${escapeHtml(t('mira.ctrlPlaceholder'))}">
        <button type="submit" class="btn btn-sm">${t('mira.ctrlAdd')}</button>
      </form>
      <p class="card-sub mt-2">${t('mira.ctrlIdeas')}</p>
      <div class="tag-wrap">${ideas[side].filter(i => !state.can.includes(i) && !state.cant.includes(i)).map(i => `<button type="button" class="tag tag-sm" data-idea="${side}" data-text="${escapeHtml(i)}">+ ${escapeHtml(i)}</button>`).join('')}</div>
    </div>`;
  return `<p class="mira-voice">${t('mira.ctrlIntro')}</p>
    <div class="mira-cols mt-4">${column('can', t('mira.ctrlCan'), t('mira.ctrlMoveCant'))}${column('cant', t('mira.ctrlCant'), t('mira.ctrlMoveCan'))}</div>
    <div class="mira-actions"><button type="button" class="btn btn-primary" data-next>${t('mira.next')}</button></div>`;
}

function step5(app) {
  state.plan = state.plan || buildPlan(state);
  const people = (app.profile && app.profile.my5 || []).map(p => p.name);
  const slot = (key, title) => `
    <div class="mira-slot">
      <h3 class="card-title">${title}</h3>
      <textarea data-slot="${key}" aria-label="${escapeHtml(title)}">${escapeHtml(state.plan[key].join('\n'))}</textarea>
    </div>`;
  return `<p class="mira-voice">${t('mira.planIntro')}</p>
    ${people.length ? `<label class="field mt-4" for="mira-person"><span class="card-sub">${t('mira.personPick')}</span>
      <select id="mira-person"><option value="">${t('mira.personNone')}</option>${people.map(n => `<option ${n === state.person ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('')}</select></label>` : ''}
    <div class="mira-plan mt-4">${slot('now', t('mira.slotNow'))}${slot('today', t('mira.slotToday'))}${slot('week', t('mira.slotWeek'))}${slot('person', t('mira.slotPerson'))}</div>
    <div class="mira-actions">
      <button type="button" class="btn" data-another>${t('mira.another')}</button>
      <button type="button" class="btn" data-copy>${t('mira.copyPlan')}</button>
      <button type="button" class="btn btn-primary" data-next>${t('mira.next')}</button>
    </div>`;
}

function step6(app) {
  const reply = state.followUp ? `<div class="card card-lav mt-4" role="status"><p>${t(`mira.fuReply.${state.followUp}`)}</p>
    ${state.followUp === 'talk' || state.followUp === 'harder' ? `<button type="button" class="btn btn-sm mt-2" data-go-my5>${t('mira.openMy5')}</button>` : ''}</div>` : '';
  return `<p class="mira-voice">${t('mira.fuIntro')}</p>
    <div class="mira-choices mt-4" role="group" aria-label="${escapeHtml(t('mira.s6'))}">
      ${FOLLOW_UPS.map(id => `<button type="button" class="mira-choice" data-fu="${id}" aria-pressed="${state.followUp === id}">${t(`mira.fu.${id}`)}</button>`).join('')}
    </div>
    ${reply}
    <div class="mira-actions">
      <button type="button" class="btn btn-primary" data-save ${app.profile && app.profile.consent && app.profile.consent.store ? '' : 'aria-describedby="mira-noconsent"'}>${t('mira.savePath')}</button>
    </div>
    ${app.profile && app.profile.consent && app.profile.consent.store ? '' : `<p id="mira-noconsent" class="card-note">${t('mira.noConsent')}</p>`}`;
}

// ---------- ngjarjet ----------

function wire(root, app) {
  const rerender = (focus = true) => {
    renderMira(root, app);
    if (focus) {
      const target = root.querySelector('#mira-step-title') || root.querySelector('#mira-text');
      if (target) target.focus();
    }
  };
  const on = (selector, fn) => root.querySelectorAll(selector).forEach(el => el.addEventListener('click', () => fn(el)));
  const submit = (selector, fn) => root.querySelectorAll(selector).forEach(form => form.addEventListener('submit', event => {
    event.preventDefault();
    const input = form.querySelector('input');
    const value = input.value.trim();
    if (value) fn(form, value);
  }));

  on('[data-urgent]', () => openUrgent());
  const text = root.querySelector('#mira-text');
  if (text) text.addEventListener('input', () => { state.text = text.value; });

  on('[data-sit]', el => {
    state.situation = state.situation === el.dataset.sit ? null : el.dataset.sit;
    root.querySelectorAll('[data-sit]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sit === state.situation)));
  });
  on('[data-start]', () => {
    if (!state.text.trim() && !state.situation) { toast(t('mira.pickFirst')); return; }
    if (!state.situation) state.situation = 'other';
    state.step = 1; rerender();
    if (looksUrgent(state.text)) openUrgent();
  });
  on('[data-edit]', () => { state.step = 0; rerender(); });
  on('[data-next]', () => {
    if (state.step === 4) state.plan = null; // plani ndërtohet me kontrollin e fundit
    state.step = Math.min(6, state.step + 1); rerender();
  });
  on('[data-back]', () => { state.step = Math.max(0, state.step - 1); rerender(); });
  on('[data-reset]', () => { state = fresh(); rerender(); });

  on('[data-feel]', el => {
    const id = el.dataset.feel;
    state.feelings = state.feelings.includes(id) ? state.feelings.filter(f => f !== id) : [...state.feelings, id];
    el.setAttribute('aria-pressed', String(state.feelings.includes(id)));
    const next = root.querySelector('[data-next]');
    if (next) next.textContent = state.feelings.length ? t('mira.next') : t('mira.feelNone');
  });
  submit('[data-own-feel]', (form, value) => {
    if (!state.ownFeelings.includes(value)) state.ownFeelings.push(value);
    if (!state.feelings.includes(`own:${value}`)) state.feelings.push(`own:${value}`);
    rerender(false);
  });

  on('[data-need]', el => {
    state.need = el.dataset.need;
    state.step = 4; rerender();
  });

  submit('[data-add]', (form, value) => { state[form.dataset.add].push(value.slice(0, 80)); rerender(false); root.querySelector(`#add-${form.dataset.add}`).focus(); });
  on('[data-idea]', el => { state[el.dataset.idea].push(el.dataset.text); rerender(false); });
  on('[data-move]', el => {
    const [side, index] = el.dataset.move.split(':');
    const other = side === 'can' ? 'cant' : 'can';
    const [item] = state[side].splice(Number(index), 1);
    state[other].push(item); rerender(false);
  });
  on('[data-remove]', el => {
    const [side, index] = el.dataset.remove.split(':');
    state[side].splice(Number(index), 1); rerender(false);
  });

  root.querySelectorAll('[data-slot]').forEach(area => area.addEventListener('input', () => {
    state.plan[area.dataset.slot] = area.value.split('\n').map(line => line.trim()).filter(Boolean);
  }));
  const person = root.querySelector('#mira-person');
  if (person) person.addEventListener('change', () => { state.person = person.value; state.plan = buildPlan(state); rerender(false); });
  on('[data-another]', () => { state.variant += 1; state.plan = buildPlan(state); rerender(false); });
  on('[data-copy]', async () => { await copyText(planAsText(state.plan)); toast(t('mira.copied'), 'success'); });

  on('[data-fu]', el => {
    state.followUp = el.dataset.fu;
    if (state.followUp === 'another') { state.variant += 1; state.plan = buildPlan(state); state.step = 5; }
    if (state.savedId) persist(app, false);
    rerender(false);
  });
  on('[data-go-my5]', () => app.goTo('my5'));
  on('[data-save]', () => persist(app, true));

  on('[data-open]', el => openSaved(app, el.dataset.open));
  on('[data-del]', el => {
    app.profile.mira = { ...(app.profile.mira || {}), paths: pathsOf(app).filter(p => p.id !== el.dataset.del) };
    app.save(); toast(t('mira.deleted')); rerender(false);
  });
}

function pathsOf(app) {
  return cleanPaths(app.profile && app.profile.mira && app.profile.mira.paths);
}

function persist(app, announce) {
  if (!app.profile || !app.profile.consent || app.profile.consent.store !== true) {
    if (announce) toast(t('mira.noConsent'));
    return;
  }
  const tomorrow = new Date(`${app.today}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const id = state.savedId || `${app.today}-${Math.random().toString(36).slice(2, 7)}`;
  const record = {
    id, date: app.today, situation: state.situation, text: state.text,
    feelings: state.feelings.map(f => (f.startsWith('own:') ? f.slice(4) : t(`mira.feel.${f}`))),
    need: state.need || 'unknown', can: state.can, cant: state.cant, plan: state.plan || buildPlan(state),
    followUp: state.followUp,
    checkLater: state.followUp === 'later' ? tomorrow.toISOString().slice(0, 10) : null
  };
  const paths = pathsOf(app).filter(p => p.id !== id);
  app.profile.mira = { ...(app.profile.mira || {}), paths: cleanPaths([...paths, record]) };
  state.savedId = id;
  if (app.save() && announce) toast(t('mira.saved'), 'success');
}

function openSaved(app, id) {
  const p = pathsOf(app).find(item => item.id === id);
  if (!p) return;
  const list = items => `<ul class="mira-read">${items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
  openModal(t(`mira.sit.${p.situation}`), `
    ${p.text ? `<p class="mira-voice">“${escapeHtml(p.text)}”</p>` : ''}
    ${p.feelings.length ? `<p class="card-sub mt-4">${t('mira.feelingsLabel')}: ${escapeHtml(p.feelings.join(', '))}</p>` : ''}
    <p class="card-sub">${t('mira.needLabel')}: ${escapeHtml(t(`mira.need.${p.need}`))}</p>
    <h3 class="card-title mt-4">${t('mira.slotNow')}</h3>${list(p.plan.now)}
    <h3 class="card-title mt-4">${t('mira.slotToday')}</h3>${list(p.plan.today)}
    <h3 class="card-title mt-4">${t('mira.slotWeek')}</h3>${list(p.plan.week)}
    <h3 class="card-title mt-4">${t('mira.slotPerson')}</h3>${list(p.plan.person)}`);
  // Pasi u hap, kujtuesi "më pyet më vonë" nuk shfaqet më.
  if (p.checkLater && p.checkLater <= app.today) {
    app.profile.mira.paths = pathsOf(app).map(item => (item.id === id ? { ...item, checkLater: null } : item));
    app.save();
  }
}

function openUrgent() {
  openModal(t('mira.urgentTitle'), `<p>${t('mira.urgentText')}</p>`);
}
