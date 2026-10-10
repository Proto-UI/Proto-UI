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
  it('preserves original recipe identity and forwards only child refs with one cleanup', async () => {
    const cleanup = vi.fn();
    const setup = vi.fn((_context: DemoSetupContext) => cleanup);
    const child: DemoSpec = {
      type: 'demo',
      root: { kind: 'box', ref: 'original', children: ['Content'] },
      setup,
    };
    const surface = createRuntimePreviewSurface(child, 'brutalist');
    if (surface.demo.root.kind !== 'box') throw new Error('Expected composition');
    const content = surface.demo.root.children![1];
    if (typeof content === 'string' || content.kind !== 'box')
      throw new Error('Expected source container');
    expect(content.children![0]).toBe(child.root);
    const host = document.createElement('div');
    document.body.append(host);
    const result = await renderDemo({ runtime: 'wc', host, demo: surface.demo });
    await surface.ready;
    expect(Object.keys(setup.mock.calls[0]![0].refs)).toEqual(['original']);
    await result.destroy();
    await result.destroy();
    await surface.setAppearance('shadcn', { '--pui-background': '#fff' });
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('keeps content and independent shell recipe closures separate', () => {
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
        expect(recipe.prototypeIds).toEqual([...original.recipePrototypeIds]);
        expect(recipe.rootPrototypeId).not.toBe(`${family}-surface-root`);
      }
    }
    const child: DemoSpec = {
      type: 'demo',
      root: { kind: 'proto', prototypeId: 'original-component' },
    };
    const ids = new Set<string>();
    collectPrototypeIds(createRuntimePreviewSurface(child, 'shadcn').demo.root, ids);
    expect([...ids]).toEqual(['original-component']);
  });

  for (const family of ['bootstrap-2-3-2', 'liquid-glass'] as const) {
    for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
      it(`${family}/${runtime}: owns a neutral partial-family canvas without aliasing Shadcn or the demonstrated Button`, async () => {
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
        const surface = createRuntimePreviewSurface(
          child,
          family,
          {
            '--pui-background': '#123456',
          },
          runtime
        );
        expect(surface.demo.root.kind).toBe('box');
        expect(runtimePreviewRecipe(family, 'button').prototypeIds).toEqual([`${family}-button`]);
        expect(runtimePreviewRecipe(family, 'select').prototypeIds).toEqual([
          `${family}-select-root`,
          `${family}-select-trigger`,
          `${family}-select-value`,
          `${family}-select-content`,
          `${family}-select-item`,
          `${family}-button`,
        ]);
        expect(() =>
          runtimePreviewRecipe(
            family,
            '__unregistered_component__' as Parameters<typeof runtimePreviewRecipe>[1]
          )
        ).toThrow(/unavailable/);
        const host = document.createElement('div');
        document.body.append(host);
        const result = await renderDemo({ runtime, host, demo: surface.demo });
        await surface.ready;
        try {
          let frame = host.querySelector<HTMLElement>('.pui-runtime-preview-surface')!;
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
          await surface.setAppearance(family, { '--pui-background': '#654321' });
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
    expect(runtimePreviewRecipe('brutalist', 'button').prototypeIds).toEqual(['brutalist-button']);
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
      const surface = createRuntimePreviewSurface(child, 'shadcn', {}, runtime);
      const host = document.createElement('div');
      document.body.append(host);
      const result = await renderDemo({ runtime, host, demo: surface.demo });
      await surface.ready;
      try {
        const toggle = context.refs.toggle!;
        const active = () => (context.api.getExposes('toggle')?.active as { get(): boolean }).get();
        toggle.click();
        await vi.waitFor(() => expect(active()).toBe(true));
        toggle.focus();
        await surface.setAppearance('brutalist', {
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
      const surface = createRuntimePreviewSurface(
        child,
        'shadcn',
        { '--pui-background': '#fff' },
        runtime
      );
      const host = document.createElement('div');
      document.body.append(host);
      const result = await renderDemo({ runtime, host, demo: surface.demo });
      await surface.ready;
      try {
        const link = host.querySelector('a')!;
        let frame = host.querySelector<HTMLElement>('.pui-runtime-preview-surface')!;
        expect(context.refs['original-link']).toBe(link);
        expect(frame.contains(link)).toBe(true);
        expect(frame.getAttribute('role')).toBeNull();
        expect(frame.getAttribute('tabindex')).toBeNull();
        expect(frame.getAttribute('data-pui-style')).toContain('rounded-xl');
        expect(frame.getAttribute('data-pui-style')).not.toContain('shadow-');
        link.focus();
        expect(document.activeElement).toBe(link);
        await surface.setAppearance('brutalist', {
          '--pui-background': '#111',
          '--pui-foreground': '#fff',
        });
        frame = host.querySelector<HTMLElement>('.pui-runtime-preview-surface')!;
        expect(frame.getAttribute('data-pui-style')).toContain('rounded-base');
        expect(frame.getAttribute('data-pui-style')).not.toContain('shadow-');
        expect(host.querySelector('a')).toBe(link);
        expect(document.activeElement).toBe(link);
        expect(link.getAttribute('href')).toBe('#destination');
        expect(link.getAttribute('aria-label')).toBe('Original link');
        await surface.setAppearance('brutalist', { '--pui-background': '#000' });
        expect(frame.style.getPropertyValue('--pui-foreground')).toBe('');
        expect(frame.getAttribute('data-pui-style')).not.toContain('shadow-');
        expect(host.querySelector('a')).toBe(link);
        expect(setup).toHaveBeenCalledTimes(1);
        await result.destroy();
        expect(cleanup).toHaveBeenCalledTimes(1);
        expect(link.isConnected).toBe(false);
        await surface.setAppearance('shadcn', { '--pui-background': '#ccc' });
        expect(link.isConnected).toBe(false);
      } finally {
        await result.destroy();
      }
    }, 15000);
  }
});

describe('passive public shell lease interruption', () => {
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    it(`${runtime}: latest family wins while the original focused content and state survive`, async () => {
      registerPrototype('shadcn-toggle', Toggle);
      let context!: DemoSetupContext;
      const cleanup = vi.fn();
      const child: DemoSpec = {
        type: 'demo',
        root: {
          kind: 'proto',
          prototypeId: 'shadcn-toggle',
          ref: 'retained',
          children: ['Retained toggle'],
        },
        setup(next) {
          context = next;
          return cleanup;
        },
      };
      const shell = createRuntimePreviewSurface(child, 'shadcn', {}, runtime);
      const host = document.createElement('div');
      document.body.append(host);
      const rendered = await renderDemo({ runtime, host, demo: shell.demo });
      await shell.ready;
      const toggle = context.refs.retained!;
      toggle.click();
      toggle.focus();
      const first = shell.setAppearance('brutalist', { '--pui-background': '#111' });
      const second = shell.setAppearance('shadcn', { '--pui-background': '#222' });
      const third = shell.setAppearance('brutalist', { '--pui-background': '#333' });
      await Promise.all([first, second, third]);
      expect(context.refs.retained).toBe(toggle);
      expect((context.api.getExposes('retained')!.active as { get(): boolean }).get()).toBe(true);
      expect(document.activeElement).toBe(toggle);
      expect(host.querySelectorAll('.pui-runtime-preview-surface')).toHaveLength(1);
      expect(
        host.querySelector('.pui-runtime-preview-surface')!.getAttribute('data-pui-style')
      ).toContain('rounded-base');
      await rendered.destroy();
      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(host.querySelectorAll('.pui-runtime-preview-surface')).toHaveLength(0);
    });
    it(`${runtime}: restores a removed borrowed source before teardown and rejects late publication`, async () => {
      const cleanup = vi.fn();
      const shell = createRuntimePreviewSurface(
        {
          type: 'demo',
          root: { kind: 'box', ref: 'source', children: ['Source text'] },
          setup: () => cleanup,
        },
        'shadcn',
        {},
        runtime
      );
      const host = document.createElement('div');
      document.body.append(host);
      const rendered = await renderDemo({ runtime, host, demo: shell.demo });
      await shell.ready;
      const borrowed = host.querySelector<HTMLElement>(
        '[data-passive-shell-slot]'
      )!.firstElementChild!;
      borrowed.remove();
      const pending = shell.setAppearance('brutalist', {});
      await rendered.destroy();
      await pending;
      await shell.setAppearance('shadcn', {});
      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(host.textContent).toBe('');
      expect(host.querySelector('[data-passive-shell-slot]')).toBeNull();
    });
  }
  it('reserves both shell and borrowed-content refs recursively', () => {
    for (const ref of [
      '__website_runtime_preview_surface__',
      '__website_runtime_preview_surface__-content',
    ])
      expect(() =>
        createRuntimePreviewSurface(
          { type: 'demo', root: { kind: 'box', children: [{ kind: 'box', ref }] } },
          'shadcn'
        )
      ).toThrow('reserved surface ref');
  });
});
