import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createRuntimePreviewSurface,
  runtimePreviewFamily,
  runtimePreviewRecipe,
} from './runtime-preview-surface';
import { collectPrototypeIds, type DemoSetupContext, type DemoSpec } from './demo-types';
import { PROJECTION_FAMILY_MANIFESTS, type ProjectionFamilyManifest } from './projection-families';
import { registerPrototype } from './registry';
import { renderDemo } from './demo-renderer';
import SitePreviewSurface from '../../prototypes/site-preview-surface.proto';
import Toggle from '../../../../../packages/prototypes/shadcn/src/toggle/toggle.proto';

// Exercise the real adapters with the repository's installed framework versions.
// Only the CDN loader is replaced; hosted-browser coverage exercises the website URLs.
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

afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.removeAttribute('data-site-library-family');
});

describe('RuntimeBox canvas composition', () => {
  it('preserves the original recipe root and forwards only its setup refs and cleanup once', () => {
    const cleanup = vi.fn();
    const setup = vi.fn(() => cleanup);
    const child: DemoSpec = { type: 'demo', root: { kind: 'box', ref: 'original' }, setup };
    const surface = createRuntimePreviewSurface(child, 'brutalist');
    expect(surface.demo.root.kind).toBe('proto');
    if (surface.demo.root.kind !== 'proto') throw new Error('Expected a Prototype surface');
    expect(surface.demo.root.props).toEqual({
      family: 'brutalist',
      emphasis: 'plain',
      appearance: 'canvas',
    });
    expect(surface.demo.root.children).toEqual([child.root]);
    expect(surface.demo.root.children?.[0]).toBe(child.root);
    const original = document.createElement('div');
    const host = document.createElement('div');
    const context = {
      host,
      refs: { original, [surface.demo.root.ref!]: host },
      api: { setProps: vi.fn(), call: vi.fn(), getExposes: vi.fn() },
    };
    const release = surface.demo.setup!(context)!;
    expect(setup).toHaveBeenCalledWith({ ...context, refs: { original } });
    release();
    release();
    surface.setAppearance('shadcn', { '--pui-background': '#fff' });
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(context.api.setProps).not.toHaveBeenCalled();
  });

  it('declares only the original recipe closure plus the one actual app surface', () => {
    for (const family of ['shadcn', 'brutalist'] as const) {
      for (const component of ['button', 'select', 'dialog', 'tooltip', 'scroll-area'] as const) {
        const original = (PROJECTION_FAMILY_MANIFESTS[family] as ProjectionFamilyManifest).families[
          component
        ]!;
        if (!original) {
          expect(() => runtimePreviewRecipe(family, component)).toThrow(/unavailable/);
          continue;
        }
        const recipe = runtimePreviewRecipe(family, component);
        expect(recipe.prototypeIds).toEqual([
          ...original.recipePrototypeIds,
          'site-preview-surface',
        ]);
        expect(recipe.rootPrototypeId).not.toBe('site-preview-surface');
      }
    }
    const child: DemoSpec = {
      type: 'demo',
      root: { kind: 'proto', prototypeId: 'original-component' },
    };
    const ids = new Set<string>();
    collectPrototypeIds(createRuntimePreviewSurface(child, 'shadcn').demo.root, ids);
    expect([...ids]).toEqual(['site-preview-surface', 'original-component']);
  });

  for (const family of ['bootstrap-2-3-2', 'liquid-glass'] as const) {
    for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
      it(`${family}/${runtime}: owns a neutral partial-family canvas without aliasing Shadcn or the demonstrated Button`, async () => {
        registerPrototype('site-preview-surface', SitePreviewSurface);
        const prototype =
          family === 'liquid-glass'
            ? (
                await import('../../../../../packages/prototypes/liquid-glass/src/button/button.proto')
              ).default
            : (
                await import('../../../../../packages/prototypes/bootstrap-2-3-2/src/button/button.proto')
              ).default;
        registerPrototype(`${family}-button`, prototype);
        let context!: DemoSetupContext;
        const onClick = vi.fn();
        const cleanup = vi.fn();
        const child: DemoSpec = {
          type: 'demo',
          root: {
            kind: 'proto',
            prototypeId: `${family}-button`,
            ref: 'actual-button',
            props: { onClick },
            children: ['Actual partial-family Button'],
          },
          setup(next) {
            context = next;
            const onCustomClick = (event: Event) => {
              if (event instanceof CustomEvent) onClick();
            };
            context.refs['actual-button'].addEventListener('click', onCustomClick);
            return () => {
              context.refs['actual-button'].removeEventListener('click', onCustomClick);
              cleanup();
            };
          },
        };
        const surface = createRuntimePreviewSurface(child, family, {
          '--pui-background': '#123456',
        });
        expect(surface.demo.root.kind).toBe('proto');
        if (surface.demo.root.kind !== 'proto') throw new Error('Expected a real private canvas');
        expect(surface.demo.root.children?.[0]).toBe(child.root);
        expect(runtimePreviewRecipe(family, 'button').prototypeIds).toEqual([
          `${family}-button`,
          'site-preview-surface',
        ]);
        expect(() => runtimePreviewRecipe(family, 'select')).toThrow(/unavailable/);
        const host = document.createElement('div');
        document.body.append(host);
        const result = await renderDemo({ runtime, host, demo: surface.demo });
        try {
          const frame = host.querySelector<HTMLElement>('.pui-runtime-preview-surface')!;
          const button = context.refs['actual-button'];
          await vi.waitFor(() => expect(button.getAttribute('role')).toBe('button'));
          const tokens = frame.getAttribute('data-pui-style') ?? '';
          expect(tokens).not.toContain('rounded-xl');
          expect(tokens).toContain(family === 'bootstrap-2-3-2' ? 'rounded-[4px]' : 'rounded-none');
          expect(tokens).not.toContain('backdrop-blur');
          expect(frame.style.getPropertyValue('--pui-background')).toBe('#123456');
          expect(frame.getAttribute('role')).toBeNull();
          expect(frame.getAttribute('tabindex')).toBeNull();
          expect(frame.contains(button)).toBe(true);
          expect(Object.keys(context.refs)).toEqual(['actual-button']);
          button.click();
          expect(onClick).toHaveBeenCalledTimes(1);
          button.focus();
          surface.setAppearance(family, { '--pui-background': '#654321' });
          expect(context.refs['actual-button']).toBe(button);
          expect(document.activeElement).toBe(button);
          expect(frame.style.getPropertyValue('--pui-background')).toBe('#654321');
          button.click();
          expect(onClick).toHaveBeenCalledTimes(2);
        } finally {
          await result.destroy();
        }
        expect(cleanup).toHaveBeenCalledTimes(1);
      }, 15000);
    }
  }

  it('rejects unknown canvas families instead of falling back to another family', () => {
    const child: DemoSpec = { type: 'demo', root: { kind: 'box', children: ['Actual source'] } };
    const unknown = 'unknown-family' as Parameters<typeof createRuntimePreviewSurface>[1];
    expect(() => createRuntimePreviewSurface(child, unknown)).toThrow(/unsupported canvas family/);
    const surface = createRuntimePreviewSurface(child, 'brutalist');
    expect(() => surface.setAppearance(unknown, {})).toThrow(/unsupported canvas family/);
    expect(surface.demo.root.kind === 'proto' && surface.demo.root.props?.family).toBe('brutalist');
  });

  it('rejects a child ref collision instead of taking over the demonstrated instance', () => {
    expect(() =>
      createRuntimePreviewSurface(
        { type: 'demo', root: { kind: 'box', ref: '__website_runtime_preview_surface__' } },
        'shadcn'
      )
    ).toThrow(/reserved surface ref/);
  });

  it('honors a fixed family before document presentation and resolves current generic ancestry', () => {
    const root = document.createElement('section');
    document.body.append(root);
    document.documentElement.dataset.siteLibraryFamily = 'brutalist';
    expect(runtimePreviewFamily(root)).toBe('brutalist');
    root.dataset.projectionFamily = 'shadcn';
    expect(runtimePreviewFamily(root)).toBe('shadcn');
    delete root.dataset.projectionFamily;
    document.documentElement.dataset.siteLibraryFamily = 'shadcn';
    expect(runtimePreviewFamily(root)).toBe('shadcn');
  });

  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    it(`${runtime}: keeps the demonstrated uncontrolled state and activation after a surface family change`, async () => {
      registerPrototype('site-preview-surface', SitePreviewSurface);
      registerPrototype('shadcn-toggle', Toggle);
      let context!: DemoSetupContext;
      const cleanup = vi.fn();
      const child: DemoSpec = {
        type: 'demo',
        root: {
          kind: 'proto',
          prototypeId: 'shadcn-toggle',
          ref: 'toggle',
          children: ['Keep my state'],
        },
        setup(next) {
          context = next;
          return cleanup;
        },
      };
      const surface = createRuntimePreviewSurface(child, 'shadcn');
      const host = document.createElement('div');
      document.body.append(host);
      const result = await renderDemo({ runtime, host, demo: surface.demo });
      try {
        const toggle = context.refs.toggle!;
        const active = () => (context.api.getExposes('toggle')?.active as { get(): boolean }).get();
        toggle.click();
        await vi.waitFor(() => expect(active()).toBe(true));
        toggle.focus();
        surface.setAppearance('brutalist', {
          '--pui-background': '#fff',
          '--pui-foreground': '#000',
        });
        await vi.waitFor(() =>
          expect(
            host.querySelector('.pui-runtime-preview-surface')?.getAttribute('data-pui-style')
          ).toContain('rounded-base')
        );
        expect(context.refs.toggle).toBe(toggle);
        expect(active()).toBe(true);
        expect(document.activeElement).toBe(toggle);
        toggle.click();
        await vi.waitFor(() => expect(active()).toBe(false));
      } finally {
        await result.destroy();
      }
      expect(cleanup).toHaveBeenCalledTimes(1);
    }, 15000);
    it(`${runtime}: projects the real slot, keeps native node/focus identity on family/theme update and revokes cleanup`, async () => {
      registerPrototype('site-preview-surface', SitePreviewSurface);
      let context!: DemoSetupContext;
      const cleanup = vi.fn();
      const setup = vi.fn((next: DemoSetupContext) => {
        context = next;
        return cleanup;
      });
      const child: DemoSpec = {
        type: 'demo',
        root: {
          kind: 'box',
          tag: 'a',
          ref: 'original-link',
          attrs: { href: '#destination', 'aria-label': 'Original link' },
          children: ['Selectable original content'],
        },
        setup,
      };
      const surface = createRuntimePreviewSurface(child, 'shadcn', { '--pui-background': '#fff' });
      const host = document.createElement('div');
      document.body.append(host);
      const result = await renderDemo({ runtime, host, demo: surface.demo });
      try {
        const link = host.querySelector('a')!;
        const frame = host.querySelector<HTMLElement>('.pui-runtime-preview-surface')!;
        expect(context.refs['original-link']).toBe(link);
        expect(frame.contains(link)).toBe(true);
        expect(frame.getAttribute('role')).toBeNull();
        expect(frame.getAttribute('tabindex')).toBeNull();
        expect(frame.getAttribute('data-pui-style')).toContain('rounded-xl');
        expect(frame.getAttribute('data-pui-style')).not.toContain('shadow-');
        link.focus();
        expect(document.activeElement).toBe(link);
        surface.setAppearance('brutalist', {
          '--pui-background': '#111',
          '--pui-foreground': '#fff',
        });
        await vi.waitFor(() =>
          expect(frame.getAttribute('data-pui-style')).toContain('rounded-base')
        );
        expect(frame.getAttribute('data-pui-style')).not.toContain('shadow-');
        expect(host.querySelector('a')).toBe(link);
        expect(document.activeElement).toBe(link);
        expect(link.getAttribute('href')).toBe('#destination');
        expect(link.getAttribute('aria-label')).toBe('Original link');
        surface.setAppearance('brutalist', { '--pui-background': '#000' });
        expect(frame.style.getPropertyValue('--pui-foreground')).toBe('');
        expect(frame.getAttribute('data-pui-style')).not.toContain('shadow-');
        expect(host.querySelector('a')).toBe(link);
        expect(setup).toHaveBeenCalledTimes(1);
        await result.destroy();
        expect(cleanup).toHaveBeenCalledTimes(1);
        expect(link.isConnected).toBe(false);
        surface.setAppearance('shadcn', { '--pui-background': '#ccc' });
        expect(link.isConnected).toBe(false);
      } finally {
        await result.destroy();
      }
    }, 15000);
  }
});
