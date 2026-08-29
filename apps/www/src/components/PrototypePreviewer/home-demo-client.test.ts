import { beforeEach, describe, expect, it, vi } from 'vitest';

const demoLoader = vi.hoisted(() => ({
  loadDemo: vi.fn(),
  collectPrototypeIds: vi.fn(),
  loadPrototypes: vi.fn(),
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
  root.innerHTML = `
    <div data-home-demo-picker>
      <wc-shadcn-select-trigger></wc-shadcn-select-trigger>
      <wc-shadcn-select-content></wc-shadcn-select-content>
    </div>
    <div data-home-demo-runtime>
      <wc-shadcn-select-trigger></wc-shadcn-select-trigger>
      <wc-shadcn-select-content></wc-shadcn-select-content>
    </div>
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
