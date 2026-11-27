import { enhanceCodeExampleTabs, type TabProjection } from './code-example-tabs';
import { refreshCodePanel } from './PrototypePreviewer/code-panel-client';

const owners = new WeakMap<HTMLElement, () => void>();

function initCliInitTabsRoot(root: HTMLElement): void {
  if (owners.has(root) || root.ownerDocument !== document) return;
  const list = root.querySelector<HTMLElement>('[data-cli-file-tabs]');
  if (!list) return;
  const tabs = [...list.querySelectorAll<HTMLElement>('[data-cli-file-tab]')];
  const panels = [...root.querySelectorAll<HTMLElement>('[data-cli-file-panel]')];
  if (tabs.length === 0 || tabs.length !== panels.length) return;

  const doc = root.ownerDocument;
  let alive = true;
  let projection: TabProjection | undefined;

  const select = (index: number) => {
    if (!alive) return;
    const selectedPanel = panels[index];
    if (!selectedPanel) return;
    for (const [i, tab] of tabs.entries()) {
      const selected = i === index;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      tab.dataset.cliFileSelected = String(selected);
    }
    for (const [i, panel] of panels.entries()) {
      panel.hidden = i !== index;
    }
    const shell = selectedPanel.querySelector<HTMLElement>('[data-code-shell]');
    if (shell) refreshCodePanel(shell);
  };

  for (const [index, tab] of tabs.entries()) {
    tab.setAttribute('role', 'tab');
    const selected = tab.dataset.cliFileSelected === 'true';
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    tab.addEventListener('click', (event) => {
      if (!alive) return;
      event.preventDefault();
      select(index);
      projection?.select(index);
    });
  }
  list.setAttribute('role', 'tablist');

  try {
    projection = enhanceCodeExampleTabs({
      list,
      tabs,
      panels,
      onSelect: select,
    });
  } catch (error) {
    console.error('[CliInitOutput] Real Tabs unavailable; retaining native file tabs.', error);
  }

  const initialIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.dataset.cliFileSelected === 'true')
  );
  select(initialIndex);

  const dispose = () => {
    if (!alive) return;
    alive = false;
    projection?.destroy();
    projection = undefined;
    owners.delete(root);
    delete root.dataset.cliInitTabsInit;
    doc.removeEventListener('astro:before-swap', dispose);
  };

  doc.addEventListener('astro:before-swap', dispose, { once: true });
  owners.set(root, dispose);
  root.dataset.cliInitTabsInit = '1';
}

export function initCliInitTabs(scope: ParentNode = document): void {
  if (scope instanceof HTMLElement && scope.matches('[data-cli-init-tabs]')) {
    initCliInitTabsRoot(scope);
  }
  scope.querySelectorAll<HTMLElement>('[data-cli-init-tabs]').forEach(initCliInitTabsRoot);
}
