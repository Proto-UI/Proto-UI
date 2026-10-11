import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRuntimePreviewSurface } from './runtime-preview-surface';
import { renderDemo } from './demo-renderer';
import { loadPrototypes } from './prototype-modules';
import { registerPrototype } from './registry';
import {
  assertDemoSpec,
  type DemoChild,
  type DemoSetupContext,
  type DemoSpec,
  type DemoSurfaceStyleEntry,
} from './demo-types';
import {
  resolveProjectionThemeSurfaceStyle,
  watchProjectionThemeSurfaceStyle,
} from './projection-theme';
import Root from '../../../../../packages/prototypes/brutalist/src/alert-dialog/root.proto';
import Trigger from '../../../../../packages/prototypes/brutalist/src/alert-dialog/trigger.proto';
import Content from '../../../../../packages/prototypes/brutalist/src/alert-dialog/content.proto';
import Mask from '../../../../../packages/prototypes/brutalist/src/alert-dialog/mask.proto';
import Action from '../../../../../packages/prototypes/brutalist/src/alert-dialog/action.proto';
import Cancel from '../../../../../packages/prototypes/brutalist/src/alert-dialog/cancel.proto';
import Description from '../../../../../packages/prototypes/brutalist/src/alert-dialog/description.proto';

vi.mock('./prototype-modules', async (original) => {
  const current = await original<typeof import('./prototype-modules')>();
  return { ...current, loadPrototypes: vi.fn(current.loadPrototypes) };
});

// Real adapters and installed frameworks; only the network/CDN loaders are replaced.
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

for (const [name, prototype] of Object.entries({
  root: Root,
  trigger: Trigger,
  content: Content,
  mask: Mask,
  action: Action,
  cancel: Cancel,
  description: Description,
})) {
  registerPrototype(`portal-theme-${name}`, prototype);
}
afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.classList.remove('dark');
  document.body.removeAttribute('style');
});

function fixture(setup: (context: DemoSetupContext) => () => void): DemoSpec {
  return {
    type: 'demo',
    root: {
      kind: 'proto',
      prototypeId: 'portal-theme-root',
      ref: 'root',
      props: { a11yLabel: 'Theme fixture' },
      children: [
        { kind: 'proto', prototypeId: 'portal-theme-trigger', ref: 'trigger', children: ['Open'] },
        { kind: 'proto', prototypeId: 'portal-theme-mask', ref: 'mask', previewTheme: 'portal' },
        {
          kind: 'proto',
          prototypeId: 'portal-theme-content',
          ref: 'content',
          previewTheme: 'portal',
          surfaceStyle: [
            'padding: 23px; --pui-radius: 6px;',
            { maxWidth: '410px', '--pui-radius': '7px' },
          ],
          props: { enterDuration: 0, leaveDuration: 0 },
          children: [
            {
              kind: 'proto',
              prototypeId: 'portal-theme-description',
              children: ['Theme scope fixture'],
            },
            {
              kind: 'proto',
              prototypeId: 'portal-theme-cancel',
              ref: 'cancel',
              children: ['Cancel'],
            },
            {
              kind: 'proto',
              prototypeId: 'portal-theme-action',
              ref: 'action',
              children: ['Confirm'],
            },
          ],
        },
      ],
    },
    setup,
  };
}

function actualSurface(boundary: HTMLElement): HTMLElement {
  return boundary.shadowRoot?.querySelector<HTMLElement>('[part~="root"]') ?? boundary;
}

describe('generic preview owned portal theme', () => {
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    it(`${runtime}: supplies the complete map through actual normalized surfaces`, async () => {
      const host = document.createElement('div');
      host.dataset.theme = 'light';
      document.body.style.setProperty('--pui-main', '#ff00ff');
      document.body.append(host);
      let context!: DemoSetupContext;
      const cleanup = vi.fn();
      const light = resolveProjectionThemeSurfaceStyle('brutalist', host);
      const original = fixture((next) => {
        context = next;
        return cleanup;
      });
      const surface = createRuntimePreviewSurface(original, 'brutalist', light, runtime);
      const rendered = await renderDemo({ runtime, host, demo: surface.demo });
      let stop = () => {};
      const current = (ref: string) =>
        actualSurface(document.querySelector<HTMLElement>(`[data-demo-ref="${ref}"]`)!);
      let lastContent: HTMLElement | undefined;
      let lastStyle: string | null = null;
      try {
        await surface.ready;
        // Match previewer-client: subscribe only after the initial shell is ready.
        stop = watchProjectionThemeSurfaceStyle('brutalist', host, (theme) => {
          void surface.setAppearance('brutalist', theme);
        });
        await vi.waitFor(() => {
          for (const ref of ['mask', 'content']) {
            const target = actualSurface(context.refs[ref]!);
            for (const [name, value] of Object.entries(light)) {
              expect(target.style.getPropertyValue(name), `${ref}/${name}`).toBe(
                name === '--pui-radius' && ref === 'content' ? '7px' : value
              );
            }
          }
        });
        expect(actualSurface(context.refs.content!).style.padding).toBe('23px');
        expect(actualSurface(context.refs.content!).style.maxWidth).toBe('410px');
        expect(context.refs.trigger!.style.getPropertyValue('--pui-main')).toBe('');
        context.api.call('root', 'openAlertDialog');
        await vi.waitFor(() => expect(host.contains(current('content'))).toBe(false));
        expect(current('content').style.getPropertyValue('--pui-main')).toBe(light['--pui-main']);
        host.setAttribute('data-theme', 'dark');
        const dark = resolveProjectionThemeSurfaceStyle('brutalist', host);
        await vi.waitFor(() => {
          for (const ref of ['mask', 'content']) {
            for (const [name, value] of Object.entries(dark)) {
              expect(current(ref).style.getPropertyValue(name), `dark ${ref}/${name}`).toBe(
                name === '--pui-radius' && ref === 'content' ? '7px' : value
              );
            }
          }
        });
        context.api.call('root', 'close');
        await vi.waitFor(() => expect(host.contains(current('content'))).toBe(true));
        // A later physical portal target must replay current normalized props.
        context.api.call('root', 'openAlertDialog');
        await vi.waitFor(() => expect(host.contains(current('content'))).toBe(false));
        expect(current('content').style.getPropertyValue('--pui-secondary-background')).toBe(
          dark['--pui-secondary-background']
        );
        expect(current('content').style.padding).toBe('23px');
        expect(current('content').style.getPropertyValue('--pui-radius')).toBe('7px');
        expect(document.body.style.getPropertyValue('--pui-main')).toBe('#ff00ff');
        expect(document.body.style.getPropertyValue('--pui-background')).toBe('');
        lastContent = current('content');
      } finally {
        stop();
        await rendered.destroy();
      }
      lastStyle = lastContent?.getAttribute('style') ?? null;
      await surface.setAppearance('brutalist', light);
      context.api.setSurfaceStyle!('content', { '--pui-main': 'red' });
      await new Promise<void>((resolve) => queueMicrotask(resolve));
      expect(document.querySelector('[data-demo-ref="content"]')).toBeNull();
      expect(lastContent?.getAttribute('style')).toBe(lastStyle);
      expect(cleanup).toHaveBeenCalledTimes(1);
    });
    it(`${runtime}: merges canonical property aliases in authored order and clears empty overrides`, async () => {
      const host = document.createElement('div');
      document.body.append(host);
      let context!: DemoSetupContext;
      const child = fixture((next) => {
        context = next;
        return () => {};
      });
      if (child.root.kind !== 'proto') throw new Error('Expected fixture root');
      const content = child.root.children![2];
      if (typeof content === 'string' || content.kind !== 'proto')
        throw new Error('Expected content');
      const authored: DemoSurfaceStyleEntry[] = [
        {
          maxWidth: '410px',
          WebkitTransform: 'translateX(1px)',
          msTransition: 'all 1s',
          '--pui-Case': 'Upper first',
          '--pui-case': 'lower first',
        },
        'max-width: 420px; -webkit-transform: translateX(2px); -ms-transition: all 2s; --pui-Case: Upper middle;',
        {
          maxWidth: '430px',
          WebkitTransform: 'translateX(3px)',
          msTransition: 'all 3s',
          '--pui-Case': 'Upper last',
          cssFloat: 'left',
        },
      ];
      content.surfaceStyle = authored;
      const surface = createRuntimePreviewSurface(
        child,
        'brutalist',
        { '--pui-main': '#112233' },
        runtime
      );
      let projected!: Extract<DemoChild, { kind: 'proto' }>;
      const visit = (node: DemoChild) => {
        if (typeof node === 'string' || node.kind === 'text') return;
        if (node.kind === 'proto' && node.ref === 'content') projected = node;
        node.children?.forEach(visit);
      };
      visit(surface.demo.root);
      expect(projected.surfaceStyle).toMatchObject({
        'max-width': '430px',
        '-webkit-transform': 'translateX(3px)',
        '-ms-transition': 'all 3s',
        '--pui-Case': 'Upper last',
        '--pui-case': 'lower first',
        float: 'left',
      });
      expect(projected.surfaceStyle).not.toHaveProperty('maxWidth');
      expect(projected.surfaceStyle).not.toHaveProperty('WebkitTransform');
      expect(projected.surfaceStyle).not.toHaveProperty('msTransition');
      const rendered = await renderDemo({ runtime, host, demo: surface.demo });
      try {
        await surface.ready;
        await vi.waitFor(() =>
          expect(actualSurface(context.refs.content!).style.maxWidth).toBe('430px')
        );
        expect(actualSurface(context.refs.content!).style.getPropertyValue('--pui-Case')).toBe(
          'Upper last'
        );
        expect(actualSurface(context.refs.content!).style.getPropertyValue('--pui-case')).toBe(
          'lower first'
        );
        // Empty CSS declarations are ignored by CSSOM, unlike an explicit
        // object empty value, which revokes the preceding normalized value.
        authored.push('max-width: ;');
        await surface.setAppearance('brutalist', { '--pui-main': '#334455' });
        expect(actualSurface(context.refs.content!).style.maxWidth).toBe('430px');
        authored.push({ maxWidth: '', '--pui-Case': '' });
        await surface.setAppearance('brutalist', {});
        await vi.waitFor(() =>
          expect(actualSurface(context.refs.content!).style.maxWidth).toBe('')
        );
        expect(actualSurface(context.refs.content!).style.getPropertyValue('--pui-Case')).toBe('');
        expect(actualSurface(context.refs.content!).style.getPropertyValue('--pui-case')).toBe(
          'lower first'
        );
        expect(actualSurface(context.refs.mask!).style.getPropertyValue('--pui-main')).toBe('');
        authored.push({ padding: '1px' }, { paddingLeft: '2px' }, { padding: '3px' });
        await surface.setAppearance('brutalist', {});
        await vi.waitFor(() =>
          expect(actualSurface(context.refs.content!).style.paddingLeft).toBe('3px')
        );
      } finally {
        await rendered.destroy();
      }
    });
    it(`${runtime}: content reconnect reentry keeps the actually committed family after a failed return`, async () => {
      const host = document.createElement('div');
      document.body.append(host);
      let context!: DemoSetupContext;
      let surface!: ReturnType<typeof createRuntimePreviewSurface>;
      let returned: Promise<unknown> | undefined;
      let reject!: (error: Error) => void;
      const gate = new Promise<void>((_resolve, fail) => {
        reject = fail;
      });
      let armed = false;
      const tag = `preview-theme-reentry-${runtime}`;
      customElements.define(
        tag,
        class extends HTMLElement {
          connectedCallback() {
            if (!armed || !this.closest('[data-projection-family="shadcn"]')) return;
            armed = false;
            vi.mocked(loadPrototypes).mockImplementationOnce(() => gate);
            returned = surface
              .setAppearance('brutalist', { '--pui-background': '#333333' })
              .catch((error) => error);
          }
        }
      );
      const child: DemoSpec = {
        type: 'demo',
        // A host-only custom element exercises a real synchronous connected
        // callback; no Prototype or Adapter behavior is replaced.
        root: {
          kind: 'box',
          children: [{ kind: 'box', tag: tag as 'div' }, fixture(() => () => {}).root],
        },
        setup(next) {
          context = next;
        },
      };
      surface = createRuntimePreviewSurface(
        child,
        'brutalist',
        { '--pui-background': '#111111' },
        runtime
      );
      const rendered = await renderDemo({ runtime, host, demo: surface.demo });
      try {
        await surface.ready;
        armed = true;
        const forward = surface.setAppearance('shadcn', { '--pui-background': '#222222' });
        await vi.waitFor(() => expect(returned).toBeDefined());
        reject(new Error('injected return failure'));
        expect(await returned).toBeInstanceOf(Error);
        await forward;
        expect(
          host.querySelector<HTMLElement>('[data-projection-family="shadcn"]')?.parentElement
            ?.hidden
        ).toBe(false);
        await vi.waitFor(() => {
          for (const ref of ['mask', 'content'])
            expect(
              actualSurface(context.refs[ref]!).style.getPropertyValue('--pui-background')
            ).toBe('#222222');
        });
      } finally {
        await rendered.destroy();
      }
    });
    for (const nextFamily of ['brutalist', 'shadcn'] as const) {
      it(`${runtime}: a nested ${nextFamily} update wins after an owned surface callback`, async () => {
        const host = document.createElement('div');
        document.body.append(host);
        let context!: DemoSetupContext;
        let surface!: ReturnType<typeof createRuntimePreviewSurface>;
        let armed = false;
        let nested: Promise<unknown> | undefined;
        surface = createRuntimePreviewSurface(
          fixture((next) => {
            context = next;
            const update = next.api.setSurfaceStyle!;
            next.api.setSurfaceStyle = (ref, style) => {
              update(ref, style);
              if (armed && ref === 'mask' && style['--pui-background'] === '#222222') {
                armed = false;
                nested = surface.setAppearance(nextFamily, { '--pui-background': '#333333' });
              }
            };
            return () => {};
          }),
          'brutalist',
          { '--pui-background': '#111111' },
          runtime
        );
        const rendered = await renderDemo({ runtime, host, demo: surface.demo });
        try {
          await surface.ready;
          armed = true;
          await surface.setAppearance('brutalist', { '--pui-background': '#222222' });
          expect(nested).toBeDefined();
          await nested;
          await vi.waitFor(() => {
            for (const ref of ['mask', 'content'])
              expect(
                actualSurface(context.refs[ref]!).style.getPropertyValue('--pui-background')
              ).toBe('#333333');
          });
          expect(
            host.querySelector<HTMLElement>('.pui-runtime-preview-surface')?.dataset
              .projectionFamily
          ).toBe(nextFamily);
        } finally {
          await rendered.destroy();
        }
      });
    }
    for (const nextFamily of ['brutalist', 'shadcn'] as const) {
      it(`${runtime}: rolls back a partially published ${nextFamily} theme and permits retry`, async () => {
        const host = document.createElement('div');
        document.body.append(host);
        let context!: DemoSetupContext;
        let fail = false;
        const theme = { '--pui-background': '#111111', '--pui-retained': 'yes' };
        const next = { '--pui-background': '#222222', '--pui-candidate': 'yes' };
        const surface = createRuntimePreviewSurface(
          fixture((value) => {
            context = value;
            const update = value.api.setSurfaceStyle!.bind(value.api);
            value.api.setSurfaceStyle = (ref, style) => {
              update(ref, style);
              if (fail && ref === 'mask' && style['--pui-background'] === '#222222') {
                fail = false;
                throw new Error('injected normalized surface publication failure');
              }
            };
            return () => {};
          }),
          'brutalist',
          theme,
          runtime
        );
        const rendered = await renderDemo({ runtime, host, demo: surface.demo });
        try {
          await surface.ready;
          fail = true;
          await expect(surface.setAppearance(nextFamily, next)).rejects.toThrow(
            'injected normalized surface publication failure'
          );
          await vi.waitFor(() => {
            for (const ref of ['mask', 'content']) {
              const style = actualSurface(context.refs[ref]!).style;
              expect(style.getPropertyValue('--pui-background')).toBe('#111111');
              expect(style.getPropertyValue('--pui-retained')).toBe('yes');
              expect(style.getPropertyValue('--pui-candidate')).toBe('');
            }
          });
          const retained = host.querySelector<HTMLElement>('.pui-runtime-preview-surface')!;
          expect(retained.dataset.projectionFamily).toBe('brutalist');
          expect(retained.style.getPropertyValue('--pui-background')).toBe('#111111');
          await surface.setAppearance(nextFamily, next);
          await vi.waitFor(() => {
            for (const ref of ['mask', 'content'])
              expect(
                actualSurface(context.refs[ref]!).style.getPropertyValue('--pui-background')
              ).toBe('#222222');
          });
        } finally {
          await rendered.destroy();
        }
      });
    }
    it(`${runtime}: a failed family request cannot recolor the retained owned surfaces`, async () => {
      const host = document.createElement('div');
      document.body.append(host);
      let context!: DemoSetupContext;
      const theme = resolveProjectionThemeSurfaceStyle('brutalist', host);
      const surface = createRuntimePreviewSurface(
        fixture((next) => {
          context = next;
          return () => {};
        }),
        'brutalist',
        theme,
        runtime
      );
      const rendered = await renderDemo({ runtime, host, demo: surface.demo });
      try {
        await surface.ready;
        let reject!: (reason: Error) => void;
        const gate = new Promise<void>((_resolve, fail) => {
          reject = fail;
        });
        vi.mocked(loadPrototypes).mockImplementationOnce(() => gate);
        const pending = surface.setAppearance('shadcn', { '--pui-background': '#abcdef' });
        const failure = expect(pending).rejects.toThrow('injected shell failure');
        const retained = actualSurface(context.refs.mask!);
        expect(retained.style.getPropertyValue('--pui-background')).toBe(theme['--pui-background']);
        reject(new Error('injected shell failure'));
        await failure;
        expect(retained.style.getPropertyValue('--pui-background')).toBe(theme['--pui-background']);
        await surface.setAppearance('shadcn', { ...theme, '--pui-background': '#abcdef' });
        await vi.waitFor(() =>
          expect(actualSurface(context.refs.mask!).style.getPropertyValue('--pui-background')).toBe(
            '#abcdef'
          )
        );
      } finally {
        await rendered.destroy();
      }
    });
    it(`${runtime}: keeps independent scopes and pre-mount appearance isolated`, async () => {
      const hosts = [document.createElement('div'), document.createElement('div')];
      document.body.append(...hosts);
      const light = resolveProjectionThemeSurfaceStyle('brutalist', hosts[0]!);
      hosts[1]!.dataset.theme = 'dark';
      const dark = resolveProjectionThemeSurfaceStyle('brutalist', hosts[1]!);
      const contexts: DemoSetupContext[] = [];
      const child = fixture((context) => {
        contexts.push(context);
        return () => {};
      });
      const before = JSON.stringify(child.root);
      const first = createRuntimePreviewSurface(child, 'brutalist', light, runtime);
      const second = createRuntimePreviewSurface(child, 'brutalist', light, runtime);
      const one = await renderDemo({ runtime, host: hosts[0]!, demo: first.demo });
      const pending = renderDemo({ runtime, host: hosts[1]!, demo: second.demo });
      await second.setAppearance('brutalist', dark);
      const two = await pending;
      try {
        await Promise.all([first.ready, second.ready]);
        await vi.waitFor(() => {
          expect(
            actualSurface(contexts[0]!.refs.mask!).style.getPropertyValue(
              '--pui-secondary-background'
            )
          ).toBe(light['--pui-secondary-background']);
          expect(
            actualSurface(contexts[1]!.refs.mask!).style.getPropertyValue(
              '--pui-secondary-background'
            )
          ).toBe(dark['--pui-secondary-background']);
        });
        await second.setAppearance('brutalist', { '--pui-main': '#112233' });
        await vi.waitFor(() =>
          expect(
            actualSurface(contexts[1]!.refs.mask!).style.getPropertyValue(
              '--pui-secondary-background'
            )
          ).toBe('')
        );
        expect(
          actualSurface(contexts[0]!.refs.mask!).style.getPropertyValue(
            '--pui-secondary-background'
          )
        ).toBe(light['--pui-secondary-background']);
        expect(JSON.stringify(child.root)).toBe(before);
        const replacement = createRuntimePreviewSurface(child, 'brutalist', light, runtime);
        const next = await renderDemo({ runtime, host: hosts[1]!, demo: replacement.demo });
        try {
          await replacement.ready;
          await second.setAppearance('brutalist', dark);
          contexts[1]!.api.setSurfaceStyle!('mask', { '--pui-secondary-background': 'red' });
          await vi.waitFor(() =>
            expect(
              actualSurface(contexts[2]!.refs.mask!).style.getPropertyValue(
                '--pui-secondary-background'
              )
            ).toBe(light['--pui-secondary-background'])
          );
        } finally {
          await next.destroy();
        }
      } finally {
        await two.destroy();
        await one.destroy();
      }
    });
  }
  it('rejects missing/duplicate ownership refs and important declarations before parsing', () => {
    for (const root of [
      { kind: 'proto', prototypeId: 'portal-theme-content', previewTheme: 'portal' },
      {
        kind: 'proto',
        prototypeId: 'portal-theme-content',
        ref: 'content',
        previewTheme: 'portal',
        surfaceStyle: 'padding: 10px !important;',
      },
      {
        kind: 'proto',
        prototypeId: 'portal-theme-content',
        ref: 'content',
        previewTheme: 'portal',
        surfaceStyle: { maxWidth: '430px !IMPORTANT' },
      },
      {
        kind: 'proto',
        prototypeId: 'portal-theme-content',
        ref: 'content',
        previewTheme: 'portal',
        surfaceStyle: 'max-width: 430px !/**/important;',
      },
    ]) {
      expect(() =>
        createRuntimePreviewSurface({ type: 'demo', root } as DemoSpec, 'brutalist')
      ).toThrow();
    }
    const duplicate: DemoSpec = {
      type: 'demo',
      root: {
        kind: 'box',
        children: [
          {
            kind: 'proto',
            prototypeId: 'portal-theme-content',
            ref: 'same',
            previewTheme: 'portal',
          },
          { kind: 'box', ref: 'same' },
        ],
      },
    };
    expect(() => createRuntimePreviewSurface(duplicate, 'brutalist')).toThrow(/unique/);
  });
  it('marks only the concrete AlertDialog Content and Mask in the authored recipe', async () => {
    const { default: demo } = await import('../../content/docs/demo-brutalist-alert-dialog.demo');
    assertDemoSpec(demo);
    const owned: string[] = [];
    const visit = (node: DemoChild) => {
      if (typeof node === 'string' || node.kind === 'text') return;
      if (node.kind === 'proto' && node.previewTheme === 'portal') owned.push(node.prototypeId);
      node.children?.forEach(visit);
    };
    visit(demo.root);
    expect(owned).toEqual(['brutalist-alert-dialog-mask', 'brutalist-alert-dialog-content']);
  });
});
