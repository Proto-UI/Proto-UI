import {
  PREFERRED_ADAPTER_EVENT,
  PREFERRED_ADAPTER_KEY,
  isRuntimeId,
  type PreferredAdapterChangeDetail,
} from './adapter-preference';
import { refreshCodePanel } from './PrototypePreviewer/code-panel-client';
import type { RuntimeId } from './PrototypePreviewer/runtimes/registry';

interface CodeExampleController {
  syncGlobalHost(host: RuntimeId): void;
}

const controllers = new WeakMap<HTMLElement, CodeExampleController>();
let globalListenerInstalled = false;

function tabsIn(list: HTMLElement): HTMLButtonElement[] {
  return [...list.children].filter(
    (child): child is HTMLButtonElement =>
      child instanceof HTMLButtonElement && child.getAttribute('role') === 'tab'
  );
}

function childPanels(root: HTMLElement, dataAttribute: string): HTMLElement[] {
  return [...root.children].filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.hasAttribute(dataAttribute)
  );
}

function activateTab(
  tabs: readonly HTMLButtonElement[],
  active: HTMLButtonElement,
  panels: readonly HTMLElement[]
): void {
  const controls = active.getAttribute('aria-controls');
  for (const tab of tabs) {
    const selected = tab === active;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  for (const panel of panels) panel.hidden = panel.id !== controls;
}

function installHorizontalActivation(
  list: HTMLElement,
  activate: (tab: HTMLButtonElement) => void
): void {
  const tabs = tabsIn(list);
  for (const tab of tabs) tab.addEventListener('click', () => activate(tab));
  list.addEventListener('keydown', (event) => {
    if (!(event.target instanceof HTMLButtonElement) || !tabs.includes(event.target)) return;
    const currentIndex = tabs.indexOf(event.target);
    let nextIndex: number | undefined;
    if (event.key === 'ArrowLeft') nextIndex = currentIndex - 1;
    else if (event.key === 'ArrowRight') nextIndex = currentIndex + 1;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;
    if (nextIndex < 0 || nextIndex >= tabs.length) return;
    event.preventDefault();
    const next = tabs[nextIndex];
    next.focus();
    activate(next);
  });
}

function storedHost(): RuntimeId | null {
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
  const hostTabs = tabsIn(hostList);
  const hostPanels = childPanels(root, 'data-code-host-panel');
  let localOverride = false;

  function selectFile(panel: HTMLElement, tab: HTMLButtonElement): void {
    const fileList = panel.querySelector<HTMLElement>('[data-code-file-tabs]');
    if (!fileList) return;
    const filePanels = childPanels(panel, 'data-code-file-panel');
    activateTab(tabsIn(fileList), tab, filePanels);
    const visiblePanel = filePanels.find((candidate) => !candidate.hidden);
    if (visiblePanel) refreshCodePanel(visiblePanel);
  }

  for (const panel of hostPanels) {
    const fileList = panel.querySelector<HTMLElement>('[data-code-file-tabs]');
    if (fileList) installHorizontalActivation(fileList, (tab) => selectFile(panel, tab));
  }

  function selectHost(tab: HTMLButtonElement, isLocal: boolean): void {
    if (isLocal) localOverride = true;
    activateTab(hostTabs, tab, hostPanels);
    const panel = hostPanels.find((candidate) => !candidate.hidden);
    const visibleFile = panel?.querySelector<HTMLElement>('[data-code-file-panel]:not([hidden])');
    if (visibleFile) refreshCodePanel(visibleFile);
  }

  installHorizontalActivation(hostList, (tab) => selectHost(tab, true));

  function tabForHost(host: RuntimeId): HTMLButtonElement | undefined {
    return hostTabs.find((tab) => tab.dataset.codeHost === host);
  }

  const preferred = storedHost();
  const initial = preferred ? tabForHost(preferred) : undefined;
  const selected = hostTabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
  const fallback = initial ?? selected ?? hostTabs[0];
  if (fallback) selectHost(fallback, false);

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
