import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initProjectedPreviewer } from './projected-previewer-client';
import { PREFERRED_ADAPTER_EVENT } from '../adapter-preference';

// Real framework adapters and public DemoSpecs; substitute installed versions
// only for the network CDN loader. This is a synthetic-DOM consumer check.
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
const mounted: HTMLElement[] = [];
afterEach(async () => {
  for (const root of mounted.splice(0)) await (root as any).__previewer__?.destroy();
  document.body.replaceChildren();
  localStorage.clear();
});
const runtimes = ['wc', 'react', 'vue', 'vue2'] as const;
for (const family of ['bootstrap-2-3-2', 'liquid-glass'] as const) {
  describe(`${family} public Collapsible with its actual family Select`, () => {
    it('both locale pages expose the implemented family Select toolbar', () => {
      for (const language of ['en', 'zh-cn']) {
        const page = readFileSync(
          path.resolve(
            `apps/www/src/content/docs/${language}/ui-libraries/${family}/collapsible.mdx`
          ),
          'utf8'
        );
        expect(page).toContain('toolbar={true}');
        expect(page).toContain(`demo-${family}-collapsible`);
      }
    });
    for (const [index, runtime] of runtimes.entries()) {
      it(`${runtime}: mounts actual parts and accepts the existing document preference event`, async () => {
        const root = document.createElement('section');
        root.dataset.previewerId = `${family}-${runtime}`;
        root.innerHTML = '<div class="host"></div>';
        document.body.append(root);
        mounted.push(root);
        initProjectedPreviewer({
          root,
          initialRuntime: runtime,
          runtimeList: [...runtimes],
          projectionFamilyId: family,
          componentId: 'collapsible',
          toolbar: true,
        });
        await vi.waitFor(
          () => expect(root.dataset.projectionState, root.textContent ?? '').toBe('ready'),
          { timeout: 5000 }
        );
        expect(root.dataset.projectionRuntime).toBe(runtime);
        expect(root.querySelector('[data-projection-control="runtime"]')).not.toBeNull();
        const disclosure = root.querySelector('[data-demo-ref="uncontrolled"]')!;
        const trigger = disclosure.querySelector<HTMLElement>('[role="button"]')!;
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        trigger.click();
        await vi.waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('true'));
        const next = runtimes[(index + 1) % runtimes.length]!;
        document.dispatchEvent(
          new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: next } })
        );
        await vi.waitFor(() => {
          expect(root.dataset.projectionState).toBe('ready');
          expect(root.dataset.projectionRuntime).toBe(next);
        }, { timeout: 5000 });
        expect(trigger.isConnected).toBe(false);
        expect(
          root
            .querySelector('[data-demo-ref="uncontrolled"] [role="button"]')
            ?.getAttribute('aria-expanded')
        ).toBe('false');
      });
    }
  });
}
