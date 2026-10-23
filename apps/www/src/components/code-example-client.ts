import { enhanceCodeExampleTabs, revealCodeExampleTab } from './code-example-tabs';
import { enhanceCodeExampleTree } from './code-example-tree';
import {
  PREFERRED_ADAPTER_EVENT,
  PREFERRED_ADAPTER_KEY,
  isRuntimeId,
  type PreferredAdapterChangeDetail,
} from './adapter-preference';
import { refreshCodePanel } from './PrototypePreviewer/code-panel-client';
import type { PublicRuntimeId } from './PrototypePreviewer/runtimes/ids';

interface CodeExampleController {
  syncGlobalHost(host: PublicRuntimeId): void;
}

const controllers = new WeakMap<HTMLElement, CodeExampleController>();
let globalListenerInstalled = false;

function tabsIn(list: HTMLElement): HTMLElement[] {
  return [...list.children].filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.getAttribute('role') === 'tab'
  );
}

function childPanels(root: HTMLElement, dataAttribute: string): HTMLElement[] {
  return [...root.children].filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.hasAttribute(dataAttribute)
  );
}

function activateTab(
  tabs: readonly HTMLElement[],
  active: HTMLElement,
  panels: readonly HTMLElement[]
): void {
  const controls = active.getAttribute('aria-controls');
  for (const tab of tabs) {
    const selected = tab === active;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  for (const panel of panels) panel.hidden = panel.id !== controls;
  const strip = active.parentElement?.parentElement;
  if (strip && !strip.hidden) revealCodeExampleTab(active, strip);
}

function installHorizontalActivation(
  list: HTMLElement,
  activate: (tab: HTMLElement) => void
): void {
  const tabs = tabsIn(list);
  for (const tab of tabs) tab.addEventListener('click', (event) => { event.preventDefault(); activate(tab); });
  list.addEventListener('keydown', (event) => {
    if (!(event.target instanceof HTMLElement) || !tabs.includes(event.target)) return;
    const currentIndex = tabs.indexOf(event.target);
    const vertical = list.getAttribute('aria-orientation') === 'vertical';
    let nextIndex: number | undefined;
    if (event.key === (vertical ? 'ArrowUp' : 'ArrowLeft')) nextIndex = currentIndex - 1;
    else if (event.key === (vertical ? 'ArrowDown' : 'ArrowRight')) nextIndex = currentIndex + 1;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;
    if (nextIndex < 0 || nextIndex >= tabs.length) return;
    event.preventDefault();
    const next = tabs[nextIndex];
    next.focus({ preventScroll: true });
    activate(next);
  });
}

function storedHost(): PublicRuntimeId | null {
  try {
    const value = localStorage.getItem(PREFERRED_ADAPTER_KEY);
    return isRuntimeId(value) ? value : null;
  } catch {
    return null;
  }
}

function initCodeExample(root: HTMLElement): void {
  if (root.dataset.codeExampleInit === '1') return;
  root.dataset.codeExampleInit = '1';

  const hostList = root.querySelector<HTMLElement>('[data-code-host-tabs]');
  if (!hostList) return;
  hostList.setAttribute('role', 'tablist');
  for (const tab of hostList.querySelectorAll<HTMLElement>('[data-code-host-tab]')) {
    tab.setAttribute('role', 'tab');
    if (!tab.hasAttribute('aria-selected')) tab.setAttribute('aria-selected', String(tab.dataset.codeHost === root.dataset.initialHost));
    tab.tabIndex = tab.getAttribute('aria-selected') === 'true' ? 0 : -1;
  }
  const hostTabs = tabsIn(hostList);
  const hostPanels = childPanels(root, 'data-code-host-panel');
  for (const panel of hostPanels) panel.setAttribute('role', 'tabpanel');
  let localOverride = false;
  const projections = new Map<HTMLElement, ReturnType<typeof enhanceCodeExampleTabs>>();
  const filePanelsByHost = new Map(hostPanels.map((panel) => [panel, [...panel.querySelectorAll<HTMLElement>('[data-code-file-panel]')]]));

  function selectFile(panel: HTMLElement, tab: HTMLElement): void {
    const fileList = panel.querySelector<HTMLElement>('[data-code-file-tabs]');
    if (!fileList) return;
    const filePanels = filePanelsByHost.get(panel) ?? [];
    projections.get(fileList)?.select(tabsIn(fileList).indexOf(tab));
    activateTab(tabsIn(fileList), tab, filePanels);
    const visiblePanel = filePanels.find((candidate) => !candidate.hidden);
    if (visiblePanel) refreshCodePanel(visiblePanel);
  }

  for (const panel of hostPanels) {
    const fileList = panel.querySelector<HTMLElement>('[data-code-file-tabs]');
    if (fileList) {
      for (const source of filePanelsByHost.get(panel) ?? []) source.setAttribute('role', 'tabpanel');
      fileList.setAttribute('role', 'tablist');
      fileList.setAttribute('aria-orientation', 'vertical');
      for (const [index, tab] of [...fileList.querySelectorAll<HTMLElement>('[data-code-file-tab]')].entries()) {
        tab.setAttribute('role', 'tab');
        if (!tab.hasAttribute('aria-selected')) tab.setAttribute('aria-selected', String(index === 0));
        tab.tabIndex = tab.getAttribute('aria-selected') === 'true' ? 0 : -1;
      }
      installHorizontalActivation(fileList, (tab) => selectFile(panel, tab));
    }
  }

  function selectHost(tab: HTMLElement, isLocal: boolean): void {
    if (isLocal) localOverride = true;
    activateTab(hostTabs, tab, hostPanels);
    projections.get(hostList!)?.select(hostTabs.indexOf(tab));
    const panel = hostPanels.find((candidate) => !candidate.hidden);
    const visibleFile = panel?.querySelector<HTMLElement>('[data-code-file-panel]:not([hidden])');
    if (visibleFile) refreshCodePanel(visibleFile);
    const command = panel?.querySelector<HTMLElement>('[data-code-example-command] [data-code-shell]');
    if (command) refreshCodePanel(command);
  }

  installHorizontalActivation(hostList, (tab) => selectHost(tab, true));

  function tabForHost(host: PublicRuntimeId): HTMLElement | undefined {
    return hostTabs.find((tab) => tab.dataset.codeHost === host);
  }

  const preferred = storedHost();
  const initial = preferred ? tabForHost(preferred) : undefined;
  const selected = hostTabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
  const fallback = initial ?? selected ?? hostTabs[0];
  if (fallback) selectHost(fallback, false);

  const enhance = (list: HTMLElement, tabs: HTMLElement[], panels: HTMLElement[], select: (tab: HTMLElement) => void) => {
    try {
      projections.set(list, enhanceCodeExampleTabs({
        list, tabs, panels, onSelect: (index) => select(tabs[index]),
      }));
    } catch (error) {
      console.error('[CodeExample] Real Tabs unavailable; retaining native controls.', error);
    }
  };
  // Inner groups first: moving a host preserves its file/source owners.
  for (const panel of hostPanels) {
    const list = panel.querySelector<HTMLElement>('[data-code-file-tabs]');
    if (list) {
      const tabs = tabsIn(list);
      try {
        projections.set(list, enhanceCodeExampleTree({ list, tabs, panels: filePanelsByHost.get(panel) ?? [], onSelect: (index) => selectFile(panel, tabs[index]) }));
      } catch (error) {
        console.error('[CodeExample] Real Tree unavailable; retaining native file controls.', error);
      }
    }
  }
  enhance(hostList, hostTabs, hostPanels, (tab) => selectHost(tab, true));
  document.addEventListener('astro:before-swap', () => {
    for (const projection of [...projections.values()].reverse()) projection.destroy();
    projections.clear();
  }, { once: true });

  controllers.set(root, {
    syncGlobalHost(host) {
      if (localOverride) return;
      const tab = tabForHost(host);
      if (tab) selectHost(tab, false);
    },
  });
}

function installGlobalListener(): void {
  if (globalListenerInstalled) return;
  globalListenerInstalled = true;
  document.addEventListener(PREFERRED_ADAPTER_EVENT, (event) => {
    const detail = (event as CustomEvent<PreferredAdapterChangeDetail>).detail;
    if (!isRuntimeId(detail?.adapter)) return;
    document.querySelectorAll<HTMLElement>('[data-code-example]').forEach((root) => {
      controllers.get(root)?.syncGlobalHost(detail.adapter);
    });
  });
}

export function initCodeExamples(root: ParentNode = document): void {
  installGlobalListener();
  if (root instanceof HTMLElement && root.matches('[data-code-example]')) initCodeExample(root);
  root.querySelectorAll<HTMLElement>('[data-code-example]').forEach(initCodeExample);
}

