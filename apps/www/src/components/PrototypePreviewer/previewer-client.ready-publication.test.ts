import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RuntimeId } from './runtimes/ids';

const control = vi.hoisted(() => ({ gates: [] as Promise<void>[], entered: 0 }));
// Exercise the actual renderers, Runtime Tabs and borrowed-content shell. Only
// CDN acquisition and explicitly controlled demo-load races are substituted.
vi.mock('./runtimes/react-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/react/package.json');
  return {
    loadReact: async () => ({
      React: require('react'),
      ReactDOM: { ...require('react-dom'), ...require('react-dom/client') },
    }),
  };
});
vi.mock('./runtimes/vue-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/apps/www/package.json');
  return { loadVue: async () => require('vue') };
});
vi.mock('./runtimes/vue2-runtime', async (original) => {
  const current = await original<typeof import('./runtimes/vue2-runtime')>();
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/vue2/package.json');
  return { ...current, loadVue2: async () => require('vue') };
});
vi.mock('./demo-modules', async (original) => {
  const current = await original<typeof import('./demo-modules')>();
  return {
    ...current,
    async loadDemo(id: string) {
      const gate = control.gates.shift();
      control.entered++;
      if (gate) await gate;
      return current.loadDemo(id);
    },
  };
});

import { initPreviewer } from './previewer-client';
import { WEBSITE_SHADCN_THEME_TOKENS } from './projection-theme';

type Handle = {
  switchRuntime(runtime: RuntimeId): Promise<void>;
  destroy(): Promise<void>;
  getCurrentRuntime(): string | null;
};
type Root = HTMLElement & { __previewer__: Handle };
const roots: Root[] = [];
beforeEach(() => {
  control.gates = [];
  control.entered = 0;
  localStorage.clear();
  for (const token of WEBSITE_SHADCN_THEME_TOKENS)
    document.documentElement.style.setProperty(
      `--pui-${token}`,
      token.startsWith('radius') ? '4px' : '#ffffff'
    );
});
afterEach(async () => {
  for (const root of roots.splice(0)) await root.__previewer__.destroy();
  document.body.replaceChildren();
  for (const token of WEBSITE_SHADCN_THEME_TOKENS)
    document.documentElement.style.removeProperty(`--pui-${token}`);
  vi.restoreAllMocks();
});

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function fixture(initialRuntime: RuntimeId = 'wc', beforeStart?: (root: Root) => void) {
  const root = document.createElement('section') as Root;
  root.dataset.previewerId = `generic-ready-${initialRuntime}`;
  root.innerHTML =
    '<div data-runtime-tabs-mount></div><div data-panel="preview"><div class="host"><div class="proto-previewer__skeleton" role="status">Loading</div></div></div>';
  // HappyDOM does not inherit these custom properties through the fixture.
  for (const target of [root, root.querySelector<HTMLElement>('.host')!])
    for (const token of WEBSITE_SHADCN_THEME_TOKENS)
      target.style.setProperty(`--pui-${token}`, token.startsWith('radius') ? '4px' : '#ffffff');
  document.body.append(root);
  roots.push(root);
  const events: Array<{ name: string; runtime: RuntimeId; active: number; blocked: boolean }> = [];
  for (const name of ['runtime:changed', 'previewer:mounted']) {
    root.addEventListener(name, (event) => {
      const runtime = (event as CustomEvent).detail[name === 'runtime:changed' ? 'id' : 'runtime'];
      const slots = [...root.querySelectorAll<HTMLElement>('[data-passive-shell-slot]')];
      const blocked = slots.some((slot) => {
        for (
          let node: HTMLElement | null = slot;
          node && node !== root;
          node = node.parentElement
        ) {
          const style = getComputedStyle(node);
          if (
            node.inert ||
            node.hidden ||
            style.display === 'none' ||
            style.visibility === 'hidden'
          )
            return true;
        }
        return false;
      });
      const active = slots.filter(
        (slot) =>
          slot.querySelector('[data-demo-ref="__website_runtime_preview_surface__-content"]') &&
          slot.querySelectorAll('[data-pui-root]').length === 4 &&
          slot.closest<HTMLElement>('.pui-runtime-preview-surface')?.dataset.projectionRuntime ===
            runtime
      ).length;
      events.push({ name, runtime, active, blocked });
    });
  }
  beforeStart?.(root);
  initPreviewer({
    root,
    demoId: 'demo-base-text',
    initialRuntime,
    runtimeList: ['wc', 'react', 'vue', 'vue2'],
    demoProps: {},
  });
  return {
    root,
    api: root.__previewer__,
    tabs: root.querySelector<HTMLElement>('[data-runtime-tabs-root]')!,
    events,
  };
}

function expectReady(events: ReturnType<typeof fixture>['events']) {
  expect(events.length).toBeGreaterThan(0);
  expect(events.every((event) => event.active === 1 && !event.blocked)).toBe(true);
}

describe('generic preview ready publication owns an unlocked actual content frame', () => {
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    it(`${runtime}: synchronous mounted and changed listeners observe ready ancestry, including a subsequent switch`, async () => {
      const { api, tabs, events } = fixture(runtime);
      await vi.waitFor(() => expect(events).toHaveLength(2));
      expectReady(events);
      expect(tabs.inert).toBe(false);
      expect(tabs.getAttribute('aria-busy')).toBe('false');
      const next = runtime === 'react' ? 'vue' : 'react';
      await api.switchRuntime(next);
      expect(events.map(({ name, runtime }) => [name, runtime])).toEqual([
        ['runtime:changed', runtime],
        ['previewer:mounted', runtime],
        ['runtime:changed', next],
      ]);
      expectReady(events);
    });
  }

  for (const outcome of ['resolve', 'reject'] as const) {
    it(`a stale ${outcome} cannot unlock or publish over the pending latest switch`, async () => {
      const { api, tabs, events } = fixture();
      await vi.waitFor(() => expect(events).toHaveLength(2));
      events.length = 0;
      const old = deferred();
      const latest = deferred();
      control.gates.push(old.promise, latest.promise);
      const staleSwitch = api.switchRuntime('react');
      await vi.waitFor(() => expect(control.entered).toBe(2));
      const latestSwitch = api.switchRuntime('vue');
      await vi.waitFor(() => expect(control.entered).toBe(3));
      if (outcome === 'resolve') old.resolve();
      else old.reject(new Error('stale demo load'));
      await staleSwitch;
      expect(tabs.inert).toBe(true);
      expect(tabs.getAttribute('aria-busy')).toBe('true');
      expect(events).toEqual([]);
      latest.resolve();
      await latestSwitch;
      expect(events.map(({ runtime }) => runtime)).toEqual(['vue']);
      expectReady(events);
    });
  }

  it('a current failed switch releases its temporary gate but publishes no ready event', async () => {
    const { root, api, tabs, events } = fixture();
    await vi.waitFor(() => expect(events).toHaveLength(2));
    events.length = 0;
    const failed = deferred();
    control.gates.push(failed.promise);
    const errors = vi.fn();
    root.addEventListener('error', errors);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const switching = api.switchRuntime('react');
    await vi.waitFor(() => expect(control.entered).toBe(2));
    failed.reject(new Error('current demo load'));
    await switching;
    expect(errors).toHaveBeenCalledOnce();
    expect(tabs.inert).toBe(false);
    expect(events).toEqual([]);
    expect(api.getCurrentRuntime()).toBeNull();
  });

  it('destroying a pending switch prevents a late ready publication', async () => {
    const { root, api, events } = fixture();
    await vi.waitFor(() => expect(events).toHaveLength(2));
    events.length = 0;
    const pending = deferred();
    control.gates.push(pending.promise);
    const switching = api.switchRuntime('react');
    await vi.waitFor(() => expect(control.entered).toBe(2));
    await api.destroy();
    pending.resolve();
    await switching;
    expect(events).toEqual([]);
    expect(root.querySelector('[data-runtime-tabs-root]')).toBeNull();
    expect(root.querySelector('.host')!.childNodes).toHaveLength(0);
  });

  it('a throwing ready publication keeps the existing error surface and resolved switch boundary', async () => {
    const { root, api, tabs, events } = fixture();
    await vi.waitFor(() => expect(events).toHaveLength(2));
    events.length = 0;
    const error = new Error('ready publication failed');
    const errors = vi.fn();
    root.addEventListener('error', errors);
    const dispatch = root.dispatchEvent.bind(root);
    vi.spyOn(root, 'dispatchEvent').mockImplementation((event) => {
      if (event.type === 'runtime:changed') throw error;
      return dispatch(event);
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(api.switchRuntime('react')).resolves.toBeUndefined();
    expect(errors).toHaveBeenCalledOnce();
    expect((errors.mock.calls[0][0] as CustomEvent).detail.error).toBe(error);
    expect(root.querySelector('.host pre')?.textContent).toContain('ready publication failed');
    expect(tabs.inert).toBe(false);
    expect(events).toEqual([]);
  });

  it('a synchronous newer switch during first changed delivery suppresses stale mounted publication', async () => {
    let newer: Promise<void> | undefined;
    const pending = deferred();
    const { tabs, events } = fixture('wc', (root) => {
      root.addEventListener('runtime:changed', (event) => {
        if ((event as CustomEvent).detail.id === 'wc') {
          control.gates.push(pending.promise);
          newer = root.__previewer__.switchRuntime('vue');
        }
      });
    });
    await vi.waitFor(() => expect(newer).toBeDefined());
    await vi.waitFor(() => expect(control.entered).toBe(2));
    expect(tabs.inert).toBe(true);
    expect(tabs.getAttribute('aria-busy')).toBe('true');
    expect(events.map(({ name, runtime }) => [name, runtime])).toEqual([['runtime:changed', 'wc']]);
    pending.resolve();
    await newer;
    expect(events.map(({ name, runtime }) => [name, runtime])).toEqual([
      ['runtime:changed', 'wc'],
      ['runtime:changed', 'vue'],
      ['previewer:mounted', 'vue'],
    ]);
    expectReady(events);
  });

  it('synchronous destruction during changed delivery prevents mounted publication', async () => {
    let destroyed: Promise<void> | undefined;
    const { events } = fixture('wc', (root) => {
      root.addEventListener('runtime:changed', () => {
        destroyed = root.__previewer__.destroy();
      });
    });
    await vi.waitFor(() => expect(destroyed).toBeDefined());
    await destroyed;
    expect(events.map(({ name }) => name)).toEqual(['runtime:changed']);
    expectReady(events);
  });
});

// Regression controls contributed by the independent review of the rejected
// unlock-only candidate. HappyDOM needs the UA's inert focus loss simulated;
// restoration still uses the actual Runtime Tab's public focusSelf method.
function emulateInertFocusLoss(tabs: HTMLElement) {
  let inert = tabs.inert;
  Object.defineProperty(tabs, 'inert', {
    configurable: true,
    get: () => inert,
    set(value: boolean) {
      inert = value;
      if (
        value &&
        document.activeElement instanceof HTMLElement &&
        tabs.contains(document.activeElement)
      )
        document.activeElement.blur();
    },
  });
}

it('focus-return reentry suppresses stale ready and preserves the newer gate', async () => {
  const f = fixture();
  await vi.waitFor(() => expect(f.events).toHaveLength(2));
  f.events.length = 0;
  emulateInertFocusLoss(f.tabs);
  const react = f.tabs.querySelector<HTMLElement>('[data-runtime-tab="react"]')!;
  const old = deferred();
  const winner = deferred();
  control.gates.push(old.promise, winner.promise);
  react.focus();
  react.click();
  await vi.waitFor(() => expect(control.entered).toBe(2));
  expect(document.activeElement).toBe(document.body);
  let next: Promise<void> | undefined;
  react.addEventListener(
    'focus',
    () => {
      next = f.api.switchRuntime('vue');
    },
    { once: true }
  );
  old.resolve();
  await vi.waitFor(() => expect(control.entered).toBe(3));
  expect(next).toBeDefined();
  expect(f.tabs.inert).toBe(true);
  expect(f.tabs.getAttribute('aria-busy')).toBe('true');
  expect(f.events).toEqual([]);
  winner.resolve();
  await next;
  expect(f.events.map((e) => [e.name, e.runtime])).toEqual([['runtime:changed', 'vue']]);
  expectReady(f.events);
});

it('error-listener reentry cannot let failed request unlock the newer gate', async () => {
  const f = fixture();
  await vi.waitFor(() => expect(f.events).toHaveLength(2));
  f.events.length = 0;
  const old = deferred();
  const winner = deferred();
  control.gates.push(old.promise, winner.promise);
  let next: Promise<void> | undefined;
  f.root.addEventListener(
    'error',
    () => {
      next = f.api.switchRuntime('vue');
    },
    { once: true }
  );
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const original = f.api.switchRuntime('react');
  await vi.waitFor(() => expect(control.entered).toBe(2));
  old.reject(new Error('intentional load rejection'));
  await original;
  await vi.waitFor(() => expect(control.entered).toBe(3));
  expect(f.tabs.inert).toBe(true);
  expect(f.tabs.getAttribute('aria-busy')).toBe('true');
  expect(f.events).toEqual([]);
  winner.resolve();
  await next;
  expect(f.events.map((e) => e.runtime)).toEqual(['vue']);
  expectReady(f.events);
});

it('reentrant throwing ready dispatch cannot unlock or publish over its winner', async () => {
  const f = fixture();
  await vi.waitFor(() => expect(f.events).toHaveLength(2));
  f.events.length = 0;
  const winner = deferred();
  let next: Promise<void> | undefined;
  const dispatch = f.root.dispatchEvent.bind(f.root);
  vi.spyOn(f.root, 'dispatchEvent').mockImplementation((event) => {
    if (event.type === 'runtime:changed' && (event as CustomEvent).detail.id === 'react') {
      control.gates.push(winner.promise);
      next = f.api.switchRuntime('vue');
      throw new Error('intentional dispatch failure after reentry');
    }
    return dispatch(event);
  });
  await expect(f.api.switchRuntime('react')).resolves.toBeUndefined();
  await vi.waitFor(() => expect(control.entered).toBe(3));
  expect(f.tabs.inert).toBe(true);
  expect(f.tabs.getAttribute('aria-busy')).toBe('true');
  expect(f.events).toEqual([]);
  winner.resolve();
  await next;
  expect(f.events.map((e) => e.runtime)).toEqual(['vue']);
  expectReady(f.events);
});

it('focus-return destruction prevents any stale ready publication', async () => {
  const f = fixture();
  await vi.waitFor(() => expect(f.events).toHaveLength(2));
  f.events.length = 0;
  emulateInertFocusLoss(f.tabs);
  const react = f.tabs.querySelector<HTMLElement>('[data-runtime-tab="react"]')!;
  const gate = deferred();
  control.gates.push(gate.promise);
  react.focus();
  react.click();
  await vi.waitFor(() => expect(control.entered).toBe(2));
  let destroyed: Promise<void> | undefined;
  react.addEventListener(
    'focus',
    () => {
      destroyed = f.api.destroy();
    },
    { once: true }
  );
  gate.resolve();
  await vi.waitFor(() => expect(destroyed).toBeDefined());
  await destroyed;
  expect(f.events).toEqual([]);
  expect(f.root.querySelector('[data-runtime-tabs-root]')).toBeNull();
});
