import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { URL as NodeURL } from 'node:url';
import { definePrototype, type ExposeState, type ExposedStateHandle } from '@proto.ui/core';
import { registerPrototype } from '../src/components/PrototypePreviewer/registry';
import type { ShadcnDialogContentExposes } from '../../../packages/prototypes/shadcn/src/dialog';
import { SHADCN_TYPOGRAPHY } from '../../../packages/prototypes/shadcn/src/text/typography';
import { BRUTALIST_THEME } from '../../../packages/prototypes/brutalist/src/theme';
import { renderDemo } from '../src/components/PrototypePreviewer/demo-renderer';
import { loadPrototypes } from '../src/components/PrototypePreviewer/prototype-modules';
import { createRuntimePreviewSurface } from '../src/components/PrototypePreviewer/runtime-preview-surface';
import {
  collectPrototypeIds,
  type DemoSetupContext,
  type DemoSpec,
} from '../src/components/PrototypePreviewer/demo-types';
import { GET } from '../src/pages/styles/site-library-theme.css';

// Real framework and Adapter implementations; only CDN acquisition is replaced.
vi.mock('../src/components/PrototypePreviewer/runtimes/react-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/react/package.json');
  return {
    loadReact: async () => ({
      React: require('react'),
      ReactDOM: { ...require('react-dom'), ...require('react-dom/client') },
    }),
  };
});
vi.mock('../src/components/PrototypePreviewer/runtimes/vue-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/apps/www/package.json');
  return { loadVue: async () => require('vue') };
});
vi.mock('../src/components/PrototypePreviewer/runtimes/vue2-runtime', async (original) => {
  const actual =
    await original<typeof import('../src/components/PrototypePreviewer/runtimes/vue2-runtime')>();
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/vue2/package.json');
  return { ...actual, loadVue2: async () => require('vue') };
});

afterEach(() => {
  document.body.replaceChildren();
  document.body.removeAttribute('style');
});
const actualSurface = (boundary: HTMLElement) =>
  boundary.shadowRoot?.querySelector<HTMLElement>('[part~="root"]') ?? boundary;
function nativeInput(root: ParentNode | null | undefined): HTMLInputElement | null {
  if (!root) return null;
  if (root instanceof HTMLInputElement) return root;
  if (root instanceof Element && root.shadowRoot) {
    const owned = nativeInput(root.shadowRoot);
    if (owned) return owned;
  }
  const direct = root.querySelector<HTMLInputElement>('input');
  if (direct) return direct;
  for (const element of root.querySelectorAll('*')) {
    if (element.shadowRoot) {
      const nested = nativeInput(element.shadowRoot);
      if (nested) return nested;
    }
  }
  return null;
}
type DialogContentRuntimeExposes = {
  [K in keyof ShadcnDialogContentExposes]: ShadcnDialogContentExposes[K] extends ExposeState<
    infer V
  >
    ? ExposedStateHandle<V>
    : never;
};
const shadcn = {
  '--pui-font-sans': SHADCN_TYPOGRAPHY['font-sans'],
  '--pui-font-heading': SHADCN_TYPOGRAPHY['font-heading'],
};
const neo = {
  '--pui-font-sans': BRUTALIST_THEME.light['font-sans']!,
  '--pui-font-heading': BRUTALIST_THEME.light['font-heading']!,
};

describe('shared Shadcn typography outside the Text prototype', () => {
  it('publishes an SSR bank without globally selecting that font', async () => {
    const css = await GET().text();
    const bank = css.match(/:root\s*\{([^}]+)\}/)?.[1];
    expect(bank).toContain(`--site-shadcn-font-sans: ${SHADCN_TYPOGRAPHY['font-sans']}`);
    expect(bank).not.toMatch(/(?:^|[;\n])\s*font-family:/);
    const consumer = readFileSync(
      new NodeURL('../src/styles/site-library-family.css', import.meta.url),
      'utf8'
    );
    expect(consumer).toContain("[data-site-family-scope][data-site-library-family='shadcn']");
    expect(consumer).toContain("[data-site-control-family='shadcn']");
    expect(consumer).toContain('--font-sans: var(--pui-font-sans)');
    expect(consumer).toContain('font-family: var(--pui-font-sans)');
  });

  it('keeps renderer refs live while preserving isolated local writes and retirement snapshots', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    let child!: DemoSetupContext;
    let owner!: DemoSetupContext;
    let cleanupRef: HTMLElement | undefined;
    let cleanedRef: HTMLElement | undefined;
    const cleanup = vi.fn(() => {
      cleanedRef = child.refs.original;
    });
    const surface = createRuntimePreviewSurface(
      {
        type: 'demo',
        root: { kind: 'box', ref: 'original', children: ['Content'] },
        setup(context) {
          child = context;
          return cleanup;
        },
      },
      'shadcn',
      shadcn,
      'wc'
    );
    const setup = surface.demo.setup!;
    const rendered = await renderDemo({
      runtime: 'wc',
      host,
      demo: {
        ...surface.demo,
        setup(context) {
          owner = context;
          return setup(context);
        },
      },
    });
    try {
      await surface.ready;
      const reserved = [
        '__website_runtime_preview_surface__',
        '__website_runtime_preview_surface__-mount',
        '__website_runtime_preview_surface__-content',
      ];
      for (const ref of reserved) {
        owner.refs[ref] ??= document.createElement('div');
        expect(child.refs[ref]).toBeUndefined();
        expect(ref in child.refs).toBe(false);
        expect(Object.getOwnPropertyDescriptor(child.refs, ref)).toBeUndefined();
        const owned = owner.refs[ref];
        expect(Reflect.set(child.refs, ref, document.createElement('span'))).toBe(false);
        expect(Reflect.defineProperty(child.refs, ref, { value: owned })).toBe(false);
        expect(Reflect.deleteProperty(child.refs, ref)).toBe(false);
        expect(owner.refs[ref]).toBe(owned);
      }
      const inherited = Object.create(null) as Record<string, HTMLElement>;
      Reflect.set(inherited, 'constructor', document.createElement('span'));
      Reflect.set(inherited, '__proto__', document.createElement('span'));
      const previousPrototype = Object.getPrototypeOf(owner.refs);
      const symbol = Symbol('not-an-author-ref');
      Reflect.set(owner.refs, symbol, document.createElement('span'));
      Object.setPrototypeOf(owner.refs, inherited);
      try {
        for (const ref of ['constructor', '__proto__', symbol]) {
          expect(Reflect.get(child.refs, ref)).toBeUndefined();
          expect(Reflect.has(child.refs, ref)).toBe(false);
          expect(Object.getOwnPropertyDescriptor(child.refs, ref)).toBeUndefined();
        }
        expect(Reflect.ownKeys(child.refs)).toEqual(['original']);
      } finally {
        Object.setPrototypeOf(owner.refs, previousPrototype);
        Reflect.deleteProperty(owner.refs, symbol);
      }
      expect(Object.keys(child.refs)).toEqual(['original']);
      const replacement = document.createElement('button');
      owner.refs.original = replacement;
      expect(child.refs.original).toBe(replacement);
      expect(Object.getOwnPropertyDescriptor(child.refs, 'original')?.value).toBe(replacement);
      owner.refs.added = document.createElement('input');
      expect(child.refs.added).toBe(owner.refs.added);
      expect(Object.keys(child.refs)).toEqual(['original', 'added']);
      delete owner.refs.added;
      expect(child.refs.added).toBeUndefined();
      expect('added' in child.refs).toBe(false);
      const local = document.createElement('a');
      child.refs.original = local;
      expect(child.refs.original).toBe(local);
      expect(owner.refs.original).toBe(replacement);
      const laterOwner = document.createElement('section');
      owner.refs.original = laterOwner;
      expect(child.refs.original).toBe(local);
      expect(Object.getOwnPropertyDescriptor(child.refs, 'original')).toMatchObject({
        configurable: true,
        enumerable: true,
        writable: true,
        value: local,
      });
      expect(Reflect.deleteProperty(child.refs, 'original')).toBe(true);
      expect(child.refs.original).toBeUndefined();
      expect('original' in child.refs).toBe(false);
      expect(Object.keys(child.refs)).not.toContain('original');
      expect(Object.getOwnPropertyDescriptor(child.refs, 'original')).toBeUndefined();
      owner.refs.original = replacement;
      expect(child.refs.original).toBeUndefined();
      child.refs.original = local;
      expect(child.refs.original).toBe(local);
      expect(owner.refs.original).toBe(replacement);

      // Defining an existing virtual own property retains the original data
      // descriptor flags, as it did on the previous local rest-copy object.
      owner.refs.defined = replacement;
      expect(Reflect.defineProperty(child.refs, 'defined', { value: local })).toBe(true);
      expect(Object.getOwnPropertyDescriptor(child.refs, 'defined')).toEqual({
        configurable: true,
        enumerable: true,
        writable: true,
        value: local,
      });
      expect(owner.refs.defined).toBe(replacement);
      expect(Reflect.deleteProperty(child.refs, 'defined')).toBe(true);
      expect('defined' in child.refs).toBe(false);
      expect(owner.refs.defined).toBe(replacement);

      let accessorValue: HTMLElement = local;
      Object.defineProperty(child.refs, 'accessor', {
        configurable: true,
        enumerable: false,
        get() {
          expect(this).toBe(child.refs);
          return accessorValue;
        },
        set(next: HTMLElement) {
          expect(this).toBe(child.refs);
          accessorValue = next;
        },
      });
      child.refs.accessor = replacement;
      expect(child.refs.accessor).toBe(replacement);
      expect(Object.keys(child.refs)).not.toContain('accessor');
      expect(Reflect.ownKeys(child.refs)).toContain('accessor');
      expect(owner.refs.accessor).toBeUndefined();
      Object.defineProperty(child.refs, 'fixed', { value: local });
      expect(Reflect.set(child.refs, 'fixed', replacement)).toBe(false);
      expect(Reflect.deleteProperty(child.refs, 'fixed')).toBe(false);
      expect(Reflect.defineProperty(child.refs, 'fixed', { value: replacement })).toBe(false);
      expect(child.refs.fixed).toBe(local);
      expect(Object.getOwnPropertyDescriptor(child.refs, 'fixed')).toEqual({
        configurable: false,
        enumerable: false,
        writable: false,
        value: local,
      });
      const localSymbol = Symbol('local-only');
      expect(Reflect.set(child.refs, localSymbol, local)).toBe(true);
      expect(Reflect.get(child.refs, localSymbol)).toBe(local);
      expect(Reflect.has(owner.refs, localSymbol)).toBe(false);

      // Explicitly sealing/freezing a local object snapshots the visible keys;
      // it must neither mutate the renderer nor violate Proxy ownKeys rules.
      owner.refs.snapshot = replacement;
      expect(Reflect.preventExtensions(child.refs)).toBe(true);
      expect(Object.isExtensible(child.refs)).toBe(false);
      expect(child.refs.snapshot).toBe(replacement);
      owner.refs.snapshot = local;
      owner.refs.late = local;
      expect(child.refs.snapshot).toBe(replacement);
      expect(child.refs.late).toBeUndefined();
      expect('late' in child.refs).toBe(false);
      expect(Reflect.set(child.refs, 'extra', local)).toBe(false);
      Object.freeze(child.refs);
      expect(Object.isFrozen(child.refs)).toBe(true);
      expect(Reflect.set(child.refs, 'original', replacement)).toBe(false);
      expect(owner.refs.original).toBe(replacement);
      expect(owner.refs.snapshot).toBe(local);
      expect(Object.isExtensible(owner.refs)).toBe(true);
      cleanupRef = child.refs.original;
    } finally {
      await rendered.destroy();
    }
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(cleanedRef).toBe(cleanupRef);
    expect(child.refs.original).toBe(cleanupRef);
    expect('original' in child.refs).toBe(true);
    expect(Object.keys(child.refs)).toContain('original');
    expect(Object.getOwnPropertyDescriptor(child.refs, 'original')?.value).toBe(cleanupRef);
    await Promise.resolve().then(() => {
      owner.refs.original = document.createElement('div');
      expect(child.refs.original).toBe(cleanupRef);
      expect(Reflect.set(child.refs, 'original', owner.refs.original)).toBe(false);
    });
  });

  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    it(`${runtime}: keeps the retiring generation readable through child unmount without following later owner refs`, async () => {
      const host = document.createElement('div');
      document.body.append(host);
      let child!: DemoSetupContext;
      let owner!: DemoSetupContext;
      let original: HTMLElement;
      let cleanupRef: HTMLElement | undefined;
      let unmountedRef: HTMLElement | undefined;
      let localAtUnmount: HTMLElement | undefined;
      const order: string[] = [];
      const poison = document.createElement('aside');
      const probe = definePrototype({
        name: `font-retirement-${runtime}`,
        setup(def) {
          def.lifecycle.onUnmounted(() => {
            order.push('unmounted');
            unmountedRef = child.refs.control;
            localAtUnmount = child.refs.cleanupLocal;
          });
        },
      });
      registerPrototype(probe.name, probe);
      const surface = createRuntimePreviewSurface(
        {
          type: 'demo',
          root: { kind: 'proto', prototypeId: probe.name, ref: 'control' },
          setup(context) {
            child = context;
            return () => {
              order.push('cleanup');
              cleanupRef = child.refs.control;
              // Controlled owner-map replacement models reentry at cleanup:
              // the released view must already be detached from this map.
              owner.refs.control = poison;
              owner.refs.newOwner = poison;
              child.refs.cleanupLocal = original;
            };
          },
        },
        'shadcn',
        shadcn,
        runtime
      );
      const setup = surface.demo.setup!;
      const rendered = await renderDemo({
        runtime,
        host,
        demo: {
          ...surface.demo,
          setup(context) {
            owner = context;
            return setup(context);
          },
        },
      });
      try {
        await surface.ready;
        original = child.refs.control!;
        expect(original).toBeTruthy();
        expect(order).toEqual([]);
      } finally {
        await rendered.destroy();
      }
      await vi.waitFor(() => expect(order).toEqual(['cleanup', 'unmounted']));
      expect(cleanupRef).toBe(original!);
      expect(unmountedRef).toBe(original!);
      expect(localAtUnmount).toBe(original!);
      expect(child.refs.control).toBe(original!);
      expect(child.refs.newOwner).toBeUndefined();
      expect('newOwner' in child.refs).toBe(false);
      expect(Object.keys(child.refs)).not.toContain('newOwner');
      expect(Object.getOwnPropertyDescriptor(child.refs, 'newOwner')).toBeUndefined();
      await Promise.resolve().then(() => {
        owner.refs.control = poison;
      });
      expect(child.refs.control).toBe(original!);
      child.refs.control = document.createElement('button');
      expect(child.refs.control).not.toBe(original!);
      expect(owner.refs.control).toBe(poison);
    });
  }

  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    it(`${runtime}: carries one family map to controls and escaped portals, without replacing their state`, async () => {
      const host = document.createElement('div');
      document.body.style.setProperty('--pui-font-sans', 'Unrelated Body Font');
      document.body.append(host);
      let context!: DemoSetupContext;
      const demo: DemoSpec = {
        type: 'demo',
        root: {
          kind: 'box',
          children: [
            {
              kind: 'proto',
              prototypeId: 'shadcn-button',
              ref: 'button',
              props: { styleProfile: 'rhea' },
              children: ['Action'],
            },
            {
              kind: 'proto',
              prototypeId: 'shadcn-accordion-root',
              ref: 'accordion',
              props: { styleProfile: 'rhea', defaultOpenItems: ['one'] },
              children: [
                {
                  kind: 'proto',
                  prototypeId: 'shadcn-accordion-item',
                  props: { value: 'one' },
                  children: [
                    {
                      kind: 'proto',
                      prototypeId: 'shadcn-accordion-heading',
                      props: { level: 3 },
                      children: [
                        {
                          kind: 'proto',
                          prototypeId: 'shadcn-accordion-trigger',
                          ref: 'label',
                          children: ['FAQ label · 问题'],
                        },
                      ],
                    },
                    {
                      kind: 'proto',
                      prototypeId: 'shadcn-accordion-content',
                      children: ['Answer · 回答'],
                    },
                  ],
                },
              ],
            },
            {
              kind: 'proto',
              prototypeId: 'shadcn-dialog-root',
              ref: 'dialog',
              props: { styleProfile: 'rhea', a11yLabel: 'Font fixture' },
              children: [
                { kind: 'proto', prototypeId: 'shadcn-dialog-trigger', children: ['Open'] },
                {
                  kind: 'proto',
                  prototypeId: 'shadcn-dialog-mask',
                  ref: 'mask',
                  previewTheme: 'portal',
                },
                {
                  kind: 'proto',
                  prototypeId: 'shadcn-dialog-content',
                  ref: 'content',
                  previewTheme: 'portal',
                  children: [
                    {
                      kind: 'proto',
                      prototypeId: 'shadcn-input-root',
                      ref: 'input',
                      props: { styleProfile: 'rhea', defaultValue: 'retained' },
                    },
                    { kind: 'proto', prototypeId: 'shadcn-dialog-close', children: ['Close'] },
                  ],
                },
              ],
            },
          ],
        },
        setup(value) {
          context = value;
        },
      };
      const ids = new Set<string>();
      collectPrototypeIds(demo.root, ids);
      await loadPrototypes([...ids]);
      const surface = createRuntimePreviewSurface(demo, 'shadcn', shadcn, runtime);
      const rendered = await renderDemo({ runtime, host, demo: surface.demo });
      const current = (ref: string) =>
        document.querySelector<HTMLElement>(`[data-demo-ref="${ref}"]`)!;
      const contentState = () =>
        context.api.getExposes('content') as DialogContentRuntimeExposes | undefined;
      try {
        await surface.ready;
        expect(current('button')).toBeTruthy();
        expect(current('label')).toBeTruthy();
        const button = current('button');
        const label = current('label');
        const canvas = host.querySelector<HTMLElement>('.pui-runtime-preview-surface')!;
        expect(canvas.style.getPropertyValue('--pui-font-sans')).toBe(shadcn['--pui-font-sans']);
        context.api.setProps('dialog', { open: true });
        const input = await vi.waitFor(() => {
          expect(contentState()?.transitionState.get()).toBe('entered');
          expect(contentState()?.isPresent.get()).toBe(true);
          const currentInput = nativeInput(context.refs.input);
          expect(currentInput).not.toBeNull();
          expect(currentInput?.isConnected).toBe(true);
          return currentInput!;
        });
        await vi.waitFor(() => {
          const content = current('content');
          expect(host.contains(content)).toBe(false);
          // Keep the selected theme variable below; the default now comes from
          // the base-layer owned marker, leaving authored utilities stronger.
          expect(actualSurface(content).style.fontFamily).toBe('');
          expect(
            actualSurface(content).classList.contains('pui-runtime-preview-owned-surface')
          ).toBe(true);
          expect(actualSurface(content).style.getPropertyValue('--pui-font-sans')).toBe(
            shadcn['--pui-font-sans']
          );
          expect(input.value).toBe('retained');
        });
        for (const [family, theme] of [
          ['brutalist', neo],
          ['shadcn', shadcn],
        ] as const) {
          await surface.setAppearance(family, theme);
          await vi.waitFor(() =>
            expect(
              actualSurface(current('content')).style.getPropertyValue('--pui-font-sans')
            ).toBe(theme['--pui-font-sans'])
          );
          expect(current('button')).toBe(button);
          expect(current('label')).toBe(label);
          expect(nativeInput(context.refs.input)).toBe(input);
          expect(input.value).toBe('retained');
        }
        context.api.setProps('dialog', { open: false });
        await vi.waitFor(() => {
          expect(contentState()?.transitionState.get()).toBe('closed');
          expect(contentState()?.isPresent.get()).toBe(false);
        });
        context.api.setProps('dialog', { open: true });
        await vi.waitFor(() => {
          expect(contentState()?.transitionState.get()).toBe('entered');
          expect(contentState()?.isPresent.get()).toBe(true);
          expect(actualSurface(current('content')).style.getPropertyValue('--pui-font-sans')).toBe(
            shadcn['--pui-font-sans']
          );
          expect(nativeInput(context.refs.input)?.value).toBe('retained');
        });
        expect(document.body.style.getPropertyValue('--pui-font-sans')).toBe('Unrelated Body Font');
      } finally {
        await rendered.destroy();
      }
      expect(document.querySelector('[data-demo-ref="content"]')).toBeNull();
      expect(document.body.style.getPropertyValue('--pui-font-sans')).toBe('Unrelated Body Font');
    });
  }
});

// Source guards only. Native cascade evidence belongs to the real browser suite.
describe('application-authored independent font scope', () => {
  it('keeps the ordinary root font bank separate from descendant Shadcn selection', () => {
    const css = readFileSync(
      new NodeURL('../src/styles/site-library-family.css', import.meta.url),
      'utf8'
    );
    expect(css).toMatch(/:root\s*\{\s*--site-default-font-sans: var\(--font-sans\);\s*\}/);
    const boundary = css.indexOf('[data-site-font-scope]');
    const baseStart = css.indexOf('@layer base {');
    const baseEnd = css.indexOf('\n}\n', baseStart);
    expect(boundary).toBeGreaterThan(baseStart);
    expect(boundary).toBeGreaterThan(css.indexOf('.pui-runtime-preview-owned-surface'));
    expect(boundary).toBeGreaterThan(css.indexOf("[data-site-control-family='shadcn']"));
    expect(boundary).toBeLessThan(baseEnd);
    const rule = css.match(/\[data-site-font-scope\]:not\(:root\)\s*\{([^}]+)\}/)?.[1];
    expect(rule).toContain('--font-sans: var(--site-font-sans);');
    expect(rule).toContain('font-family: var(--site-font-sans);');
    expect(rule).not.toMatch(/Geist|library|shadcn|brutalist|!important|--pui-/i);
    const original = readFileSync(
      new NodeURL('../src/styles/tailwindcss.css', import.meta.url),
      'utf8'
    );
    const sans = original.match(/--font-sans:([\s\S]*?);/)?.[1];
    expect(sans).toContain('ui-sans-serif, system-ui');
    expect(sans).not.toContain('--site-default-font-sans');
    expect(sans).not.toContain('Geist');
  });
});
