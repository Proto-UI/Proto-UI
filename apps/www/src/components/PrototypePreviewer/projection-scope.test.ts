import { describe, expect, it, vi } from 'vitest';

import {
  createProjectionScopeController,
  type ProjectionScopeCandidate,
  type ProjectionScopeCommit,
  type ProjectionScopeMaterializeRequest,
  type ProjectionScopeSelection,
} from './projection-scope';

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function selection(runtimeId: string, projectionFamilyId: string): ProjectionScopeSelection {
  return { runtimeId, projectionFamilyId };
}

function candidate(
  label: string,
  events: string[] = []
): ProjectionScopeCandidate & {
  activate: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
} {
  return {
    activate: vi.fn(() => {
      events.push(`activate:${label}`);
    }),
    dispose: vi.fn(async () => {
      events.push(`dispose:${label}`);
    }),
  };
}

function prepareCommit(
  publish: (commit: ProjectionScopeCommit) => void,
  rollback: (commit: ProjectionScopeCommit) => void = () => {}
): (commit: ProjectionScopeCommit) => { publish(): void; rollback(): void } {
  return (commit) => ({
    publish: () => publish(commit),
    rollback: () => rollback(commit),
  });
}

describe('Website Prototype projection scope controller', () => {
  it('switches Runtime and projection family as orthogonal coordinates', async () => {
    const events: string[] = [];
    const materialize = vi.fn(async ({ selection: target, generation }) => {
      const label = `${generation}:${target.runtimeId}:${target.projectionFamilyId}`;
      events.push(`prepare:${label}`);
      return candidate(label, events);
    });
    const controller = createProjectionScopeController({
      initialSelection: selection('wc', 'shadcn'),
      materialize,
    });

    await controller.start();
    await controller.request({ runtimeId: 'react' });
    expect(controller.getSnapshot()).toMatchObject({
      selection: selection('react', 'shadcn'),
      generation: 2,
      phase: 'ready',
    });

    await controller.request({ projectionFamilyId: 'brutalist' });
    expect(controller.getSnapshot()).toMatchObject({
      selection: selection('react', 'brutalist'),
      generation: 3,
      phase: 'ready',
    });
    expect(materialize.mock.calls.map(([request]) => request.selection)).toEqual([
      selection('wc', 'shadcn'),
      selection('react', 'shadcn'),
      selection('react', 'brutalist'),
    ]);
    expect(events).toEqual([
      'prepare:1:wc:shadcn',
      'activate:1:wc:shadcn',
      'prepare:2:react:shadcn',
      'activate:2:react:shadcn',
      'dispose:1:wc:shadcn',
      'prepare:3:react:brutalist',
      'activate:3:react:brutalist',
      'dispose:2:react:shadcn',
    ]);

    await controller.destroy();
  });

  it('supersedes a pending initial generation before it can activate', async () => {
    const initial = candidate('initial');
    const latest = candidate('latest');
    const initialPreparation = deferred<ProjectionScopeCandidate>();
    const materialize = vi
      .fn<(request: ProjectionScopeMaterializeRequest) => Promise<ProjectionScopeCandidate>>()
      .mockReturnValueOnce(initialPreparation.promise)
      .mockResolvedValueOnce(latest);
    const onCommit = vi.fn();
    const controller = createProjectionScopeController({
      initialSelection: selection('wc', 'shadcn'),
      materialize,
      prepareCommit: prepareCommit(onCommit),
    });

    const starting = controller.start();
    const requested = controller.request({ runtimeId: 'react' });

    await expect(requested).resolves.toMatchObject({
      selection: selection('react', 'shadcn'),
      generation: 2,
      phase: 'ready',
    });
    expect(materialize).toHaveBeenCalledTimes(2);
    expect(latest.activate).toHaveBeenCalledTimes(1);
    expect(initial.activate).not.toHaveBeenCalled();
    expect(onCommit).toHaveBeenCalledTimes(1);

    initialPreparation.resolve(initial);
    await starting;
    expect(initial.activate).not.toHaveBeenCalled();
    expect(initial.dispose).toHaveBeenCalledTimes(1);

    await controller.destroy();
  });

  it('starts new work after a stale initial start fulfills without a commit', async () => {
    const initial = candidate('initial');
    const retry = candidate('retry');
    const initialPreparation = deferred<ProjectionScopeCandidate>();
    const requestFailure = new Error('superseding request failed');
    const materialize = vi
      .fn<(request: ProjectionScopeMaterializeRequest) => Promise<ProjectionScopeCandidate>>()
      .mockReturnValueOnce(initialPreparation.promise)
      .mockRejectedValueOnce(requestFailure)
      .mockResolvedValueOnce(retry);
    const controller = createProjectionScopeController({
      initialSelection: selection('wc', 'shadcn'),
      materialize,
    });

    const staleStart = controller.start();
    await expect(controller.request({ runtimeId: 'react' })).rejects.toBe(requestFailure);
    initialPreparation.resolve(initial);
    await staleStart;
    expect(controller.getSnapshot()).toMatchObject({ generation: 0, phase: 'idle' });

    await expect(controller.start()).resolves.toMatchObject({
      selection: selection('wc', 'shadcn'),
      generation: 3,
      phase: 'ready',
    });
    expect(materialize).toHaveBeenCalledTimes(3);
    expect(initial.activate).not.toHaveBeenCalled();
    expect(initial.dispose).toHaveBeenCalledTimes(1);
    expect(retry.activate).toHaveBeenCalledTimes(1);

    await controller.destroy();
  });

  it('keeps the committed generation active until the prepared candidate activates', async () => {
    const current = candidate('current');
    const next = candidate('next');
    const nextPreparation = deferred<ProjectionScopeCandidate>();
    const materialize = vi
      .fn<(request: ProjectionScopeMaterializeRequest) => Promise<ProjectionScopeCandidate>>()
      .mockResolvedValueOnce(current)
      .mockReturnValueOnce(nextPreparation.promise);
    const onCommit = vi.fn();
    const controller = createProjectionScopeController({
      initialSelection: selection('wc', 'shadcn'),
      materialize,
      prepareCommit: prepareCommit(onCommit),
    });

    await controller.start();
    const pending = controller.request({ runtimeId: 'react' });
    await vi.waitFor(() => expect(materialize).toHaveBeenCalledTimes(2));

    expect(controller.getSnapshot()).toMatchObject({
      selection: selection('wc', 'shadcn'),
      generation: 1,
      phase: 'preparing',
    });
    expect(current.dispose).not.toHaveBeenCalled();
    expect(next.activate).not.toHaveBeenCalled();
    expect(onCommit).toHaveBeenCalledTimes(1);

    nextPreparation.resolve(next);
    await pending;

    expect(next.activate).toHaveBeenCalledTimes(1);
    expect(current.dispose).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({
      selection: selection('react', 'shadcn'),
      generation: 2,
      phase: 'ready',
    });
    expect(onCommit).toHaveBeenLastCalledWith({
      selection: selection('react', 'shadcn'),
      generation: 2,
    });

    await controller.destroy();
  });

  it('fails closed and retains the complete committed generation when preparation fails', async () => {
    const current = candidate('current');
    const materialize = vi
      .fn<(request: ProjectionScopeMaterializeRequest) => Promise<ProjectionScopeCandidate>>()
      .mockResolvedValueOnce(current)
      .mockRejectedValueOnce(new Error('Brutalist Select Content is missing'));
    const onCommit = vi.fn();
    const restoreFocus = vi.fn();
    const controller = createProjectionScopeController({
      initialSelection: selection('wc', 'shadcn'),
      materialize,
      prepareCommit: prepareCommit(onCommit),
      restoreFocus,
    });

    await controller.start();
    await expect(
      controller.request(
        { projectionFamilyId: 'brutalist' },
        { focusKey: 'projection-family-select' }
      )
    ).rejects.toThrow('Brutalist Select Content is missing');

    expect(current.dispose).not.toHaveBeenCalled();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(restoreFocus).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toEqual({
      selection: selection('wc', 'shadcn'),
      generation: 1,
      phase: 'ready',
    });

    await controller.destroy();
  });

  it('preserves the target failure when retained-generation unlock also rejects', async () => {
    const targetFailure = new Error('missing target component recipe');
    const unlockFailure = new Error('retained generation failed to unlock');
    const current: ProjectionScopeCandidate = {
      activate: vi.fn(),
      dispose: vi.fn(),
      setLocked: vi.fn((locked: boolean) => (locked ? undefined : Promise.reject(unlockFailure))),
    };
    const materialize = vi
      .fn<(request: ProjectionScopeMaterializeRequest) => Promise<ProjectionScopeCandidate>>()
      .mockResolvedValueOnce(current)
      .mockRejectedValueOnce(targetFailure);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const controller = createProjectionScopeController({
      initialSelection: selection('wc', 'shadcn'),
      materialize,
    });

    await controller.start();
    await expect(controller.request({ runtimeId: 'react' })).rejects.toBe(targetFailure);

    expect(controller.getSnapshot()).toEqual({
      selection: selection('wc', 'shadcn'),
      generation: 1,
      phase: 'ready',
    });
    expect(consoleError).toHaveBeenCalledWith(
      '[ProjectionScope] Failed to unlock the retained generation.',
      unlockFailure
    );

    consoleError.mockRestore();
    await controller.destroy();
  });

  it('keeps a committed request successful when replaced-generation disposal reports failure', async () => {
    const cleanupFailure = new Error('old Runtime destroy failed');
    const current: ProjectionScopeCandidate = {
      activate: vi.fn(),
      dispose: vi.fn().mockRejectedValue(cleanupFailure),
    };
    const next = candidate('next');
    const materialize = vi
      .fn<(request: ProjectionScopeMaterializeRequest) => Promise<ProjectionScopeCandidate>>()
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(next);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const controller = createProjectionScopeController({
      initialSelection: selection('wc', 'shadcn'),
      materialize,
    });

    await controller.start();
    await expect(controller.request({ runtimeId: 'react' })).resolves.toEqual({
      selection: selection('react', 'shadcn'),
      generation: 2,
      phase: 'ready',
    });

    expect(controller.getSnapshot()).toEqual({
      selection: selection('react', 'shadcn'),
      generation: 2,
      phase: 'ready',
    });
    expect(consoleError).toHaveBeenCalledWith(
      '[ProjectionScope] Failed to dispose the replaced generation.',
      cleanupFailure
    );

    consoleError.mockRestore();
    await controller.destroy();
  });

  it('keeps the committed generation ready when post-commit focus restoration throws', async () => {
    const focusFailure = new Error('focus target disappeared');
    const current = candidate('current');
    const next = candidate('next');
    const materialize = vi
      .fn<(request: ProjectionScopeMaterializeRequest) => Promise<ProjectionScopeCandidate>>()
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(next);
    const restoreFocus = vi.fn(() => {
      throw focusFailure;
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const controller = createProjectionScopeController({
      initialSelection: selection('wc', 'shadcn'),
      materialize,
      restoreFocus,
    });

    await controller.start();
    await expect(
      controller.request({ runtimeId: 'react' }, { focusKey: 'runtime-select' })
    ).resolves.toEqual({
      selection: selection('react', 'shadcn'),
      generation: 2,
      phase: 'ready',
    });

    expect(current.dispose).toHaveBeenCalledTimes(1);
    expect(restoreFocus).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      '[ProjectionScope] Failed to restore focus for the committed generation.',
      focusFailure
    );

    consoleError.mockRestore();
    await controller.destroy();
  });

  it('lets the latest requested coordinates win and disposes a candidate that resolves stale', async () => {
    const initial = candidate('initial');
    const older = candidate('older');
    const latest = candidate('latest');
    const olderPreparation = deferred<ProjectionScopeCandidate>();
    const latestPreparation = deferred<ProjectionScopeCandidate>();
    const requests: ProjectionScopeMaterializeRequest[] = [];
    const materialize = vi.fn(async (request: ProjectionScopeMaterializeRequest) => {
      requests.push(request);
      if (request.generation === 1) return initial;
      if (request.generation === 2) return olderPreparation.promise;
      return latestPreparation.promise;
    });
    const onCommit = vi.fn();
    const controller = createProjectionScopeController({
      initialSelection: selection('wc', 'shadcn'),
      materialize,
      prepareCommit: prepareCommit(onCommit),
    });

    await controller.start();
    const olderRequest = controller.request({ runtimeId: 'react' });
    const latestRequest = controller.request({ projectionFamilyId: 'brutalist' });
    await vi.waitFor(() => expect(materialize).toHaveBeenCalledTimes(3));

    expect(requests[1]).toMatchObject({
      generation: 2,
      selection: selection('react', 'shadcn'),
    });
    expect(requests[2]).toMatchObject({
      generation: 3,
      selection: selection('react', 'brutalist'),
    });

    latestPreparation.resolve(latest);
    await latestRequest;
    expect(controller.getSnapshot()).toMatchObject({
      selection: selection('react', 'brutalist'),
      generation: 3,
      phase: 'ready',
    });
    expect(latest.activate).toHaveBeenCalledTimes(1);
    expect(initial.dispose).toHaveBeenCalledTimes(1);

    olderPreparation.resolve(older);
    await olderRequest;
    expect(older.activate).not.toHaveBeenCalled();
    expect(older.dispose).toHaveBeenCalledTimes(1);
    expect(latest.dispose).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toMatchObject({
      selection: selection('react', 'brutalist'),
      generation: 3,
      phase: 'ready',
    });
    expect(onCommit).toHaveBeenCalledTimes(2);

    await controller.destroy();
    expect(latest.dispose).toHaveBeenCalledTimes(1);
  });

  it('reports controlled commits and restores focus by semantic key only after activation', async () => {
    const candidates: Array<ReturnType<typeof candidate>> = [];
    const materialize = vi.fn(async ({ selection: target, generation }) => {
      const next = candidate(`${generation}:${target.runtimeId}:${target.projectionFamilyId}`);
      candidates.push(next);
      return next;
    });
    const onCommit = vi.fn();
    const restoreFocus = vi.fn();
    const controller = createProjectionScopeController({
      initialSelection: selection('wc', 'shadcn'),
      materialize,
      prepareCommit: prepareCommit(onCommit),
      restoreFocus,
    });

    await controller.start();
    await controller.request({ runtimeId: 'vue' }, { focusKey: 'runtime-select' });
    await controller.request(
      { projectionFamilyId: 'brutalist' },
      { focusKey: 'projection-family-select' }
    );

    expect(onCommit.mock.calls.map(([commit]) => commit)).toEqual([
      { selection: selection('wc', 'shadcn'), generation: 1 },
      { selection: selection('vue', 'shadcn'), generation: 2 },
      { selection: selection('vue', 'brutalist'), generation: 3 },
    ]);
    expect(restoreFocus.mock.calls.map(([focusKey, commit]) => [focusKey, commit])).toEqual([
      ['runtime-select', { selection: selection('vue', 'shadcn'), generation: 2 }],
      ['projection-family-select', { selection: selection('vue', 'brutalist'), generation: 3 }],
    ]);
    expect(candidates[1]!.activate.mock.invocationCallOrder[0]).toBeLessThan(
      restoreFocus.mock.invocationCallOrder[0]!
    );
    expect(candidates[2]!.activate.mock.invocationCallOrder[0]).toBeLessThan(
      restoreFocus.mock.invocationCallOrder[1]!
    );

    await controller.destroy();
  });

  it('restores switch focus before delayed retired-generation cleanup', async () => {
    const retiredCleanup = deferred<void>();
    const current: ProjectionScopeCandidate = {
      activate: vi.fn(),
      dispose: vi.fn(() => retiredCleanup.promise),
    };
    const next = candidate('next');
    const materialize = vi
      .fn<(request: ProjectionScopeMaterializeRequest) => Promise<ProjectionScopeCandidate>>()
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(next);
    const initiatingControl = document.createElement('button');
    const laterControl = document.createElement('button');
    document.body.append(initiatingControl, laterControl);
    const restoreFocus = vi.fn(() => initiatingControl.focus());
    const controller = createProjectionScopeController({
      initialSelection: selection('wc', 'shadcn'),
      materialize,
      restoreFocus,
    });

    await controller.start();
    const switching = controller.request({ runtimeId: 'react' }, { focusKey: 'runtime-select' });
    await vi.waitFor(() => expect(next.activate).toHaveBeenCalledTimes(1));

    expect(restoreFocus).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(initiatingControl);
    laterControl.focus();
    retiredCleanup.resolve(undefined);
    await switching;

    expect(document.activeElement).toBe(laterControl);
    await controller.destroy();
  });

  it('rematerializes controlled content without adding it to the projection coordinates', async () => {
    const materialize = vi.fn(async ({ selection: target, generation }) =>
      candidate(`${generation}:${target.runtimeId}:${target.projectionFamilyId}`)
    );
    const controller = createProjectionScopeController({
      initialSelection: selection('wc', 'shadcn'),
      materialize,
    });

    await controller.start();
    await controller.request({}, { force: true, focusKey: 'component-select' });

    expect(materialize.mock.calls.map(([request]) => request.selection)).toEqual([
      selection('wc', 'shadcn'),
      selection('wc', 'shadcn'),
    ]);
    expect(controller.getSnapshot()).toEqual({
      selection: selection('wc', 'shadcn'),
      generation: 2,
      phase: 'ready',
    });

    await controller.destroy();
  });

  it('publishes activation and commit metadata in the same synchronous stack', async () => {
    const events: string[] = [];
    const materialize = vi.fn(async ({ generation }: ProjectionScopeMaterializeRequest) => ({
      activate() {
        events.push(`activate:${generation}`);
        queueMicrotask(() => events.push(`activation-microtask:${generation}`));
      },
      dispose() {
        events.push(`dispose:${generation}`);
      },
    }));
    const controller = createProjectionScopeController({
      initialSelection: selection('wc', 'shadcn'),
      materialize,
      prepareCommit: prepareCommit(({ generation }) => events.push(`commit:${generation}`)),
    });

    await controller.start();

    expect(events.slice(0, 2)).toEqual(['activate:1', 'commit:1']);
    expect(events.indexOf('commit:1')).toBeLessThan(events.indexOf('activation-microtask:1'));
    await controller.destroy();
  });

  it('fails closed when an erased candidate returns a thenable from activation', async () => {
    const current = candidate('current');
    const invalidActivation = vi.fn(() => Promise.resolve());
    const invalidDispose = vi.fn();
    const invalid = {
      activate: invalidActivation,
      dispose: invalidDispose,
    } as unknown as ProjectionScopeCandidate;
    const materialize = vi
      .fn<(request: ProjectionScopeMaterializeRequest) => Promise<ProjectionScopeCandidate>>()
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(invalid);
    const onCommit = vi.fn();
    const controller = createProjectionScopeController({
      initialSelection: selection('wc', 'shadcn'),
      materialize,
      prepareCommit: prepareCommit(onCommit),
    });

    await controller.start();
    await expect(controller.request({ runtimeId: 'react' })).rejects.toThrow(
      'Candidate activation must complete synchronously'
    );

    expect(invalidActivation).toHaveBeenCalledTimes(1);
    expect(invalidDispose).toHaveBeenCalledTimes(1);
    expect(current.activate).toHaveBeenCalledTimes(2);
    expect(current.dispose).not.toHaveBeenCalled();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toEqual({
      selection: selection('wc', 'shadcn'),
      generation: 1,
      phase: 'ready',
    });

    await controller.destroy();
  });

  it('restores the retained candidate when activation mutates visibility and then throws', async () => {
    let visibleGeneration = 0;
    const current: ProjectionScopeCandidate & {
      activate: ReturnType<typeof vi.fn>;
      dispose: ReturnType<typeof vi.fn>;
    } = {
      activate: vi.fn(() => {
        visibleGeneration = 1;
      }),
      dispose: vi.fn(),
    };
    const failed: ProjectionScopeCandidate & {
      activate: ReturnType<typeof vi.fn>;
      dispose: ReturnType<typeof vi.fn>;
    } = {
      activate: vi.fn(() => {
        visibleGeneration = 2;
        throw new Error('activation exposed a partial tree');
      }),
      dispose: vi.fn(),
    };
    const materialize = vi
      .fn<(request: ProjectionScopeMaterializeRequest) => Promise<ProjectionScopeCandidate>>()
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(failed);
    const controller = createProjectionScopeController({
      initialSelection: selection('wc', 'shadcn'),
      materialize,
    });

    await controller.start();
    await expect(controller.request({ runtimeId: 'react' })).rejects.toThrow(
      'activation exposed a partial tree'
    );

    expect(current.activate).toHaveBeenCalledTimes(2);
    expect(current.dispose).not.toHaveBeenCalled();
    expect(failed.activate).toHaveBeenCalledTimes(1);
    expect(failed.dispose).toHaveBeenCalledTimes(1);
    expect(visibleGeneration).toBe(1);
    expect(controller.getSnapshot()).toEqual({
      selection: selection('wc', 'shadcn'),
      generation: 1,
      phase: 'ready',
    });

    await controller.destroy();
  });

  it('rolls back the activated candidate when client commit publication throws', async () => {
    let visibleGeneration = 0;
    let publishedGeneration = 0;
    const currentLocks: boolean[] = [];
    const current: ProjectionScopeCandidate & {
      activate: ReturnType<typeof vi.fn>;
      dispose: ReturnType<typeof vi.fn>;
    } = {
      activate: vi.fn(() => {
        visibleGeneration = 1;
      }),
      dispose: vi.fn(),
      setLocked: vi.fn((locked: boolean) => {
        currentLocks.push(locked);
      }),
    };
    const next: ProjectionScopeCandidate & {
      activate: ReturnType<typeof vi.fn>;
      dispose: ReturnType<typeof vi.fn>;
    } = {
      activate: vi.fn(() => {
        visibleGeneration = 2;
      }),
      dispose: vi.fn(),
    };
    const materialize = vi
      .fn<(request: ProjectionScopeMaterializeRequest) => Promise<ProjectionScopeCandidate>>()
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(next);
    const publishCommit = vi.fn(({ generation }: ProjectionScopeCommit) => {
      publishedGeneration = generation;
      if (generation === 2) throw new Error('theme publication failed');
    });
    const controller = createProjectionScopeController({
      initialSelection: selection('wc', 'shadcn'),
      materialize,
      prepareCommit: (commit) => {
        const previousPublishedGeneration = publishedGeneration;
        return {
          publish: () => publishCommit(commit),
          rollback: () => {
            publishedGeneration = previousPublishedGeneration;
          },
        };
      },
    });

    await controller.start();
    await expect(controller.request({ runtimeId: 'react' })).rejects.toThrow(
      'theme publication failed'
    );

    expect(current.activate).toHaveBeenCalledTimes(2);
    expect(current.dispose).not.toHaveBeenCalled();
    expect(currentLocks).toEqual([true, false]);
    expect(next.activate).toHaveBeenCalledTimes(1);
    expect(next.dispose).toHaveBeenCalledTimes(1);
    expect(visibleGeneration).toBe(1);
    expect(publishedGeneration).toBe(1);
    expect(controller.getSnapshot()).toEqual({
      selection: selection('wc', 'shadcn'),
      generation: 1,
      phase: 'ready',
    });

    await controller.destroy();
  });

  it('keeps the superseding target and retained lease locked when publication reenters request', async () => {
    const currentLocks: boolean[] = [];
    const current: ProjectionScopeCandidate & {
      activate: ReturnType<typeof vi.fn>;
      dispose: ReturnType<typeof vi.fn>;
    } = {
      activate: vi.fn(),
      dispose: vi.fn(),
      setLocked: vi.fn((locked: boolean) => {
        currentLocks.push(locked);
      }),
    };
    const failed = candidate('failed');
    const latest = candidate('latest');
    const latestPreparation = deferred<ProjectionScopeCandidate>();
    const materialize = vi
      .fn<(request: ProjectionScopeMaterializeRequest) => Promise<ProjectionScopeCandidate>>()
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(failed)
      .mockReturnValueOnce(latestPreparation.promise);
    let controller!: ReturnType<typeof createProjectionScopeController>;
    let latestRequest!: Promise<unknown>;
    const rollback = vi.fn();
    controller = createProjectionScopeController({
      initialSelection: selection('wc', 'shadcn'),
      materialize,
      prepareCommit: (commit) => ({
        publish() {
          if (commit.generation !== 2) return;
          latestRequest = controller.request({ projectionFamilyId: 'brutalist' });
          throw new Error('superseded publication failed');
        },
        rollback,
      }),
    });

    await controller.start();
    const supersededRequest = controller.request({ runtimeId: 'react' });
    await supersededRequest;
    await vi.waitFor(() => expect(materialize).toHaveBeenCalledTimes(3));

    expect(materialize.mock.calls[2]![0]).toEqual({
      selection: selection('react', 'brutalist'),
      generation: 3,
    });
    expect(controller.getSnapshot()).toEqual({
      selection: selection('wc', 'shadcn'),
      generation: 1,
      phase: 'preparing',
    });
    expect(current.activate).toHaveBeenCalledTimes(2);
    expect(current.dispose).not.toHaveBeenCalled();
    expect(currentLocks).toEqual([true]);
    expect(failed.activate).toHaveBeenCalledTimes(1);
    expect(failed.dispose).toHaveBeenCalledTimes(1);
    expect(rollback).toHaveBeenCalledTimes(1);

    latestPreparation.resolve(latest);
    await latestRequest;

    expect(controller.getSnapshot()).toEqual({
      selection: selection('react', 'brutalist'),
      generation: 3,
      phase: 'ready',
    });
    expect(latest.activate).toHaveBeenCalledTimes(1);
    expect(current.dispose).toHaveBeenCalledTimes(1);
    expect(currentLocks).toEqual([true]);

    await controller.destroy();
  });

  it('disposes a stale prepared candidate even when its rollback throws', async () => {
    const current = candidate('current');
    const stale = candidate('stale');
    const latest = candidate('latest');
    const latestPreparation = deferred<ProjectionScopeCandidate>();
    const materialize = vi
      .fn<(request: ProjectionScopeMaterializeRequest) => Promise<ProjectionScopeCandidate>>()
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(stale)
      .mockReturnValueOnce(latestPreparation.promise);
    let controller!: ReturnType<typeof createProjectionScopeController>;
    let latestRequest!: Promise<unknown>;
    controller = createProjectionScopeController({
      initialSelection: selection('wc', 'shadcn'),
      materialize,
      prepareCommit: (commit) => {
        if (commit.generation === 2) {
          latestRequest = controller.request({ projectionFamilyId: 'brutalist' });
        }
        return {
          publish() {},
          rollback() {
            if (commit.generation === 2) throw new Error('stale rollback failed');
          },
        };
      },
    });

    await controller.start();
    await controller.request({ runtimeId: 'react' });
    await vi.waitFor(() => expect(materialize).toHaveBeenCalledTimes(3));

    expect(stale.activate).not.toHaveBeenCalled();
    expect(stale.dispose).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toEqual({
      selection: selection('wc', 'shadcn'),
      generation: 1,
      phase: 'preparing',
    });

    latestPreparation.resolve(latest);
    await latestRequest;
    expect(controller.getSnapshot()).toEqual({
      selection: selection('react', 'brutalist'),
      generation: 3,
      phase: 'ready',
    });

    await controller.destroy();
  });

  it('waits for pending materialization and stale lease cleanup before destroy resolves', async () => {
    const current = candidate('current');
    const staleCleanup = deferred<void>();
    const stale: ProjectionScopeCandidate & {
      activate: ReturnType<typeof vi.fn>;
      dispose: ReturnType<typeof vi.fn>;
    } = {
      activate: vi.fn(),
      dispose: vi.fn(() => staleCleanup.promise),
    };
    const nextPreparation = deferred<ProjectionScopeCandidate>();
    const materialize = vi
      .fn<(request: ProjectionScopeMaterializeRequest) => Promise<ProjectionScopeCandidate>>()
      .mockResolvedValueOnce(current)
      .mockReturnValueOnce(nextPreparation.promise);
    const onCommit = vi.fn();
    const controller = createProjectionScopeController({
      initialSelection: selection('wc', 'shadcn'),
      materialize,
      prepareCommit: prepareCommit(onCommit),
    });

    await controller.start();
    const pendingRequest = controller.request({ runtimeId: 'react' });
    await vi.waitFor(() => expect(materialize).toHaveBeenCalledTimes(2));

    let destroyResolved = false;
    const destroying = controller.destroy().then(() => {
      destroyResolved = true;
    });
    await Promise.resolve();

    expect(destroyResolved).toBe(false);
    expect(controller.getSnapshot()).toEqual({
      selection: selection('wc', 'shadcn'),
      generation: 1,
      phase: 'destroyed',
    });

    expect(current.dispose).toHaveBeenCalledTimes(1);
    nextPreparation.resolve(stale);
    await vi.waitFor(() => expect(stale.dispose).toHaveBeenCalledTimes(1));

    expect(stale.activate).not.toHaveBeenCalled();
    expect(destroyResolved).toBe(false);

    staleCleanup.resolve(undefined);
    await Promise.all([pendingRequest, destroying]);

    expect(current.dispose).toHaveBeenCalledTimes(1);
    expect(stale.dispose).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(destroyResolved).toBe(true);
    expect(controller.getSnapshot()).toEqual({
      selection: selection('wc', 'shadcn'),
      generation: 1,
      phase: 'destroyed',
    });
  });

  it('restores and unlocks the committed generation when lock acquisition throws', async () => {
    const lockFailure = new Error('current projection could not be sealed');
    const setLocked = vi.fn((locked: boolean) => {
      if (locked) throw lockFailure;
    });
    const current: ProjectionScopeCandidate = {
      activate: vi.fn(),
      dispose: vi.fn(),
      setLocked,
    };
    const materialize = vi
      .fn<(request: ProjectionScopeMaterializeRequest) => Promise<ProjectionScopeCandidate>>()
      .mockResolvedValueOnce(current);
    const controller = createProjectionScopeController({
      initialSelection: selection('wc', 'shadcn'),
      materialize,
    });

    await controller.start();
    await expect(controller.request({ runtimeId: 'react' })).rejects.toBe(lockFailure);

    expect(setLocked.mock.calls.map(([locked]) => locked)).toEqual([true, false]);
    expect(materialize).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toEqual({
      selection: selection('wc', 'shadcn'),
      generation: 1,
      phase: 'ready',
    });

    await controller.destroy();
  });

  it('restores and unlocks the committed generation when async lock acquisition rejects', async () => {
    const lockFailure = new Error('async projection seal failed');
    const locking = deferred<void>();
    const setLocked = vi.fn((locked: boolean) => (locked ? locking.promise : Promise.resolve()));
    const current: ProjectionScopeCandidate = {
      activate: vi.fn(),
      dispose: vi.fn(),
      setLocked,
    };
    const materialize = vi
      .fn<(request: ProjectionScopeMaterializeRequest) => Promise<ProjectionScopeCandidate>>()
      .mockResolvedValueOnce(current);
    const controller = createProjectionScopeController({
      initialSelection: selection('wc', 'shadcn'),
      materialize,
    });

    await controller.start();
    const request = controller.request({ runtimeId: 'react' });
    locking.reject(lockFailure);
    await expect(request).rejects.toBe(lockFailure);

    expect(setLocked.mock.calls.map(([locked]) => locked)).toEqual([true, false]);
    expect(materialize).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toEqual({
      selection: selection('wc', 'shadcn'),
      generation: 1,
      phase: 'ready',
    });

    await controller.destroy();
  });

  it('does not let a stale async unlock reopen a superseding preparation', async () => {
    const lockFailure = new Error('first projection seal failed');
    const unlocking = deferred<void>();
    const nextPreparation = deferred<ProjectionScopeCandidate>();
    let physicalLocked = false;
    let lockAttempt = 0;
    const setLocked = vi.fn((locked: boolean): void | Promise<void> => {
      if (locked) {
        physicalLocked = true;
        lockAttempt += 1;
        if (lockAttempt === 1) return Promise.reject(lockFailure);
        return;
      }
      return unlocking.promise.then(() => {
        physicalLocked = false;
      });
    });
    const current: ProjectionScopeCandidate = {
      activate: vi.fn(),
      dispose: vi.fn(),
      setLocked,
    };
    const materialize = vi
      .fn<(request: ProjectionScopeMaterializeRequest) => Promise<ProjectionScopeCandidate>>()
      .mockResolvedValueOnce(current)
      .mockReturnValueOnce(nextPreparation.promise);
    const controller = createProjectionScopeController({
      initialSelection: selection('wc', 'shadcn'),
      materialize,
    });

    await controller.start();
    const failedRequest = controller.request({ runtimeId: 'react' });
    await vi.waitFor(() => expect(setLocked).toHaveBeenCalledWith(false));
    const supersedingRequest = controller.request({ projectionFamilyId: 'brutalist' });

    expect(physicalLocked).toBe(true);
    unlocking.resolve(undefined);
    await expect(failedRequest).rejects.toBe(lockFailure);
    await vi.waitFor(() => expect(materialize).toHaveBeenCalledTimes(2));

    expect(setLocked.mock.calls.map(([locked]) => locked)).toEqual([true, false, true]);
    expect(physicalLocked).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({ phase: 'preparing' });

    nextPreparation.resolve(candidate('next'));
    await supersedingRequest;
    await controller.destroy();
  });

  it('reserves the lock queue before a candidate synchronously reenters request', async () => {
    const innerLock = deferred<void>();
    const next = candidate('next');
    let controller!: ReturnType<typeof createProjectionScopeController>;
    let innerRequest!: Promise<unknown>;
    let lockCall = 0;
    const current: ProjectionScopeCandidate = {
      activate: vi.fn(),
      dispose: vi.fn(),
      setLocked: vi.fn((locked: boolean) => {
        if (!locked) return;
        lockCall += 1;
        if (lockCall === 1) {
          innerRequest = controller.request({ projectionFamilyId: 'brutalist' });
          return;
        }
        return innerLock.promise;
      }),
    };
    const materialize = vi
      .fn<(request: ProjectionScopeMaterializeRequest) => Promise<ProjectionScopeCandidate>>()
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(next);
    controller = createProjectionScopeController({
      initialSelection: selection('wc', 'shadcn'),
      materialize,
    });

    await controller.start();
    const outerRequest = controller.request({ runtimeId: 'react' });

    expect(lockCall).toBe(1);
    await outerRequest;
    await vi.waitFor(() => expect(lockCall).toBe(2));

    innerLock.resolve(undefined);
    await innerRequest;

    expect(controller.getSnapshot()).toEqual({
      selection: selection('react', 'brutalist'),
      generation: 3,
      phase: 'ready',
    });
    await controller.destroy();
  });

  it('disposes the retained generation while an async seal is still pending', async () => {
    const sealing = deferred<void>();
    const events: string[] = [];
    const current: ProjectionScopeCandidate = {
      activate: vi.fn(),
      setLocked: vi.fn((locked: boolean) =>
        locked
          ? sealing.promise.then(() => {
              events.push('seal-settled');
            })
          : undefined
      ),
      dispose: vi.fn(() => {
        events.push('dispose');
      }),
    };
    const materialize = vi
      .fn<(request: ProjectionScopeMaterializeRequest) => Promise<ProjectionScopeCandidate>>()
      .mockResolvedValueOnce(current);
    const controller = createProjectionScopeController({
      initialSelection: selection('wc', 'shadcn'),
      materialize,
    });

    await controller.start();
    const request = controller.request({ runtimeId: 'react' });
    await vi.waitFor(() => expect(current.setLocked).toHaveBeenCalledWith(true));
    let destroyResolved = false;
    const destroying = controller.destroy().then(() => {
      destroyResolved = true;
      events.push('destroy-resolved');
    });
    await vi.waitFor(() => expect(current.dispose).toHaveBeenCalledTimes(1));

    expect(events).toEqual(['dispose']);
    expect(destroyResolved).toBe(false);

    sealing.resolve(undefined);
    await Promise.all([request, destroying]);

    expect(events).toEqual(['dispose', 'seal-settled', 'destroy-resolved']);
    expect(controller.getSnapshot()).toMatchObject({ phase: 'destroyed' });
  });

  it('breaks a request-destroy cycle returned directly from the lock callback', async () => {
    let controller!: ReturnType<typeof createProjectionScopeController>;
    const current: ProjectionScopeCandidate = {
      activate: vi.fn(),
      dispose: vi.fn(),
      setLocked: vi.fn((locked: boolean) => (locked ? controller.destroy() : undefined)),
    };
    const materialize = vi
      .fn<(request: ProjectionScopeMaterializeRequest) => Promise<ProjectionScopeCandidate>>()
      .mockResolvedValueOnce(current);
    controller = createProjectionScopeController({
      initialSelection: selection('wc', 'shadcn'),
      materialize,
    });

    await controller.start();
    await expect(controller.request({ runtimeId: 'react' })).resolves.toMatchObject({
      phase: 'destroyed',
    });
    await expect(controller.destroy()).resolves.toBeUndefined();

    expect(current.dispose).toHaveBeenCalledTimes(1);
    expect(materialize).toHaveBeenCalledTimes(1);
  });

  it('breaks a request-destroy cycle returned through a lock callback wrapper', async () => {
    let controller!: ReturnType<typeof createProjectionScopeController>;
    const current: ProjectionScopeCandidate = {
      activate: vi.fn(),
      dispose: vi.fn(),
      setLocked: vi.fn((locked: boolean) => {
        if (!locked) return;
        const destroying = controller.destroy();
        return destroying.then(() => undefined);
      }),
    };
    const materialize = vi
      .fn<(request: ProjectionScopeMaterializeRequest) => Promise<ProjectionScopeCandidate>>()
      .mockResolvedValueOnce(current);
    controller = createProjectionScopeController({
      initialSelection: selection('wc', 'shadcn'),
      materialize,
    });

    await controller.start();
    await expect(controller.request({ runtimeId: 'react' })).resolves.toMatchObject({
      phase: 'destroyed',
    });
    await expect(controller.destroy()).resolves.toBeUndefined();

    expect(current.dispose).toHaveBeenCalledTimes(1);
    expect(materialize).toHaveBeenCalledTimes(1);
  });

  it('breaks a destroy-dispose cycle returned from the candidate disposal callback', async () => {
    let controller!: ReturnType<typeof createProjectionScopeController>;
    const current: ProjectionScopeCandidate = {
      activate: vi.fn(),
      dispose: vi.fn(() => controller.destroy()),
    };
    const materialize = vi
      .fn<(request: ProjectionScopeMaterializeRequest) => Promise<ProjectionScopeCandidate>>()
      .mockResolvedValueOnce(current);
    controller = createProjectionScopeController({
      initialSelection: selection('wc', 'shadcn'),
      materialize,
    });

    await controller.start();
    await expect(controller.destroy()).resolves.toBeUndefined();

    expect(current.dispose).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({ phase: 'destroyed' });
  });

  it('awaits independent async disposal after the candidate synchronously reenters destroy', async () => {
    const cleanup = deferred<void>();
    let controller!: ReturnType<typeof createProjectionScopeController>;
    const current: ProjectionScopeCandidate = {
      activate: vi.fn(),
      dispose: vi.fn(() => {
        void controller.destroy();
        return cleanup.promise;
      }),
    };
    const materialize = vi
      .fn<(request: ProjectionScopeMaterializeRequest) => Promise<ProjectionScopeCandidate>>()
      .mockResolvedValueOnce(current);
    controller = createProjectionScopeController({
      initialSelection: selection('wc', 'shadcn'),
      materialize,
    });

    await controller.start();
    let destroyResolved = false;
    const destroying = controller.destroy().then(() => {
      destroyResolved = true;
    });
    await vi.waitFor(() => expect(current.dispose).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(destroyResolved).toBe(false);

    cleanup.resolve(undefined);
    await destroying;
    expect(destroyResolved).toBe(true);
  });

  it('locks the committed request surfaces and unlocks them after a fail-closed rejection', async () => {
    const locks: boolean[] = [];
    const current: ProjectionScopeCandidate = {
      activate: vi.fn(),
      dispose: vi.fn(),
      setLocked: vi.fn((locked: boolean) => {
        locks.push(locked);
      }),
    };
    const materialize = vi
      .fn<(request: ProjectionScopeMaterializeRequest) => Promise<ProjectionScopeCandidate>>()
      .mockResolvedValueOnce(current)
      .mockRejectedValueOnce(new Error('missing projected Select item'));
    const controller = createProjectionScopeController({
      initialSelection: selection('wc', 'shadcn'),
      materialize,
    });

    await controller.start();
    await expect(controller.request({ runtimeId: 'react' })).rejects.toThrow(
      'missing projected Select item'
    );

    expect(locks).toEqual([true, false]);
    expect(controller.getSnapshot()).toEqual({
      selection: selection('wc', 'shadcn'),
      generation: 1,
      phase: 'ready',
    });

    await controller.destroy();
  });
});
