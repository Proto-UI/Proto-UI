import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHomepageContent } from '../Homepage/homepage-runtime-client';
import { renderDemo } from './demo-renderer';
import { loadPrototypes } from './prototype-modules';
import { assertDemoSpec, type DemoRuntimeApi, type DemoSpec } from './demo-types';
import { createCopyCommandDemo } from '../site-copy-command';
import { createCopyController } from '../site-copy-controller';
const reactSource = vi.hoisted(() => ({ path: 'apps/www/package.json' }));
// Only CDN acquisition is replaced. Frameworks, adapters, the renderer and
// Prototypes are real installed implementations; this is host-unit, not browser evidence.
vi.mock('./runtimes/react-runtime', async (original) => {
  const actual = await original<typeof import('./runtimes/react-runtime')>();
  const { createRequire } = await import('node:module');
  const { resolve } = await import('node:path');
  return {
    ...actual,
    loadReact: async () => {
      const require = createRequire(resolve(reactSource.path));
      return {
        React: require('react'),
        ReactDOM: { ...require('react-dom'), ...require('react-dom/client') },
      };
    },
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

const cleanups: Array<() => void | Promise<void>> = [];
beforeAll(
  async () =>
    loadPrototypes([
      'shadcn-surface-root',
      'shadcn-text-root',
      'brutalist-surface-root',
      'brutalist-text-root',
    ]),
  20_000
);
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  document.body.replaceChildren();
});
describe('native link facts through actual renderer props', () => {
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    it(`${runtime}: preserves pressed feedback through pointerdown then native focus`, async () => {
      const host = document.createElement('div');
      document.body.append(host);
      const source = document.createElement('a');
      source.href = 'https://github.com/Proto-UI/Proto-UI';
      source.dataset.siteLinkIcon = 'github';
      source.dataset.siteLinkAppearance = 'icon';
      source.setAttribute('aria-label', 'GitHub');
      const demo = createHomepageContent(
        {
          root: host,
          mount: host,
          fallback: host,
          ownerId: 'native-test',
          links: [source],
          theme: false,
          runtime: false,
        },
        runtime,
        () => true,
        'brutalist'
      );
      const events: unknown[] = [];
      const setup = demo.setup!;
      demo.setup = (context) => {
        const set = context.api.setProps;
        context.api.setProps = (ref, next) => {
          events.push({ ref, next: { ...next } });
          set(ref, next);
        };
        return setup(context);
      };
      const view = await renderDemo({ runtime, host, demo });
      cleanups.push(() => view.destroy());
      const link = host.querySelector('a')!;
      const tokens = () =>
        link.querySelector('[data-pui-root]')?.getAttribute('data-pui-style')?.split(/\s+/) ?? [];
      link.dispatchEvent(new PointerEvent('pointerenter'));
      await vi.waitFor(() => expect(tokens()).toContain('translate-x-1'));
      link.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
      link.focus();
      await vi.waitFor(() => expect(tokens()).toContain('translate-y-1'));
      expect(events.some((event: any) => event.next.pressed === true)).toBe(true);
      expect(tokens()).toContain('shadow-none');
      window.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
      await vi.waitFor(() => expect((events.at(-1) as any).next.pressed).toBe(false));
      // Hover and press share the same endpoint. The real props lease must still
      // clear pressed, and only leaving hover restores resting elevation.
      expect(tokens()).toContain('translate-y-1');
      link.dispatchEvent(new PointerEvent('pointerleave'));
      await vi.waitFor(() => expect(tokens()).not.toContain('translate-y-1'));
      expect(link.isConnected).toBe(true);
      expect(host.querySelectorAll('a')).toHaveLength(1);
      // Later independent props remain live; the first hover update is not enough.
      link.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
      await vi.waitFor(() => expect(tokens()).toContain('translate-y-1'));
      window.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
      await vi.waitFor(() => expect(tokens()).not.toContain('translate-y-1'));
      await view.destroy();
      const eventsAfterDispose = events.length;
      link.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
      window.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
      await Promise.resolve();
      expect(events).toHaveLength(eventsAfterDispose);
      expect(host.childElementCount).toBe(0);
    }, 20_000);

    it(`${runtime}: late props from a replaced owner cannot change its replacement`, async () => {
      const host = document.createElement('div');
      document.body.append(host);
      const source = document.createElement('a');
      source.href = '/en/';
      source.dataset.siteLinkIcon = 'github';
      source.dataset.siteLinkAppearance = 'icon';
      source.setAttribute('aria-label', 'GitHub');
      const group = {
        root: host,
        mount: host,
        fallback: host,
        ownerId: 'lease-test',
        links: [source],
        theme: false,
        runtime: false,
      };
      const first = createHomepageContent(group, runtime, () => true, 'brutalist');
      const setup = first.setup!;
      let staleApi!: DemoRuntimeApi;
      first.setup = (context) => {
        staleApi = context.api;
        return setup(context);
      };
      const old = await renderDemo({ runtime, host, demo: first });
      cleanups.push(() => old.destroy());
      const oldLink = host.querySelector('a')!;
      oldLink.dispatchEvent(new PointerEvent('pointerenter'));
      oldLink.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
      // Revoke while framework prop delivery can still be queued.
      const replacing = renderDemo({
        runtime,
        host,
        demo: createHomepageContent(group, runtime, () => true, 'shadcn'),
      });
      staleApi.setProps('home-link-surface-0', { pressed: true, family: 'brutalist' });
      const current = await replacing;
      cleanups.push(() => current.destroy());
      staleApi.setProps('home-link-surface-0', {
        pressed: true,
        hovered: true,
        family: 'brutalist',
      });
      for (let turn = 0; turn < 12; turn++) await Promise.resolve();
      const link = host.querySelector('a')!;
      expect(link).not.toBe(oldLink);
      expect(oldLink.isConnected).toBe(false);
      expect(host.querySelectorAll('a')).toHaveLength(1);
      const surface = link.querySelector('[data-pui-root]')!;
      const tokens = (surface.getAttribute('data-pui-style') ?? '').split(/\s+/);
      expect(tokens).toContain('rounded-lg');
      expect(tokens).not.toContain('rounded-base');
      expect(tokens).not.toContain('translate-y-1');
      expect(tokens).not.toContain('translate-x-1');
      expect(tokens).not.toContain('bg-main');
    }, 20_000);
  }
});

// The configured hero icon supplements the authored CTA; it is not an icon-only
// social link and must survive the real public Surface/Text projection.
describe('configured hero action glyph', () => {
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const)
    for (const family of ['shadcn', 'brutalist'] as const)
      it(`${runtime}/${family}: preserves text, destination and decorative external glyph`, async () => {
        const host = document.createElement('div');
        document.body.append(host);
        const source = document.createElement('a');
        source.href = '#home-demo-previewer';
        source.textContent = '试试 Demo';
        source.dataset.homeActionVariant = 'minimal';
        source.dataset.homeActionIcon = 'external';
        const view = await renderDemo({
          runtime,
          host,
          demo: createHomepageContent(
            {
              root: host,
              mount: host,
              fallback: host,
              ownerId: 'hero-icon',
              links: [source],
              theme: false,
              runtime: false,
            },
            runtime,
            () => true,
            family
          ),
        });
        cleanups.push(() => view.destroy());
        const link = host.querySelector('a')!;
        expect(link.textContent).toBe('试试 Demo');
        expect(link.getAttribute('href')).toBe('#home-demo-previewer');
        const glyph = link.querySelector('svg');
        expect(glyph).not.toBeNull();
        expect(glyph!.getAttribute('aria-hidden')).toBe('true');
        expect(link.querySelectorAll('svg')).toHaveLength(1);
        expect(link.querySelector('[data-demo-ref="home-link-text-0"]')).not.toBeNull();
        link.dispatchEvent(new PointerEvent('pointerenter'));
        link.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
        link.focus();
        window.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
        await Promise.resolve();
        expect(link.querySelector('svg')).toBe(glyph);
        expect(link.textContent).toBe('试试 Demo');
        expect(document.activeElement).toBe(link);
        expect(host.querySelectorAll('a')).toHaveLength(1);
      }, 20_000);
});

describe.each(['apps/www/package.json', 'packages/adapters/react/package.json'])(
  'React host-box native presence before setup (%s)',
  (source) => {
    beforeEach(() => {
      reactSource.path = source;
    });
    for (const value of [false, true]) {
      it(`retains the string-only contract rather than coercing boolean ${value}`, () => {
        expect(() =>
          assertDemoSpec({
            type: 'demo',
            root: {
              kind: 'box',
              attrs: { hidden: value } as unknown as Record<string, string>,
            },
          })
        ).toThrow(/字符串/);
      });
    }
    for (const value of ['', 'hidden', 'false', 'until-found']) {
      it(`preserves hidden=${JSON.stringify(value)} before setup without coercing aria/data`, async () => {
        const host = document.createElement('div');
        document.body.append(host);
        const demo: DemoSpec = {
          type: 'demo',
          root: {
            kind: 'box',
            ref: 'box',
            attrs: {
              hidden: value,
              inert: '',
              itemscope: '',
              'aria-hidden': 'false',
              'data-hidden': '',
              draggable: 'false',
              spellcheck: 'false',
            },
          },
          setup({ refs }) {
            expect(refs.box!.getAttribute('hidden')).toBe(value);
            expect(refs.box!.hasAttribute('inert')).toBe(true);
            expect(refs.box!.hasAttribute('itemscope')).toBe(true);
            expect(refs.box!.getAttribute('aria-hidden')).toBe('false');
            expect(refs.box!.getAttribute('data-hidden')).toBe('');
            expect(refs.box!.getAttribute('draggable')).toBe('false');
            expect(refs.box!.getAttribute('spellcheck')).toBe('false');
          },
        };
        const view = await renderDemo({ runtime: 'react', host, demo });
        cleanups.push(() => view.destroy());
      });
    }

    it('omits absent presence attributes', async () => {
      const host = document.createElement('div');
      document.body.append(host);
      const view = await renderDemo({
        runtime: 'react',
        host,
        demo: {
          type: 'demo',
          root: { kind: 'box', ref: 'box', attrs: { 'data-hidden': 'false' } },
        },
      });
      cleanups.push(() => view.destroy());
      const box = host.querySelector('[data-demo-ref="box"]')!;
      for (const attr of ['hidden', 'inert', 'itemscope'])
        expect(box.hasAttribute(attr)).toBe(false);
      expect(box.getAttribute('data-hidden')).toBe('false');
    });

    it('renders only the idle Copy glyph in the initial commit, before effect setup', async () => {
      await loadPrototypes([
        'shadcn-button',
        'shadcn-surface-root',
        'base-live-region-root',
        'lucide-copy-icon',
        'lucide-loader-circle-icon',
        'lucide-check-icon',
        'lucide-circle-alert-icon',
      ]);
      const host = document.createElement('div');
      document.body.append(host);
      const owner = createCopyController({ readText: () => 'source', writeText: async () => {} });
      const demo = createCopyCommandDemo(host, owner, 'react', 'shadcn', () => true);
      // Do not let the later Copy effect repair the initial renderer mistake.
      demo.setup = ({ refs, api }) => {
        expect(
          ['idle', 'pending', 'success', 'error'].filter(
            (state) => !refs[`copy-glyph-${state}`]!.hasAttribute('hidden')
          )
        ).toEqual(['idle']);
        // The later effect owns visibility. An unrelated React props refresh
        // must not reapply the initial native attributes and undo that state.
        refs['copy-glyph-idle']!.hidden = true;
        refs['copy-glyph-pending']!.hidden = false;
        api.setProps('copy-button', { title: 'Copying' });
        expect(refs['copy-glyph-idle']!.hidden).toBe(true);
        expect(refs['copy-glyph-pending']!.hidden).toBe(false);
      };
      const view = await renderDemo({ runtime: 'react', host, demo });
      cleanups.push(() => view.destroy());
    });
  }
);
