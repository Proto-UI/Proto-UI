import { loadDemo } from './demo-modules';
import { prepareDemoRuntime, renderDemo } from './demo-renderer';
import { collectPrototypeIds } from './demo-types';
import { loadPrototypes } from './prototype-modules';
import { isRuntimeId, type RuntimeId } from './runtimes/registry';
import { PREFERRED_ADAPTER_EVENT, PREFERRED_ADAPTER_KEY } from '../adapter-preference';
import {
  initSiteShadcnControls,
  selectValue,
  setSiteSelectDisabled,
  setSelectValue,
  type SiteSelectRoot,
} from '../site-shadcn-controls';

type DemoOption = {
  id: string;
  label: string;
  description?: string;
};

type RuntimeOption = {
  id: RuntimeId;
  label: string;
};

type RunnerState = 'loading' | 'ready' | 'error';

type ActiveRender = {
  runtime: RuntimeId;
  demoId: string;
  destroy: () => Promise<void> | void;
};

type AdapterPreferenceDetail = {
  adapter?: unknown;
  source?: EventTarget | null;
  focusTarget?: HTMLElement | null;
};

const DEFAULT_RUNTIME_OPTIONS: RuntimeOption[] = [
  { id: 'wc', label: 'Web Components' },
  { id: 'react', label: 'React' },
  { id: 'vue', label: 'Vue' },
  { id: 'vue2', label: 'Vue 2' },
];

function readPreferredRuntime(runtimeOptions: RuntimeOption[]): RuntimeId | null {
  try {
    const stored = localStorage.getItem(PREFERRED_ADAPTER_KEY);
    return isRuntimeId(stored) && runtimeOptions.some((option) => option.id === stored)
      ? stored
      : null;
  } catch {
    return null;
  }
}

function readRuntimeOptions(raw: string | undefined): RuntimeOption[] {
  if (!raw) return DEFAULT_RUNTIME_OPTIONS;
  const parsed = JSON.parse(raw) as unknown;
  if (
    !Array.isArray(parsed) ||
    parsed.length === 0 ||
    parsed.some(
      (option) =>
        !option ||
        typeof option !== 'object' ||
        !isRuntimeId((option as RuntimeOption).id) ||
        typeof (option as RuntimeOption).label !== 'string'
    )
  ) {
    throw new Error('[HomeDemoPreviewer] runtime options contain an unsupported runtime.');
  }
  return parsed as RuntimeOption[];
}

function populateSelect(
  select: SiteSelectRoot,
  options: Array<{ id: string; label: string }>,
  selected: string
): void {
  const content = select.querySelector<HTMLElement>('wc-shadcn-select-content');
  if (!content) return;
  content.replaceChildren();
  for (const option of options) {
    const item = document.createElement('wc-shadcn-select-item');
    item.dataset.value = option.id;
    item.dataset.textValue = option.label;
    item.textContent = option.label;
    content.appendChild(item);
  }
  setSelectValue(select, selected);
  initSiteShadcnControls(select);
}

export function initHomeDemoPreviewer(root: HTMLElement) {
  if (root.dataset.inited === '1') return;
  root.dataset.inited = '1';

  const host = root.querySelector<HTMLElement>('[data-home-demo-host]');
  const status = root.querySelector<HTMLElement>('[data-home-demo-status]');
  const runtimeSelect = root.querySelector<SiteSelectRoot>('[data-home-demo-runtime]');
  const demoSelect = root.querySelector<SiteSelectRoot>('[data-home-demo-picker]');

  if (!host || !runtimeSelect || !demoSelect) {
    console.error('[HomeDemoPreviewer] missing required elements.');
    return;
  }
  const hostEl = host;
  const runtimeSelectEl = runtimeSelect;
  const demoSelectEl = demoSelect;

  const demoOptions = JSON.parse(root.dataset.homeDemoOptions || '[]') as DemoOption[];
  const runtimeOptions = readRuntimeOptions(root.dataset.runtimeOptions);

  const initialDemoId = root.dataset.initialDemoId || demoOptions[0]?.id || '';
  const configuredRuntimeValue = root.dataset.initialRuntime || runtimeOptions[0]?.id || 'wc';
  const configuredRuntime = isRuntimeId(configuredRuntimeValue)
    ? configuredRuntimeValue
    : runtimeOptions[0].id;
  const initialRuntime =
    readPreferredRuntime(runtimeOptions) ??
    (runtimeOptions.some((option) => option.id === configuredRuntime)
      ? configuredRuntime
      : (runtimeOptions[0]?.id as RuntimeId));

  if (!demoOptions.length) {
    console.error('[HomeDemoPreviewer] no demos configured.');
    return;
  }

  initSiteShadcnControls(root);
  populateSelect(demoSelectEl, demoOptions, initialDemoId);
  populateSelect(runtimeSelectEl, runtimeOptions, initialRuntime);

  let active: ActiveRender | null = null;
  let version = 0;
  let destroyed = false;

  const takeActive = () => {
    const current = active;
    active = null;
    return current;
  };

  let lastRuntimeValue = selectValue(runtimeSelectEl);
  let lastDemoValue = selectValue(demoSelectEl);

  const runtimeLabel = (runtime: RuntimeId) =>
    runtimeOptions.find((option) => option.id === runtime)?.label ?? runtime;
  const setRunnerState = (state: RunnerState, runtime: RuntimeId) => {
    root.dataset.runnerState = state;
    root.dataset.runnerRuntime = runtime;
    hostEl.setAttribute('aria-busy', String(state === 'loading'));
    if (!status) return;
    const stateLabel = root.dataset[`status${state[0].toUpperCase()}${state.slice(1)}`];
    status.textContent = `${runtimeLabel(runtime)} · ${stateLabel ?? state}`;
  };
  const waitForMountPaint = () =>
    new Promise<void>((resolve) => {
      const view = hostEl.ownerDocument.defaultView;
      if (view?.requestAnimationFrame) view.requestAnimationFrame(() => resolve());
      else queueMicrotask(resolve);
    });

  async function renderCurrent(
    runtime: RuntimeId,
    demoId: string,
    focusTarget?: HTMLElement | null
  ) {
    if (destroyed) return;
    const currentVersion = ++version;
    setSiteSelectDisabled(runtimeSelectEl, true);
    setSiteSelectDisabled(demoSelectEl, true);
    setRunnerState('loading', runtime);

    try {
      const demo = await loadDemo(demoId);
      const ids = new Set<string>();
      collectPrototypeIds(demo.root, ids);
      await loadPrototypes(Array.from(ids));
      await prepareDemoRuntime(runtime);

      if (destroyed || currentVersion !== version) return;

      const previous = takeActive();
      if (previous) await previous.destroy();

      if (destroyed || currentVersion !== version) return;

      const { destroy } = await renderDemo({
        runtime,
        demo,
        host: hostEl,
        isCurrent: () => !destroyed && currentVersion === version,
      });

      if (destroyed || currentVersion !== version) {
        await destroy();
        return;
      }

      active = { runtime, demoId, destroy };
      await waitForMountPaint();
      if (!destroyed && currentVersion === version) setRunnerState('ready', runtime);
    } catch (error) {
      if (destroyed || currentVersion !== version) return;
      const failedActive = takeActive();
      if (failedActive) await failedActive.destroy();
      if (destroyed || currentVersion !== version) return;
      hostEl.innerHTML = '';
      const pre = document.createElement('pre');
      pre.textContent =
        '[Home Demo Error]\n' +
        (error && ((error as Error).stack || (error as Error).message || String(error)));
      pre.style.whiteSpace = 'pre-wrap';
      pre.style.color = 'crimson';
      hostEl.appendChild(pre);
      setRunnerState('error', runtime);
      console.error(error);
    } finally {
      if (!destroyed && currentVersion === version) {
        setSiteSelectDisabled(runtimeSelectEl, false);
        setSiteSelectDisabled(demoSelectEl, false);
        if (
          focusTarget?.isConnected &&
          (document.activeElement === document.body || document.activeElement == null)
        ) {
          // The Select adapter applies the unlocked props on its next
          // controller turn. Focusing in this same stack is ignored by the
          // browser while the trigger is still disabled, leaving the local
          // Runtime control on BODY after a remount. Restore after the
          // unlock has committed, and re-check the render generation so a
          // newer selection cannot steal focus.
          await new Promise<void>((resolve) => {
            const view = focusTarget.ownerDocument.defaultView;
            if (view?.requestAnimationFrame) {
              view.requestAnimationFrame(() => resolve());
            } else {
              queueMicrotask(resolve);
            }
          });
          if (
            !destroyed &&
            currentVersion === version &&
            focusTarget.isConnected &&
            (document.activeElement === document.body || document.activeElement == null)
          ) {
            focusTarget.focus();
          }
        }
      }
    }
  }
  const renderFromInputs = (
    event: Event,
    changed: SiteSelectRoot,
    focusTarget = changed.querySelector<HTMLElement>('wc-shadcn-select-trigger')
  ) => {
    const detail = (event as CustomEvent<{ value?: unknown }>).detail;
    const value = typeof detail?.value === 'string' ? detail.value : selectValue(changed);
    const previousValue = changed === runtimeSelectEl ? lastRuntimeValue : lastDemoValue;
    if (previousValue === value) return;
    const nextRuntime = changed === runtimeSelectEl ? value : selectValue(runtimeSelectEl);
    if (!isRuntimeId(nextRuntime)) return;
    if (changed === runtimeSelectEl) lastRuntimeValue = value;
    else lastDemoValue = value;
    setSelectValue(changed, value);
    renderCurrent(
      nextRuntime,
      changed === demoSelectEl ? value : selectValue(demoSelectEl),
      focusTarget
    );
  };

  const onDemoChange = (event: Event) => renderFromInputs(event, demoSelectEl);

  const onRuntimeChange = (event: Event) => {
    const detail = (event as CustomEvent<{ value?: unknown }>).detail;
    const value = typeof detail?.value === 'string' ? detail.value : selectValue(runtimeSelectEl);
    if (!isRuntimeId(value) || !runtimeOptions.some((option) => option.id === value)) return;
    const focusTarget = runtimeSelectEl.querySelector<HTMLElement>('wc-shadcn-select-trigger');
    if (lastRuntimeValue === value) return;
    try {
      localStorage.setItem(PREFERRED_ADAPTER_KEY, value);
    } catch {
      // Storage is optional; the in-document synchronization still applies.
    }
    runtimeSelectEl.ownerDocument.dispatchEvent(
      new CustomEvent(PREFERRED_ADAPTER_EVENT, {
        detail: { adapter: value, source: runtimeSelectEl, focusTarget },
      })
    );
    renderFromInputs(event, runtimeSelectEl, focusTarget);
  };
  const onAdapterChange = (event: Event) => {
    const detail = (event as CustomEvent<AdapterPreferenceDetail>).detail;
    const adapter = detail?.adapter;
    if (!isRuntimeId(adapter) || !runtimeOptions.some((option) => option.id === adapter)) return;
    if (detail?.source === runtimeSelectEl) return;
    if (lastRuntimeValue === adapter) return;
    lastRuntimeValue = adapter;
    setSelectValue(runtimeSelectEl, adapter);
    void renderCurrent(adapter, selectValue(demoSelectEl), detail?.focusTarget ?? null);
  };
  demoSelectEl.addEventListener('valueChange', onDemoChange);
  runtimeSelectEl.addEventListener('valueChange', onRuntimeChange);
  runtimeSelectEl.ownerDocument.addEventListener(PREFERRED_ADAPTER_EVENT, onAdapterChange);

  renderCurrent(initialRuntime, initialDemoId);

  const observer = new MutationObserver(() => {
    if (!document.body.contains(root)) {
      destroyed = true;
      version += 1;
      const detachedActive = takeActive();
      Promise.resolve(detachedActive?.destroy?.()).finally(() => {
        demoSelectEl.removeEventListener('valueChange', onDemoChange);
        runtimeSelectEl.removeEventListener('valueChange', onRuntimeChange);
        runtimeSelectEl.ownerDocument.removeEventListener(PREFERRED_ADAPTER_EVENT, onAdapterChange);
        observer.disconnect();
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
