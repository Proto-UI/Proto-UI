import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DemoChild, DemoNode, DemoRuntimeApi, DemoSetupContext, DemoSpec } from './demo-types';
import { loadDemo } from './demo-modules';
import {
  createProjectionComposition,
  PROJECTION_FOCUS_KEYS,
  type ProjectionCompositionControls,
} from './projection-composition';
import { PROJECTION_FAMILY_MANIFESTS, SHARED_BASE_FAMILY_IDS } from './projection-families';

function controls(events: string[] = []): ProjectionCompositionControls {
  return {
    runtime: {
      label: 'Runtime',
      options: [
        { value: 'wc', label: 'Web Components' },
        { value: 'react', label: 'React' },
        { value: 'vue', label: 'Vue' },
        { value: 'vue2', label: 'Vue 2' },
      ],
      onValueChange: (value) => events.push(`runtime:${value}`),
    },
    family: {
      label: 'Projection family',
      options: [
        { value: 'shadcn', label: 'Shadcn' },
        { value: 'brutalist', label: 'Brutalist' },
      ],
      onValueChange: (value) => events.push(`family:${value}`),
    },
    component: {
      label: 'Component',
      options: [
        { value: 'button', label: 'Button' },
        { value: 'switch', label: 'Switch' },
        { value: 'select', label: 'Select' },
      ],
      onValueChange: (value) => events.push(`component:${value}`),
    },
  };
}

function walk(node: DemoChild, visit: (node: DemoNode) => void): void {
  if (typeof node === 'string') return;
  visit(node);
  if (node.kind === 'text') return;
  for (const child of node.children ?? []) walk(child, visit);
}

function findNode(demo: DemoSpec, predicate: (node: DemoNode) => boolean): DemoNode {
  let match: DemoNode | undefined;
  walk(demo.root, (node) => {
    if (!match && predicate(node)) match = node;
  });
  if (!match) throw new Error('Expected projection-composition test node.');
  return match;
}

function mountDemoTree(demo: DemoSpec): {
  host: HTMLElement;
  refs: Record<string, HTMLElement>;
} {
  const host = document.createElement('div');
  const refs: Record<string, HTMLElement> = {};
  const mount = (node: DemoChild, parent: HTMLElement) => {
    if (typeof node === 'string' || node.kind === 'text') return;
    const element = document.createElement('div');
    if (node.className) element.className = node.className;
    if (node.kind === 'proto') element.tabIndex = 0;
    if (node.kind === 'box') {
      for (const [name, value] of Object.entries(node.attrs ?? {})) {
        element.setAttribute(name, value);
      }
    }
    if (node.ref) {
      element.setAttribute('data-demo-ref', node.ref);
      refs[node.ref] = element;
    }
    parent.appendChild(element);
    for (const child of node.children ?? []) mount(child, element);
  };
  mount(demo.root, host);
  document.body.appendChild(host);
  return { host, refs };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('Website projection composition', () => {
  it('clones the child tree and closes style plus identity markers over every Proto surface', () => {
    const childDemo = {
      type: 'demo',
      root: {
        kind: 'box',
        ref: 'child-box',
        attrs: { 'data-child': 'kept' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            ref: 'child-button',
            props: { variant: 'outline' },
            surfaceStyle: { color: 'red' },
            children: ['Child'],
          },
        ],
      },
    } satisfies DemoSpec;
    const originalRoot = structuredClone(childDemo.root);

    const composition = createProjectionComposition({
      ownerId: 'scope-1',
      runtimeId: 'wc',
      projectionFamilyId: 'shadcn',
      generation: 7,
      componentId: 'button',
      childDemo,
      controls: controls(),
      themeSurfaceStyle: { '--pui-background': '#fff' },
    });

    expect(childDemo.root).toEqual(originalRoot);
    const scope = composition.demo.root;
    expect(scope).toMatchObject({
      kind: 'box',
      attrs: {
        'data-projection-scope': 'scope-1',
        'data-projection-family': 'shadcn',
        'data-projection-runtime': 'wc',
        'data-projection-generation': '7',
        'data-projection-state': 'preparing',
      },
    });

    const content = findNode(
      composition.demo,
      (node) => node.kind === 'box' && node.attrs?.['data-projection-content'] === ''
    );
    expect(content).toMatchObject({
      kind: 'box',
      attrs: {
        'data-projection-id': 'button',
        'data-projection-owner': 'scope-1',
        'data-projection-prototype': 'shadcn-button',
      },
    });

    const runtimeControl = findNode(
      composition.demo,
      (node) => node.kind === 'box' && node.attrs?.['data-projection-control'] === 'runtime'
    );
    if (runtimeControl.kind !== 'box') throw new Error('Runtime control box required.');
    const runtimeLabel = runtimeControl.children?.find(
      (child) =>
        typeof child !== 'string' &&
        child.kind === 'box' &&
        child.attrs?.['data-projection-control-label'] === 'runtime'
    );
    expect(runtimeLabel).toMatchObject({
      kind: 'box',
      className: 'pui-projection-control-label',
      attrs: { 'data-projection-control-label': 'runtime' },
      children: ['Runtime'],
    });
    const runtimeSelectRoot = findNode(
      composition.demo,
      (node) => node.kind === 'proto' && node.prototypeId === 'shadcn-select-root'
    );
    expect(runtimeSelectRoot).toMatchObject({
      kind: 'proto',
      surfaceStyle: { width: '100%', '--pui-background': '#fff' },
    });

    const projectedButton = findNode(
      composition.demo,
      (node) => node.kind === 'proto' && node.ref === 'child-button'
    );
    expect(projectedButton).not.toBe(childDemo.root.children![0]);
    expect(projectedButton).toMatchObject({
      kind: 'proto',
      prototypeId: 'shadcn-button',
      props: { variant: 'outline' },
      surfaceStyle: { color: 'red', maxWidth: '100%', '--pui-background': '#fff' },
    });
    if (projectedButton.kind !== 'proto') throw new Error('Expected a projected Proto node.');
    expect(projectedButton.className).toContain('pui-projection-prototype');

    const selectPrototypeIds: string[] = [];
    walk(composition.demo.root, (node) => {
      if (
        node.kind === 'proto' &&
        node.ref?.startsWith('__pui_projection__') &&
        node.prototypeId.includes('select')
      ) {
        selectPrototypeIds.push(node.prototypeId);
      }
    });
    expect(new Set(selectPrototypeIds)).toEqual(
      new Set(['shadcn-select-root', 'shadcn-select-trigger'])
    );
  });

  it('materializes only explicitly requested controls for a fixed-family consumer', () => {
    const composition = createProjectionComposition({
      ownerId: 'fixed-family',
      runtimeId: 'wc',
      projectionFamilyId: 'brutalist',
      generation: 1,
      componentId: 'button',
      childDemo: {
        type: 'demo',
        root: {
          kind: 'proto',
          prototypeId: 'brutalist-button',
          children: ['Button'],
        },
      },
      controls: controls(),
      controlIds: ['runtime', 'runtime'],
    });

    const renderedControls: string[] = [];
    walk(composition.demo.root, (node) => {
      if (node.kind === 'box' && node.attrs?.['data-projection-control']) {
        renderedControls.push(node.attrs['data-projection-control']);
      }
    });
    expect(renderedControls).toEqual(['runtime']);
    expect(() =>
      createProjectionComposition({
        ownerId: 'invalid-fixed-family',
        runtimeId: 'wc',
        projectionFamilyId: 'brutalist',
        generation: 1,
        componentId: 'button',
        childDemo: {
          type: 'demo',
          root: { kind: 'proto', prototypeId: 'brutalist-button' },
        },
        controls: controls(),
        controlIds: ['unknown' as never],
      })
    ).toThrow(/unsupported control/);
  });

  it('accepts every concrete shared-family recipe only after its manifest closure is complete', async () => {
    for (const projectionFamilyId of ['shadcn', 'brutalist'] as const) {
      for (const componentId of SHARED_BASE_FAMILY_IDS) {
        const componentFamily =
          PROJECTION_FAMILY_MANIFESTS[projectionFamilyId].families[componentId];
        const childDemo = await loadDemo(componentFamily.recipeId);

        expect(() =>
          createProjectionComposition({
            ownerId: `complete-${projectionFamilyId}-${componentId}`,
            runtimeId: 'wc',
            projectionFamilyId,
            generation: 1,
            componentId,
            childDemo,
            controls: controls(),
            controlIds: [],
          })
        ).not.toThrow();
      }
    }
  });

  it.each([
    {
      label: 'component root',
      componentId: 'button' as const,
      childDemo: {
        type: 'demo',
        root: { kind: 'box', children: ['Missing Button Prototype'] },
      } satisfies DemoSpec,
      missingPrototypeId: 'shadcn-button',
    },
    {
      label: 'compound part',
      componentId: 'switch' as const,
      childDemo: {
        type: 'demo',
        root: { kind: 'proto', prototypeId: 'shadcn-switch-root' },
      } satisfies DemoSpec,
      missingPrototypeId: 'shadcn-switch-thumb',
    },
  ])('fails closed when a projection recipe omits its required $label', (testCase) => {
    expect(() =>
      createProjectionComposition({
        ownerId: `incomplete-${testCase.componentId}`,
        runtimeId: 'wc',
        projectionFamilyId: 'shadcn',
        generation: 1,
        componentId: testCase.componentId,
        childDemo: testCase.childDemo,
        controls: controls(),
      })
    ).toThrow(
      new RegExp(
        `recipe .* is incomplete; missing required Prototype\\(s\\): ${testCase.missingPrototypeId}`
      )
    );
  });

  it('bounds child setup, closes before value callbacks, locks controls, restores focus, and cleans up', () => {
    const order: string[] = [];
    const childCleanup = vi.fn();
    const childSetup = vi.fn((_context: DemoSetupContext) => childCleanup);
    const childDemo = {
      type: 'demo',
      setup: childSetup,
      root: {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        ref: 'child-button',
        children: ['Child'],
      },
    } satisfies DemoSpec;
    const composition = createProjectionComposition({
      ownerId: 'scope-2',
      runtimeId: 'wc',
      projectionFamilyId: 'shadcn',
      generation: 3,
      componentId: 'button',
      childDemo,
      controls: controls(order),
    });
    const { host, refs } = mountDemoTree(composition.demo);
    const api: DemoRuntimeApi = {
      call(ref, path) {
        order.push(`call:${ref}:${path}`);
      },
      getExposes: () => undefined,
      setProps(ref, props) {
        order.push(`props:${ref}:${String(props.disabled)}`);
      },
    };
    const cleanup = composition.demo.setup?.({ host, refs, api });
    expect(cleanup).toBeTypeOf('function');

    const content = host.querySelector<HTMLElement>('[data-projection-content]')!;
    expect(childSetup).toHaveBeenCalledTimes(1);
    const childContext = childSetup.mock.calls[0]![0];
    expect(childContext.host).toBe(content);
    expect(Object.keys(childContext.refs)).toEqual(['child-button']);

    const childButton = refs['child-button']!;
    expect(childButton.dataset.projectionOwner).toBe('scope-2');
    expect(childButton.dataset.projectionFamily).toBe('shadcn');
    expect(childButton.dataset.projectionRuntime).toBe('wc');
    expect(childButton.dataset.projectionGeneration).toBe('3');
    expect(childButton.dataset.projectionPrototype).toBe('shadcn-button');
    expect(
      host.querySelector('[data-projection-scope]')?.getAttribute('data-projection-state')
    ).toBe('ready');

    composition.setLocked(true);
    expect(host.querySelector('[data-projection-scope]')?.getAttribute('aria-busy')).toBe('true');
    expect(order.filter((entry) => entry.endsWith(':close'))).toHaveLength(3);
    expect(order.filter((entry) => entry.endsWith(':true'))).toHaveLength(3);
    composition.setLocked(false);

    const runtimeControl = findNode(
      composition.demo,
      (node) => node.kind === 'box' && node.attrs?.['data-projection-control'] === 'runtime'
    );
    if (runtimeControl.kind !== 'box') throw new Error('Runtime control box required.');
    const runtimeRoot = runtimeControl.children?.find(
      (child) => typeof child !== 'string' && child.kind === 'proto' && Boolean(child.ref)
    );
    if (typeof runtimeRoot === 'string' || runtimeRoot?.kind !== 'proto' || !runtimeRoot.ref) {
      throw new Error('Runtime control root ref required.');
    }

    order.length = 0;
    refs[runtimeRoot.ref]!.dispatchEvent(
      new CustomEvent('valueChange', { detail: { value: 'react' } })
    );
    expect(order[0]).toBe(`call:${runtimeRoot.ref}:close`);
    expect(order[1]).toBe('runtime:react');

    composition.setEventGateOpen(false);
    order.length = 0;
    refs[runtimeRoot.ref]!.dispatchEvent(
      new CustomEvent('valueChange', { detail: { value: 'react' } })
    );
    expect(order).toEqual([`call:${runtimeRoot.ref}:close`]);
    composition.setEventGateOpen(true);

    expect(composition.restoreFocus(PROJECTION_FOCUS_KEYS.runtime)).toBe(true);
    const runtimeTrigger = runtimeRoot.children?.[0];
    if (
      typeof runtimeTrigger === 'string' ||
      runtimeTrigger?.kind !== 'proto' ||
      !runtimeTrigger.ref
    ) {
      throw new Error('Runtime trigger ref required.');
    }
    expect(document.activeElement).toBe(refs[runtimeTrigger.ref]);

    (cleanup as () => void)();
    expect(childCleanup).toHaveBeenCalledTimes(1);
    order.length = 0;
    refs[runtimeRoot.ref]!.dispatchEvent(
      new CustomEvent('valueChange', { detail: { value: 'react' } })
    );
    expect(order).toEqual([]);
    expect(composition.restoreFocus(PROJECTION_FOCUS_KEYS.runtime)).toBe(false);
  });

  it('continues composition teardown after a control close fails', () => {
    const controlEvents: string[] = [];
    const childCleanup = vi.fn();
    const composition = createProjectionComposition({
      ownerId: 'cleanup-failure',
      runtimeId: 'wc',
      projectionFamilyId: 'shadcn',
      generation: 1,
      componentId: 'button',
      childDemo: {
        type: 'demo',
        setup: () => childCleanup,
        root: {
          kind: 'proto',
          prototypeId: 'shadcn-button',
          children: ['Child'],
        },
      },
      controls: controls(controlEvents),
    });
    const { host, refs } = mountDemoTree(composition.demo);
    const closeFailure = new Error('first control close failed');
    const closeCalls: string[] = [];
    const api: DemoRuntimeApi = {
      call(ref, path) {
        closeCalls.push(`${ref}:${path}`);
        if (closeCalls.length === 1) throw closeFailure;
      },
      getExposes: () => undefined,
      setProps: () => undefined,
    };
    const cleanup = composition.demo.setup?.({ host, refs, api }) as () => void;
    const runtimeRoot = refs.__pui_projection__runtime_root!;

    expect(cleanup).toThrow(closeFailure.message);
    expect(closeCalls).toEqual([
      '__pui_projection__runtime_root:close',
      '__pui_projection__family_root:close',
      '__pui_projection__component_root:close',
    ]);
    expect(childCleanup).toHaveBeenCalledTimes(1);

    closeCalls.length = 0;
    runtimeRoot.dispatchEvent(new CustomEvent('valueChange', { detail: { value: 'react' } }));
    expect(closeCalls).toEqual([]);
    expect(controlEvents).toEqual([]);
    expect(cleanup).not.toThrow();
  });

  it.each(['react', 'vue', 'vue2'] as const)(
    'routes %s projection controls through the framework callback channel only',
    (runtimeId) => {
      const order: string[] = [];
      const composition = createProjectionComposition({
        ownerId: `scope-${runtimeId}`,
        runtimeId,
        projectionFamilyId: 'shadcn',
        generation: 1,
        componentId: 'button',
        childDemo: {
          type: 'demo',
          root: { kind: 'proto', prototypeId: 'shadcn-button', children: ['Child'] },
        },
        controls: controls(order),
        eventGateOpen: false,
      });
      const { host, refs } = mountDemoTree(composition.demo);
      const propsByRef = new Map<string, Record<string, unknown>>();
      const api: DemoRuntimeApi = {
        call(ref, path) {
          order.push(`call:${ref}:${path}`);
        },
        getExposes: () => undefined,
        setProps(ref, props) {
          propsByRef.set(ref, { ...(propsByRef.get(ref) ?? {}), ...props });
        },
      };
      const cleanup = composition.demo.setup?.({ host, refs, api });
      const runtimeRootRef = '__pui_projection__runtime_root';
      const onValueChange = propsByRef.get(runtimeRootRef)?.onValueChange;
      expect(onValueChange).toBeTypeOf('function');

      order.length = 0;
      refs[runtimeRootRef]!.dispatchEvent(
        new CustomEvent('valueChange', { detail: { value: 'wc' } })
      );
      expect(order).toEqual([]);

      (onValueChange as (detail: unknown) => void)({ value: 'wc' });
      expect(order).toEqual([`call:${runtimeRootRef}:close`]);

      composition.setEventGateOpen(true);
      order.length = 0;
      (onValueChange as (detail: unknown) => void)({ value: 'wc' });
      expect(order).toEqual([`call:${runtimeRootRef}:close`, 'runtime:wc']);

      (cleanup as () => void)();
      order.length = 0;
      (onValueChange as (detail: unknown) => void)({ value: 'react' });
      expect(order).toEqual([]);
    }
  );

  it('reprojects the latest complete theme onto mounted and late portal surfaces', async () => {
    const childDemo = {
      type: 'demo',
      root: {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        ref: 'child-button',
        children: ['Child'],
        surfaceStyle: 'color: red;',
      },
    } satisfies DemoSpec;
    const composition = createProjectionComposition({
      ownerId: 'scope-theme',
      runtimeId: 'wc',
      projectionFamilyId: 'shadcn',
      generation: 9,
      componentId: 'button',
      childDemo,
      controls: controls(),
      themeSurfaceStyle: {
        '--pui-background': '#fff',
        '--pui-foreground': '#111',
      },
    });
    const { host, refs } = mountDemoTree(composition.demo);
    const api: DemoRuntimeApi = {
      call: () => undefined,
      getExposes: () => undefined,
      setProps: () => undefined,
    };
    const cleanup = composition.demo.setup?.({ host, refs, api });
    const childButton = refs['child-button']!;
    expect(childButton.style.getPropertyValue('--pui-background')).toBe('#fff');
    const rendererThemeEntries: Array<Record<string, string>> = [];
    walk(composition.demo.root, (node) => {
      if (node.kind !== 'proto' || !node.surfaceStyle) return;
      const entries = Array.isArray(node.surfaceStyle) ? node.surfaceStyle : [node.surfaceStyle];
      const themeEntry = entries.at(-1);
      if (themeEntry && typeof themeEntry === 'object') rendererThemeEntries.push(themeEntry);
    });
    expect(rendererThemeEntries.length).toBeGreaterThan(0);

    composition.setThemeSurfaceStyle({
      '--pui-background': '#090909',
      '--pui-foreground': '#f4f4f5',
    });
    expect(childButton.style.getPropertyValue('--pui-background')).toBe('#090909');
    expect(childButton.style.getPropertyValue('--pui-foreground')).toBe('#f4f4f5');
    for (const rendererThemeEntry of rendererThemeEntries) {
      expect(rendererThemeEntry['--pui-background']).toBe('#090909');
      expect(rendererThemeEntry['--pui-foreground']).toBe('#f4f4f5');
    }
    expect(() => composition.setThemeSurfaceStyle({ '--pui-background': '#fff' })).toThrow(
      /complete token shape/
    );

    const projectedButton = findNode(
      composition.demo,
      (node) => node.kind === 'proto' && node.ref === 'child-button'
    );
    if (projectedButton.kind !== 'proto' || !projectedButton.className) {
      throw new Error('Projected button marker classes required.');
    }
    const portalSurface = document.createElement('div');
    portalSurface.className = projectedButton.className;
    document.body.appendChild(portalSurface);

    await vi.waitFor(() => {
      expect(portalSurface.dataset.projectionOwner).toBe('scope-theme');
      expect(portalSurface.dataset.projectionPrototype).toBe('shadcn-button');
      expect(portalSurface.style.getPropertyValue('--pui-background')).toBe('#090909');
      expect(portalSurface.style.getPropertyValue('--pui-foreground')).toBe('#f4f4f5');
    });

    (cleanup as () => void)();
  });

  it('shares one owner-filtered marker observer across compositions', async () => {
    const childDemo = {
      type: 'demo',
      root: {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        ref: 'child-button',
        children: ['Child'],
      },
    } satisfies DemoSpec;
    const createComposition = (ownerId: string) =>
      createProjectionComposition({
        ownerId,
        runtimeId: 'wc',
        projectionFamilyId: 'shadcn',
        generation: 1,
        componentId: 'button',
        childDemo,
        controls: controls(),
        controlIds: [],
      });
    const first = createComposition('marker-owner-a');
    const second = createComposition('marker-owner-b');
    const firstMount = mountDemoTree(first.demo);
    const secondMount = mountDemoTree(second.demo);
    const api: DemoRuntimeApi = {
      call: () => undefined,
      getExposes: () => undefined,
      setProps: () => undefined,
    };
    const firstCleanup = first.demo.setup?.({ ...firstMount, api });
    const secondCleanup = second.demo.setup?.({ ...secondMount, api });
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    const documentScan = vi.spyOn(document, 'getElementsByClassName');
    let cleaned = false;

    try {
      firstMount.refs['child-button']!.classList.add('state-change');
      await vi.waitFor(() => expect(documentScan).toHaveBeenCalled());
      expect(documentScan).toHaveBeenCalledTimes(1);

      (firstCleanup as () => void)();
      (secondCleanup as () => void)();
      cleaned = true;
      documentScan.mockClear();
      firstMount.refs['child-button']!.classList.add('after-cleanup');
      await new Promise<void>((resolve) => queueMicrotask(resolve));
      expect(documentScan).not.toHaveBeenCalled();
    } finally {
      documentScan.mockRestore();
      if (!cleaned) {
        (firstCleanup as () => void)();
        (secondCleanup as () => void)();
      }
    }
  });

  it('stamps SVG Prototype surfaces with generation identity and theme values', async () => {
    const componentFamily = PROJECTION_FAMILY_MANIFESTS.shadcn.families.toggle;
    const childDemo = await loadDemo(componentFamily.recipeId);
    const composition = createProjectionComposition({
      ownerId: 'scope-svg',
      runtimeId: 'react',
      projectionFamilyId: 'shadcn',
      generation: 10,
      componentId: 'toggle',
      childDemo,
      controls: controls(),
      controlIds: [],
      themeSurfaceStyle: {
        '--pui-background': '#fff',
        '--pui-foreground': '#111',
      },
    });
    const projectedIcon = findNode(
      composition.demo,
      (node) => node.kind === 'proto' && node.prototypeId === 'lucide-icon'
    );
    if (projectedIcon.kind !== 'proto' || !projectedIcon.className) {
      throw new Error('Projected Lucide marker classes required.');
    }
    const { host, refs } = mountDemoTree(composition.demo);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add(...projectedIcon.className.split(/\s+/).filter(Boolean));
    document.body.appendChild(svg);
    const api: DemoRuntimeApi = {
      call: () => undefined,
      getExposes: () => undefined,
      setProps: () => undefined,
    };

    const cleanup = composition.demo.setup?.({ host, refs, api });

    expect(svg.getAttribute('data-projection-owner')).toBe('scope-svg');
    expect(svg.getAttribute('data-projection-family')).toBe('shadcn');
    expect(svg.getAttribute('data-projection-runtime')).toBe('react');
    expect(svg.getAttribute('data-projection-generation')).toBe('10');
    expect(svg.getAttribute('data-projection-prototype')).toBe('lucide-icon');
    expect(svg.style.getPropertyValue('--pui-background')).toBe('#fff');
    expect(svg.style.getPropertyValue('--pui-foreground')).toBe('#111');

    (cleanup as () => void)();
  });

  it('runs child cleanup and releases the mount when setup fails after child setup', () => {
    const childCleanup = vi.fn();
    const childDemo = {
      type: 'demo',
      setup: () => childCleanup,
      root: {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        children: ['Child'],
      },
    } satisfies DemoSpec;
    const composition = createProjectionComposition({
      ownerId: 'scope-failure',
      runtimeId: 'wc',
      projectionFamilyId: 'shadcn',
      generation: 1,
      componentId: 'button',
      childDemo,
      controls: controls(),
    });
    const { host, refs } = mountDemoTree(composition.demo);
    const failingApi: DemoRuntimeApi = {
      call: () => undefined,
      getExposes: () => undefined,
      setProps: () => {
        throw new Error('setProps failed');
      },
    };

    expect(() => composition.demo.setup?.({ host, refs, api: failingApi })).toThrow(
      /setProps failed/
    );
    expect(childCleanup).toHaveBeenCalledTimes(1);
    expect(composition.restoreFocus(PROJECTION_FOCUS_KEYS.runtime)).toBe(false);
  });
});
