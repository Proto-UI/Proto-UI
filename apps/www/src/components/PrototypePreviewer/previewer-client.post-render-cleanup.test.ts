import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DemoSpec } from './demo-types';
import type { RuntimeId } from './runtimes/registry';

const control = vi.hoisted(() => ({
  gate: Promise.resolve(),
  committed: vi.fn(),
  destroy: vi.fn(),
  failTheme: false,
  failLoad: false,
  demo: null as DemoSpec | null,
}));

// Use the installed frameworks and real renderer/host leases. Only the CDN
// entry and the bounded fault/gate are replaced; this is not browser evidence.
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
vi.mock('./demo-modules', () => ({ loadDemo: async () => control.demo }));
vi.mock('./prototype-modules', async (original) => {
  const current = await original<typeof import('./prototype-modules')>();
  return {
    ...current,
    loadPrototypes: async (ids: string[]) => {
      if (control.failLoad && ids.includes('brutalist-surface-root'))
        throw new Error('post-render surface load failed');
      return current.loadPrototypes(ids);
    },
  };
});
vi.mock('./projection-theme', async (original) => {
  const current = await original<typeof import('./projection-theme')>();
  return {
    ...current,
    resolveProjectionThemeSurfaceStyle: (
      ...args: Parameters<typeof current.resolveProjectionThemeSurfaceStyle>
    ) => {
      if (control.failTheme && args[0] === 'brutalist') throw new Error('post-render theme failed');
      return current.resolveProjectionThemeSurfaceStyle(...args);
    },
  };
});
vi.mock('./demo-renderer', async (original) => {
  const current = await original<typeof import('./demo-renderer')>();
  return {
    ...current,
    renderDemo: async (options: Parameters<typeof current.renderDemo>[0]) => {
      const result = await current.renderDemo(options);
      if (
        options.demo.root.kind !== 'box' ||
        options.demo.root.className !== 'pui-runtime-preview-composition'
      )
        return result;
      control.committed(options.runtime);
      await control.gate;
      return {
        destroy: async () => {
          control.destroy(options.runtime);
          await result.destroy();
        },
      };
    },
  };
});

import { initPreviewer } from './previewer-client';
import { WEBSITE_SHADCN_THEME_TOKENS } from './projection-theme';
import { isPreviewErrorSurface, previewErrorKind } from './preview-error-surface';

type PreviewerHandle = { destroy(): Promise<void>; getCurrentRuntime(): string | null };
const roots: Array<HTMLElement & { __previewer__?: PreviewerHandle }> = [];

beforeEach(() => {
  control.gate = Promise.resolve();
  control.committed.mockClear();
  control.destroy.mockClear();
  control.failTheme = false;
  control.failLoad = false;
  localStorage.clear();
  for (const token of WEBSITE_SHADCN_THEME_TOKENS)
    document.documentElement.style.setProperty(
      `--pui-${token}`,
      token.startsWith('radius') ? '4px' : '#ffffff'
    );
});
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await root.__previewer__?.destroy();
    root.remove();
  }
  for (const token of WEBSITE_SHADCN_THEME_TOKENS)
    document.documentElement.style.removeProperty(`--pui-${token}`);
  vi.restoreAllMocks();
});

describe('generic preview post-render preparation cleanup', () => {
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as RuntimeId[]) {
    for (const fault of ['theme', 'surface-load'] as const) {
      it(`${runtime}: releases the real mounted demo when latest-family ${fault} fails`, async () => {
        const cleanup = vi.fn();
        const listener = vi.fn();
        control.demo = {
          type: 'demo',
          root: { kind: 'box', children: ['Retained demo content'] },
          setup() {
            window.addEventListener('preview-cleanup-probe', listener);
            return () => {
              window.removeEventListener('preview-cleanup-probe', listener);
              cleanup();
            };
          },
        };
        let release!: () => void;
        control.gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        const root = document.createElement('div') as (typeof roots)[number];
        root.dataset.siteLibraryFamily = 'shadcn';
        for (const token of WEBSITE_SHADCN_THEME_TOKENS)
          root.style.setProperty(`--pui-${token}`, token.startsWith('radius') ? '4px' : '#ffffff');
        root.innerHTML = '<select></select><div class="host"></div>';
        document.body.append(root);
        roots.push(root);
        const errors = vi.fn();
        const published = vi.fn();
        root.addEventListener('error', errors);
        root.addEventListener('runtime:changed', published);
        vi.spyOn(console, 'error').mockImplementation(() => {});
        initPreviewer({
          root,
          demoId: 'post-render-cleanup-fixture',
          initialRuntime: runtime,
          demoProps: {},
          runtimeList: [runtime],
        });
        await vi.waitFor(() =>
          expect(
            control.committed.mock.calls,
            root.querySelector('.host')?.textContent ?? ''
          ).toContainEqual([runtime])
        );
        await vi.waitFor(() =>
          expect(root.querySelector('.pui-runtime-preview-surface')).not.toBeNull()
        );
        expect(cleanup).not.toHaveBeenCalled();
        window.dispatchEvent(new Event('preview-cleanup-probe'));
        expect(listener).toHaveBeenCalledTimes(1);
        root.dataset.siteLibraryFamily = 'brutalist';
        control.failTheme = fault === 'theme';
        control.failLoad = fault === 'surface-load';
        release();
        await vi.waitFor(() =>
          expect(isPreviewErrorSurface(root.querySelector('.host'))).toBe(true)
        );
        expect(previewErrorKind(root.querySelector('.host'))).toBe('error');
        expect(errors).toHaveBeenCalledOnce();
        expect(published).not.toHaveBeenCalled();
        expect(root.__previewer__?.getCurrentRuntime()).toBeNull();
        window.dispatchEvent(new Event('preview-cleanup-probe'));
        expect({
          destroyCalls: control.destroy.mock.calls.length,
          setupCleanupCalls: cleanup.mock.calls.length,
          listenerCallsAfterFailure: listener.mock.calls.length,
        }).toEqual({ destroyCalls: 1, setupCleanupCalls: 1, listenerCallsAfterFailure: 1 });
        expect(control.destroy).toHaveBeenCalledWith(runtime);
        expect(root.querySelector('[data-v-app]')).toBeNull();
        expect(root.querySelector('.pui-runtime-preview-surface')).toBeNull();
        await root.__previewer__?.destroy();
        expect(control.destroy).toHaveBeenCalledOnce();
        expect(cleanup).toHaveBeenCalledOnce();
      });
    }
  }
});
