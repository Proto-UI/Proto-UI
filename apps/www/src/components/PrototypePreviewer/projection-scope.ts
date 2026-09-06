export type ProjectionScopeSelection = Readonly<{
  runtimeId: string;
  projectionFamilyId: string;
}>;

export type ProjectionScopePhase = 'idle' | 'preparing' | 'ready' | 'destroyed';

export type ProjectionScopeSnapshot = Readonly<{
  selection: ProjectionScopeSelection;
  generation: number;
  phase: ProjectionScopePhase;
}>;

export type ProjectionScopeCommit = Readonly<{
  selection: ProjectionScopeSelection;
  generation: number;
}>;

export type ProjectionScopeMaterializeRequest = ProjectionScopeCommit;

export type ProjectionScopeCommitPublication = Readonly<{
  /** Publish only already-prepared, synchronous client metadata. */
  publish(): void;
  /** Revoke prepared resources and undo a partial publication synchronously. */
  rollback(): void;
}>;

export type ProjectionScopeCandidate = Readonly<{
  /**
   * Expose this candidate synchronously. Returning a thenable is a contract
   * violation because activation and generation metadata must share one
   * host-observable commit.
   */
  activate(): void;
  /**
   * Revoke this candidate and its owned resources. The controller awaits the
   * returned cleanup. A synchronous destroy() reentry is supported, but after
   * this callback returns, its thenable and continuations must not call or
   * await a method on the same controller: lifecycle completion cannot depend
   * on itself. Disposal must also revoke or make inert every outstanding
   * candidate-owned async effect before it releases the resource lease.
   */
  dispose(): void | Promise<void>;
  /**
   * Seal or reopen every candidate-owned request surface. Operations are
   * serialized. A callback that synchronously reenters request() must complete
   * synchronously and return void. Synchronous destroy() reentry is supported
   * through a non-cyclic facade. Any returned thenable and its continuations
   * must not call or await the same controller.
   * The callback and every async completion are confined to this candidate's
   * generation-owned surfaces; they must never mutate shared state or another
   * generation and must become inert once dispose() begins.
   */
  setLocked?(locked: boolean): void | Promise<void>;
}>;

export type ProjectionScopeRequestOptions = Readonly<{
  focusKey?: string;
  /** Rematerialize host-controlled content without changing projection coordinates. */
  force?: boolean;
}>;

export type ProjectionScopeControllerOptions = Readonly<{
  initialSelection: ProjectionScopeSelection;
  materialize(
    request: ProjectionScopeMaterializeRequest
  ): ProjectionScopeCandidate | Promise<ProjectionScopeCandidate>;
  /**
   * Perform every fallible client-side preparation before activation and
   * return an infallible synchronous publication with a rollback lease.
   */
  prepareCommit?(commit: ProjectionScopeCommit): ProjectionScopeCommitPublication;
  restoreFocus?(focusKey: string, commit: ProjectionScopeCommit): void;
}>;

export type ProjectionScopeController = Readonly<{
  start(): Promise<ProjectionScopeSnapshot>;
  request(
    patch: Partial<ProjectionScopeSelection>,
    options?: ProjectionScopeRequestOptions
  ): Promise<ProjectionScopeSnapshot>;
  getSnapshot(): ProjectionScopeSnapshot;
  destroy(): Promise<void>;
}>;

function copySelection(selection: ProjectionScopeSelection): ProjectionScopeSelection {
  return {
    runtimeId: selection.runtimeId,
    projectionFamilyId: selection.projectionFamilyId,
  };
}

function sameSelection(left: ProjectionScopeSelection, right: ProjectionScopeSelection): boolean {
  return left.runtimeId === right.runtimeId && left.projectionFamilyId === right.projectionFamilyId;
}

function isPromiseLike(value: unknown): value is PromiseLike<void> {
  return Boolean(value && typeof (value as PromiseLike<void>).then === 'function');
}

const EMPTY_COMMIT_PUBLICATION: ProjectionScopeCommitPublication = Object.freeze({
  publish() {},
  rollback() {},
});

const STALE_ACTIVATION = Symbol('stale-projection-activation');

/**
 * Coordinates Website-owned Prototype projections without owning their DOM.
 *
 * Materializers prepare an inert candidate first. Only the latest request may
 * activate and commit it; the previously active candidate stays available
 * until that activation succeeds. Every stale or failed candidate is disposed
 * through its own lease and therefore cannot revoke a newer generation.
 */
export function createProjectionScopeController(
  options: ProjectionScopeControllerOptions
): ProjectionScopeController {
  let committedSelection = copySelection(options.initialSelection);
  let desiredSelection = copySelection(options.initialSelection);
  let committedGeneration = 0;
  let nextGeneration = 0;
  let latestRequestGeneration = 0;
  let phase: ProjectionScopePhase = 'idle';
  let activeCandidate: ProjectionScopeCandidate | null = null;
  let startPromise: Promise<ProjectionScopeSnapshot> | null = null;
  let destroyPromise: Promise<void> | null = null;
  let candidateCallbackDepth = 0;
  let destroyed = false;

  const reentrantDestroyFacade = Promise.resolve();

  const disposalPromises = new WeakMap<ProjectionScopeCandidate, Promise<void>>();
  const candidateLockQueues = new WeakMap<
    ProjectionScopeCandidate,
    { tail: Promise<void> | null }
  >();
  const inFlightMaterializations = new Set<Promise<ProjectionScopeSnapshot>>();
  const inFlightRequests = new Set<Promise<ProjectionScopeSnapshot>>();

  const getSnapshot = (): ProjectionScopeSnapshot => ({
    selection: copySelection(committedSelection),
    generation: committedGeneration,
    phase,
  });

  const invokeCandidateCallback = <Result>(callback: () => Result): Result => {
    candidateCallbackDepth += 1;
    try {
      return callback();
    } finally {
      candidateCallbackDepth -= 1;
    }
  };

  const disposeCandidate = (candidate: ProjectionScopeCandidate): Promise<void> => {
    const existing = disposalPromises.get(candidate);
    if (existing) return existing;

    const disposal = Promise.resolve().then(() =>
      invokeCandidateCallback(() => candidate.dispose())
    );
    disposalPromises.set(candidate, disposal);
    return disposal;
  };

  const disposeCandidateAfterOutcome = async (
    candidate: ProjectionScopeCandidate,
    label: string
  ): Promise<void> => {
    try {
      await disposeCandidate(candidate);
    } catch (error) {
      console.error(`[ProjectionScope] Failed to dispose ${label}.`, error);
    }
  };

  const isCurrentRequest = (generation: number): boolean =>
    !destroyed && latestRequestGeneration === generation;

  const setCandidateLocked = (
    candidate: ProjectionScopeCandidate | null,
    locked: boolean
  ): void | PromiseLike<void> => {
    if (!candidate?.setLocked) return;
    let queue = candidateLockQueues.get(candidate);
    if (!queue) {
      queue = { tail: null };
      candidateLockQueues.set(candidate, queue);
    }
    const lockQueue = queue;

    const track = (operation: Promise<void>): Promise<void> => {
      let tail!: Promise<void>;
      tail = operation
        .then(
          () => undefined,
          () => undefined
        )
        .then(() => {
          if (lockQueue.tail === tail) lockQueue.tail = null;
        });
      lockQueue.tail = tail;
      return operation;
    };

    const invoke = (): void | PromiseLike<void> => {
      if (destroyed) return;
      return invokeCandidateCallback(() => candidate.setLocked?.(locked));
    };

    if (!lockQueue.tail) {
      let releaseSentinel!: () => void;
      const completion = new Promise<void>((resolve) => {
        releaseSentinel = resolve;
      });
      let sentinel!: Promise<void>;
      sentinel = completion.then(() => {
        if (lockQueue.tail === sentinel) lockQueue.tail = null;
      });
      // Reserve the queue before invoking user-controlled candidate code. A
      // synchronous reentrant request must queue behind this invocation, and
      // its descendant tail must not be overwritten when this call returns.
      lockQueue.tail = sentinel;

      let operation: void | PromiseLike<void>;
      try {
        operation = invoke();
      } catch (error) {
        releaseSentinel();
        if (lockQueue.tail === sentinel) lockQueue.tail = null;
        throw error;
      }
      if (!isPromiseLike(operation)) {
        releaseSentinel();
        if (lockQueue.tail === sentinel) lockQueue.tail = null;
        return;
      }

      const pending = Promise.resolve(operation);
      void pending.then(releaseSentinel, releaseSentinel);
      return pending;
    }

    // Preserve invocation order for async candidates so a stale unlock cannot
    // settle after and reopen a newer generation's lock.
    return track(lockQueue.tail.then(invoke));
  };

  const unlockCandidateAfterFailure = async (
    candidate: ProjectionScopeCandidate | null,
    label: string
  ): Promise<void> => {
    try {
      const unlock = setCandidateLocked(candidate, false);
      if (isPromiseLike(unlock)) await unlock;
    } catch (error) {
      console.error(`[ProjectionScope] Failed to unlock ${label}.`, error);
    }
  };

  const trackSnapshotOperation = (
    inFlight: Set<Promise<ProjectionScopeSnapshot>>,
    run: () => Promise<ProjectionScopeSnapshot>
  ): Promise<ProjectionScopeSnapshot> => {
    let resolveTracked!: (snapshot: ProjectionScopeSnapshot) => void;
    let rejectTracked!: (reason: unknown) => void;
    const tracked = new Promise<ProjectionScopeSnapshot>((resolve, reject) => {
      resolveTracked = resolve;
      rejectTracked = reject;
    });
    const settle = (
      outcome:
        | Readonly<{ status: 'fulfilled'; value: ProjectionScopeSnapshot }>
        | Readonly<{ status: 'rejected'; reason: unknown }>
    ): void => {
      inFlight.delete(tracked);
      if (outcome.status === 'fulfilled') resolveTracked(outcome.value);
      else rejectTracked(outcome.reason);
    };

    inFlight.add(tracked);
    try {
      void run().then(
        (value) => settle({ status: 'fulfilled', value }),
        (reason: unknown) => settle({ status: 'rejected', reason })
      );
    } catch (reason) {
      settle({ status: 'rejected', reason });
    }
    return tracked;
  };
  const trackMaterialization = (
    run: () => Promise<ProjectionScopeSnapshot>
  ): Promise<ProjectionScopeSnapshot> => trackSnapshotOperation(inFlightMaterializations, run);
  const trackRequest = (
    run: () => Promise<ProjectionScopeSnapshot>
  ): Promise<ProjectionScopeSnapshot> => trackSnapshotOperation(inFlightRequests, run);

  const materializeGeneration = async (
    targetSelection: ProjectionScopeSelection,
    generation: number,
    focusKey?: string
  ): Promise<ProjectionScopeSnapshot> => {
    let candidate: ProjectionScopeCandidate;

    try {
      candidate = await options.materialize({
        selection: copySelection(targetSelection),
        generation,
      });
    } catch (error) {
      if (!isCurrentRequest(generation)) return getSnapshot();
      desiredSelection = copySelection(committedSelection);
      phase = activeCandidate ? 'ready' : 'idle';
      await unlockCandidateAfterFailure(activeCandidate, 'the retained generation');
      throw error;
    }

    if (!isCurrentRequest(generation)) {
      await disposeCandidateAfterOutcome(candidate, 'a stale generation');
      return getSnapshot();
    }

    const commit: ProjectionScopeCommit = {
      selection: copySelection(targetSelection),
      generation,
    };
    let publication: ProjectionScopeCommitPublication;

    try {
      publication = options.prepareCommit?.(commit) ?? EMPTY_COMMIT_PUBLICATION;
      if (
        !publication ||
        typeof publication.publish !== 'function' ||
        typeof publication.rollback !== 'function'
      ) {
        throw new Error(
          '[ProjectionScope] Commit preparation must return synchronous publish and rollback functions.'
        );
      }
    } catch (error) {
      await disposeCandidateAfterOutcome(candidate, 'a failed generation');
      if (!isCurrentRequest(generation)) return getSnapshot();
      desiredSelection = copySelection(committedSelection);
      phase = activeCandidate ? 'ready' : 'idle';
      await unlockCandidateAfterFailure(activeCandidate, 'the retained generation');
      throw error;
    }

    if (!isCurrentRequest(generation)) {
      try {
        const rollback = publication.rollback() as unknown;
        if (isPromiseLike(rollback)) {
          throw new Error('[ProjectionScope] Commit rollback must complete synchronously.');
        }
      } catch {
        // A stale preparation cannot publish. Preserve that no-commit result
        // while still revoking both its publication and candidate leases.
      } finally {
        await disposeCandidateAfterOutcome(candidate, 'a stale generation');
      }
      return getSnapshot();
    }

    const previousCandidate = activeCandidate;
    const previousSelection = copySelection(committedSelection);
    const previousGeneration = committedGeneration;
    const previousPhase: ProjectionScopePhase = previousCandidate ? 'ready' : 'idle';
    let activationAttempted = false;

    try {
      activationAttempted = true;
      const activation = candidate.activate() as unknown;
      if (isPromiseLike(activation)) {
        throw new Error(
          '[ProjectionScope] Candidate activation must complete synchronously; thenables cannot form an atomic generation commit.'
        );
      }
      if (!isCurrentRequest(generation)) throw STALE_ACTIVATION;

      activeCandidate = candidate;
      committedSelection = copySelection(targetSelection);
      desiredSelection = copySelection(targetSelection);
      committedGeneration = generation;
      phase = 'ready';

      const published = publication.publish() as unknown;
      if (isPromiseLike(published)) {
        throw new Error('[ProjectionScope] Commit publication must complete synchronously.');
      }
    } catch (error) {
      const wasDestroyed = destroyed;
      const superseded = !wasDestroyed && latestRequestGeneration !== generation;

      if (!wasDestroyed) {
        activeCandidate = previousCandidate;
        committedSelection = previousSelection;
        if (!superseded) desiredSelection = previousSelection;
        committedGeneration = previousGeneration;
        phase = superseded ? 'preparing' : previousPhase;
      }

      try {
        const rollback = publication.rollback() as unknown;
        if (isPromiseLike(rollback)) {
          throw new Error('[ProjectionScope] Commit rollback must complete synchronously.');
        }
      } catch {
        // Preserve the publication/activation failure while still restoring
        // the retained generation and revoking the failed candidate lease.
      }

      if (activationAttempted && previousCandidate && !wasDestroyed) {
        try {
          const restored = previousCandidate.activate() as unknown;
          if (isPromiseLike(restored)) {
            throw new Error(
              '[ProjectionScope] Previous candidate restoration must complete synchronously.'
            );
          }
        } catch {
          // Disposal and event-gate restoration still run below.
        }
      }

      await disposeCandidateAfterOutcome(candidate, 'a failed generation');
      if (wasDestroyed) {
        if (previousCandidate && previousCandidate !== candidate) {
          await disposeCandidateAfterOutcome(previousCandidate, 'the retained generation');
        }
        return getSnapshot();
      }
      if (!superseded) {
        await unlockCandidateAfterFailure(previousCandidate, 'the retained generation');
      }
      if (superseded || error === STALE_ACTIVATION) return getSnapshot();
      throw error;
    }

    const previousDisposal =
      previousCandidate && previousCandidate !== candidate
        ? disposeCandidateAfterOutcome(previousCandidate, 'the replaced generation')
        : null;

    if (
      focusKey &&
      isCurrentRequest(generation) &&
      activeCandidate === candidate &&
      committedGeneration === generation
    ) {
      try {
        options.restoreFocus?.(focusKey, commit);
      } catch (error) {
        console.error(
          '[ProjectionScope] Failed to restore focus for the committed generation.',
          error
        );
      }
    }

    if (previousDisposal) await previousDisposal;

    return getSnapshot();
  };

  const start = (): Promise<ProjectionScopeSnapshot> => {
    if (destroyed) {
      return Promise.reject(new Error('[ProjectionScope] Cannot start a destroyed controller.'));
    }
    if (startPromise && phase !== 'idle') return startPromise;

    const generation = ++nextGeneration;
    latestRequestGeneration = generation;
    phase = 'preparing';
    let currentStart!: Promise<ProjectionScopeSnapshot>;
    currentStart = trackMaterialization(() =>
      materializeGeneration(desiredSelection, generation)
    ).finally(() => {
      if (startPromise === currentStart && committedGeneration === 0) startPromise = null;
    });
    startPromise = currentStart;
    return currentStart;
  };

  const runRequest = async (
    patch: Partial<ProjectionScopeSelection>,
    requestOptions: ProjectionScopeRequestOptions = {}
  ): Promise<ProjectionScopeSnapshot> => {
    if (destroyed) {
      throw new Error('[ProjectionScope] Cannot request from a destroyed controller.');
    }
    if (!startPromise) {
      throw new Error('[ProjectionScope] start() must be called before request().');
    }

    const targetSelection = copySelection({
      ...desiredSelection,
      ...patch,
    });
    if (
      !requestOptions.force &&
      sameSelection(targetSelection, desiredSelection) &&
      phase === 'ready'
    ) {
      return getSnapshot();
    }

    desiredSelection = targetSelection;
    const generation = ++nextGeneration;
    latestRequestGeneration = generation;
    phase = 'preparing';
    const retainedCandidate = activeCandidate;
    try {
      const lock = setCandidateLocked(retainedCandidate, true);
      if (isPromiseLike(lock)) await lock;
    } catch (error) {
      if (!isCurrentRequest(generation)) return getSnapshot();
      desiredSelection = copySelection(committedSelection);
      phase = activeCandidate ? 'ready' : 'idle';
      await unlockCandidateAfterFailure(retainedCandidate, 'the retained generation');
      throw error;
    }
    if (!isCurrentRequest(generation)) return getSnapshot();
    return trackMaterialization(() =>
      materializeGeneration(targetSelection, generation, requestOptions.focusKey)
    );
  };
  const request = (
    patch: Partial<ProjectionScopeSelection>,
    requestOptions: ProjectionScopeRequestOptions = {}
  ): Promise<ProjectionScopeSnapshot> => trackRequest(() => runRequest(patch, requestOptions));

  const destroy = (): Promise<void> => {
    const calledFromCandidateCallback = candidateCallbackDepth > 0;
    if (destroyPromise) {
      return calledFromCandidateCallback ? reentrantDestroyFacade : destroyPromise;
    }

    destroyed = true;
    latestRequestGeneration = ++nextGeneration;
    phase = 'destroyed';
    const candidate = activeCandidate;
    activeCandidate = null;

    // A lifecycle callback may synchronously reenter destroy() and return the
    // result (or a wrapper) as its own completion. Give only that callback an
    // already-settled facade while every external caller keeps the real
    // teardown Promise, which still awaits independent async cleanup.
    const pending = [...inFlightRequests, ...inFlightMaterializations];
    const activeDisposal = candidate ? disposeCandidate(candidate) : Promise.resolve();
    destroyPromise = Promise.allSettled([activeDisposal, ...pending]).then((results) => {
      const failure = results.find(
        (result): result is PromiseRejectedResult => result.status === 'rejected'
      );
      if (failure) throw failure.reason;
    });
    return calledFromCandidateCallback ? reentrantDestroyFacade : destroyPromise;
  };

  return {
    start,
    request,
    getSnapshot,
    destroy,
  };
}
