// @vitest-environment happy-dom
// Execute the suite's readiness predicate against real, locked-dependency adapters.
// This emulated DOM check does not import/run the native-browser suite or prove paint.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initPreviewer } from '../../../components/PrototypePreviewer/previewer-client';
import { initProjectedPreviewer } from '../../../components/PrototypePreviewer/projected-previewer-client';
import { SHADCN_THEME_CSS } from '../../../../../../packages/cli/src/legacy/type';
import { renderPrefixedThemeCss } from '../../../../../../packages/cli/src/services/proto-style-css';

// Match the existing projected-previewer-shell integration harness. Only asset
// loaders are replaced by the repository's installed versions; no runtime facts
// or React/Vue ownership markers are injected into the DOM.
vi.mock('../../../components/PrototypePreviewer/runtimes/react-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/react/package.json');
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
  const require = createRequire(process.cwd() + '/packages/adapters/vue2/package.json');
  return { ...current, loadVue2: async () => require('vue') };
});

const filename = 'apps/www/src/content/docs/zh-cn/finf-representative-features.browser.test.ts';
const source = ts.createSourceFile(
  filename,
  readFileSync(filename, 'utf8'),
  ts.ScriptTarget.Latest,
  true
);
const predicate = source.statements.find(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'inspectRuntime'
)!;
const inspectRuntime = vm.runInNewContext(
  transformSync(`${predicate.getText(source)}; inspectRuntime;`, { loader: 'ts' }).code,
  { getComputedStyle }
);
const roots: HTMLElement[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await (root as any).__previewer__?.destroy();
  document.body.replaceChildren();
  localStorage.clear();
});

for (const shell of ['generic', 'fixed-family'] as const) {
  describe(`${shell} suite readiness with actual adapters`, () => {
    it.each(['wc', 'react', 'vue', 'vue2'] as const)(
      '%s has a selected live shell, real framework and original controls',
      async (runtime) => {
        const root = document.createElement('section');
        root.dataset.previewerId = `finf-${shell}-${runtime}`;
        if (shell === 'fixed-family') root.dataset.projectionMode = shell;
        root.innerHTML =
          shell === 'generic'
            ? '<div data-runtime-tabs-mount></div><div data-panel="preview"><div class="host"><div class="proto-previewer__skeleton" role="status">Loading</div></div></div>'
            : '<div class="host"></div>';
        // HappyDOM does not inherit custom properties through this fixture tree.
        for (const match of renderPrefixedThemeCss(SHADCN_THEME_CSS)
          .split('}')[0]!
          .matchAll(/(--pui-[\w-]+):\s*([^;]+);/g)) {
          root.style.setProperty(match[1]!, match[2]!);
          root.querySelector<HTMLElement>('.host')!.style.setProperty(match[1]!, match[2]!);
        }
        document.body.append(root);
        roots.push(root);
        if (shell === 'generic')
          initPreviewer({
            root,
            demoId: 'demo-shadcn-form',
            initialRuntime: runtime,
            runtimeList: ['wc', 'react', 'vue', 'vue2'],
            demoProps: {},
          });
        else
          initProjectedPreviewer({
            root,
            initialRuntime: runtime,
            runtimeList: ['wc', 'react', 'vue', 'vue2'],
            projectionFamilyId: 'shadcn',
            componentId: 'accordion',
            toolbar: true,
          });
        const labels = { wc: 'Web Components', react: 'React', vue: 'Vue', vue2: 'Vue 2' };
        const readySelector =
          shell === 'generic' ? '[data-demo-ref="form"]' : '[data-demo-ref="single"]';
        const observe = () =>
          inspectRuntime(root, { runtime, label: labels[runtime], readySelector, count: 1 });
        await vi.waitFor(
          () =>
            expect(observe()).toMatchObject({
              ready: true,
              framework: runtime,
              shell,
              targetCount: 1,
            }),
          { timeout: 10_000 }
        );
        // A matching real framework cannot hide a runtime mismatch or host lock.
        expect(
          inspectRuntime(root, {
            runtime: runtime === 'react' ? 'wc' : 'react',
            label: runtime === 'react' ? labels.wc : labels.react,
            readySelector,
            count: 1,
          }).ready
        ).toBe(false);
        root.querySelector<HTMLElement>('.host')!.inert = true;
        expect(observe().ready).toBe(false);
        root.querySelector<HTMLElement>('.host')!.inert = false;
        if (shell === 'generic') {
          const next =
            runtime === 'wc'
              ? 'react'
              : runtime === 'react'
                ? 'vue'
                : runtime === 'vue'
                  ? 'vue2'
                  : 'wc';
          const oldSurface = root.querySelector('.pui-runtime-preview-surface')!;
          const events: string[] = [];
          const listener = (event: Event) => {
            if (event.target === root)
              events.push((event as CustomEvent<{ id: string }>).detail.id);
          };
          root.addEventListener('runtime:changed', listener);
          try {
            // Emulated DOM click only. The official suite retains real browser
            // pointer/keyboard input, focus and geometry assertions.
            root.querySelector<HTMLElement>(`[data-runtime-tab="${next}"]`)!.click();
            await vi.waitFor(
              () =>
                expect(
                  inspectRuntime(root, {
                    runtime: next,
                    label: labels[next],
                    readySelector,
                    count: 1,
                  })
                ).toMatchObject({ ready: true, framework: next }),
              { timeout: 10_000 }
            );
            expect(events).toEqual([next]);
            expect(oldSurface.isConnected).toBe(false);
            expect(root.querySelectorAll('.pui-runtime-preview-surface')).toHaveLength(1);
            expect(root.querySelector('.pui-runtime-preview-surface')).not.toBe(oldSurface);
          } finally {
            root.removeEventListener('runtime:changed', listener);
          }
        }
      },
      20_000
    );
  });
}
