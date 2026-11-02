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
const runtimeLabels = { wc: 'Web Components', react: 'React', vue: 'Vue', vue2: 'Vue 2' };
type Runtime = (typeof runtimes)[number];
type Previewer = HTMLElement & {
  __previewer__?: { getCurrentRuntime?: () => string | null };
};

function expectRuntimeToolbar(root: Previewer, family: string, runtime: Runtime) {
  const roots = root.querySelectorAll<HTMLElement>(
    `[data-projection-scope][data-projection-state="ready"] [data-projection-prototype="${family}-tabs-root"]`
  );
  expect(roots).toHaveLength(1);
  const toolbar = root.querySelectorAll<HTMLElement>('[data-projection-control="runtime"]');
  expect(toolbar).toHaveLength(1);
  expect(
    roots[0]!.querySelectorAll('[data-projection-control="runtime"][data-runtime-tabs]')
  ).toHaveLength(1);
  expect(toolbar[0]!.querySelectorAll('[role="tablist"][aria-label="Runtime"]')).toHaveLength(1);
  expect(
    toolbar[0]!.querySelectorAll(`[data-projection-prototype="${family}-tabs-list"]`)
  ).toHaveLength(1);
  const tabs = toolbar[0]!.querySelectorAll<HTMLElement>('[role="tab"]');
  expect(tabs).toHaveLength(runtimes.length);
  const selected = toolbar[0]!.querySelectorAll<HTMLElement>('[role="tab"][aria-selected="true"]');
  expect(selected).toHaveLength(1);
  expect(selected[0]!.dataset.projectionPrototype).toBe(`${family}-tabs-trigger`);
  expect(selected[0]!.dataset.projectionRuntime).toBe(runtime);
  expect(selected[0]!.textContent?.trim()).toBe(runtimeLabels[runtime]);
  const panelId = selected[0]!.getAttribute('aria-controls');
  expect(panelId).toBeTruthy();
  const panels = roots[0]!.querySelectorAll<HTMLElement>(`[id=${JSON.stringify(panelId)}]`);
  expect(panels).toHaveLength(1);
  const panel = panels[0]!;
  expect(panel.getAttribute('role')).toBe('tabpanel');
  expect(panel.dataset.projectionPrototype).toBe(`${family}-tabs-content`);
  expect(panel.getAttribute('aria-labelledby')).toBe(selected[0]!.id);
  // P-BASE-TABS-CONTENT: a linked retained panel is not necessarily current.
  // Emulated DOM proves eligibility only; native coverage checks visibility too.
  expect(panel.isConnected).toBe(true);
  for (let node: HTMLElement | null = panel; node; node = node.parentElement) {
    expect(node.matches('[hidden], [inert], [aria-hidden="true"], [aria-busy="true"]')).toBe(false);
    expect(Boolean(node.inert)).toBe(false);
    const style = getComputedStyle(node);
    expect(style.display).not.toBe('none');
    expect(['hidden', 'collapse']).not.toContain(style.visibility);
  }
  expect(root.querySelectorAll('.pui-runtime-preview-surface')).toHaveLength(1);
  expect(panel.querySelectorAll('.pui-runtime-preview-surface')).toHaveLength(1);
  expect(panel.querySelectorAll('[data-projection-content]')).toHaveLength(1);
  expect(root.__previewer__?.getCurrentRuntime?.()).toBe(runtime);
  return { selected: selected[0]!, tabs, panel };
}

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
          { timeout: 8000 }
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
        const initial = expectRuntimeToolbar(root, family, runtime);
        const next = runtime === 'react' ? 'vue' : 'react';
        const nextTab = [...initial.tabs].find((tab) => tab.textContent === runtimeLabels[next])!;
        nextTab.click();
        // Switching the runtime crosses the same cold boundary: it loads
        // another adapter and re-materializes the complete family demo before
        // it can commit ready.
        await vi.waitFor(
          () => {
            expect(root.dataset.projectionState).toBe('ready');
            expect(root.dataset.projectionRuntime).toBe(next);
          },
          { timeout: 8000 }
        );
        const current = expectRuntimeToolbar(root, family, next);

        // These are deliberate negative mutations of the real adapter DOM/API,
        // restored synchronously; none supplies the positive fixture's identity.
        const rejectAttribute = (node: HTMLElement, name: string, value: string) => {
          const previous = node.getAttribute(name);
          try {
            node.setAttribute(name, value);
            expect(() => expectRuntimeToolbar(root, family, next)).toThrow();
          } finally {
            if (previous === null) node.removeAttribute(name);
            else node.setAttribute(name, previous);
          }
        };
        // A matching relationship is insufficient when the panel or an ancestor
        // is hidden/locked. These are DOM/CSS eligibility controls, not pixel proof.
        for (const node of [current.panel, current.panel.parentElement!]) {
          rejectAttribute(node, 'aria-hidden', 'true');
          rejectAttribute(node, 'hidden', '');
          rejectAttribute(node, 'inert', '');
          rejectAttribute(node, 'aria-busy', 'true');
          rejectAttribute(node, 'style', 'display: none');
          rejectAttribute(node, 'style', 'visibility: hidden');
        }
        rejectAttribute(current.selected, 'aria-selected', 'false');
        rejectAttribute(
          [...current.tabs].find((tab) => tab !== current.selected)!,
          'aria-selected',
          'true'
        );
        rejectAttribute(current.selected, 'data-projection-prototype', 'unrelated-tabs-trigger');
        rejectAttribute(current.selected, 'data-projection-runtime', 'uncommitted');
        rejectAttribute(current.selected, 'aria-controls', 'missing-runtime-panel');
        const surface = current.panel.querySelector<HTMLElement>('.pui-runtime-preview-surface')!;
        rejectAttribute(surface, 'class', 'not-the-runtime-surface');
        const duplicateSurface = document.createElement('div');
        duplicateSurface.className = 'pui-runtime-preview-surface';
        current.panel.append(duplicateSurface);
        try {
          expect(() => expectRuntimeToolbar(root, family, next)).toThrow();
        } finally {
          duplicateSurface.remove();
        }
        const previewer = root as Previewer;
        const controller = previewer.__previewer__;
        try {
          for (const invalid of [
            undefined,
            {},
            { getCurrentRuntime: () => null },
            { getCurrentRuntime: () => runtime },
          ]) {
            previewer.__previewer__ = invalid;
            expect(() => expectRuntimeToolbar(root, family, next)).toThrow();
          }
        } finally {
          previewer.__previewer__ = controller;
        }
        expectRuntimeToolbar(root, family, next);
      }, 20_000);
    }
  });
}
