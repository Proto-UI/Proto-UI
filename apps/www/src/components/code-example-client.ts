import {
  enhanceCodeExampleTabs,
  revealCodeExampleTab,
  type TabProjection,
} from './code-example-tabs';
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
  enhanceNext(): boolean;
  destroy(): void;
}

const controllers = new WeakMap<HTMLElement, CodeExampleController>();
const pendingProjections = new Set<CodeExampleController>();
let projectionTask: number | undefined;
let projectionTaskUsesIdle = false;
let globalListenerInstalled = false;

function scheduleProjection(): void {
  if (projectionTask !== undefined || pendingProjections.size === 0) return;
  try {
    projectionTaskUsesIdle = typeof window.requestIdleCallback === 'function';
    projectionTask = projectionTaskUsesIdle
      ? window.requestIdleCallback(continueProjection)
      : window.setTimeout(continueProjection, 0);
  } catch (error) {
    const pending = [...pendingProjections];
    pendingProjections.clear();
    for (const controller of pending) {
      try {
        controller.destroy();
      } catch {
        // Attempt every release while preserving the scheduling failure.
      }
    }
    throw error;
  }
}

function continueProjection(): void {
  projectionTask = undefined;
  const controller = pendingProjections.values().next().value;
  if (!controller) return;
  pendingProjections.delete(controller);
  let failure: { error: unknown } | undefined;
  try {
    if (controller.enhanceNext()) pendingProjections.add(controller);
  } catch (error) {
    failure = { error };
    try {
      controller.destroy();
    } catch {
      // Cleanup must not replace the projection's original failure.
    }
  }
  try {
    scheduleProjection();
  } catch (error) {
    failure ??= { error };
  }
  if (failure) throw failure.error;
}

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
  activate: (tab: HTMLElement) => void,
  signal: AbortSignal,
  isCurrent: () => boolean
): void {
  const tabs = tabsIn(list);
  for (const tab of tabs) {
    tab.addEventListener(
      'click',
      (event) => {
        if (!isCurrent()) return;
        event.preventDefault();
        activate(tab);
      },
      { signal }
    );
  }
  list.addEventListener(
    'keydown',
    (event) => {
      if (!isCurrent()) return;
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
    },
    { signal }
  );
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
  if (controllers.has(root) || root.ownerDocument !== document) return;
  const candidateHostList = root.querySelector<HTMLElement>('[data-code-host-tabs]');
  if (!candidateHostList) return;
  const hostList = candidateHostList;
  const doc = root.ownerDocument;
  const lifetime = new AbortController();
  let alive = true;
  let initializing = true;
  let projecting = false;
  let cleanupFailed = false;
  let cursor = 0;
  let hostTabs: HTMLElement[] = [];
  const hostPanels = childPanels(root, 'data-code-host-panel');
  const fileGroups: Array<{ panel: HTMLElement; list: HTMLElement }> = [];
  let localOverride = false;
  const projections = new Map<HTMLElement, TabProjection>();
  const filePanelsByHost = new Map(
    hostPanels.map((panel) => [
      panel,
      [...panel.querySelectorAll<HTMLElement>('[data-code-file-panel]')],
    ])
  );

  const ownsRoot = () =>
    alive &&
    controllers.get(root) === controller &&
    root.ownerDocument === doc &&
    (initializing || root.isConnected);
  const releaseClaim = () => {
    if (initializing || projecting || cleanupFailed || controllers.get(root) !== controller) return;
    controllers.delete(root);
    delete root.dataset.codeExampleInit;
  };
  const destroy = () => {
    if (!alive) return;
    alive = false;
    pendingProjections.delete(controller);
    if (pendingProjections.size === 0 && projectionTask !== undefined) {
      if (projectionTaskUsesIdle) window.cancelIdleCallback(projectionTask);
      else window.clearTimeout(projectionTask);
      projectionTask = undefined;
    }
    lifetime.abort();
    const failures: unknown[] = [];
    for (const projection of [...projections.values()].reverse()) {
      try {
        projection.destroy();
      } catch (error) {
        failures.push(error);
      }
    }
    projections.clear();
    cleanupFailed ||= failures.length > 0;
    releaseClaim();
    if (failures.length === 1) throw failures[0];
    if (failures.length)
      throw new AggregateError(failures, '[CodeExample] Projection cleanup failed.');
  };

  function selectFile(panel: HTMLElement, tab: HTMLElement): void {
    if (!ownsRoot()) return;
    const fileList = panel.querySelector<HTMLElement>('[data-code-file-tabs]');
    if (!fileList) return;
    const filePanels = filePanelsByHost.get(panel) ?? [];
    projections.get(fileList)?.select(tabsIn(fileList).indexOf(tab));
    if (!ownsRoot()) return;
    activateTab(tabsIn(fileList), tab, filePanels);
    const visiblePanel = filePanels.find((candidate) => !candidate.hidden);
    if (visiblePanel) refreshCodePanel(visiblePanel);
  }

  function selectHost(tab: HTMLElement, isLocal: boolean): void {
    if (!ownsRoot()) return;
    if (isLocal) localOverride = true;
    activateTab(hostTabs, tab, hostPanels);
    projections.get(hostList)?.select(hostTabs.indexOf(tab));
    if (!ownsRoot()) return;
    const panel = hostPanels.find((candidate) => !candidate.hidden);
    const visibleFile = panel?.querySelector<HTMLElement>('[data-code-file-panel]:not([hidden])');
    if (visibleFile) refreshCodePanel(visibleFile);
    const command = panel?.querySelector<HTMLElement>(
      '[data-code-example-command] [data-code-shell]'
    );
    if (command) refreshCodePanel(command);
  }

  const controller: CodeExampleController = {
    syncGlobalHost(host) {
      if (!ownsRoot() || localOverride) return;
      const tab = hostTabs.find((tab) => tab.dataset.codeHost === host);
      if (tab) selectHost(tab, false);
    },
    enhanceNext() {
      if (!ownsRoot()) {
        destroy();
        return false;
      }
      // Finish inner Trees before the outer Tabs transport their source owners.
      const group = fileGroups[cursor++];
      const list = group?.list ?? hostList;
      const panels = group ? (filePanelsByHost.get(group.panel) ?? []) : hostPanels;
      if (!root.contains(list) || panels.some((panel) => !root.contains(panel))) {
        destroy();
        return false;
      }
      const tabs = group ? tabsIn(list) : hostTabs;
      const initialSelected = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
      const select = group
        ? (tab: HTMLElement) => selectFile(group.panel, tab)
        : (tab: HTMLElement) => selectHost(tab, true);
      projecting = true;
      try {
        let projection: TabProjection | undefined;
        try {
          const options = { list, tabs, panels, onSelect: (index: number) => select(tabs[index]) };
          projection = group ? enhanceCodeExampleTree(options) : enhanceCodeExampleTabs(options);
        } catch (error) {
          console.error(
            group
              ? '[CodeExample] Real Tree unavailable; retaining native file controls.'
              : '[CodeExample] Real Tabs unavailable; retaining native controls.',
            error
          );
        }
        if (projection) {
          if (ownsRoot()) {
            projections.set(list, projection);
            const selected = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
            if (selected && selected !== initialSelected) projection.select(tabs.indexOf(selected));
          } else {
            try {
              projection.destroy();
            } catch (error) {
              cleanupFailed = true;
              throw error;
            }
          }
        }
      } finally {
        projecting = false;
        // An acquisition can synchronously retire this owner. Do not permit a
        // replacement until its returned projection has also been released.
        if (!alive) releaseClaim();
      }
      if (!ownsRoot()) {
        destroy();
        return false;
      }
      return cursor <= fileGroups.length;
    },
    destroy,
  };
  // Claim the pending owner and its teardown before any native or projected
  // callback can reenter initialization. Native interaction is available now.
  controllers.set(root, controller);
  root.dataset.codeExampleInit = '1';
  doc.addEventListener('astro:before-swap', destroy, { once: true, signal: lifetime.signal });
  try {
    hostList.setAttribute('role', 'tablist');
    for (const tab of hostList.querySelectorAll<HTMLElement>('[data-code-host-tab]')) {
      tab.setAttribute('role', 'tab');
      if (!tab.hasAttribute('aria-selected'))
        tab.setAttribute(
          'aria-selected',
          String(tab.dataset.codeHost === root.dataset.initialHost)
        );
      tab.tabIndex = tab.getAttribute('aria-selected') === 'true' ? 0 : -1;
    }
    hostTabs = tabsIn(hostList);
    for (const panel of hostPanels) {
      panel.setAttribute('role', 'tabpanel');
      const list = panel.querySelector<HTMLElement>('[data-code-file-tabs]');
      if (!list) continue;
      for (const source of filePanelsByHost.get(panel) ?? [])
        source.setAttribute('role', 'tabpanel');
      list.setAttribute('role', 'tablist');
      list.setAttribute('aria-orientation', 'vertical');
      for (const [index, tab] of [
        ...list.querySelectorAll<HTMLElement>('[data-code-file-tab]'),
      ].entries()) {
        tab.setAttribute('role', 'tab');
        if (!tab.hasAttribute('aria-selected'))
          tab.setAttribute('aria-selected', String(index === 0));
        tab.tabIndex = tab.getAttribute('aria-selected') === 'true' ? 0 : -1;
      }
      installHorizontalActivation(list, (tab) => selectFile(panel, tab), lifetime.signal, ownsRoot);
      fileGroups.push({ panel, list });
    }
    installHorizontalActivation(
      hostList,
      (tab) => selectHost(tab, true),
      lifetime.signal,
      ownsRoot
    );
    const preferred = storedHost();
    const initial = hostTabs.find((tab) => tab.dataset.codeHost === preferred);
    const selected = hostTabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
    const fallback = initial ?? selected ?? hostTabs[0];
    if (fallback) selectHost(fallback, false);
    if (ownsRoot()) {
      pendingProjections.add(controller);
      scheduleProjection();
    } else destroy();
  } catch (error) {
    try {
      destroy();
    } finally {
      throw error;
    }
  } finally {
    initializing = false;
    if (!alive) releaseClaim();
  }
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
