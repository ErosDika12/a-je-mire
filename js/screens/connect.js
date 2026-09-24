// "Lidhjet": MY 5, KAFE? dhe Connection Wall nën një tab të vetëm,
// sepse të trija flasin për të njëjtët njerëz.
import { renderMy5 } from './my5.js';
import { renderKafe } from './kafe.js';
import { renderWall } from './wall.js';
import { t } from '../i18n/index.js';

export const CONNECT_TABS = [
  { id: 'my5', label: 'MY 5', render: renderMy5 },
  { id: 'kafe', label: 'KAFE?', render: renderKafe },
  { id: 'wall', label: 'Connection Wall', render: renderWall }
];

let active = 'my5';

export function setConnectTab(id) {
  if (CONNECT_TABS.some(item => item.id === id)) active = id;
}

export function renderConnect(container, app) {
  container.innerHTML = `
    <div class="seg-control connect-tabs" role="group" aria-label="${t('nav.connect')}">
      ${CONNECT_TABS.map(item => `<button type="button" data-connect-tab="${item.id}" aria-pressed="${item.id === active}">${item.label}</button>`).join('')}
    </div>
    <div class="mt-4" id="connect-body"></div>`;

  const body = container.querySelector('#connect-body');
  CONNECT_TABS.find(item => item.id === active).render(body, app);

  for (const button of container.querySelectorAll('[data-connect-tab]')) {
    button.addEventListener('click', () => { active = button.dataset.connectTab; renderConnect(container, app); });
  }
}
