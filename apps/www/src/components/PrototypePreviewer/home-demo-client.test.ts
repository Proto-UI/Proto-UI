import { beforeEach, describe, expect, it, vi } from 'vitest';

const demoLoader = vi.hoisted(() => ({
  loadDemo: vi.fn(),
  collectPrototypeIds: vi.fn(),
  loadPrototypes: vi.fn(),
  prepareDemoRuntime: vi.fn(),
  renderDemo: vi.fn(),
}));

vi.mock('./demo-modules', () => ({
  loadDemo: demoLoader.loadDemo,
}));
vi.mock('./demo-types', () => ({
  collectPrototypeIds: demoLoader.collectPrototypeIds,
}));
vi.mock('./prototype-modules', () => ({
  loadPrototypes: demoLoader.loadPrototypes,
}));
vi.mock('./demo-renderer', () => ({
  prepareDemoRuntime: demoLoader.prepareDemoRuntime,
  renderDemo: demoLoader.renderDemo,
}));
vi.mock('../adapter-preference', () => ({
  PREFERRED_ADAPTER_EVENT: 'proto-adapter:change',
  PREFERRED_ADAPTER_KEY: 'preferred-prototypes-adapter',
}));
vi.mock('../site-shadcn-controls', () => ({
  initSiteShadcnControls: () => {},
  selectValue: (root: HTMLElement) => root.dataset.value ?? '',
  setSelectValue: (root: HTMLElement, value: string) => {
    root.dataset.value = value;
  },
  setSiteSelectDisabled: (root: HTMLElement, disabled: boolean) => {
    root.dataset.disabled = String(disabled);
  },
}));

import { initHomeDemoPreviewer } from './home-demo-client';

function createHomeRoot(): HTMLElement {
  const root = document.createElement('section');
  root.dataset.homeDemoOptions = JSON.stringify([
    { id: 'demo-one', label: 'One' },
    { id: 'demo-two', label: 'Two' },
  ]);
  root.dataset.runtimeOptions = JSON.stringify([
    { id: 'wc', label: 'Web Components' },
    { id: 'react', label: 'React' },
  ]);
  root.dataset.initialDemoId = 'demo-one';
  root.dataset.initialRuntime = 'wc';
  root.dataset.statusLoading = 'Preparing';
  root.dataset.statusReady = 'Ready';
  root.dataset.statusError = 'Error';
  root.innerHTML = `
    <div data-home-demo-picker>
      <wc-shadcn-select-trigger></wc-shadcn-select-trigger>
      <wc-shadcn-select-content></wc-shadcn-select-content>
    </div>
    <div data-home-demo-runtime>
      <wc-shadcn-select-trigger></wc-shadcn-select-trigger>
      <wc-shadcn-select-content></wc-shadcn-select-content>
    </div>
    <output data-home-demo-status></output>
    <div data-home-demo-host></div>
  `;
  document.body.append(root);
  return root;
}

describe('Home demo runtime selector', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    demoLoader.loadDemo.mockReset().mockResolvedValue({ root: {} });
    demoLoader.collectPrototypeIds.mockReset();
    demoLoader.loadPrototypes.mockReset().mockResolvedValue(undefined);
    demoLoader.prepareDemoRuntime.mockReset().mockResolvedValue(undefined);
    demoLoader.renderDemo.mockReset().mockImplementation(async () => ({ destroy: vi.fn() }));
  });

  it('rerenders locally when no global AdapterSelect is present', async () => {
    const root = createHomeRoot();
    initHomeDemoPreviewer(root);

    await vi.waitFor(() =>
      expect(demoLoader.renderDemo).toHaveBeenCalledWith(
        expect.objectContaining({ runtime: 'wc', demo: expect.anything() })
      )
    );

    const runtimeSelect = root.querySelector<HTMLElement>('[data-home-demo-runtime]')!;
    runtimeSelect.dataset.value = 'react';
    runtimeSelect.dispatchEvent(
      new CustomEvent('valueChange', { detail: { value: 'react' }, bubbles: true })
    );

    await vi.waitFor(() =>
      expect(demoLoader.renderDemo).toHaveBeenCalledWith(
        expect.objectContaining({ runtime: 'react', demo: expect.anything() })
      )
    );
    expect(demoLoader.renderDemo).toHaveBeenCalledTimes(2);
    expect(runtimeSelect.dataset.disabled).toBe('false');
    expect(root.dataset.runnerState).toBe('ready');
    expect(root.querySelector('[data-home-demo-status]')?.textContent).toBe('React · Ready');
  });

  it('keeps the current demo mounted while the next runtime dependencies load', async () => {
    const firstDestroy = vi.fn();
    let resolveNextRuntime!: () => void;
    const nextRuntime = new Promise<void>((resolve) => {
      resolveNextRuntime = resolve;
    });
    demoLoader.prepareDemoRuntime.mockResolvedValueOnce(undefined).mockReturnValueOnce(nextRuntime);
    demoLoader.renderDemo
      .mockResolvedValueOnce({ destroy: firstDestroy })
      .mockResolvedValueOnce({ destroy: vi.fn() });

    const root = createHomeRoot();
    initHomeDemoPreviewer(root);
    await vi.waitFor(() => expect(root.dataset.runnerState).toBe('ready'));

    const runtimeSelect = root.querySelector<HTMLElement>('[data-home-demo-runtime]')!;
    runtimeSelect.dataset.value = 'react';
    runtimeSelect.dispatchEvent(
      new CustomEvent('valueChange', { detail: { value: 'react' }, bubbles: true })
    );

    await vi.waitFor(() => expect(demoLoader.prepareDemoRuntime).toHaveBeenCalledTimes(2));
    expect(firstDestroy).not.toHaveBeenCalled();
    expect(root.dataset.runnerState).toBe('loading');

    resolveNextRuntime();
    await vi.waitFor(() => expect(demoLoader.renderDemo).toHaveBeenCalledTimes(2));
    expect(firstDestroy).toHaveBeenCalledTimes(1);
  });

  it('keeps the newest active cleanup when an older teardown completes late', async () => {
    let resolveFirstDestroy!: () => void;
    const firstDestroyPending = new Promise<void>((resolve) => {
      resolveFirstDestroy = resolve;
    });
    let firstDestroyCalls = 0;
    const firstDestroy = vi.fn(() => {
      firstDestroyCalls += 1;
      return firstDestroyCalls === 1 ? firstDestroyPending : Promise.resolve();
    });
    const newestDestroy = vi.fn();
    demoLoader.renderDemo
      .mockResolvedValueOnce({ destroy: firstDestroy })
      .mockResolvedValueOnce({ destroy: newestDestroy });

    const root = createHomeRoot();
    initHomeDemoPreviewer(root);
    await vi.waitFor(() => expect(root.dataset.runnerState).toBe('ready'));

    const runtimeSelect = root.querySelector<HTMLElement>('[data-home-demo-runtime]')!;
    runtimeSelect.dataset.value = 'react';
    runtimeSelect.dispatchEvent(
      new CustomEvent('valueChange', { detail: { value: 'react' }, bubbles: true })
    );
    await vi.waitFor(() => expect(firstDestroy).toHaveBeenCalledTimes(1));

    document.dispatchEvent(
      new CustomEvent('proto-adapter:change', {
        detail: { adapter: 'wc', source: document.body },
      })
    );
    await vi.waitFor(() => {
      expect(root.dataset.runnerRuntime).toBe('wc');
      expect(root.dataset.runnerState).toBe('ready');
    });
    expect(firstDestroy).toHaveBeenCalledTimes(1);

    resolveFirstDestroy();
    await firstDestroyPending;
    await Promise.resolve();
    expect(demoLoader.renderDemo).toHaveBeenCalledTimes(2);

    document.dispatchEvent(
      new CustomEvent('proto-adapter:change', {
        detail: { adapter: 'react', source: document.body },
      })
    );
    await vi.waitFor(() => expect(newestDestroy).toHaveBeenCalledTimes(1));
  });

  it('destroys a render result that becomes stale before registration', async () => {
    let resolveStaleRender!: (result: { destroy(): void }) => void;
    const staleRender = new Promise<{ destroy(): void }>((resolve) => {
      resolveStaleRender = resolve;
    });
    const firstDestroy = vi.fn();
    const staleDestroy = vi.fn();
    const newestDestroy = vi.fn();
    demoLoader.renderDemo
      .mockResolvedValueOnce({ destroy: firstDestroy })
      .mockReturnValueOnce(staleRender)
      .mockResolvedValueOnce({ destroy: newestDestroy });

    const root = createHomeRoot();
    initHomeDemoPreviewer(root);
    await vi.waitFor(() => expect(root.dataset.runnerState).toBe('ready'));

    const runtimeSelect = root.querySelector<HTMLElement>('[data-home-demo-runtime]')!;
    runtimeSelect.dataset.value = 'react';
    runtimeSelect.dispatchEvent(
      new CustomEvent('valueChange', { detail: { value: 'react' }, bubbles: true })
    );
    await vi.waitFor(() => expect(demoLoader.renderDemo).toHaveBeenCalledTimes(2));

    document.dispatchEvent(
      new CustomEvent('proto-adapter:change', {
        detail: { adapter: 'wc', source: document.body },
      })
    );
    await vi.waitFor(() => {
      expect(demoLoader.renderDemo).toHaveBeenCalledTimes(3);
      expect(root.dataset.runnerRuntime).toBe('wc');
      expect(root.dataset.runnerState).toBe('ready');
    });

    resolveStaleRender({ destroy: staleDestroy });
    await staleRender;
    await Promise.resolve();
    expect(staleDestroy).toHaveBeenCalledTimes(1);
  });

  it('reports a runner preload error without leaving a stale runtime visible', async () => {
    const firstDestroy = vi.fn();
    demoLoader.prepareDemoRuntime
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('React loader failed'));
    demoLoader.renderDemo.mockResolvedValueOnce({ destroy: firstDestroy });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const root = createHomeRoot();
    initHomeDemoPreviewer(root);
    await vi.waitFor(() => expect(root.dataset.runnerState).toBe('ready'));

    const runtimeSelect = root.querySelector<HTMLElement>('[data-home-demo-runtime]')!;
    runtimeSelect.dataset.value = 'react';
    runtimeSelect.dispatchEvent(
      new CustomEvent('valueChange', { detail: { value: 'react' }, bubbles: true })
    );

    await vi.waitFor(() => expect(root.dataset.runnerState).toBe('error'));
    expect(firstDestroy).toHaveBeenCalledTimes(1);
    expect(demoLoader.renderDemo).toHaveBeenCalledTimes(1);
    expect(root.querySelector('[data-home-demo-host]')?.textContent).toContain('[Home Demo Error]');
    expect(root.querySelector('[data-home-demo-host]')?.getAttribute('aria-busy')).toBe('false');
    expect(root.querySelector('[data-home-demo-status]')?.textContent).toBe('React · Error');
    consoleError.mockRestore();
  });

  it('rejects future browser runner research ids at the executable runtime boundary', async () => {
    const root = createHomeRoot();
    const adapterChange = vi.fn();
    document.addEventListener('proto-adapter:change', adapterChange);
    initHomeDemoPreviewer(root);
    await vi.waitFor(() => expect(demoLoader.renderDemo).toHaveBeenCalledTimes(1));

    const runtimeSelect = root.querySelector<HTMLElement>('[data-home-demo-runtime]')!;
    runtimeSelect.dispatchEvent(
      new CustomEvent('valueChange', { detail: { value: 'gpui-wasm' }, bubbles: true })
    );
    await Promise.resolve();

    expect(demoLoader.renderDemo).toHaveBeenCalledTimes(1);
    expect(adapterChange).not.toHaveBeenCalled();
    expect(runtimeSelect.dataset.value).toBe('wc');
    expect(localStorage.getItem('preferred-prototypes-adapter')).toBeNull();
    document.removeEventListener('proto-adapter:change', adapterChange);
  });

  it('does not remount when the active demo or runtime is reselected', async () => {
    const root = createHomeRoot();
    initHomeDemoPreviewer(root);
    await vi.waitFor(() => expect(demoLoader.renderDemo).toHaveBeenCalledTimes(1));

    const runtimeSelect = root.querySelector<HTMLElement>('[data-home-demo-runtime]')!;
    runtimeSelect.dispatchEvent(
      new CustomEvent('valueChange', { detail: { value: 'wc' }, bubbles: true })
    );
    const demoSelect = root.querySelector<HTMLElement>('[data-home-demo-picker]')!;
    demoSelect.dispatchEvent(
      new CustomEvent('valueChange', { detail: { value: 'demo-one' }, bubbles: true })
    );

    await Promise.resolve();
    expect(demoLoader.renderDemo).toHaveBeenCalledTimes(1);
  });
});
