import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectionFamilyId } from './projection-families';

const render = vi.hoisted(() => vi.fn());
vi.mock('./prototype-modules', () => ({
  loadPrototype: async () => {},
  loadPrototypes: async () => {},
}));
vi.mock('./demo-modules', () => ({
  loadDemo: async () => ({ type: 'demo', root: { kind: 'box', children: ['Test runtime'] } }),
}));
vi.mock('./demo-renderer', () => ({ renderDemo: render }));
vi.mock('./runtimes/host-mount', () => ({ releaseHostMount() {} }));
vi.mock('./runtime-preview-surface', () => ({
  runtimePreviewFamily: (root: HTMLElement) => root.dataset.testFamily,
  createRuntimePreviewSurface: (demo: unknown) => ({
    demo,
    ready: Promise.resolve(),
    setAppearance: async () => {},
  }),
}));
vi.mock('./projection-theme', () => ({
  resolveProjectionThemeSurfaceStyle: () => ({}),
  watchProjectionThemeSurfaceStyle: () => () => {},
}));
vi.mock('../site-shadcn-controls', () => ({
  initSiteShadcnControls() {},
  selectValue() {},
  setSelectValue() {},
  setSiteSelectDisabled() {},
}));
import { initPreviewer } from './previewer-client';

const roots: HTMLElement[] = [];
beforeEach(() => {
  localStorage.clear();
  render.mockReset().mockImplementation(async () => ({ destroy() {} }));
});
afterEach(async () => {
  for (const root of roots.splice(0)) await (root as any).__previewer__.destroy();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function fixture(family: ProjectionFamilyId = 'shadcn', loseFocus = true) {
  const root = document.createElement('section');
  root.dataset.testFamily = family;
  root.innerHTML =
    '<div data-runtime-tabs-mount></div><div data-panel="preview"><div class="host"></div></div>';
  document.body.append(root);
  roots.push(root);
  initPreviewer({
    root,
    demoId: 'test-runtime',
    initialRuntime: 'wc',
    demoProps: {},
    runtimeList: ['wc', 'react', 'vue', 'vue2'],
  });
  const api = (root as any).__previewer__;
  await vi.waitFor(() => expect(api.getCurrentRuntime()).toBe('wc'));
  const tabs = root.querySelector<HTMLElement>('[data-runtime-tabs-root]')!;
  const trigger = (runtime: string) =>
    tabs.querySelector<HTMLElement>(`[data-runtime-tab="${runtime}"]`)!;
  // HappyDOM does not perform the browser's inert focus fixup. Inject only that
  // loss here; restoration must come from the real Website + Tabs public API.
  // The unchanged official browser journey is the independent native red control.
  let inert = false;
  Object.defineProperty(tabs, 'inert', {
    configurable: true,
    get: () => inert,
    set(value: boolean) {
      inert = value;
      if (
        loseFocus &&
        value &&
        document.activeElement instanceof HTMLElement &&
        tabs.contains(document.activeElement)
      ) {
        document.activeElement.blur();
      }
    },
  });
  return { root, api, tabs, trigger };
}
function observePublicFocus(trigger: HTMLElement, afterFocus?: () => void) {
  const element = trigger as HTMLElement & { getExposes(): { focusSelf(options: unknown): void } };
  const read = element.getExposes.bind(element);
  const focus = vi.fn((options: unknown) => {
    read().focusSelf(options);
    afterFocus?.();
  });
  // Expose snapshots are replaced as real state changes. Observe the stable
  // public entry, delegating to its current real scoped method on every call.
  vi.spyOn(element, 'getExposes').mockImplementation(() => ({ ...read(), focusSelf: focus }));
  return focus;
}
function holdNextRender() {
  const gate = deferred();
  render.mockImplementationOnce(async () => {
    await gate.promise;
    return { destroy() {} };
  });
  return gate;
}
async function activate(f: Awaited<ReturnType<typeof fixture>>, runtime = 'react') {
  f.trigger(runtime).focus();
  expect(document.activeElement).toBe(f.trigger(runtime));
  f.trigger(runtime).click();
  await vi.waitFor(() => expect(f.tabs.inert).toBe(true));
  await vi.waitFor(() => expect(render).toHaveBeenCalledWith(expect.objectContaining({ runtime })));
  expect(document.activeElement).toBe(document.body);
}

// T-RUNTIME-TABS-APPEARANCE-0001-CASE-GENERATION-FOCUS (draft): consumer scope only.
describe('generic Runtime Tabs focus lease', () => {
  for (const family of ['shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'] as const) {
    it(`${family}: restores the initiating real Tab only after a successful unlocked switch`, async () => {
      const f = await fixture(family);
      const focus = observePublicFocus(f.trigger('react'));
      const gate = holdNextRender();
      await activate(f);
      expect(focus).not.toHaveBeenCalled();
      expect(f.api.getCurrentRuntime()).toBeNull();
      gate.resolve();
      await vi.waitFor(() => expect(f.api.getCurrentRuntime()).toBe('react'));
      expect(f.tabs.inert).toBe(false);
      expect(document.activeElement).toBe(f.trigger('react'));
      expect(focus).toHaveBeenCalledTimes(1);
      expect(focus).toHaveBeenCalledWith(expect.objectContaining({ preventScroll: true }));
    });
  }
  it('never reclaims focus after a newer focus target returns to body', async () => {
    const f = await fixture();
    const focus = observePublicFocus(f.trigger('react'));
    const gate = holdNextRender();
    await activate(f);
    const elsewhere = document.createElement('button');
    document.body.append(elsewhere);
    elsewhere.focus();
    elsewhere.blur();
    gate.resolve();
    await vi.waitFor(() => expect(f.api.getCurrentRuntime()).toBe('react'));
    expect(document.activeElement).toBe(document.body);
    expect(focus).not.toHaveBeenCalled();
  });

  for (const interruption of ['pointerdown', 'keydown', 'window-blur'] as const) {
    it(`cancels on newer ${interruption} even without a new focus target`, async () => {
      const f = await fixture();
      const focus = observePublicFocus(f.trigger('react'));
      const gate = holdNextRender();
      await activate(f);
      if (interruption === 'window-blur') window.dispatchEvent(new Event('blur'));
      else document.body.dispatchEvent(new Event(interruption, { bubbles: true }));
      gate.resolve();
      await vi.waitFor(() => expect(f.api.getCurrentRuntime()).toBe('react'));
      expect(document.activeElement).toBe(document.body);
      expect(focus).not.toHaveBeenCalled();
    });
  }

  it('does not grant a focus lease to a document preference broadcast', async () => {
    const f = await fixture();
    const focus = observePublicFocus(f.trigger('react'));
    f.trigger('react').focus();
    document.dispatchEvent(
      new CustomEvent('proto-adapter:change', { detail: { adapter: 'react' } })
    );
    await vi.waitFor(() => expect(f.api.getCurrentRuntime()).toBe('react'));
    expect(document.activeElement).toBe(document.body);
    expect(focus).not.toHaveBeenCalled();
  });

  it('cancels a failed switch instead of restoring when finally unlocks', async () => {
    const f = await fixture();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const focus = observePublicFocus(f.trigger('react'));
    const gate = deferred();
    render.mockImplementationOnce(async () => {
      await gate.promise;
      throw new Error('render failed');
    });
    await activate(f);
    gate.resolve();
    await vi.waitFor(() => expect(log).toHaveBeenCalled());
    expect(f.tabs.inert).toBe(false);
    expect(f.api.getCurrentRuntime()).toBeNull();
    expect(document.activeElement).toBe(document.body);
    expect(focus).not.toHaveBeenCalled();
  });

  it('revokes a superseded version before its late render resolves', async () => {
    const f = await fixture();
    const focus = observePublicFocus(f.trigger('react'));
    const gate = holdNextRender();
    await activate(f);
    await f.api.switchRuntime('vue');
    gate.resolve();
    await vi.waitFor(() => expect(f.api.getCurrentRuntime()).toBe('vue'));
    expect(document.activeElement).toBe(document.body);
    expect(focus).not.toHaveBeenCalled();
  });

  it('revokes on destruction before the late renderer returns', async () => {
    const f = await fixture();
    const focus = observePublicFocus(f.trigger('react'));
    const gate = deferred();
    const retired = vi.fn();
    render.mockImplementationOnce(async () => {
      await gate.promise;
      return { destroy: retired };
    });
    await activate(f);
    await f.api.destroy();
    gate.resolve();
    await vi.waitFor(() => expect(retired).toHaveBeenCalledTimes(1));
    expect(f.root.querySelector('[data-runtime-tabs-root]')).toBeNull();
    expect(document.activeElement).toBe(document.body);
    expect(focus).not.toHaveBeenCalled();
  });

  it('does not revive a disconnected and reconnected Tab instance', async () => {
    const f = await fixture();
    const gate = holdNextRender();
    await activate(f);
    const mount = f.tabs.parentElement!;
    f.tabs.remove();
    mount.append(f.tabs);
    gate.resolve();
    await vi.waitFor(() => expect(f.api.getCurrentRuntime()).toBe('react'));
    expect(document.activeElement).toBe(document.body);
  });

  it('does not issue a redundant request when this host kept focus across inert', async () => {
    const f = await fixture('shadcn', false);
    const focus = observePublicFocus(f.trigger('react'));
    f.trigger('react').focus();
    f.trigger('react').click();
    await vi.waitFor(() => expect(f.api.getCurrentRuntime()).toBe('react'));
    expect(document.activeElement).toBe(f.trigger('react'));
    expect(focus).not.toHaveBeenCalled();
  });

  it('consumes before public focus callbacks synchronously start another switch', async () => {
    const f = await fixture();
    const focus = observePublicFocus(f.trigger('react'), () => {
      void f.api.switchRuntime('vue');
    });
    const gate = holdNextRender();
    await activate(f);
    gate.resolve();
    await vi.waitFor(() => expect(f.api.getCurrentRuntime()).toBe('vue'));
    expect(document.activeElement).toBe(document.body);
    expect(focus).toHaveBeenCalledTimes(1);
  });
  for (const unavailable of ['hidden', 'inert', 'display'] as const) {
    it(`does not request deferred focus through a newly ${unavailable} ancestor`, async () => {
      const f = await fixture();
      const focus = observePublicFocus(f.trigger('react'));
      const gate = holdNextRender();
      await activate(f);
      if (unavailable === 'display') f.root.style.display = 'none';
      else f.root[unavailable] = true;
      gate.resolve();
      await vi.waitFor(() => expect(f.api.getCurrentRuntime()).toBe('react'));
      expect(focus).not.toHaveBeenCalled();
      if (unavailable === 'display') f.root.style.display = '';
      else f.root[unavailable] = false;
      expect(document.activeElement).toBe(document.body);
    });
  }
  it("does not capture another Tab's focus for an unfocused activation", async () => {
    const f = await fixture();
    const focus = observePublicFocus(f.trigger('react'));
    f.trigger('wc').focus();
    f.trigger('react').click();
    await vi.waitFor(() => expect(f.api.getCurrentRuntime()).toBe('react'));
    expect(document.activeElement).toBe(document.body);
    expect(focus).not.toHaveBeenCalled();
  });

  it('synchronizes a second preview without letting it steal the local lease', async () => {
    const first = await fixture();
    const second = await fixture('brutalist');
    const firstFocus = observePublicFocus(first.trigger('react'));
    const secondFocus = observePublicFocus(second.trigger('react'));
    const gate = deferred();
    render.mockImplementation(async () => {
      await gate.promise;
      return { destroy() {} };
    });
    await activate(first);
    expect(second.tabs.inert).toBe(true);
    gate.resolve();
    await vi.waitFor(() => expect(first.api.getCurrentRuntime()).toBe('react'));
    await vi.waitFor(() => expect(second.api.getCurrentRuntime()).toBe('react'));
    expect(document.activeElement).toBe(first.trigger('react'));
    expect(firstFocus).toHaveBeenCalledTimes(1);
    expect(secondFocus).not.toHaveBeenCalled();
  });
  for (const focused of [true, false]) {
    it(`does not persist or broadcast an activation superseded by teardown (focus lease ${focused})`, async () => {
      let api: any;
      let entered = false;
      render.mockImplementationOnce(async () => ({
        destroy() {
          entered = true;
          void api.switchRuntime('vue');
        },
      }));
      const first = await fixture();
      api = first.api;
      const peer = await fixture('brutalist');
      const broadcasts: string[] = [];
      const listener = (event: Event) => broadcasts.push((event as CustomEvent).detail.adapter);
      document.addEventListener('proto-adapter:change', listener);
      try {
        first.trigger(focused ? 'react' : 'wc').focus();
        first.trigger('react').click();
        expect(entered).toBe(true);
        await vi.waitFor(() => expect(first.api.getCurrentRuntime()).not.toBeNull());
        expect(first.api.getCurrentRuntime()).toBe('vue');
        expect(peer.api.getCurrentRuntime()).toBe('wc');
        expect(broadcasts).toEqual([]);
        expect(localStorage.getItem('preferred-prototypes-adapter')).toBeNull();
        expect(document.activeElement).toBe(document.body);
      } finally {
        document.removeEventListener('proto-adapter:change', listener);
      }
    });
  }

  it('does not replay an outer activation over a synchronous newer peer activation', async () => {
    let peer: Awaited<ReturnType<typeof fixture>>;
    let reentered = false;
    const broadcast: string[] = [];
    // Register before either preview receives broadcasts. The newer peer event
    // is synchronously nested inside the old event's delivery.
    const listener = (event: Event) => {
      const value = (event as CustomEvent).detail.adapter;
      broadcast.push(value);
      if (value !== 'react' || reentered) return;
      reentered = true;
      peer.trigger('vue').focus();
      peer.trigger('vue').click();
    };
    document.addEventListener('proto-adapter:change', listener);
    try {
      const first = await fixture();
      peer = await fixture('brutalist');
      const firstPublications: string[] = [];
      const peerPublications: string[] = [];
      first.root.addEventListener('runtime:changed', (event) =>
        firstPublications.push((event as CustomEvent).detail.id)
      );
      peer.root.addEventListener('runtime:changed', (event) =>
        peerPublications.push((event as CustomEvent).detail.id)
      );
      first.trigger('react').focus();
      first.trigger('react').click();
      await vi.waitFor(() => expect(first.api.getCurrentRuntime()).not.toBeNull());
      await vi.waitFor(() => expect(peer.api.getCurrentRuntime()).not.toBeNull());
      expect(first.api.getCurrentRuntime()).toBe('vue');
      expect(peer.api.getCurrentRuntime()).toBe('vue');
      expect(firstPublications).toEqual(['vue']);
      expect(peerPublications).toEqual(['vue']);
      expect(broadcast).toEqual(['react', 'vue']);
      expect(localStorage.getItem('preferred-prototypes-adapter')).toBe('vue');
      expect(document.activeElement).toBe(peer.trigger('vue'));
    } finally {
      document.removeEventListener('proto-adapter:change', listener);
    }
  });
  for (const listenerOrder of ['before', 'between', 'after'] as const) {
    it(`preserves a nested newer broadcast with its listener ${listenerOrder} the previews`, async () => {
      let entered = false;
      const listener = (event: Event) => {
        if ((event as CustomEvent).detail.adapter !== 'react' || entered) return;
        entered = true;
        localStorage.setItem('preferred-prototypes-adapter', 'vue');
        document.dispatchEvent(
          new CustomEvent('proto-adapter:change', { detail: { adapter: 'vue' } })
        );
      };
      if (listenerOrder === 'before') document.addEventListener('proto-adapter:change', listener);
      try {
        const first = await fixture();
        if (listenerOrder === 'between')
          document.addEventListener('proto-adapter:change', listener);
        const second = await fixture('brutalist');
        if (listenerOrder === 'after') document.addEventListener('proto-adapter:change', listener);
        const firstPublications: string[] = [];
        const secondPublications: string[] = [];
        first.root.addEventListener('runtime:changed', (event) =>
          firstPublications.push((event as CustomEvent).detail.id)
        );
        second.root.addEventListener('runtime:changed', (event) =>
          secondPublications.push((event as CustomEvent).detail.id)
        );
        const countBefore = render.mock.calls.length;
        first.trigger('react').focus();
        first.trigger('react').click();
        await vi.waitFor(() => expect(first.api.getCurrentRuntime()).not.toBeNull());
        await vi.waitFor(() => expect(second.api.getCurrentRuntime()).not.toBeNull());
        expect(first.api.getCurrentRuntime()).toBe('vue');
        expect(second.api.getCurrentRuntime()).toBe('vue');
        expect(firstPublications).toEqual(['vue']);
        expect(secondPublications).toEqual(['vue']);
        expect(render.mock.calls.slice(countBefore).map(([request]) => request.runtime)).toEqual([
          'vue',
          'vue',
        ]);
        expect(localStorage.getItem('preferred-prototypes-adapter')).toBe('vue');
        expect(document.activeElement).toBe(document.body);
      } finally {
        document.removeEventListener('proto-adapter:change', listener);
      }
    });
  }
});
