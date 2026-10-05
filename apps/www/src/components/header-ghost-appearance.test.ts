import { afterEach, expect, it, vi } from 'vitest';
import { createProjectionComposition } from './PrototypePreviewer/projection-composition';
import { loadPrototypes } from './PrototypePreviewer/prototype-modules';
import { renderDemo } from './PrototypePreviewer/demo-renderer';
import { initSiteHeaderDisclosure, type SiteHeaderDisclosure } from './site-header-disclosure';

// Real installed runtimes and adapters; only CDN loading is replaced in Happy DOM.
vi.mock('./PrototypePreviewer/runtimes/react-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/react/package.json');
  return {
    loadReact: async () => ({
      React: require('react'),
      ReactDOM: { ...require('react-dom'), ...require('react-dom/client') },
    }),
  };
});
vi.mock('./PrototypePreviewer/runtimes/vue-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/apps/www/package.json');
  return { loadVue: async () => require('vue') };
});
vi.mock('./PrototypePreviewer/runtimes/vue2-runtime', async (original) => {
  const actual = await original<typeof import('./PrototypePreviewer/runtimes/vue2-runtime')>();
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/vue2/package.json');
  return { ...actual, loadVue2: async () => require('vue') };
});

let rendered: Awaited<ReturnType<typeof renderDemo>> | undefined;
let disclosure: SiteHeaderDisclosure | undefined;
afterEach(async () => {
  disclosure?.destroy();
  disclosure = undefined;
  await rendered?.destroy();
  rendered = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

for (const family of ['shadcn', 'brutalist'] as const)
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    it(`${family}/${runtime}: retains family-specific Header props and the same Select owners through Header moves, locks and theme updates`, async () => {
      const compact = Object.assign(new EventTarget(), { matches: false });
      vi.spyOn(window, 'matchMedia').mockReturnValue(compact as MediaQueryList);
      document.body.innerHTML = `<header data-site-header><div data-site-header-context><div data-site-header-preferences><div id="mount"></div></div></div><div data-site-header-panel><div data-site-header-compact-context></div></div><button id="menu">Navigation</button></header>`;
      const header = document.querySelector<HTMLElement>('header')!;
      const preferences = header.querySelector<HTMLElement>('[data-site-header-preferences]')!;
      const host = document.getElementById('mount')!;
      const composition = createProjectionComposition({
        ownerId: 'header-ghost-appearance',
        runtimeId: runtime,
        projectionFamilyId: family,
        generation: 7,
        componentId: 'button',
        childDemo: {
          type: 'demo',
          root: { kind: 'proto', prototypeId: `${family}-button`, children: ['Command'] },
        },
        controlIds: ['runtime', 'family'],
        controls: {
          runtime: {
            label: 'Runtime',
            wrapValue: true,
            triggerAppearance: 'ghost',
            brutalistTriggerAppearance: 'elevated',
            compactTriggerAppearance: 'default',
            options: [{ value: runtime, label: 'Current runtime' }],
            onValueChange() {},
          },
          family: {
            label: 'Style',
            wrapValue: true,
            triggerAppearance: 'ghost',
            brutalistTriggerAppearance: 'elevated',
            compactTriggerAppearance: 'default',
            options: [{ value: family, label: family }],
            onValueChange() {},
          },
          component: { label: 'Unused', options: [], onValueChange() {} },
        },
      });
      await loadPrototypes([
        `${family}-button`,
        `${family}-text-root`,
        ...['root', 'trigger', 'value', 'content', 'item'].map(
          (part) => `${family}-select-${part}`
        ),
      ]);
      rendered = await renderDemo({ runtime, demo: composition.demo, host });
      disclosure = initSiteHeaderDisclosure(header);
      disclosure.bindButton(document.getElementById('menu')!);
      disclosure.enhance();
      const triggers = [...host.querySelectorAll<HTMLElement>('[role="combobox"]')];
      expect(triggers).toHaveLength(2);
      const roots = [
        ...host.querySelectorAll(`[data-projection-prototype="${family}-select-root"]`),
      ];
      expect(roots).toHaveLength(2);
      const assertSame = () => {
        expect(host.querySelectorAll('[role="combobox"]')).toHaveLength(2);
        expect(
          host.querySelectorAll(`[data-projection-prototype="${family}-select-root"]`)
        ).toHaveLength(2);
        [...host.querySelectorAll('[role="combobox"]')].forEach((node, index) =>
          expect(node).toBe(triggers[index])
        );
        [...host.querySelectorAll(`[data-projection-prototype="${family}-select-root"]`)].forEach(
          (node, index) => expect(node).toBe(roots[index])
        );
        for (const trigger of triggers) {
          expect(trigger.dataset.projectionOwner).toBe('header-ghost-appearance');
          expect(trigger.dataset.projectionGeneration).toBe('7');
          expect(trigger.dataset.projectionRuntime).toBe(runtime);
          expect(
            trigger.getAttribute('data-pui-style')!.split(/\s+/).includes('border-transparent')
          ).toBe(family === 'shadcn' && !compact.matches);
          expect(
            trigger.getAttribute('data-pui-style')!.includes('shadow-[4px_4px_0_0_#000]')
          ).toBe(family === 'brutalist');
          expect(trigger.style.boxShadow).toBe('');
        }
      };
      await vi.waitFor(assertSame);
      composition.setLocked(true);
      composition.setLocked(false);
      composition.setThemeSurfaceStyle({ '--pui-background': '#171717' });
      await vi.waitFor(assertSame);
      for (const matches of [true, false, true, false]) {
        compact.matches = matches;
        compact.dispatchEvent(new Event('change'));
        await vi.waitFor(assertSame);
        expect(
          preferences.parentElement?.hasAttribute(
            matches ? 'data-site-header-compact-context' : 'data-site-header-context'
          )
        ).toBe(true);
      }
      triggers[0].focus();
      triggers[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      triggers[0].dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
      await vi.waitFor(() => expect(triggers[0].getAttribute('aria-expanded')).toBe('true'));
      await vi.waitFor(() =>
        expect(document.getElementById(triggers[0].getAttribute('aria-controls')!)).not.toBeNull()
      );
      const popup = document.getElementById(triggers[0].getAttribute('aria-controls')!)!;
      expect(popup.getAttribute('data-pui-style')).not.toContain('border-transparent');
      if (family === 'brutalist')
        expect(popup.getAttribute('data-pui-style')).not.toContain('shadow-');
      expect(popup.dataset.projectionGeneration).toBe('7');
      const option = popup.querySelector<HTMLElement>('[role="option"]')!;
      option.focus();
      option.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await vi.waitFor(() => expect(triggers[0].getAttribute('aria-expanded')).toBe('false'));
      await vi.waitFor(() => expect(document.activeElement).toBe(triggers[0]));
      assertSame();
    }, 15000);
  }
