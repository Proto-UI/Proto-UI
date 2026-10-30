import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createProjectionComposition,
  type ProjectionCompositionControls,
} from './projection-composition';
import {
  collectPrototypeIds,
  type DemoChild,
  type DemoKeyedChild,
  type DemoRuntimeApi,
  type DemoSetupContext,
  type DemoSpec,
  type DemoSurfaceStyle,
} from './demo-types';

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  document.body.replaceChildren();
});
const controls: ProjectionCompositionControls = {
  runtime: { label: 'Runtime', options: [{ value: 'wc', label: 'WC' }], onValueChange() {} },
  family: { label: 'Library', options: [{ value: 'shadcn', label: 'Shadcn' }], onValueChange() {} },
  component: {
    label: 'Component',
    options: [{ value: 'button', label: 'Button' }],
    onValueChange() {},
  },
};
function child(setup?: DemoSpec['setup']): DemoSpec {
  return {
    type: 'demo',
    root: {
      kind: 'box',
      ref: 'results',
      dynamicChildren: {
        prototypeIds: ['shadcn-button'],
      },
      children: [],
    },
    setup,
  };
}
function composition(demo = child()) {
  return createProjectionComposition({
    ownerId: 'dynamic-projection',
    generation: 3,
    runtimeId: 'wc',
    projectionFamilyId: 'shadcn',
    componentId: 'button',
    childDemo: demo,
    controlIds: [],
    controls,
    themeSurfaceStyle: { '--pui-background': '#fff' },
  });
}
function mount(demo: DemoSpec) {
  const host = document.createElement('div');
  const refs: Record<string, HTMLElement> = Object.create(null);
  const walk = (node: DemoChild, parent: HTMLElement) => {
    if (typeof node === 'string' || node.kind === 'text') return;
    const el = document.createElement(node.kind === 'box' ? (node.tag ?? 'div') : 'div');
    if (node.className) el.className = node.className;
    if (node.kind === 'box')
      for (const [name, value] of Object.entries(node.attrs ?? {})) el.setAttribute(name, value);
    if (node.ref) {
      refs[node.ref] = el;
      el.dataset.demoRef = node.ref;
    }
    parent.append(el);
    for (const nested of node.children ?? []) walk(nested, el);
  };
  walk(demo.root, host);
  document.body.append(host);
  return { host, refs };
}
const row = (ref = 'row'): DemoKeyedChild => ({
  key: 'row',
  node: {
    kind: 'proto',
    prototypeId: 'shadcn-button',
    ref,
    children: ['Result'],
    surfaceStyle: { color: 'red' },
  },
});

describe('Website dynamic projection wrapper', () => {
  it('includes future prototypes in explicit recipe closure while the slot remains empty', () => {
    const view = composition();
    const ids = new Set<string>();
    collectPrototypeIds(view.demo.root, ids);
    expect(ids).toContain('shadcn-button');
    const other = child();
    if (other.root.kind !== 'box') throw new Error('Expected slot');
    other.root.dynamicChildren = { prototypeIds: ['brutalist-button'] };
    expect(() => composition(other)).toThrow(/undeclared Prototype/);
  });
  it('projects dynamic values through the selected lane and keeps refs live until cleanup', async () => {
    let childContext!: DemoSetupContext;
    const view = composition(
      child((context) => {
        childContext = context;
      })
    );
    const context = mount(view.demo);
    const setChildren = vi.fn(
      async (_slot: string, _nodes: readonly DemoKeyedChild[]) => 'committed' as const
    );
    const api: DemoRuntimeApi = {
      call() {},
      getExposes() {
        return undefined;
      },
      setProps() {},
      setSurfaceStyle() {},
      setChildren,
    };
    const cleanup = view.demo.setup!({ ...context, api }) as () => void;
    cleanups.push(cleanup);
    await expect(childContext.api.setChildren!('results', [row()])).resolves.toBe('committed');
    const projected = setChildren.mock.calls[0][1][0].node;
    expect(projected).toMatchObject({
      kind: 'proto',
      prototypeId: 'shadcn-button',
      ref: 'row',
      surfaceStyle: { color: 'red', '--pui-background': '#fff' },
    });
    if (typeof projected === 'string' || projected.kind !== 'proto')
      throw new Error('Expected Proto');
    expect(projected.className).toContain('pui-projection-prototype');
    // Adapter portal publication happens later than the first host commit.
    const portaled = document.createElement('div');
    document.body.append(portaled);
    context.refs.row = portaled;
    expect(childContext.refs.row).toBe(portaled);
    expect(Object.keys(childContext.refs)).toContain('row');
    expect(Object.keys(childContext.refs).some((key) => key.startsWith('__pui_projection__'))).toBe(
      false
    );
    delete context.refs.row;
    expect(childContext.refs.row).toBeUndefined();
    cleanup();
    context.refs.row = portaled;
    expect(Object.keys(childContext.refs)).toEqual([]);
    const calls = setChildren.mock.calls.length;
    await expect(childContext.api.setChildren!('results', [row()])).resolves.toBe('disposed');
    expect(setChildren).toHaveBeenCalledTimes(calls);
  });
  it('rejects foreign lane, reserved refs and accessor data before dispatch to the renderer', async () => {
    let ctx!: DemoSetupContext;
    const view = composition(
      child((context) => {
        ctx = context;
      })
    );
    const mounted = mount(view.demo);
    const setChildren = vi.fn(async () => 'committed' as const);
    const api: DemoRuntimeApi = {
      call() {},
      getExposes() {
        return undefined;
      },
      setProps() {},
      setSurfaceStyle() {},
      setChildren,
    };
    cleanups.push(view.demo.setup!({ ...mounted, api }) as () => void);
    await expect(
      ctx.api.setChildren!('results', [
        { key: 'foreign', node: { kind: 'proto', prototypeId: 'brutalist-button' } },
      ])
    ).rejects.toThrow(/selected projection family/);
    await expect(
      ctx.api.setChildren!('results', [row('__pui_projection__forged')])
    ).rejects.toThrow(/reserved/);
    const accessor = Object.defineProperty({}, 'node', {
      get() {
        throw new Error('must not invoke accessor');
      },
      enumerable: true,
    });
    await expect(ctx.api.setChildren!('results', [accessor as DemoKeyedChild])).rejects.toThrow(
      /accessor/
    );
    expect(setChildren).not.toHaveBeenCalled();
  });

  it('keeps private renderer handles stable and preserves mixed author styles across current-theme updates', async () => {
    let ctx!: DemoSetupContext;
    const view = composition(
      child((context) => {
        ctx = context;
      })
    );
    const mounted = mount(view.demo);
    const setChildren = vi.fn(
      async (_slot: string, _nodes: readonly DemoKeyedChild[]) => 'committed' as const
    );
    const setSurfaceStyle = vi.fn((_ref: string, _style: DemoSurfaceStyle) => {});
    const api: DemoRuntimeApi = {
      call() {},
      getExposes() {
        return undefined;
      },
      setProps() {},
      setChildren,
      setSurfaceStyle,
    };
    const cleanup = view.demo.setup!({ ...mounted, api }) as () => void;
    cleanups.push(cleanup);
    const input: DemoKeyedChild[] = [
      {
        key: 'a:/☃',
        node: {
          kind: 'proto',
          prototypeId: 'shadcn-button',
          surfaceStyle: ['padding: 3px', { color: 'red' }],
          children: ['Value'],
        },
      },
    ];
    await ctx.api.setChildren!('results', input);
    const first = setChildren.mock.calls[0][1][0].node;
    if (typeof first === 'string' || first.kind !== 'proto' || !first.ref)
      throw new Error('Expected renderer ref');
    expect(first.ref).toMatch(/^__pui_projection__dynamic_/);
    mounted.refs[first.ref] = document.createElement('div');
    expect(Object.keys(ctx.refs)).not.toContain(first.ref);
    expect(() => ctx.api.setProps(first.ref!, {})).toThrow(/reserved/);
    expect(() => ctx.api.call(first.ref!, 'focus')).toThrow(/reserved/);
    expect(() => ctx.api.getExposes(first.ref!)).toThrow(/reserved/);
    expect(setSurfaceStyle).toHaveBeenLastCalledWith(first.ref, [
      'padding: 3px',
      { color: 'red' },
      { maxWidth: '100%' },
      { '--pui-background': '#fff' },
    ]);
    view.setThemeSurfaceStyle({ '--pui-background': '#222' });
    expect(setSurfaceStyle).toHaveBeenLastCalledWith(first.ref, [
      'padding: 3px',
      { color: 'red' },
      { maxWidth: '100%' },
      { '--pui-background': '#222' },
    ]);
    await ctx.api.setChildren!('results', input);
    const second = setChildren.mock.calls[1][1][0].node;
    expect(second).toMatchObject({ ref: first.ref });
    expect(input[0].node).not.toHaveProperty('ref');
    cleanup();
    const count = setSurfaceStyle.mock.calls.length;
    view.setThemeSurfaceStyle({ '--pui-background': '#333' });
    expect(setSurfaceStyle).toHaveBeenCalledTimes(count);
  });

  it('uses the latest theme after a started commit even if a newer request rejects', async () => {
    let ctx!: DemoSetupContext, finish!: (value: 'committed') => void;
    const view = composition(
      child((context) => {
        ctx = context;
      })
    );
    const mounted = mount(view.demo);
    const first = new Promise<'committed'>((resolve) => {
      finish = resolve;
    });
    const setChildren = vi
      .fn()
      .mockImplementationOnce(() => first)
      .mockRejectedValueOnce(new Error('newer admission rejected'));
    const setSurfaceStyle = vi.fn((_ref: string, _style: DemoSurfaceStyle) => {});
    const api: DemoRuntimeApi = {
      call() {},
      getExposes() {
        return undefined;
      },
      setProps() {},
      setChildren,
      setSurfaceStyle,
    };
    cleanups.push(view.demo.setup!({ ...mounted, api }) as () => void);
    const pending = ctx.api.setChildren!('results', [row('first')]);
    await expect(ctx.api.setChildren!('results', [row('rejected')])).rejects.toThrow(
      'newer admission rejected'
    );
    view.setThemeSurfaceStyle({ '--pui-background': '#222' });
    finish('committed');
    await expect(pending).resolves.toBe('committed');
    expect(setSurfaceStyle).toHaveBeenLastCalledWith('first', {
      color: 'red',
      maxWidth: '100%',
      '--pui-background': '#222',
    });
    view.setThemeSurfaceStyle({ '--pui-background': '#333' });
    expect(setSurfaceStyle).toHaveBeenLastCalledWith('first', {
      color: 'red',
      maxWidth: '100%',
      '--pui-background': '#333',
    });
    expect(setSurfaceStyle.mock.calls.some(([ref]) => ref === 'rejected')).toBe(false);
  });
  it('filters complete subscription batches and owns listener teardown', () => {
    let ctx!: DemoSetupContext;
    const view = composition(
      child((context) => {
        ctx = context;
      })
    );
    const mounted = mount(view.demo);
    const actual = { getExposes: () => ({}) };
    let notify!: (
      snapshot: Readonly<Record<string, typeof actual | undefined>>,
      revision: number
    ) => void;
    const off = vi.fn();
    const subscribePublicInstances = vi.fn((refs, listener) => {
      notify = listener;
      listener(Object.freeze({ result: actual, __pui_projection__private: actual }), 0);
      return off;
    });
    const api: DemoRuntimeApi = {
      call() {},
      getExposes() {
        return undefined;
      },
      setProps() {},
      subscribePublicInstances,
    };
    const cleanup = view.demo.setup!({ ...mounted, api }) as () => void;
    cleanups.push(cleanup);
    const listener = vi.fn();
    expect(() =>
      ctx.api.subscribePublicInstances!(['result', '__pui_projection__private'], listener)
    ).toThrow(/reserved/);
    expect(subscribePublicInstances).not.toHaveBeenCalled();
    ctx.api.subscribePublicInstances!(['result'], listener);
    expect(listener).toHaveBeenCalledWith({ result: actual }, 0);
    cleanup();
    expect(off).toHaveBeenCalledTimes(1);
    notify({ result: undefined }, 1);
    expect(listener).toHaveBeenCalledTimes(1);
    ctx.api.subscribePublicInstances!(['result'], listener);
    expect(subscribePublicInstances).toHaveBeenCalledTimes(1);
  });
  it('forwards only live child public instance lookups, without wrapping or leaking reserved refs', () => {
    let childContext!: DemoSetupContext;
    const view = composition(
      child((context) => {
        childContext = context;
      })
    );
    const mounted = mount(view.demo);
    const instance = { getExposes: () => ({ value: 'actual' }) };
    const getPublicInstance = vi.fn((ref: string) => (ref === 'result' ? instance : undefined));
    const api: DemoRuntimeApi = {
      call() {},
      getExposes() {
        return undefined;
      },
      setProps() {},
      getPublicInstance,
    };
    const cleanup = view.demo.setup!({ ...mounted, api }) as () => void;
    cleanups.push(cleanup);
    expect(childContext.api.getPublicInstance!('result')).toBe(instance);
    expect(childContext.api.getPublicInstance!('result')).toBe(instance);
    const count = getPublicInstance.mock.calls.length;
    expect(() => childContext.api.getPublicInstance!('__pui_projection__private')).toThrow(
      /reserved/
    );
    expect(getPublicInstance).toHaveBeenCalledTimes(count);
    cleanup();
    expect(childContext.api.getPublicInstance!('result')).toBeUndefined();
    expect(childContext.api.getPublicInstance!('__pui_projection__private')).toBeUndefined();
    expect(getPublicInstance).toHaveBeenCalledTimes(count);
  });
  it('does not manufacture public instance access for an external API without it', () => {
    let childContext!: DemoSetupContext;
    const view = composition(
      child((context) => {
        childContext = context;
      })
    );
    const mounted = mount(view.demo);
    const api: DemoRuntimeApi = {
      call() {},
      getExposes() {
        return undefined;
      },
      setProps() {},
    };
    cleanups.push(view.demo.setup!({ ...mounted, api }) as () => void);
    expect(childContext.api.getPublicInstance).toBeUndefined();
  });
  it('explicitly preserves every standard API capability but not nonstandard external extensions', async () => {
    let ctx!: DemoSetupContext;
    const view = composition(
      child((context) => {
        ctx = context;
      })
    );
    const mounted = mount(view.demo);
    const instance = { getExposes: () => ({}) };
    const api = {
      call: vi.fn(() => 'called'),
      getExposes: vi.fn(() => ({ exposed: true })),
      setProps: vi.fn(),
      removeProps: vi.fn(),
      setSurfaceStyle: vi.fn(),
      setChildren: vi.fn(async () => 'committed' as const),
      getPublicInstance: vi.fn(() => instance),
      externalUnfilteredLookup: vi.fn(),
    };
    cleanups.push(view.demo.setup!({ ...mounted, api }) as () => void);
    expect(Object.keys(ctx.api).sort()).toEqual(
      [
        'call',
        'getExposes',
        'getPublicInstance',
        'removeProps',
        'setChildren',
        'setProps',
        'setSurfaceStyle',
      ].sort()
    );
    expect(ctx.api.call('result', 'focusSelf')).toBe('called');
    expect(ctx.api.getExposes('result')).toEqual({ exposed: true });
    expect(ctx.api.getPublicInstance!('result')).toBe(instance);
    ctx.api.setProps('result', { disabled: true });
    expect(api.setProps).toHaveBeenLastCalledWith('result', { disabled: true });
    ctx.api.removeProps!('result', ['disabled']);
    expect(api.removeProps).toHaveBeenLastCalledWith('result', ['disabled']);
    ctx.api.setSurfaceStyle!('result', { color: 'red' });
    expect(api.setSurfaceStyle).toHaveBeenLastCalledWith('result', { color: 'red' });
    await expect(ctx.api.setChildren!('results', [])).resolves.toBe('committed');
    expect(api.setChildren).toHaveBeenCalledWith('results', []);
    expect(api.externalUnfilteredLookup).not.toHaveBeenCalled();
  });
});
