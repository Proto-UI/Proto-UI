import { setElementProps } from '@proto.ui/adapter-web-component';
import { enhanceInstallCommandTabs, type InstallCommandTabsProjection } from './code-example-tabs';
import { enhanceCodeScrollArea } from './PrototypePreviewer/code-scroll-area-client';
import { isSiteButtonActivation } from './site-shadcn-controls';

const cards = new WeakMap<HTMLElement, () => void>();

function initInstallCommandCard(card: HTMLElement): void {
  if (cards.has(card)) return;
  const fallbackTabs = [...card.querySelectorAll<HTMLElement>('[data-manager-tab]')];
  const panels = [...card.querySelectorAll<HTMLElement>('[data-command-panel]')];
  if (fallbackTabs.length === 0 || panels.length === 0) return;

  const doc = card.ownerDocument;
  const view = doc.defaultView;
  if (!view) return;
  let alive = true;
  let tabsProjection: InstallCommandTabsProjection | undefined;

  const selectManager = (manager: string) => {
    if (!alive || !card.isConnected) return;
    if (!panels.some((panel) => panel.dataset.commandPanel === manager)) return;
    card.dataset.activeManager = manager;
    for (const item of fallbackTabs) {
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
    tabsProjection?.select(manager);
  };

  const activate = (event: Event) => {
    if (!alive || !card.isConnected || !isSiteButtonActivation(event)) return;
    const tab = event.currentTarget as HTMLElement;
    const manager = tab.dataset.managerTab;
    if (!manager) return;
    selectManager(manager);
  };

  const managersContainer = card.querySelector<HTMLElement>('[data-install-managers]');
  if (managersContainer) {
    const managers = fallbackTabs
      .map((tab) => tab.dataset.managerTab)
      .filter((value): value is string => Boolean(value));
    const panelIds = new Map<string, string>();
    for (const panel of panels) {
      if (panel.dataset.commandPanel && panel.id) {
        panelIds.set(panel.dataset.commandPanel, panel.id);
      }
    }
    if (managers.length > 0) {
      try {
        tabsProjection = enhanceInstallCommandTabs({
          container: managersContainer,
          managers,
          activeManager: card.dataset.activeManager ?? managers[0]!,
          panelIds,
          label: managersContainer.getAttribute('aria-label') ?? 'Package manager',
          onSelect: selectManager,
        });
      } catch (error) {
        console.error(
          '[InstallCommandCard] Real Tabs unavailable; retaining fallback manager controls.',
          error
        );
      }
    }
  }

  for (const panel of panels) {
    if (panel.querySelector('[data-code-scroll-root]')) {
      void enhanceCodeScrollArea(panel).catch(() => {
        // Fallback pre stays usable if ScrollArea enhancement cannot attach.
      });
    }
  }

  const dispose = () => {
    if (!alive) return;
    alive = false;
    tabsProjection?.destroy();
    tabsProjection = undefined;
    for (const tab of fallbackTabs) tab.removeEventListener('click', activate);
    observer.disconnect();
    doc.removeEventListener('astro:before-swap', dispose);
    cards.delete(card);
    delete card.dataset.installCommandInit;
  };
  const observer = new view.MutationObserver(() => {
    if (!card.isConnected) dispose();
  });
  for (const tab of fallbackTabs) tab.addEventListener('click', activate);
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
