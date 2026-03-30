import { loadDemo } from './demo-modules';
import { renderDemo } from './demo-renderer';
import { collectPrototypeIds } from './demo-types';
import { loadPrototypes } from './prototype-modules';
import type { RuntimeId } from './runtimes/registry';

type DemoOption = {
  id: string;
  label: string;
  description?: string;
};

type RuntimeOption = {
  id: RuntimeId;
  label: string;
};

type ActiveRender = {
  runtime: RuntimeId;
  demoId: string;
  destroy: () => Promise<void> | void;
};

const DEFAULT_RUNTIME_OPTIONS: RuntimeOption[] = [
  { id: 'wc', label: 'Web Components' },
  { id: 'react', label: 'React' },
  { id: 'vue', label: 'Vue' },
];

export function initHomeDemoPreviewer(root: HTMLElement) {
  if (root.dataset.inited === '1') return;
  root.dataset.inited = '1';

  const host = root.querySelector<HTMLElement>('[data-home-demo-host]');
  const runtimeSelect = root.querySelector<HTMLSelectElement>('[data-home-demo-runtime]');
  const demoSelect = root.querySelector<HTMLSelectElement>('[data-home-demo-picker]');

  if (!host || !runtimeSelect || !demoSelect) {
    console.error('[HomeDemoPreviewer] missing required elements.');
    return;
  }

  const demoOptions = JSON.parse(root.dataset.homeDemoOptions || '[]') as DemoOption[];
  const runtimeOptions = root.dataset.runtimeOptions
    ? (JSON.parse(root.dataset.runtimeOptions) as RuntimeOption[])
    : DEFAULT_RUNTIME_OPTIONS;

  const initialDemoId = root.dataset.initialDemoId || demoOptions[0]?.id || '';
  const initialRuntime = (root.dataset.initialRuntime ||
    runtimeOptions[0]?.id ||
    'wc') as RuntimeId;

  if (!demoOptions.length) {
    console.error('[HomeDemoPreviewer] no demos configured.');
    return;
  }

  demoSelect.innerHTML = '';
  for (const option of demoOptions) {
    const el = document.createElement('option');
    el.value = option.id;
    el.textContent = option.label;
    if (option.id === initialDemoId) el.selected = true;
    demoSelect.appendChild(el);
  }

  runtimeSelect.innerHTML = '';
  for (const option of runtimeOptions) {
    const el = document.createElement('option');
    el.value = option.id;
    el.textContent = option.label;
    if (option.id === initialRuntime) el.selected = true;
    runtimeSelect.appendChild(el);
  }

  let active: ActiveRender | null = null;
  let version = 0;
  let destroyed = false;

  async function renderCurrent(runtime: RuntimeId, demoId: string) {
    if (destroyed) return;
    const currentVersion = ++version;
    runtimeSelect.disabled = true;
    demoSelect.disabled = true;

    try {
      if (active) {
        await active.destroy();
        active = null;
      }

      const demo = await loadDemo(demoId);
      const ids = new Set<string>();
      collectPrototypeIds(demo.root, ids);
      await loadPrototypes(Array.from(ids));

      if (destroyed || currentVersion !== version) return;

      const { destroy } = await renderDemo({
        runtime,
        demo,
        host,
      });

      active = { runtime, demoId, destroy };
    } catch (error) {
      host.innerHTML = '';
      const pre = document.createElement('pre');
      pre.textContent =
        '[Home Demo Error]\n' +
        (error && ((error as Error).stack || (error as Error).message || String(error)));
      pre.style.whiteSpace = 'pre-wrap';
      pre.style.color = 'crimson';
      host.appendChild(pre);
      console.error(error);
    } finally {
      if (!destroyed && currentVersion === version) {
        runtimeSelect.disabled = false;
        demoSelect.disabled = false;
      }
    }
  }

  const renderFromInputs = () => renderCurrent(runtimeSelect.value as RuntimeId, demoSelect.value);

  demoSelect.addEventListener('change', renderFromInputs);
  runtimeSelect.addEventListener('change', renderFromInputs);

  renderCurrent(initialRuntime, initialDemoId);

  const observer = new MutationObserver(() => {
    if (!document.body.contains(root)) {
      destroyed = true;
      version += 1;
      Promise.resolve(active?.destroy?.()).finally(() => {
        active = null;
        observer.disconnect();
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
