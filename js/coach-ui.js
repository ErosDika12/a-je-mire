// Komponenti i "Conversation Coach": zgjedh situatën, tonin dhe emrin; drafti është i redaktueshëm.
// Butoni i vetëm është "Kopjo" — aplikacioni nuk dërgon asnjë mesazh.
import { toast, copyText } from './ui.js';
import { escapeHtml } from './format.js';
import { t } from './i18n/index.js';
import { SCENARIOS, TONES, draft } from './coach.js';

let uid = 0;

export function coachHtml({ scenario = 'ask_help', tone = 'calm', name = '', people = [], fixed = false }) {
  const id = `coach${++uid}`;
  return `<div class="coach" data-coach data-scenario="${scenario}" data-tone="${tone}">
    ${fixed ? '' : `<label class="field"><span class="card-sub">${t('coach.pickScenario')}</span>
      <select data-coach-scenario>${SCENARIOS.map(s => `<option value="${s}" ${s === scenario ? 'selected' : ''}>${t(`coach.sc.${s}`)}</option>`).join('')}</select></label>`}
    <div class="seg-control mt-3" role="group" aria-label="${escapeHtml(t('coach.pickTone'))}">
      ${TONES.map(k => `<button type="button" data-coach-tone="${k}" aria-pressed="${k === tone}">${t(`coach.tone.${k}`)}</button>`).join('')}
    </div>
    <label class="field mt-3"><span class="card-sub">${t('coach.nameLabel')}</span>
      <input type="text" data-coach-name maxlength="40" value="${escapeHtml(name)}" list="${id}-people">
      <datalist id="${id}-people">${people.map(p => `<option value="${escapeHtml(p)}">`).join('')}</datalist>
    </label>
    <label class="sr-only" for="${id}-text">${t('coach.copy')}</label>
    <textarea id="${id}-text" class="mt-3 coach-text" data-coach-text>${escapeHtml(draft(scenario, tone, name))}</textarea>
    <p class="card-note">${t('coach.editHint')}</p>
    <button type="button" class="btn btn-primary mt-3" data-coach-copy>${t('coach.copy')}</button>
  </div>`;
}

export function wireCoach(root) {
  for (const box of root.querySelectorAll('[data-coach]')) {
    const text = box.querySelector('[data-coach-text]');
    const nameInput = box.querySelector('[data-coach-name]');
    const refresh = () => { text.value = draft(box.dataset.scenario, box.dataset.tone, nameInput.value); };
    const select = box.querySelector('[data-coach-scenario]');
    if (select) select.addEventListener('change', () => { box.dataset.scenario = select.value; refresh(); });
    for (const button of box.querySelectorAll('[data-coach-tone]')) {
      button.addEventListener('click', () => {
        box.dataset.tone = button.dataset.coachTone;
        box.querySelectorAll('[data-coach-tone]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
        refresh();
      });
    }
    nameInput.addEventListener('change', refresh);
    box.querySelector('[data-coach-copy]').addEventListener('click', async () => {
      await copyText(text.value);
      toast(t('coach.copied'), 'success');
    });
  }
}
