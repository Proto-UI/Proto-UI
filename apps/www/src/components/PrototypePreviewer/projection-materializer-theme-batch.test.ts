import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DemoSpec } from './demo-types';
import type { ProjectionCompositionOptions } from './projection-composition';
import type { ProjectionMaterializerOptions } from './projection-materializer';

const render = vi.hoisted(() => ({
  compose: vi.fn(),
  materialize: vi.fn(),
  load: vi.fn(),
  prepare: vi.fn(),
}));

vi.mock('./demo-modules', () => ({ loadDemo: vi.fn() }));
vi.mock('./demo-renderer', () => ({
  renderDemo: render.materialize,
  prepareDemoRuntime: render.prepare,
}));
vi.mock('./prototype-modules', () => ({ loadPrototypes: render.load }));
vi.mock('./projection-composition', () => ({
  PROJECTION_FOCUS_KEYS: {},
  createProjectionComposition: render.compose,
}));

import { materializeProjectionCandidate } from './projection-materializer';
import { createProjectionScopeController } from './projection-scope';
import { WEBSITE_SHADCN_THEME_TOKENS, scheduleProjectionThemeRead } from './projection-theme';

const disposals: Array<() => void | Promise<unknown>> = [];
const pendingTasks: Array<() => void> = [];
const childDemo: DemoSpec = { type: 'demo', root: { kind: 'box', children: [] } };
const controls = {
  runtime: { label: 'Runtime', options: [], onValueChange() {} },
  family: { label: 'Family', options: [], onValueChange() {} },
  component: { label: 'Component', options: [], onValueChange() {} },
};

function controlScheduler(view: Window) {
  const descriptor = Object.getOwnPropertyDescriptor(view, 'scheduler');
  const tasks: Array<() => void> = [];
  const postTask = vi.fn(
    (callback: () => void) =>
      new Promise<void>((resolve) => {
        const run = () => {
          tasks.splice(tasks.indexOf(run), 1);
          pendingTasks.splice(pendingTasks.indexOf(run), 1);
          callback();
          resolve();
        };
        tasks.push(run);
        pendingTasks.push(run);
      })
  );
  Object.defineProperty(view, 'scheduler', { configurable: true, value: { postTask } });
  disposals.push(() => {
    for (const task of [...tasks]) task();
    if (descriptor) Object.defineProperty(view, 'scheduler', descriptor);
    else Reflect.deleteProperty(view, 'scheduler');
  });
  return { tasks, postTask, flush: () => [...tasks].forEach((task) => task()) };
}

function fixture(ownerId: string, doc: Document = document) {
  const scope = doc.createElement('section');
  for (const token of WEBSITE_SHADCN_THEME_TOKENS)
    scope.style.setProperty(`--pui-${token}`, `${ownerId}-${token}`);
  const mount = scope.appendChild(doc.createElement('div'));
  doc.body.append(scope);
  disposals.push(() => scope.remove());
  let current = true;
  const options: ProjectionMaterializerOptions = {
    mount,
    ownerId,
    componentId: 'button',
    controls,
    controlIds: [],
    content: {
      demo: childDemo,
      recipe: { id: 'theme-batch-control', rootPrototypeId: '', prototypeIds: [] },
    },
    themeSource: { scope, family: 'shadcn', isCurrent: () => current },
  };
  return {
    scope,
    mount,
    options,
    retire: () => {
      current = false;
    },
  };
}

function request(runtimeId = 'wc', generation = 1) {
  return { generation, selection: { runtimeId, projectionFamilyId: 'shadcn' } };
}

function makeComposition(options: ProjectionCompositionOptions) {
  return {
    demo: {
      type: 'demo',
      root: { kind: 'box', attrs: { 'data-projection-scope': options.ownerId } },
    } satisfies DemoSpec,
    setLocked: vi.fn(),
    setEventGateOpen: vi.fn(),
    setThemeSurfaceStyle: vi.fn(),
  };
}

beforeEach(() => {
  render.compose.mockReset().mockImplementation(makeComposition);
  render.prepare.mockReset().mockResolvedValue(undefined);
  render.load.mockReset().mockResolvedValue(undefined);
  render.materialize
    .mockReset()
    .mockImplementation(async ({ host, demo }: { host: HTMLElement; demo: DemoSpec }) => {
      if (demo.root.kind !== 'box') throw new Error('Expected the bounded composition fixture');
      const scope = host.ownerDocument.createElement('section');
      scope.dataset.projectionScope = demo.root.attrs?.['data-projection-scope'];
      host.append(scope);
      return { destroy: vi.fn() };
    });
});

afterEach(async () => {
  for (const task of [...pendingTasks]) task();
  for (const dispose of disposals.splice(0).reverse()) await dispose();
  vi.restoreAllMocks();
});

describe('initial projection theme acquisition', () => {
  it('reads both live scopes before either owner resumes preparation writes', async () => {
    const scheduler = controlScheduler(window);
    const a = fixture('a');
    const b = fixture('b');
    const order: string[] = [];
    const computed = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
      if (element === a.scope || element === b.scope)
        order.push(`read ${element === a.scope ? 'a' : 'b'}`);
      return computed(element, pseudo);
    });
    render.compose.mockImplementation((options: ProjectionCompositionOptions) => {
      order.push(`write ${options.ownerId}`);
      if (options.ownerId === 'a') b.scope.style.setProperty('--pui-background', 'after-a');
      return makeComposition(options);
    });
    const first = materializeProjectionCandidate(request(), a.options);
    const second = materializeProjectionCandidate(request(), b.options);
    // The existing public import and the materializer's direct import must
    // share the same queue, rather than creating parallel publication batches.
    const publicRead = scheduleProjectionThemeRead(a.scope, () => {
      order.push('publication read');
      return 'publication';
    });
    const beforeFlush = [...order];
    // A read must be current at acquisition, not cached when its owner queues it.
    a.scope.style.setProperty('--pui-background', 'latest-a');
    scheduler.flush();
    const candidates = await Promise.all([first, second]);
    await expect(publicRead).resolves.toBe('publication');
    candidates.forEach((candidate) => disposals.push(() => candidate.dispose()));
    expect(beforeFlush).toEqual([]);
    expect(order.slice(0, 5)).toEqual([
      'read a',
      'read b',
      'publication read',
      'write a',
      'write b',
    ]);
    expect(
      render.compose.mock.calls.map(([options]) => [
        options.ownerId,
        options.themeSurfaceStyle['--pui-background'],
      ])
    ).toEqual([
      ['a', 'latest-a'],
      ['b', 'b-background'],
    ]);
    expect(scheduler.postTask).toHaveBeenCalledOnce();
    expect(scheduler.postTask).toHaveBeenCalledWith(expect.any(Function), {
      priority: 'user-blocking',
    });
  });

  it('does not release another document through the first document batch', async () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    disposals.push(() => iframe.remove());
    const otherDocument = iframe.contentDocument!;
    const firstScheduler = controlScheduler(window);
    const secondScheduler = controlScheduler(otherDocument.defaultView!);
    const a = fixture('parent');
    const b = fixture('frame', otherDocument);
    const first = materializeProjectionCandidate(request(), a.options);
    const second = materializeProjectionCandidate(request(), b.options);
    const initialCalls = render.compose.mock.calls.length;
    firstScheduler.flush();
    const firstCandidate = await first;
    disposals.push(() => firstCandidate.dispose());
    const afterFirst = render.compose.mock.calls.map(([options]) => options.ownerId);
    secondScheduler.flush();
    const secondCandidate = await second;
    disposals.push(() => secondCandidate.dispose());
    expect(initialCalls).toBe(0);
    expect(afterFirst).toEqual(['parent']);
    expect(firstScheduler.postTask).toHaveBeenCalledOnce();
    expect(secondScheduler.postTask).toHaveBeenCalledOnce();
    expect(render.compose.mock.calls[1][0].themeSurfaceStyle['--pui-background']).toBe(
      'frame-background'
    );
  });

  it('keeps an initial read failure isolated and retries through the same controller', async () => {
    const scheduler = controlScheduler(window);
    const failing = fixture('retry');
    const healthy = fixture('healthy');
    failing.scope.style.removeProperty('--pui-background');
    const publications: number[] = [];
    const controller = createProjectionScopeController({
      initialSelection: request().selection,
      materialize: (next) => materializeProjectionCandidate(next, failing.options),
      prepareCommit: (commit) => ({
        publish: () => {
          publications.push(commit.generation);
        },
        rollback() {},
      }),
    });
    disposals.push(() => controller.destroy());
    const failed = controller.start();
    void failed.catch(() => {});
    const other = materializeProjectionCandidate(request(), healthy.options);
    scheduler.flush();
    await expect(failed).rejects.toThrow('missing required --pui-background');
    const healthyCandidate = await other;
    disposals.push(() => healthyCandidate.dispose());
    expect(publications).toEqual([]);
    expect(failing.mount.childElementCount).toBe(0);
    failing.scope.style.setProperty('--pui-background', 'recovered');
    const retry = controller.start();
    scheduler.flush();
    await expect(retry).resolves.toMatchObject({ phase: 'ready', generation: 2 });
    expect(publications).toEqual([2]);
    expect(
      failing.mount.querySelectorAll('[data-projection-generation-state="active"]')
    ).toHaveLength(1);
    expect(
      render.compose.mock.calls.find(([options]) => options.ownerId === 'retry')?.[0]
        .themeSurfaceStyle['--pui-background']
    ).toBe('recovered');
  });

  it('cannot publish a queued older runtime after the same owner selects a newer one', async () => {
    const scheduler = controlScheduler(window);
    const owner = fixture('runtime');
    const publications: string[] = [];
    const controller = createProjectionScopeController({
      initialSelection: request().selection,
      materialize: (next) => materializeProjectionCandidate(next, owner.options),
      prepareCommit: (commit) => ({
        publish: () => {
          publications.push(commit.selection.runtimeId);
        },
        rollback() {},
      }),
    });
    disposals.push(() => controller.destroy());
    const original = controller.start();
    const latest = controller.request({ runtimeId: 'react' });
    scheduler.flush();
    await Promise.all([original, latest]);
    expect(publications).toEqual(['react']);
    expect(controller.getSnapshot()).toMatchObject({
      phase: 'ready',
      generation: 2,
      selection: { runtimeId: 'react' },
    });
    expect(owner.mount.querySelectorAll('[data-projection-generation-host]')).toHaveLength(1);
    expect(
      owner.mount
        .querySelector('[data-projection-generation-host]')
        ?.getAttribute('data-projection-generation-host')
    ).toBe('2');
  });

  it('does not acquire a theme watch or render after its queued owner is disposed', async () => {
    const scheduler = controlScheduler(window);
    const owner = fixture('disposed');
    const read = vi.spyOn(window, 'getComputedStyle');
    const publish = vi.fn();
    const controller = createProjectionScopeController({
      initialSelection: request().selection,
      materialize: (next) => materializeProjectionCandidate(next, owner.options),
      prepareCommit: () => ({ publish, rollback() {} }),
    });
    const starting = controller.start();
    void starting.catch(() => {});
    owner.retire();
    const destruction = controller.destroy();
    scheduler.flush();
    const outcomes = await Promise.allSettled([starting, destruction]);
    expect(outcomes[1]).toMatchObject({ status: 'fulfilled' });
    expect(controller.getSnapshot().phase).toBe('destroyed');
    expect(publish).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    expect(render.compose).not.toHaveBeenCalled();
    expect(render.materialize).not.toHaveBeenCalled();
    expect(owner.mount.childElementCount).toBe(0);
  });

  it('releases an acquired watch when its owner retires before the queued continuation', async () => {
    const scheduler = controlScheduler(window);
    const owner = fixture('retired');
    const read = vi.spyOn(window, 'getComputedStyle');
    const pending = materializeProjectionCandidate(request(), owner.options);
    void pending.catch(() => {});
    scheduler.flush();
    const readsBeforeRetirement = read.mock.calls.length;
    owner.retire();
    const result = await Promise.allSettled([pending]);
    const outcome = result[0];
    if (outcome.status === 'fulfilled') disposals.push(() => outcome.value.dispose());
    owner.scope.style.setProperty('--pui-background', 'too-late');
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(readsBeforeRetirement).toBe(1);
    expect(result[0]).toMatchObject({ status: 'rejected', reason: { name: 'AbortError' } });
    expect(read).toHaveBeenCalledOnce();
    expect(render.materialize).not.toHaveBeenCalled();
    expect(owner.mount.childElementCount).toBe(0);
  });
});
