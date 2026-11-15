import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProjectionComposition } from './projection-composition';
import type {
  DemoChild,
  DemoKeyedChild,
  DemoRuntimeApi,
  DemoSetupContext,
  DemoSurfaceStyle,
} from './demo-types';
import type { ProjectionThemeSurfaceStyle } from './projection-theme';

// Real projection/composition code at its public renderer API boundary. The
// controlled renderer below supplies commit completion, not native CPU timing.
const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  document.body.replaceChildren();
});

function deferred() {
  let finish!: (status: 'committed') => void;
  const result = new Promise<'committed'>((resolve) => (finish = resolve));
  return { result, finish: () => finish('committed') };
}

const row = (ref: string, surfaceStyle: DemoSurfaceStyle = { color: 'red' }): DemoKeyedChild => ({
  key: ref,
  node: { kind: 'proto', prototypeId: 'shadcn-button', ref, surfaceStyle, children: [ref] },
});

function fixture(theme: ProjectionThemeSurfaceStyle = { '--pui-background': '#fff' }) {
  let childContext!: DemoSetupContext;
  const view = createProjectionComposition({
    ownerId: 'theme-cost',
    generation: 1,
    runtimeId: 'react',
    projectionFamilyId: 'shadcn',
    componentId: 'button',
    controlIds: [],
    controls: {
      runtime: {
        label: 'Runtime',
        options: [{ value: 'react', label: 'React' }],
        onValueChange() {},
      },
      family: {
        label: 'Library',
        options: [{ value: 'shadcn', label: 'Shadcn' }],
        onValueChange() {},
      },
      component: {
        label: 'Component',
        options: [{ value: 'button', label: 'Button' }],
        onValueChange() {},
      },
    },
    contentRecipe: {
      id: 'button',
      prototypeIds: ['shadcn-button'],
      rootPrototypeId: 'shadcn-button',
    },
    childDemo: {
      type: 'demo',
      root: {
        kind: 'box',
        children: ['left', 'right'].map((ref) => ({
          kind: 'box' as const,
          ref,
          dynamicChildren: { prototypeIds: ['shadcn-button'] },
          children: [],
        })),
      },
      setup(context) {
        childContext = context;
      },
    },
    themeSurfaceStyle: theme,
  });
  const host = document.createElement('div');
  const refs: Record<string, HTMLElement> = Object.create(null);
  const mount = (node: DemoChild, parent: HTMLElement) => {
    if (typeof node === 'string' || node.kind === 'text') return;
    const element = document.createElement(node.kind === 'box' ? (node.tag ?? 'div') : 'div');
    if (node.className) element.className = node.className;
    if (node.kind === 'box')
      for (const [name, value] of Object.entries(node.attrs ?? {}))
        element.setAttribute(name, value);
    if (node.ref) {
      refs[node.ref] = element;
      element.dataset.demoRef = node.ref;
    }
    parent.append(element);
    for (const nested of node.children ?? []) mount(nested, element);
  };
  mount(view.demo.root, host);
  document.body.append(host);
  const setChildren = vi.fn(
    async (_slot: string, _children: readonly DemoKeyedChild[]) => 'committed' as const
  );
  const setSurfaceStyle = vi.fn((_ref: string, _style: DemoSurfaceStyle) => {});
  const api: DemoRuntimeApi = {
    setProps() {},
    call() {},
    getExposes() {
      return undefined;
    },
    setChildren,
    setSurfaceStyle,
  };
  const cleanup = view.demo.setup!({ host, refs, api }) as () => void;
  cleanups.push(cleanup);
  return { view, api: childContext.api, setChildren, setSurfaceStyle, cleanup };
}

describe('Projection dynamic theme commit cost', () => {
  it('commits two correctly themed rows without two redundant renderer style commits', async () => {
    const h = fixture();
    await expect(h.api.setChildren!('left', [row('one'), row('two')])).resolves.toBe('committed');
    expect(h.setChildren).toHaveBeenCalledOnce();
    for (const { node } of h.setChildren.mock.calls[0][1])
      expect(node).toMatchObject({
        surfaceStyle: { color: 'red', maxWidth: '100%', '--pui-background': '#fff' },
      });
    expect(h.setSurfaceStyle).not.toHaveBeenCalled();
  });

  it('does not repaint another already committed slot when a new slot uses the current theme', async () => {
    const h = fixture();
    await h.api.setChildren!('left', [row('left-row')]);
    h.setSurfaceStyle.mockClear();
    await h.api.setChildren!('right', [row('right-row')]);
    expect(h.setChildren.mock.calls[1][1][0].node).toMatchObject({
      ref: 'right-row',
      surfaceStyle: { '--pui-background': '#fff' },
    });
    expect(h.setSurfaceStyle).not.toHaveBeenCalled();
  });

  it.each(['same-value replacement', 'changed then restored'] as const)(
    'does not replay the theme after a pending commit sees %s',
    async (change) => {
      const h = fixture();
      const pending = deferred();
      h.setChildren.mockReturnValueOnce(pending.result);
      const commit = h.api.setChildren!('left', [row('one')]);
      if (change === 'changed then restored')
        h.view.setThemeSurfaceStyle({ '--pui-background': '#222' });
      h.view.setThemeSurfaceStyle({ '--pui-background': '#fff' });
      pending.finish();
      await expect(commit).resolves.toBe('committed');
      expect(h.setChildren.mock.calls[0][1][0].node).toMatchObject({
        surfaceStyle: { '--pui-background': '#fff' },
      });
      expect(h.setSurfaceStyle).not.toHaveBeenCalled();
    }
  );

  it('repairs only the newly committed slot when its captured theme became stale', async () => {
    const h = fixture();
    await h.api.setChildren!('left', [row('left-row')]);
    const pending = deferred();
    h.setChildren.mockReturnValueOnce(pending.result);
    const commit = h.api.setChildren!('right', [row('right-row')]);
    h.setSurfaceStyle.mockClear();
    h.view.setThemeSurfaceStyle({ '--pui-background': '#222' });
    // An explicit theme update reaches committed children synchronously.
    expect(h.setSurfaceStyle.mock.calls).toEqual([
      ['left-row', { color: 'red', maxWidth: '100%', '--pui-background': '#222' }],
    ]);
    h.setSurfaceStyle.mockClear();
    pending.finish();
    await expect(commit).resolves.toBe('committed');
    expect(h.setSurfaceStyle.mock.calls).toEqual([
      ['right-row', { color: 'red', maxWidth: '100%', '--pui-background': '#222' }],
    ]);
  });

  it('does not repaint the newer slot tree when an older successful completion arrives late', async () => {
    const h = fixture();
    const first = deferred(),
      second = deferred();
    h.setChildren.mockReturnValueOnce(first.result).mockReturnValueOnce(second.result);
    const oldCommit = h.api.setChildren!('left', [row('old-row')]);
    const newCommit = h.api.setChildren!('left', [row('new-row')]);
    second.finish();
    await newCommit;
    h.view.setThemeSurfaceStyle({ '--pui-background': '#222' });
    expect(h.setSurfaceStyle).toHaveBeenLastCalledWith('new-row', {
      color: 'red',
      maxWidth: '100%',
      '--pui-background': '#222',
    });
    h.setSurfaceStyle.mockClear();
    first.finish();
    await oldCommit;
    expect(h.setSurfaceStyle).not.toHaveBeenCalled();
    h.view.setThemeSurfaceStyle({ '--pui-background': '#333' });
    expect(h.setSurfaceStyle.mock.calls).toEqual([
      ['new-row', { color: 'red', maxWidth: '100%', '--pui-background': '#333' }],
    ]);
  });

  it('snapshots mutable author styles and theme input while preserving later explicit theme updates', async () => {
    const theme = { '--pui-background': '#fff' };
    const h = fixture(theme);
    const authorStyle = { color: 'red' };
    const input = row('mixed', ['padding: 3px', authorStyle]);
    const pending = deferred();
    h.setChildren.mockReturnValueOnce(pending.result);
    const commit = h.api.setChildren!('left', [input]);
    authorStyle.color = 'blue';
    theme['--pui-background'] = '#222';
    pending.finish();
    await commit;
    expect(h.setChildren.mock.calls[0][1][0].node).toMatchObject({
      surfaceStyle: [
        'padding: 3px',
        { color: 'red' },
        { maxWidth: '100%' },
        { '--pui-background': '#fff' },
      ],
    });
    h.setSurfaceStyle.mockClear();
    h.view.setThemeSurfaceStyle(theme);
    expect(h.setSurfaceStyle.mock.calls).toEqual([
      [
        'mixed',
        ['padding: 3px', { color: 'red' }, { maxWidth: '100%' }, { '--pui-background': '#222' }],
      ],
    ]);
  });

  it('keeps the latest theme for a valid pending commit even when a newer request rejects', async () => {
    const h = fixture();
    const pending = deferred();
    h.setChildren
      .mockReturnValueOnce(pending.result)
      .mockRejectedValueOnce(new Error('rejected admission'));
    const accepted = h.api.setChildren!('left', [row('accepted')]);
    await expect(h.api.setChildren!('left', [row('rejected')])).rejects.toThrow(
      'rejected admission'
    );
    h.view.setThemeSurfaceStyle({ '--pui-background': '#222' });
    pending.finish();
    await accepted;
    expect(h.setSurfaceStyle.mock.calls).toEqual([
      ['accepted', { color: 'red', maxWidth: '100%', '--pui-background': '#222' }],
    ]);
  });

  it('does not revive dynamic style ownership after cleanup of a pending commit', async () => {
    const h = fixture();
    const pending = deferred();
    h.setChildren.mockReturnValueOnce(pending.result);
    const commit = h.api.setChildren!('left', [row('retired')]);
    h.cleanup();
    h.view.setThemeSurfaceStyle({ '--pui-background': '#222' });
    pending.finish();
    await commit;
    expect(h.setSurfaceStyle).not.toHaveBeenCalled();
    await expect(h.api.setChildren!('left', [row('late')])).resolves.toBe('disposed');
    expect(h.setChildren).toHaveBeenCalledOnce();
  });

  it('keeps a newer synchronous theme request through public renderer callback reentry', async () => {
    const h = fixture();
    await h.api.setChildren!('left', [row('one'), row('two')]);
    h.setSurfaceStyle.mockClear();
    h.setSurfaceStyle.mockImplementationOnce(() => {
      h.view.setThemeSurfaceStyle({ '--pui-background': '#333' });
    });
    h.view.setThemeSurfaceStyle({ '--pui-background': '#222' });
    for (const ref of ['one', 'two']) {
      const writes = h.setSurfaceStyle.mock.calls.filter(([target]) => target === ref);
      expect(writes.at(-1)).toEqual([
        ref,
        { color: 'red', maxWidth: '100%', '--pui-background': '#333' },
      ]);
    }
  });
});
