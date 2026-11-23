import { setElementProps } from '@proto.ui/adapter-web-component';
import { isSiteButtonActivation } from './site-shadcn-controls';

const cards = new WeakMap<HTMLElement, () => void>();

function initInstallCommandCard(card: HTMLElement): void {
  if (cards.has(card)) return;
  const tabs = [...card.querySelectorAll<HTMLElement>('[data-manager-tab]')];
  const panels = [...card.querySelectorAll<HTMLElement>('[data-command-panel]')];
  if (tabs.length === 0 || panels.length === 0) return;

  const doc = card.ownerDocument;
  const view = doc.defaultView;
  if (!view) return;
  let alive = true;
  const activate = (event: Event) => {
    if (!alive || !card.isConnected || !isSiteButtonActivation(event)) return;
    const tab = event.currentTarget as HTMLElement;
    const manager = tab.dataset.managerTab;
    if (!manager || !panels.some((panel) => panel.dataset.commandPanel === manager)) return;
    card.dataset.activeManager = manager;
    for (const item of tabs) {
      const active = item.dataset.managerTab === manager;
      item.classList.toggle('install-command-card__manager--active', active);
      item.setAttribute('aria-pressed', String(active));
      setElementProps(item, {
        variant:
          item.dataset.siteControlFamily === 'brutalist'
            ? active
              ? 'solid'
              : 'surface'
            : active
              ? 'secondary'
              : 'ghost',
        size: 'sm',
      });
    }
    for (const panel of panels) {
      const active = panel.dataset.commandPanel === manager;
      panel.hidden = !active;
      panel.classList.toggle('install-command-card__body--hidden', !active);
    }
  };
  const dispose = () => {
    if (!alive) return;
    alive = false;
    for (const tab of tabs) tab.removeEventListener('click', activate);
    observer.disconnect();
    doc.removeEventListener('astro:before-swap', dispose);
    cards.delete(card);
    delete card.dataset.installCommandInit;
  };
  const observer = new view.MutationObserver(() => {
    if (!card.isConnected) dispose();
  });
  for (const tab of tabs) tab.addEventListener('click', activate);
  observer.observe(doc.body, { childList: true, subtree: true });
  doc.addEventListener('astro:before-swap', dispose);
  cards.set(card, dispose);
  card.dataset.installCommandInit = '1';
}

/** Each Astro navigation receives fresh cards; initialization is owner-local and idempotent. */
export function initInstallCommandCards(root: ParentNode = document): void {
  if (root instanceof HTMLElement && root.matches('[data-install-command-card]'))
    initInstallCommandCard(root);
  root.querySelectorAll<HTMLElement>('[data-install-command-card]').forEach(initInstallCommandCard);
}
