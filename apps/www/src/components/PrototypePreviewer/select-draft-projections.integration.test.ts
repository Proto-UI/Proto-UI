import { afterEach, describe, expect, it, vi } from 'vitest';
import { initProjectedPreviewer } from './projected-previewer-client';
import { assertDemoSpec, type DemoNode } from './demo-types';
import { PROJECTION_FAMILY_MANIFESTS } from './projection-families';
import { loadPrototype } from './prototype-modules';
import { getPrototype } from './registry';
import bootstrap from '../../content/docs/demo-bootstrap-2-3-2-select.demo';
import glass from '../../content/docs/demo-liquid-glass-select.demo';

// Real composed framework owners; only remote runtime loading is replaced with
// the locked installed version. These checks do not establish native paint.
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
for (const [family, demo] of [
  ['bootstrap-2-3-2', bootstrap],
  ['liquid-glass', glass],
] as const) {
  describe(`${family} complete Select recipe and family toolbar`, () => {
    it('registers each actual part and an independent family acceptance action', async () => {
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = new Set<string>();
      const visit = (node: DemoNode) => {
        if (node.kind === 'text') return;
        if (node.kind === 'proto') ids.add(node.prototypeId);
        for (const child of node.children ?? []) if (typeof child !== 'string') visit(child);
      };
      visit(demo.root);
      expect(ids).toEqual(
        new Set(PROJECTION_FAMILY_MANIFESTS[family].families.select.recipePrototypeIds)
      );
      for (const id of ids) {
        await loadPrototype(id);
        expect(getPrototype(id).name).toBe(id);
      }
    });
    for (const runtime of runtimes) {
      it(`${runtime}: preserves composed selection, controlled requests, disabled state, focus and the real family toolbar`, async () => {
        const root = document.createElement('section');
        root.dataset.previewerId = `select-${family}-${runtime}`;
        root.innerHTML = '<div class="host"></div>';
        document.body.append(root);
        mounted.push(root);
        initProjectedPreviewer({
          root,
          initialRuntime: runtime,
          runtimeList: [...runtimes],
          projectionFamilyId: family,
          componentId: 'select',
          toolbar: true,
        });
        // Cold materialization imports/adapts the complete demo, toolbar and
        // surface before committing ready. Bound that async fixture boundary
        // explicitly; the exact state assertion and 20s case budget are unchanged.
        await vi.waitFor(
          () => expect(root.dataset.projectionState, root.textContent ?? '').toBe('ready'),
          { timeout: 5000 }
        );
        const content = root.querySelector('[data-projection-content]')!;
        const query = (ref: string) =>
          content.querySelector<HTMLElement>(`[data-demo-ref="${ref}"]`)!;
        const trigger = query('uncontrolledTrigger');
        await vi.waitFor(() => expect(trigger.textContent).toContain('Alpha'));
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        trigger.focus();
        trigger.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
        );
        await vi.waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('true'));
        const popup = () => document.getElementById(trigger.getAttribute('aria-controls')!)!;
        await vi.waitFor(() => {
          expect(document.activeElement?.getAttribute('role')).toBe('option');
          expect(document.activeElement?.textContent).toBe('Alpha');
        });
        await vi.waitFor(() => expect(popup()?.getAttribute('role')).toBe('listbox'));
        document.activeElement?.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
        );
        await vi.waitFor(() => expect(document.activeElement?.textContent).toBe('Beta'));
        expect(trigger.textContent).toContain('Alpha');
        document.activeElement?.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
        );
        await vi.waitFor(() => expect(trigger.textContent).toContain('Beta'));
        await vi.waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'));
        expect(document.activeElement).toBe(trigger);
        const disabled = query('disabledTrigger');
        expect(disabled.getAttribute('aria-disabled')).toBe('true');
        disabled.click();
        expect(disabled.getAttribute('aria-expanded')).toBe('false');
        const controlled = query('controlledTrigger');
        controlled.click();
        await vi.waitFor(() => expect(controlled.getAttribute('aria-expanded')).toBe('true'));
        await vi.waitFor(() =>
          expect(
            document.getElementById(controlled.getAttribute('aria-controls')!)?.getAttribute('role')
          ).toBe('listbox')
        );
        const controlledPopup = document.getElementById(controlled.getAttribute('aria-controls')!)!;
        const beta = Array.from(
          controlledPopup.querySelectorAll<HTMLElement>('[role="option"]')
        ).find((item) => item.textContent === 'Beta')!;
        beta.click();
        await vi.waitFor(() =>
          expect(query('requestStatus').textContent).toContain('Requested Beta')
        );
        expect(controlled.textContent).toContain('Alpha');
        query('accept').click();
        await vi.waitFor(() => expect(controlled.textContent).toContain('Beta'));
        expect(query('rtlTrigger').textContent).toContain('VeryLongUnbrokenOptionLabels');
        const toolbar = root.querySelector<HTMLElement>('[data-projection-control="runtime"]')!;
        expect(toolbar).not.toBeNull();
        const controlIds = Array.from(toolbar.querySelectorAll('[data-projection-prototype]')).map(
          (node) => node.getAttribute('data-projection-prototype')
        );
        expect(controlIds.some((id) => id?.startsWith(`${family}-select-`))).toBe(true);
      }, 20_000);
    }
  });
}
