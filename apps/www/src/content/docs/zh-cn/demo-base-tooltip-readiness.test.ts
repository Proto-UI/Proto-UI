// @vitest-environment happy-dom
import type { Page } from 'playwright-core';
import { afterEach, expect, it, vi } from 'vitest';
import { waitForPreviewRuntime } from './browser-harness';

// Real installed website frameworks and Adapter implementations; only the
// module loaders are redirected. No runtime/fiber/ownership marker is injected.
vi.mock('../../../components/PrototypePreviewer/runtimes/react-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/apps/www/package.json');
  return {
    loadReact: async () => ({
      React: require('react'),
      ReactDOM: { ...require('react-dom'), ...require('react-dom/client') },
    }),
  };
});
vi.mock('../../../components/PrototypePreviewer/runtimes/vue-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/apps/www/package.json');
  return { loadVue: async () => require('vue') };
});
vi.mock('../../../components/PrototypePreviewer/runtimes/vue2-runtime', async (original) => {
  const current =
    await original<typeof import('../../../components/PrototypePreviewer/runtimes/vue2-runtime')>();
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/apps/www/package.json');
  return { ...current, loadVue2: async () => require('vue2-runtime') };
});

const cleanup: Array<() => void | Promise<void>> = [];
afterEach(async () => {
  for (const destroy of cleanup.splice(0)) await destroy();
  document.body.replaceChildren();
  localStorage.clear();
});

it.each(['wc', 'react', 'vue', 'vue2'] as const)(
  '%s: real Tooltip entry readiness observes its two current focus subjects',
  async (runtime) => {
    const { initPreviewer } =
      await import('../../../components/PrototypePreviewer/previewer-client');
    const { SHADCN_THEME_CSS } = await import('../../../../../../packages/cli/src/legacy/type');
    const { renderPrefixedThemeCss } =
      await import('../../../../../../packages/cli/src/services/proto-style-css');
    const root = document.createElement('section');
    root.dataset.previewerId = `tooltip-readiness-${runtime}`;
    root.innerHTML =
      '<div data-runtime-tabs-mount></div><div data-panel="preview"><div class="host"></div></div>';
    const host = root.querySelector<HTMLElement>('.host')!;
    for (const match of renderPrefixedThemeCss(SHADCN_THEME_CSS)
      .split('}')[0]!
      .matchAll(/(--pui-[\w-]+):\s*([^;]+);/g)) {
      root.style.setProperty(match[1]!, match[2]!);
      host.style.setProperty(match[1]!, match[2]!);
    }
    document.body.append(root);
    cleanup.push(() => (root as any).__previewer__?.destroy());
    initPreviewer({
      root,
      demoId: 'demo-base-tooltip',
      initialRuntime: runtime,
      runtimeList: ['wc', 'react', 'vue', 'vue2'],
      demoProps: {},
    });

    let observed: boolean | undefined;
    const page = {
      locator: (selector: string) => ({
        first: () => ({
          getAttribute: async (name: string) =>
            document.querySelector(selector)?.getAttribute(name) ?? null,
        }),
      }),
      // Execute the unchanged browser predicate against the actual producer.
      // This is a DOM control, not native timing, input or AX acceptance.
      waitForFunction: async (
        predicate: (args: unknown) => boolean,
        args: unknown,
        options: unknown
      ) => {
        expect(options).toEqual({ timeout: 20_000 });
        observed = predicate(args);
      },
    } as unknown as Page;
    const ready = async (selector = '[data-pui-root][tabindex="0"]', count = 2) => {
      await waitForPreviewRuntime(page, runtime, selector, count);
      return observed;
    };
    await vi.waitFor(async () => expect(await ready()).toBe(true), { timeout: 10_000 });
    const surface = root.querySelector<HTMLElement>('.pui-runtime-preview-surface')!;
    const triggers = Array.from(
      surface.querySelectorAll<HTMLElement>('[data-pui-root][tabindex="0"]')
    );
    expect(triggers.map((trigger) => trigger.textContent)).toEqual(['Account', 'Notifications']);
    expect((root as any).__previewer__.getCurrentRuntime()).toBe(runtime);
    expect(surface.isConnected).toBe(true);

    for (const trigger of triggers) {
      trigger.focus();
      expect(document.activeElement).toBe(trigger);
      expect(await ready()).toBe(true);
    }
    triggers[1]!.blur();

    // A broad marker count is not the caller's focus-subject readiness contract.
    // Retained closed React Content hosts may still carry physical markers.
    if (runtime === 'react') {
      expect(surface.querySelectorAll('[data-pui-root]')).toHaveLength(7);
      const currentTabIndex = triggers[0].tabIndex;
      triggers[0].tabIndex = -1;
      try {
        expect(await ready('[data-pui-root]', 7)).toBe(true);
        expect(await ready()).toBe(false);
      } finally {
        triggers[0].tabIndex = currentTabIndex;
      }
    }

    const first = triggers[0]!;
    const parent = first.parentNode!;
    const next = first.nextSibling;
    first.remove();
    expect(await ready()).toBe(false);
    parent.insertBefore(first, next);
    await vi.waitFor(async () => expect(await ready()).toBe(true), { timeout: 10_000 });

    // An extra copied-looking focus subject cannot substitute for exact anatomy.
    const extra = document.createElement('div');
    extra.setAttribute('data-pui-root', '');
    extra.tabIndex = 0;
    extra.textContent = 'Account';
    surface.append(extra);
    expect(await ready()).toBe(false);
    extra.remove();
    expect(await ready()).toBe(true);

    host.inert = true;
    expect(await ready()).toBe(false);
    host.inert = false;
    expect(await ready()).toBe(true);
  },
  20_000
);
