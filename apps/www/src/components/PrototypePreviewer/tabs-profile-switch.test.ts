import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { renderDemo } from './demo-renderer';
import { collectPrototypeIds, type DemoSetupContext } from './demo-types';
import { loadPrototypes } from './prototype-modules';
import demo from '../../content/docs/demo_components/tabs/demo-shadcn-tabs-profile-switch.demo';
import { normalizeShadcnStyle } from '@proto.ui/prototypes-shadcn/style-scope';

// Replace only network framework acquisition with each Adapter's pinned dependency.
vi.mock('./runtimes/react-runtime', async (original) => {
  const actual = await original<typeof import('./runtimes/react-runtime')>();
  const { createRequire } = await import('node:module');
  const { resolve } = await import('node:path');
  const require = createRequire(resolve('packages/adapters/react/package.json'));
  return {
    ...actual,
    loadReact: async () => ({
      React: require('react'),
      ReactDOM: { ...require('react-dom'), ...require('react-dom/client') },
    }),
  };
});
vi.mock('./runtimes/vue-runtime', async (original) => {
  const actual = await original<typeof import('./runtimes/vue-runtime')>();
  const { createRequire } = await import('node:module');
  const { resolve } = await import('node:path');
  const require = createRequire(resolve('packages/adapters/vue/package.json'));
  return { ...actual, loadVue: async () => require('vue') };
});
vi.mock('./runtimes/vue2-runtime', async (original) => {
  const actual = await original<typeof import('./runtimes/vue2-runtime')>();
  const { createRequire } = await import('node:module');
  const { resolve } = await import('node:path');
  const require = createRequire(resolve('packages/adapters/vue2/package.json'));
  return { ...actual, loadVue2: async () => require('vue') };
});

const views: Array<Awaited<ReturnType<typeof renderDemo>>> = [];
beforeAll(async () => {
  const ids = new Set<string>();
  collectPrototypeIds(demo.root, ids);
  await loadPrototypes([...ids]);
}, 20_000);
afterEach(async () => {
  for (const view of views.splice(0).reverse()) await view.destroy();
  document.body.replaceChildren();
});
for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
  it(`${runtime}: switches a live profile without resetting selected value, focus, handles or children`, async () => {
    const host = document.createElement('div');
    document.body.append(host);
    let context!: DemoSetupContext;
    const view = await renderDemo({
      runtime,
      host,
      demo: {
        ...demo,
        setup(ctx) {
          context = ctx;
          return demo.setup?.(ctx);
        },
      },
    });
    views.push(view);
    const { api, refs } = context;
    const tab = refs.passwordTab;
    tab.click();
    await vi.waitFor(() => expect(api.call('tabs', 'value.get')).toBe('password'));
    api.call('passwordTab', 'focusSelf');
    await vi.waitFor(() => expect(document.activeElement).toBe(tab));
    await vi.waitFor(() => expect(refs.passwordContent).toBeInstanceOf(HTMLElement));
    await vi.waitFor(() => expect(host.contains(refs.passwordContent)).toBe(true));
    const value = api.getExposes('tabs')!.value;
    const selected = api.getExposes('passwordTab')!.selected;
    const instance = api.getPublicInstance?.('tabs');
    const text = tab.firstChild;
    const content = refs.passwordContent;
    let changes = 0;
    const handle = value as { subscribe(fn: () => void): unknown; unsubscribe(id: unknown): void };
    const off = handle.subscribe(() => changes++);
    for (const [key, profile, radius] of [
      ['1', 'nova', 'rounded-md'],
      ['2', 'rhea', 'rounded-2xl'],
      ['3', 'new-york-v4', 'rounded-md'],
      ['1', 'nova', 'rounded-md'],
    ]) {
      tab.dispatchEvent(
        new KeyboardEvent('keydown', { key, altKey: true, bubbles: true, cancelable: true })
      );
      await vi.waitFor(() =>
        expect(tab.getAttribute('data-pui-style')?.split(/\s+/)).toContain(radius)
      );
      expect(refs.profileStatus.textContent).toBe(`Profile: ${profile}`);
      expect(api.call('tabs', 'value.get')).toBe('password');
      expect(api.call('passwordTab', 'selected.get')).toBe(true);
      expect(api.getExposes('tabs')!.value).toBe(value);
      expect(api.getExposes('passwordTab')!.selected).toBe(selected);
      expect(api.getPublicInstance?.('tabs')).toBe(instance);
      expect(document.activeElement).toBe(tab);
      expect(tab.firstChild).toBe(text);
      expect(refs.passwordContent).toBe(content);
      expect(host.contains(content)).toBe(true);
      expect(api.call('billingTab', 'disabled.get')).toBe(true);
    }
    expect(changes).toBe(0);
    handle.unsubscribe(off);
    // Normal activation still works after the visual-only transitions.
    refs.accountTab.click();
    await vi.waitFor(() => expect(api.call('tabs', 'value.get')).toBe('account'));
    refs['profile-rhea'].click();
    await vi.waitFor(() => expect(refs.profileStatus.textContent).toBe('Profile: rhea'));
    // A retired demo removes its shortcut and cannot publish a late profile change.
    const statusNode = refs.profileStatus;
    const status = statusNode.textContent;
    await view.destroy();
    host.dispatchEvent(new KeyboardEvent('keydown', { key: '1', altKey: true, bubbles: true }));
    expect(statusNode.textContent).toBe(status);
  }, 20_000);
  it(`${runtime}: rejects an unknown profile at the real host boundary`, async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const failures: unknown[] = [];
    const originalError = console.error;
    const error = vi.spyOn(console, 'error').mockImplementation((...args) => {
      failures.push(...args);
      originalError(...args);
    });
    try {
      const view = await renderDemo({
        runtime,
        host,
        demo: {
          type: 'demo',
          root: {
            kind: 'proto',
            prototypeId: 'shadcn-style-scope',
            props: { styleProfile: 'unknown-profile' },
            children: [demo.root],
          },
        },
      }).catch((failure) => {
        failures.push(failure);
        return null;
      });
      if (view) views.push(view);
      // React and Vue2 report setup failures through their framework channel;
      // WC and Vue reject mounting. Neither may substitute a supported recipe.
      await vi.waitFor(() => expect(failures.map(String).join('\n')).toContain('Unknown style'));
      expect(host.querySelector('[role="tab"]')).toBeNull();
    } finally {
      error.mockRestore();
    }
  }, 20_000);
}
it('rejects unknown profiles rather than borrowing a supported recipe', () => {
  expect(() => normalizeShadcnStyle('unknown-profile')).toThrow('Unknown style');
  expect(normalizeShadcnStyle('new-york')).toBe('new-york-v4');
});
