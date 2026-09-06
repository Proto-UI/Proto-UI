import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProjectionCompositionControls } from './projection-composition';
import type { ProjectionScopeMaterializeRequest } from './projection-scope';

const projection = vi.hoisted(() => ({
  materialize: vi.fn(),
  restoreFocus: vi.fn(),
  resolveTheme: vi.fn(),
  watchTheme: vi.fn(),
}));
const codePanel = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock('./projection-materializer', () => ({
  materializeProjectionCandidate: projection.materialize,
  restoreProjectionControlFocus: projection.restoreFocus,
}));

vi.mock('./projection-theme', () => ({
  resolveProjectionThemeSurfaceStyle: projection.resolveTheme,
  watchProjectionThemeSurfaceStyle: projection.watchTheme,
}));

vi.mock('./code-panel-client', () => ({ refreshCodePanel: codePanel.refresh }));

import { initProjectedPreviewer } from './projected-previewer-client';

type Candidate = ReturnType<typeof createCandidate>;

function createCandidate(label: string) {
  return {
    label,
    host: document.createElement('div'),
    scope: document.createElement('div'),
    activate: vi.fn(),
    dispose: vi.fn(),
    setLocked: vi.fn(),
    setThemeSurfaceStyle: vi.fn(),
  };
}

function createRoot(): HTMLElement {
  const root = document.createElement('section');
  root.dataset.previewerId = 'fixed-family-test';
  root.innerHTML = '<div class="host"><span class="proto-previewer__skeleton"></span></div>';
  document.body.append(root);
  return root;
}

function previewerApi(root: HTMLElement): {
  switchRuntime(runtimeId: string): Promise<unknown>;
  reload(): Promise<unknown>;
  getCurrentRuntime(): string | null;
  destroy(): Promise<void>;
} {
  return (root as HTMLElement & { __previewer__: ReturnType<typeof previewerApi> }).__previewer__;
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

function init(root: HTMLElement, toolbar = true): void {
  initProjectedPreviewer({
    root,
    initialRuntime: 'wc',
    runtimeList: ['wc', 'react'],
    projectionFamilyId: 'shadcn',
    componentId: 'button',
    toolbar,
  });
}

describe('PrototypePreviewer fixed-family projection', () => {
  let candidates: Candidate[];

  beforeEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
    candidates = [];
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
    projection.watchTheme.mockReset().mockReturnValue(vi.fn());
    codePanel.refresh.mockReset();
  });

  it('materializes only the Runtime control with the fixed recipe content', async () => {
    const root = createRoot();
    init(root);

    await vi.waitFor(() => expect(root.dataset.projectionState).toBe('ready'));

    expect(latestRequest()).toEqual({
      selection: { runtimeId: 'wc', projectionFamilyId: 'shadcn' },
      generation: 1,
    });
    expect(projection.materialize.mock.calls[0]![1]).toMatchObject({
      ownerId: 'fixed-family-test',
      componentId: 'button',
      controlIds: ['runtime'],
    });
    expect(latestControls().runtime.options.map((option) => option.value)).toEqual(['wc', 'react']);
    expect(root.dataset.projectionFamily).toBe('shadcn');
    expect(root.dataset.projectionComponent).toBe('button');
    expect(root.querySelector('.proto-previewer__skeleton')).toBeNull();

    await previewerApi(root).destroy();
  });

  it('renders the exact initial projection failure in the empty host', async () => {
    const failure = new Error('Initial fixed-family recipe is unavailable');
    projection.materialize.mockRejectedValueOnce(failure);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const projectionError = vi.fn();
    const root = createRoot();
    root.addEventListener('error', projectionError);
    init(root);

    try {
      await vi.waitFor(() => expect(root.dataset.projectionState).toBe('error'));

      const mount = root.querySelector<HTMLElement>('.host');
      expect(mount?.textContent).toContain('[Preview Error]');
      expect(mount?.textContent).toContain(failure.message);
      expect(mount?.getAttribute('aria-busy')).toBe('false');
      expect(previewerApi(root).getCurrentRuntime()).toBeNull();
      expect(projectionError).toHaveBeenCalledTimes(1);

      await previewerApi(root).reload();
      await vi.waitFor(() => expect(root.dataset.projectionState).toBe('ready'));
      expect(mount?.textContent).not.toContain('[Preview Error]');
      expect(previewerApi(root).getCurrentRuntime()).toBe('wc');
    } finally {
      consoleError.mockRestore();
      await previewerApi(root).destroy();
    }
  });

  it('switches Runtime once while preserving the fixed family and component', async () => {
    const root = createRoot();
    const adapterChange = vi.fn();
    document.addEventListener('proto-adapter:change', adapterChange);
    init(root);
    await vi.waitFor(() => expect(root.dataset.projectionState).toBe('ready'));

    candidates[0]!.setLocked.mockClear();
    latestControls().runtime.onValueChange('react');
    expect(candidates[0]!.setLocked).toHaveBeenCalledWith(true);
    await vi.waitFor(() => expect(projection.materialize).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(root.dataset.projectionRuntime).toBe('react'));

    expect(latestRequest()).toEqual({
      selection: { runtimeId: 'react', projectionFamilyId: 'shadcn' },
      generation: 2,
    });
    expect(projection.materialize.mock.calls[1]![1]).toMatchObject({
      componentId: 'button',
      controlIds: ['runtime'],
    });
    expect(adapterChange).toHaveBeenCalledTimes(1);
    expect(projection.materialize).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem('preferred-prototypes-adapter')).toBe('react');
    expect(projection.restoreFocus).toHaveBeenCalledWith(expect.anything(), 'runtime-select', 2);

    document.removeEventListener('proto-adapter:change', adapterChange);
    await previewerApi(root).destroy();
  });

  it('seals the current generation before a preference event can reenter Runtime switching', async () => {
    const root = createRoot();
    init(root);
    await vi.waitFor(() => expect(root.dataset.projectionState).toBe('ready'));

    const order: string[] = [];
    candidates[0]!.setLocked.mockImplementation((locked: boolean) => {
      order.push(`lock:${locked}`);
    });
    const reenter = (): void => {
      order.push('preference-event');
      void previewerApi(root).switchRuntime('wc');
    };
    document.addEventListener('proto-adapter:change', reenter, { once: true });

    latestControls().runtime.onValueChange('react');

    expect(order[0]).toBe('lock:true');
    expect(order).toContain('preference-event');
    await vi.waitFor(() => expect(root.dataset.projectionRuntime).toBe('wc'));
    await vi.waitFor(() => expect(root.dataset.projectionState).toBe('ready'));
    expect(root.querySelector('.host')?.getAttribute('aria-busy')).toBe('false');

    await previewerApi(root).destroy();
  });

  it('settles a same-turn Runtime switch away and back without leaving loading state', async () => {
    const root = createRoot();
    init(root);
    await vi.waitFor(() => expect(root.dataset.projectionState).toBe('ready'));

    const switchedAway = previewerApi(root).switchRuntime('react');
    const switchedBack = previewerApi(root).switchRuntime('wc');
    await Promise.all([switchedAway, switchedBack]);

    expect(root.dataset.projectionRuntime).toBe('wc');
    expect(root.dataset.projectionState).toBe('ready');
    expect(root.querySelector('.host')?.getAttribute('aria-busy')).toBe('false');
    expect(previewerApi(root).getCurrentRuntime()).toBe('wc');

    await previewerApi(root).destroy();
  });

  it('supersedes a pending initial generation with the latest Runtime intent', async () => {
    let releaseInitial!: () => void;
    const initialPending = new Promise<void>((resolve) => {
      releaseInitial = resolve;
    });
    projection.materialize.mockImplementation(
      async (request: ProjectionScopeMaterializeRequest) => {
        const candidate = createCandidate(
          `${request.generation}:${request.selection.runtimeId}:${request.selection.projectionFamilyId}`
        );
        candidates.push(candidate);
        if (request.generation === 1) await initialPending;
        return candidate;
      }
    );
    const root = createRoot();
    init(root);

    const first = previewerApi(root).switchRuntime('react');
    const middle = previewerApi(root).switchRuntime('wc');
    const latest = previewerApi(root).switchRuntime('react');

    await vi.waitFor(() => expect(projection.materialize).toHaveBeenCalledTimes(4));
    await Promise.all([first, middle, latest]);
    expect(
      projection.materialize.mock.calls.map(([request]) => request.selection.runtimeId)
    ).toEqual(['wc', 'react', 'wc', 'react']);
    expect(root.dataset.projectionRuntime).toBe('react');
    expect(root.dataset.projectionState).toBe('ready');
    expect(root.querySelector('.host')?.getAttribute('aria-busy')).toBe('false');
    expect(candidates[0]!.activate).not.toHaveBeenCalled();

    releaseInitial();
    await vi.waitFor(() => expect(candidates[0]!.dispose).toHaveBeenCalledTimes(1));
    expect(candidates[0]!.activate).not.toHaveBeenCalled();

    await previewerApi(root).destroy();
  });

  it('keeps the replacement ready when retired-generation cleanup reports failure', async () => {
    const cleanupFailure = new Error('old Runtime cleanup failed');
    projection.materialize.mockImplementation(
      async (request: ProjectionScopeMaterializeRequest) => {
        const candidate = createCandidate(
          `${request.generation}:${request.selection.runtimeId}:${request.selection.projectionFamilyId}`
        );
        if (request.generation === 1) candidate.dispose.mockRejectedValue(cleanupFailure);
        candidates.push(candidate);
        return candidate;
      }
    );
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const projectionError = vi.fn();
    const root = createRoot();
    root.addEventListener('error', projectionError);
    init(root);
    await vi.waitFor(() => expect(root.dataset.projectionState).toBe('ready'));

    latestControls().runtime.onValueChange('react');
    await vi.waitFor(() => expect(root.dataset.projectionRuntime).toBe('react'));

    expect(root.dataset.projectionState).toBe('ready');
    expect(root.querySelector('.host')?.getAttribute('aria-busy')).toBe('false');
    expect(previewerApi(root).getCurrentRuntime()).toBe('react');
    expect(projectionError).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      '[ProjectionScope] Failed to dispose the replaced generation.',
      cleanupFailure
    );

    consoleError.mockRestore();
    await previewerApi(root).destroy();
  });

  it('does not mark an already-committed generation as error when focus restoration fails', async () => {
    const focusFailure = new Error('runtime trigger disappeared before focus restoration');
    projection.restoreFocus.mockImplementationOnce(() => {
      throw focusFailure;
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const projectionError = vi.fn();
    const root = createRoot();
    root.addEventListener('error', projectionError);
    init(root);
    await vi.waitFor(() => expect(root.dataset.projectionState).toBe('ready'));

    latestControls().runtime.onValueChange('react');
    await vi.waitFor(() => expect(root.dataset.projectionRuntime).toBe('react'));

    expect(root.dataset.projectionState).toBe('ready');
    expect(root.querySelector('.host')?.getAttribute('aria-busy')).toBe('false');
    expect(previewerApi(root).getCurrentRuntime()).toBe('react');
    expect(projectionError).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      '[ProjectionScope] Failed to restore focus for the committed generation.',
      focusFailure
    );

    consoleError.mockRestore();
    await previewerApi(root).destroy();
  });

  it('handles one page preference event through one projection request', async () => {
    const root = createRoot();
    init(root);
    await vi.waitFor(() => expect(root.dataset.projectionState).toBe('ready'));

    document.dispatchEvent(
      new CustomEvent('proto-adapter:change', {
        detail: { adapter: 'react', source: document.body },
      })
    );
    await vi.waitFor(() => expect(root.dataset.projectionRuntime).toBe('react'));

    expect(projection.materialize).toHaveBeenCalledTimes(2);
    expect(latestRequest().selection).toEqual({
      runtimeId: 'react',
      projectionFamilyId: 'shadcn',
    });

    await previewerApi(root).destroy();
  });

  it('fails closed and retains the committed Runtime generation', async () => {
    projection.materialize
      .mockImplementationOnce(async (request: ProjectionScopeMaterializeRequest) => {
        const candidate = createCandidate(`initial:${request.generation}`);
        candidates.push(candidate);
        return candidate;
      })
      .mockRejectedValueOnce(new Error('React projection preparation failed'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const root = createRoot();
    init(root);
    await vi.waitFor(() => expect(root.dataset.projectionState).toBe('ready'));

    latestControls().runtime.onValueChange('react');
    await vi.waitFor(() => expect(root.dataset.projectionState).toBe('error'));

    expect(previewerApi(root).getCurrentRuntime()).toBe('wc');
    expect(root.dataset.projectionRuntime).toBe('wc');
    expect(candidates[0]!.dispose).not.toHaveBeenCalled();
    expect(candidates[0]!.setLocked).toHaveBeenLastCalledWith(false);
    expect(root.querySelector('.host')?.textContent).not.toContain('[Preview Error]');
    expect(consoleError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'React projection preparation failed' })
    );

    consoleError.mockRestore();
    await previewerApi(root).destroy();
  });

  it('rejects a theme preparation failure before activating the replacement generation', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const root = createRoot();
    init(root);
    await vi.waitFor(() => expect(root.dataset.projectionState).toBe('ready'));

    projection.resolveTheme.mockImplementationOnce(() => {
      throw new Error('Shadcn theme input is incomplete');
    });
    latestControls().runtime.onValueChange('react');
    await vi.waitFor(() => expect(root.dataset.projectionState).toBe('error'));

    expect(candidates).toHaveLength(2);
    expect(candidates[0]!.dispose).not.toHaveBeenCalled();
    expect(candidates[0]!.setLocked).toHaveBeenLastCalledWith(false);
    expect(candidates[1]!.activate).not.toHaveBeenCalled();
    expect(candidates[1]!.dispose).toHaveBeenCalledTimes(1);
    expect(root.dataset.projectionFamily).toBe('shadcn');
    expect(root.dataset.projectionComponent).toBe('button');
    expect(root.dataset.projectionRuntime).toBe('wc');
    expect(previewerApi(root).getCurrentRuntime()).toBe('wc');
    expect(consoleError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Shadcn theme input is incomplete' })
    );

    consoleError.mockRestore();
    await previewerApi(root).destroy();
  });

  it('routes theme updates to the currently active candidate without rematerializing', async () => {
    let onThemeChange!: (theme: Record<string, string>) => void;
    projection.watchTheme.mockImplementation((_family, _document, onChange) => {
      onThemeChange = onChange;
      return vi.fn();
    });
    const root = createRoot();
    init(root);
    await vi.waitFor(() => expect(root.dataset.projectionState).toBe('ready'));

    candidates[0]!.setThemeSurfaceStyle.mockClear();
    onThemeChange({ '--pui-background': '#111' });
    expect(candidates[0]!.setThemeSurfaceStyle).toHaveBeenCalledWith({
      '--pui-background': '#111',
    });

    await previewerApi(root).switchRuntime('react');
    candidates[0]!.setThemeSurfaceStyle.mockClear();
    candidates[1]!.setThemeSurfaceStyle.mockClear();
    onThemeChange({ '--pui-background': '#222' });

    expect(candidates[0]!.setThemeSurfaceStyle).not.toHaveBeenCalled();
    expect(candidates[1]!.setThemeSurfaceStyle).toHaveBeenCalledWith({
      '--pui-background': '#222',
    });
    expect(projection.materialize).toHaveBeenCalledTimes(2);

    await previewerApi(root).destroy();
  });

  it('keeps a committed generation ready when deferred code-panel work throws', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const root = createRoot();
    root.dataset.codeHighlights = JSON.stringify({
      wc: '<code>Web Components</code>',
      react: '<code>React</code>',
    });
    root.insertAdjacentHTML(
      'beforeend',
      '<div data-code-shell><div data-code-content></div></div>'
    );
    init(root);
    await vi.waitFor(() => expect(root.dataset.projectionState).toBe('ready'));
    await vi.waitFor(() => expect(codePanel.refresh).toHaveBeenCalledTimes(1));
    codePanel.refresh.mockImplementationOnce(() => {
      throw new Error('code panel refresh failed');
    });

    await previewerApi(root).switchRuntime('react');
    await vi.waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'code panel refresh failed' })
      )
    );

    expect(root.dataset.projectionState).toBe('ready');
    expect(root.dataset.projectionRuntime).toBe('react');
    expect(previewerApi(root).getCurrentRuntime()).toBe('react');
    expect(candidates[0]!.dispose).toHaveBeenCalledTimes(1);
    expect(candidates[1]!.dispose).not.toHaveBeenCalled();

    consoleError.mockRestore();
    await previewerApi(root).destroy();
  });

  it('omits all scope controls when the Previewer toolbar is disabled', async () => {
    const root = createRoot();
    init(root, false);

    await vi.waitFor(() => expect(root.dataset.projectionState).toBe('ready'));
    expect(projection.materialize.mock.calls[0]![1].controlIds).toEqual([]);

    await previewerApi(root).destroy();
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
    const root = createRoot();
    init(root);
    await vi.waitFor(() => expect(root.dataset.projectionState).toBe('ready'));
    const mount = root.querySelector<HTMLElement>('.host')!;
    mount.textContent = 'teardown pending';

    const first = previewerApi(root).destroy();
    const repeated = previewerApi(root).destroy();
    let repeatedSettled = false;
    void repeated.then(() => {
      repeatedSettled = true;
    });

    expect(repeated).toBe(first);
    await vi.waitFor(() => expect(candidates[0]!.dispose).toHaveBeenCalledTimes(1));
    expect(repeatedSettled).toBe(false);
    expect(mount.textContent).toBe('teardown pending');

    finishDisposal();
    await first;
    expect(repeatedSettled).toBe(true);
    expect(mount.textContent).toBe('');
  });

  it('does not retain a candidate that finishes after client destroy', async () => {
    let finishMaterialization!: (candidate: Candidate) => void;
    const materialization = new Promise<Candidate>((resolve) => {
      finishMaterialization = resolve;
    });
    projection.materialize.mockReturnValueOnce(materialization);
    const mapSet = vi.spyOn(Map.prototype, 'set');
    const root = createRoot();
    init(root);
    await vi.waitFor(() => expect(projection.materialize).toHaveBeenCalledTimes(1));
    const destruction = previewerApi(root).destroy();
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

  it('materializes an exact lane-only recipe without inventing a cross-lane family', async () => {
    const root = createRoot();
    initProjectedPreviewer({
      root,
      initialRuntime: 'wc',
      runtimeList: ['wc', 'react'],
      projectionFamilyId: 'brutalist',
      componentId: 'card',
      toolbar: true,
    });

    await vi.waitFor(() => expect(root.dataset.projectionState).toBe('ready'));
    expect(latestRequest().selection).toEqual({
      runtimeId: 'wc',
      projectionFamilyId: 'brutalist',
    });
    expect(projection.materialize.mock.calls[0]![1]).toMatchObject({
      componentId: 'card',
      controlIds: ['runtime'],
    });
    expect(root.dataset.projectionComponent).toBe('card');

    await previewerApi(root).destroy();
  });
});
