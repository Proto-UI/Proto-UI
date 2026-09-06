import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProjectionCompositionControls } from './projection-composition';
import type {
  ProjectionScopeCommit,
  ProjectionScopeCommitPublication,
  ProjectionScopeControllerOptions,
  ProjectionScopeMaterializeRequest,
} from './projection-scope';

const projection = vi.hoisted(() => ({
  materialize: vi.fn(),
  restoreFocus: vi.fn(),
  resolveTheme: vi.fn(),
  watchTheme: vi.fn(),
}));

const projectionScope = vi.hoisted(() => ({
  options: null as ProjectionScopeControllerOptions | null,
  publications: [] as Array<
    Readonly<{
      commit: ProjectionScopeCommit;
      publication: ProjectionScopeCommitPublication;
    }>
  >,
}));

vi.mock('./projection-materializer', () => ({
  materializeProjectionCandidate: projection.materialize,
  restoreProjectionControlFocus: projection.restoreFocus,
}));

vi.mock('./projection-theme', () => ({
  resolveProjectionThemeSurfaceStyle: projection.resolveTheme,
  watchProjectionThemeSurfaceStyle: projection.watchTheme,
}));

vi.mock('./projection-scope', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./projection-scope')>();
  return {
    ...actual,
    createProjectionScopeController(options: ProjectionScopeControllerOptions) {
      projectionScope.options = options;
      const prepareCommit = options.prepareCommit;
      return actual.createProjectionScopeController({
        ...options,
        prepareCommit: prepareCommit
          ? (commit) => {
              const publication = prepareCommit(commit);
              projectionScope.publications.push({ commit, publication });
              return publication;
            }
          : undefined,
      });
    },
  };
});

import { initHomeDemoPreviewer } from './home-demo-client';

type Candidate = ReturnType<typeof createCandidate>;

function createCandidate(label: string) {
  const host = document.createElement('div');
  const scope = document.createElement('div');
  return {
    label,
    host,
    scope,
    activate: vi.fn(),
    dispose: vi.fn(),
    setLocked: vi.fn(),
    setThemeSurfaceStyle: vi.fn(),
  };
}

function createHomeRoot(): HTMLElement {
  const root = document.createElement('section');
  root.id = 'home-demo-previewer';
  root.dataset.projectionOwner = 'home-scope-test';
  root.dataset.homeDemoOptions = JSON.stringify([
    { id: 'demo-shadcn-button', label: 'Button', description: 'Button description' },
    { id: 'demo-shadcn-switch', label: 'Switch', description: 'Switch description' },
    { id: 'demo-shadcn-select', label: 'Select', description: 'Select description' },
  ]);
  root.dataset.runtimeOptions = JSON.stringify([
    { id: 'wc', label: 'Web Components' },
    { id: 'react', label: 'React' },
  ]);
  root.dataset.initialDemoId = 'demo-shadcn-button';
  root.dataset.initialRuntime = 'wc';
  root.dataset.statusLoading = 'Preparing';
  root.dataset.statusReady = 'Ready';
  root.dataset.statusError = 'Error';
  root.dataset.runtimeLabel = 'Runtime';
  root.dataset.familyLabel = 'Component Library';
  root.dataset.pickerLabel = 'Component';
  root.innerHTML = `
    <p data-home-demo-description></p>
    <output data-home-demo-status></output>
    <div data-home-demo-host></div>
  `;
  document.body.append(root);
  return root;
}

function latestControls(): ProjectionCompositionControls {
  const call = projection.materialize.mock.calls.at(-1);
  if (!call) throw new Error('Expected a materializer call.');
  return call[1].controls as ProjectionCompositionControls;
}

function latestRequest(): ProjectionScopeMaterializeRequest {
  const call = projection.materialize.mock.calls.at(-1);
  if (!call) throw new Error('Expected a materializer call.');
  return call[0] as ProjectionScopeMaterializeRequest;
}

function homeApi(root: HTMLElement): {
  destroy(): Promise<void>;
  getSnapshot(): unknown;
} {
  return (root as HTMLElement & { __homeProjection__: ReturnType<typeof homeApi> })
    .__homeProjection__;
}

function homeScopeOptions(): ProjectionScopeControllerOptions {
  if (!projectionScope.options) throw new Error('Expected Home projection scope options.');
  return projectionScope.options;
}

describe('Homepage Prototype projection scope', () => {
  let candidates: Candidate[];

  beforeEach(() => {
    document.body.replaceChildren();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
    localStorage.clear();
    candidates = [];
    projectionScope.options = null;
    projectionScope.publications = [];
    projection.materialize
      .mockReset()
      .mockImplementation(async (request: ProjectionScopeMaterializeRequest) => {
        const candidate = createCandidate(
          `${request.generation}:${request.selection.runtimeId}:${request.selection.projectionFamilyId}`
        );
        candidates.push(candidate);
        return candidate;
      });
    projection.restoreFocus.mockReset();
    projection.resolveTheme.mockReset().mockReturnValue({ '--pui-background': '#fff' });
    projection.watchTheme.mockReset().mockImplementation((_family, _document, onChange) => {
      onChange({ '--pui-background': '#fff' });
      return vi.fn();
    });
  });

  it('materializes Runtime, library, component controls, and content as one initial generation', async () => {
    const root = createHomeRoot();
    initHomeDemoPreviewer(root);

    await vi.waitFor(() => expect(root.dataset.runnerState).toBe('ready'));

    expect(latestRequest()).toEqual({
      selection: { runtimeId: 'wc', projectionFamilyId: 'shadcn' },
      generation: 1,
    });
    expect(projection.materialize.mock.calls[0]![1]).toMatchObject({
      ownerId: 'home-scope-test',
      componentId: 'button',
    });
    expect(latestControls().runtime.options.map((option) => option.value)).toEqual(['wc', 'react']);
    expect(latestControls().family.options.map((option) => option.value)).toEqual([
      'shadcn',
      'brutalist',
    ]);
    expect(latestControls().component.options.map((option) => option.value)).toEqual([
      'button',
      'switch',
      'select',
    ]);
    expect(root.dataset.projectionFamily).toBe('shadcn');
    expect(root.dataset.projectionComponent).toBe('button');
    expect(root.querySelector('[data-home-demo-description]')?.textContent).toBe(
      'Button description'
    );
    expect(root.querySelector('[data-home-demo-status]')?.textContent).toBe(
      'Web Components · Ready'
    );

    await homeApi(root).destroy();
  });

  it('renders the exact initial projection failure in the empty host', async () => {
    const failure = new Error('Initial Shadcn Button recipe is unavailable');
    projection.materialize.mockRejectedValueOnce(failure);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const root = createHomeRoot();
    initHomeDemoPreviewer(root);

    try {
      await vi.waitFor(() => expect(root.dataset.runnerState).toBe('error'));

      const host = root.querySelector<HTMLElement>('[data-home-demo-host]');
      expect(host?.textContent).toContain('[Home Demo Error]');
      expect(host?.textContent).toContain(failure.message);
      expect(host?.getAttribute('aria-busy')).toBe('false');
      expect(homeApi(root).getSnapshot()).toEqual({
        selection: { runtimeId: 'wc', projectionFamilyId: 'shadcn' },
        generation: 0,
        phase: 'idle',
      });

      document.dispatchEvent(
        new CustomEvent('proto-adapter:change', {
          detail: { adapter: 'react', source: document.body },
        })
      );
      await vi.waitFor(() =>
        expect(homeApi(root).getSnapshot()).toMatchObject({
          selection: { runtimeId: 'react', projectionFamilyId: 'shadcn' },
          generation: expect.any(Number),
          phase: 'ready',
        })
      );
      expect(host?.textContent).not.toContain('[Home Demo Error]');
    } finally {
      consoleError.mockRestore();
      await homeApi(root).destroy();
    }
  });

  it('supersedes the initial generation with the latest complete intent', async () => {
    let resolveInitial!: (candidate: Candidate) => void;
    const initial = new Promise<Candidate>((resolve) => {
      resolveInitial = resolve;
    });
    projection.materialize
      .mockReturnValueOnce(initial)
      .mockImplementationOnce(async (request: ProjectionScopeMaterializeRequest) => {
        const candidate = createCandidate(`intermediate:${request.generation}`);
        candidates.push(candidate);
        return candidate;
      });

    const root = createHomeRoot();
    initHomeDemoPreviewer(root);
    await vi.waitFor(() => expect(projection.materialize).toHaveBeenCalledTimes(1));

    const initialControls = latestControls();
    document.dispatchEvent(
      new CustomEvent('proto-adapter:change', {
        detail: { adapter: 'react', source: document.body },
      })
    );
    initialControls.family.onValueChange('brutalist');
    initialControls.component.onValueChange('select');

    await vi.waitFor(() => expect(projection.materialize).toHaveBeenCalledTimes(4));
    await vi.waitFor(() => expect(root.dataset.runnerState).toBe('ready'));
    expect(latestRequest()).toEqual({
      selection: { runtimeId: 'react', projectionFamilyId: 'brutalist' },
      generation: 4,
    });
    expect(projection.materialize.mock.calls[3]![1].componentId).toBe('select');
    expect(root.dataset.runnerRuntime).toBe('react');
    expect(root.dataset.projectionFamily).toBe('brutalist');
    expect(root.dataset.projectionComponent).toBe('select');
    expect(root.querySelector('[data-home-demo-description]')?.textContent).toBe(
      'Select description'
    );

    const initialCandidate = createCandidate('initial:1');
    candidates.push(initialCandidate);
    resolveInitial(initialCandidate);
    await vi.waitFor(() => expect(initialCandidate.dispose).toHaveBeenCalledTimes(1));
    expect(initialCandidate.activate).not.toHaveBeenCalled();

    await homeApi(root).destroy();
  });

  it('fails closed when a committing generation has no component mapping', async () => {
    const root = createHomeRoot();
    initHomeDemoPreviewer(root);
    await vi.waitFor(() => expect(root.dataset.runnerState).toBe('ready'));

    expect(() =>
      homeScopeOptions().prepareCommit?.({
        selection: { runtimeId: 'react', projectionFamilyId: 'brutalist' },
        generation: 99,
      })
    ).toThrow(/generation 99 component mapping is missing/i);

    await homeApi(root).destroy();
  });

  it('preserves a reentrant newer generation while an older publication commits', async () => {
    const root = createHomeRoot();
    initHomeDemoPreviewer(root);
    await vi.waitFor(() => expect(root.dataset.runnerState).toBe('ready'));
    const options = homeScopeOptions();
    const generation2 = {
      selection: { runtimeId: 'react', projectionFamilyId: 'shadcn' },
      generation: 2,
    } as const;
    const generation3 = {
      selection: { runtimeId: 'wc', projectionFamilyId: 'shadcn' },
      generation: 3,
    } as const;

    await options.materialize(generation2);
    const publication2 = options.prepareCommit?.(generation2);
    if (!publication2) throw new Error('Expected generation 2 publication.');
    await options.materialize(generation3);

    let publication3: ProjectionScopeCommitPublication | undefined;
    let publication3AfterRollback: ProjectionScopeCommitPublication | undefined;
    try {
      publication2.publish();
      expect(() => {
        publication3 = options.prepareCommit?.(generation3);
      }).not.toThrow();
      expect(publication3).toBeDefined();

      publication2.rollback();
      expect(() => {
        publication3AfterRollback = options.prepareCommit?.(generation3);
      }).not.toThrow();
      expect(publication3AfterRollback).toBeDefined();
    } finally {
      publication3AfterRollback?.rollback();
      publication3?.rollback();
      publication2.rollback();
      await homeApi(root).destroy();
    }
  });

  it('gates old watcher callbacks and preserves a restored watcher before deferred cleanup', async () => {
    const queuedMicrotasks: Array<() => void> = [];
    const queueMicrotaskSpy = vi
      .spyOn(globalThis, 'queueMicrotask')
      .mockImplementation((callback) => queuedMicrotasks.push(callback));
    const watcherCallbacks: Array<(theme: Record<string, string>) => void> = [];
    const watcherCleanups: Array<ReturnType<typeof vi.fn>> = [];
    projection.watchTheme.mockImplementation((_family, _document, onChange) => {
      watcherCallbacks.push(onChange);
      onChange({ '--pui-background': '#fff' });
      const cleanup = vi.fn();
      watcherCleanups.push(cleanup);
      return cleanup;
    });

    const root = createHomeRoot();
    try {
      initHomeDemoPreviewer(root);
      await vi.waitFor(() => expect(root.dataset.runnerState).toBe('ready'));
      latestControls().family.onValueChange('brutalist');
      await vi.waitFor(() => expect(root.dataset.projectionFamily).toBe('brutalist'));

      expect(watcherCallbacks).toHaveLength(2);
      expect(watcherCleanups[0]).not.toHaveBeenCalled();
      expect(queuedMicrotasks).toHaveLength(1);

      const staleTheme = { '--pui-background': '#f00' };
      candidates[1]!.setThemeSurfaceStyle.mockClear();
      watcherCallbacks[0]!(staleTheme);
      expect(candidates[1]!.setThemeSurfaceStyle).not.toHaveBeenCalledWith(staleTheme);

      const generation2 = projectionScope.publications.find(
        ({ commit }) => commit.generation === 2
      );
      if (!generation2) throw new Error('Expected generation 2 publication.');
      generation2.publication.rollback();
      queuedMicrotasks.splice(0).forEach((callback) => callback());

      expect(watcherCleanups[0]).not.toHaveBeenCalled();
      expect(watcherCleanups[1]).toHaveBeenCalledTimes(1);
      candidates[0]!.setThemeSurfaceStyle.mockClear();
      watcherCallbacks[0]!(staleTheme);
      expect(candidates[0]!.setThemeSurfaceStyle).toHaveBeenCalledWith(staleTheme);
    } finally {
      await homeApi(root).destroy();
      queueMicrotaskSpy.mockRestore();
    }
  });

  it('switches Runtime while preserving the library and controlled component content', async () => {
    const root = createHomeRoot();
    const adapterChange = vi.fn();
    document.addEventListener('proto-adapter:change', adapterChange);
    initHomeDemoPreviewer(root);
    await vi.waitFor(() => expect(root.dataset.runnerState).toBe('ready'));

    latestControls().runtime.onValueChange('react');
    await vi.waitFor(() => expect(projection.materialize).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(root.dataset.runnerState).toBe('ready'));

    expect(latestRequest().selection).toEqual({
      runtimeId: 'react',
      projectionFamilyId: 'shadcn',
    });
    expect(projection.materialize.mock.calls[1]![1].componentId).toBe('button');
    expect(localStorage.getItem('preferred-prototypes-adapter')).toBe('react');
    expect(adapterChange).toHaveBeenCalledTimes(1);
    expect(candidates[0]!.setLocked).toHaveBeenCalledWith(true);
    expect(candidates[0]!.dispose).toHaveBeenCalledTimes(1);
    expect(projection.restoreFocus).toHaveBeenCalledWith(expect.anything(), 'runtime-select', 2);

    document.removeEventListener('proto-adapter:change', adapterChange);
    await homeApi(root).destroy();
  });

  it('locks the active generation before publishing Runtime preference', async () => {
    const root = createHomeRoot();
    initHomeDemoPreviewer(root);
    await vi.waitFor(() => expect(root.dataset.runnerState).toBe('ready'));

    let lockedAtPublication = false;
    const reenterWithFamilyChange = (): void => {
      lockedAtPublication = candidates[0]!.setLocked.mock.calls.some(([locked]) => locked === true);
      latestControls().family.onValueChange('brutalist');
    };
    document.addEventListener('proto-adapter:change', reenterWithFamilyChange);

    try {
      latestControls().runtime.onValueChange('react');
      await vi.waitFor(() => expect(projection.materialize).toHaveBeenCalledTimes(3));
      await vi.waitFor(() => expect(root.dataset.runnerState).toBe('ready'));

      expect(lockedAtPublication).toBe(true);
      expect(latestRequest().selection).toEqual({
        runtimeId: 'react',
        projectionFamilyId: 'brutalist',
      });
    } finally {
      document.removeEventListener('proto-adapter:change', reenterWithFamilyChange);
      await homeApi(root).destroy();
    }
  });

  it('switches the projection library while preserving Runtime and component content', async () => {
    const root = createHomeRoot();
    initHomeDemoPreviewer(root);
    await vi.waitFor(() => expect(root.dataset.runnerState).toBe('ready'));

    candidates[0]!.setLocked.mockClear();
    latestControls().family.onValueChange('brutalist');
    expect(candidates[0]!.setLocked).toHaveBeenCalledWith(true);
    await vi.waitFor(() => expect(root.dataset.projectionFamily).toBe('brutalist'));

    expect(latestRequest().selection).toEqual({
      runtimeId: 'wc',
      projectionFamilyId: 'brutalist',
    });
    expect(projection.materialize.mock.calls[1]![1].componentId).toBe('button');
    expect(projection.watchTheme).toHaveBeenLastCalledWith(
      'brutalist',
      document,
      expect.any(Function)
    );

    await homeApi(root).destroy();
  });

  it('rematerializes component content without changing the canonical coordinates', async () => {
    const root = createHomeRoot();
    initHomeDemoPreviewer(root);
    await vi.waitFor(() => expect(root.dataset.runnerState).toBe('ready'));

    latestControls().component.onValueChange('select');
    await vi.waitFor(() => expect(root.dataset.projectionComponent).toBe('select'));

    expect(latestRequest()).toEqual({
      selection: { runtimeId: 'wc', projectionFamilyId: 'shadcn' },
      generation: 2,
    });
    expect(projection.materialize.mock.calls[1]![1].componentId).toBe('select');
    expect(root.querySelector('[data-home-demo-description]')?.textContent).toBe(
      'Select description'
    );

    await homeApi(root).destroy();
  });

  it('keeps and locks the active generation while the next candidate prepares', async () => {
    let resolveNext!: (candidate: Candidate) => void;
    const next = new Promise<Candidate>((resolve) => {
      resolveNext = resolve;
    });
    projection.materialize
      .mockImplementationOnce(async (request: ProjectionScopeMaterializeRequest) => {
        const candidate = createCandidate(`initial:${request.generation}`);
        candidates.push(candidate);
        return candidate;
      })
      .mockReturnValueOnce(next);

    const root = createHomeRoot();
    initHomeDemoPreviewer(root);
    await vi.waitFor(() => expect(root.dataset.runnerState).toBe('ready'));

    latestControls().runtime.onValueChange('react');
    await vi.waitFor(() => expect(projection.materialize).toHaveBeenCalledTimes(2));
    expect(candidates[0]!.setLocked).toHaveBeenCalledWith(true);
    expect(candidates[0]!.dispose).not.toHaveBeenCalled();
    expect(root.dataset.runnerState).toBe('loading');

    const nextCandidate = createCandidate('next:2');
    candidates.push(nextCandidate);
    resolveNext(nextCandidate);
    await vi.waitFor(() => expect(root.dataset.runnerState).toBe('ready'));
    expect(nextCandidate.activate).toHaveBeenCalledTimes(1);
    expect(candidates[0]!.dispose).toHaveBeenCalledTimes(1);

    await homeApi(root).destroy();
  });

  it('fails closed, retains the committed candidate, and reports the exact request failure', async () => {
    projection.materialize
      .mockImplementationOnce(async (request: ProjectionScopeMaterializeRequest) => {
        const candidate = createCandidate(`initial:${request.generation}`);
        candidates.push(candidate);
        return candidate;
      })
      .mockRejectedValueOnce(new Error('Brutalist Select item mapping missing'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const root = createHomeRoot();
    initHomeDemoPreviewer(root);
    await vi.waitFor(() => expect(root.dataset.runnerState).toBe('ready'));

    latestControls().family.onValueChange('brutalist');
    await vi.waitFor(() => expect(root.dataset.runnerState).toBe('error'));

    expect(homeApi(root).getSnapshot()).toEqual({
      selection: { runtimeId: 'wc', projectionFamilyId: 'shadcn' },
      generation: 1,
      phase: 'ready',
    });
    expect(candidates[0]!.dispose).not.toHaveBeenCalled();
    expect(candidates[0]!.setLocked).toHaveBeenLastCalledWith(false);
    expect(root.dataset.projectionFamily).toBe('shadcn');
    expect(root.querySelector('[data-home-demo-host]')?.textContent).not.toContain(
      '[Home Demo Error]'
    );
    expect(consoleError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Brutalist Select item mapping missing' })
    );

    consoleError.mockRestore();
    await homeApi(root).destroy();
  });

  it('rejects browser-WASM research ids at the executable Runtime boundary', async () => {
    const root = createHomeRoot();
    initHomeDemoPreviewer(root);
    await vi.waitFor(() => expect(root.dataset.runnerState).toBe('ready'));

    document.dispatchEvent(
      new CustomEvent('proto-adapter:change', {
        detail: { adapter: 'gpui-wasm', source: document.body },
      })
    );
    await Promise.resolve();

    expect(projection.materialize).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('preferred-prototypes-adapter')).toBeNull();

    await homeApi(root).destroy();
  });

  it('rejects lane-only recipes from the homepage cross-library component selector', () => {
    const root = createHomeRoot();
    root.dataset.homeDemoOptions = JSON.stringify([
      { id: 'demo-shadcn-checkbox', label: 'Checkbox' },
    ]);
    root.dataset.initialDemoId = 'demo-shadcn-checkbox';

    expect(() => initHomeDemoPreviewer(root)).toThrow(/lane-only.*cross-library selector/i);
    expect(projection.materialize).not.toHaveBeenCalled();
  });

  it('returns the in-flight teardown promise to repeated callers', async () => {
    let finishDisposal!: () => void;
    const disposal = new Promise<void>((resolve) => {
      finishDisposal = resolve;
    });
    projection.materialize.mockImplementationOnce(
      async (request: ProjectionScopeMaterializeRequest) => {
        const candidate = createCandidate(`initial:${request.generation}`);
        candidate.dispose.mockReturnValue(disposal);
        candidates.push(candidate);
        return candidate;
      }
    );
    const root = createHomeRoot();
    initHomeDemoPreviewer(root);
    await vi.waitFor(() => expect(root.dataset.runnerState).toBe('ready'));

    const first = homeApi(root).destroy();
    const repeated = homeApi(root).destroy();
    let repeatedSettled = false;
    void repeated.then(() => {
      repeatedSettled = true;
    });

    expect(repeated).toBe(first);
    await vi.waitFor(() => expect(candidates[0]!.dispose).toHaveBeenCalledTimes(1));
    expect(repeatedSettled).toBe(false);

    finishDisposal();
    await first;
    expect(repeatedSettled).toBe(true);
  });

  it('does not retain a candidate that finishes after client destroy', async () => {
    let finishMaterialization!: (candidate: Candidate) => void;
    const materialization = new Promise<Candidate>((resolve) => {
      finishMaterialization = resolve;
    });
    projection.materialize.mockReturnValueOnce(materialization);
    const mapSet = vi.spyOn(Map.prototype, 'set');
    const root = createHomeRoot();
    initHomeDemoPreviewer(root);
    await vi.waitFor(() => expect(projection.materialize).toHaveBeenCalledTimes(1));
    const destruction = homeApi(root).destroy();
    const lateCandidate = createCandidate('late-after-destroy');
    mapSet.mockClear();

    try {
      finishMaterialization(lateCandidate);
      await destruction;

      expect(lateCandidate.dispose).toHaveBeenCalledTimes(1);
      expect(mapSet.mock.calls.some(([, value]) => value === lateCandidate)).toBe(false);
    } finally {
      mapSet.mockRestore();
    }
  });

  it('updates the active generation theme in place instead of remounting it', async () => {
    const root = createHomeRoot();
    initHomeDemoPreviewer(root);
    await vi.waitFor(() => expect(root.dataset.runnerState).toBe('ready'));
    const onThemeChange = projection.watchTheme.mock.calls[0]![2] as (
      theme: Record<string, string>
    ) => void;
    candidates[0]!.setThemeSurfaceStyle.mockClear();

    onThemeChange({ '--pui-background': '#111', '--pui-foreground': '#eee' });

    expect(candidates[0]!.setThemeSurfaceStyle).toHaveBeenCalledWith({
      '--pui-background': '#111',
      '--pui-foreground': '#eee',
    });
    expect(projection.materialize).toHaveBeenCalledTimes(1);

    await homeApi(root).destroy();
  });
});
