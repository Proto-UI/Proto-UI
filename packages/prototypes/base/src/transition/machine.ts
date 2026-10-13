import type {
  DelayTask,
  AttemptToken,
  PresentationOwnerFrame,
  PresentationOutcome,
  PresentationCompletionConfig,
} from '@proto.ui/core';

export type TransitionPresentationFrame = Omit<PresentationOwnerFrame, 'owner'>;
import type { TransitionInterrupt, TransitionState } from './types';

type TransitionIntent = 'enter' | 'leave';
type TransitionEvent = 'beforeEnter' | 'afterEnter' | 'beforeLeave' | 'afterLeave';

export type TransitionMachineDriver = {
  getState(): TransitionState;
  setState(state: TransitionState): void;
  getInterrupt(): TransitionInterrupt;
  requiresColdPreparation?(): boolean;
  getCompletion?(): PresentationCompletionConfig;
  publishPresentation?(frame: TransitionPresentationFrame): void;
  settlePresentation?(outcome: PresentationOutcome): void;
  getDuration(state: 'entering' | 'leaving'): number;
  schedule(durationMs: number, callback: () => void): DelayTask;
  setViewPresent(present: boolean): void;
  emit(event: TransitionEvent): void;
};

export type TransitionMachine = {
  initialize(open: boolean, appear: boolean): void;
  setTarget(open: boolean): void;
  enter(): void;
  leave(): void;
  complete(): void;
  completePresentation(attempt: AttemptToken, isCurrent?: () => boolean): boolean;
  capturePreparation(): (() => void) | null;
  mounted(): void;
  unmounted(): void;
  dispose(): void;
};

export function createTransitionMachine(driver: TransitionMachineDriver): TransitionMachine {
  let targetOpen = false;
  let viewMounted = false;
  let queuedIntent: TransitionIntent | null = null;
  let pendingTask: DelayTask | null = null;
  let generation = 0;
  let ownerEpoch = 0;
  let phaseAttempt = 0;
  let revision = 0;
  let publishing = false;
  let stagedState: TransitionState | null = null;
  let acknowledged = false;
  let acknowledgementCurrent: (() => boolean) | null = null;
  let invalidDuration = false;
  let publicationFailed = false;
  let activePresentation: TransitionPresentationFrame | null = null;
  const sameAttempt = (attempt: AttemptToken) =>
    !terminal &&
    activePresentation?.attempt?.ownerEpoch === attempt.ownerEpoch &&
    activePresentation.attempt.phaseAttempt === attempt.phaseAttempt;
  const cancelTask = () => {
    const task = pendingTask;
    pendingTask = null;
    try {
      task?.cancel();
    } catch {
      /* Cancellation cannot retain a leaving view. */
    }
  };
  let terminal = false;
  let operationVersion = 0;
  let starting: { kind: TransitionIntent; version: number } | null = null;
  const currentOperation = (version: number) => !terminal && operationVersion === version;
  const updateTarget = (open: boolean) => {
    if (targetOpen !== open) operationVersion += 1;
    targetOpen = open;
  };
  type Preparation = {
    ready: boolean;
    finishing: boolean;
    animate: boolean;
    presentRequested: boolean;
  };
  let preparation: Preparation | null = null;

  const cancelPreparation = () => {
    preparation = null;
  };
  const isPreparing = (attempt: Preparation) =>
    !terminal && targetOpen && preparation === attempt && driver.getState() === 'preparing';

  const finishPreparation = (attempt: Preparation) => {
    if (
      !isPreparing(attempt) ||
      !attempt.presentRequested ||
      !viewMounted ||
      !attempt.ready ||
      attempt.finishing
    )
      return;
    attempt.finishing = true;
    if (!attempt.animate) {
      preparation = null;
      setState('entered');
      return;
    }
    driver.emit('beforeEnter');
    if (!isPreparing(attempt) || !viewMounted) return;
    const frame = setState('entering');
    if (
      frame &&
      activePresentation === frame &&
      !terminal &&
      viewMounted &&
      driver.getState() === 'entering'
    ) {
      if (preparation === attempt) preparation = null;
      armCompletion('entering');
      return;
    }
    if (
      preparation !== attempt ||
      terminal ||
      !targetOpen ||
      !viewMounted ||
      driver.getState() !== 'entering'
    ) {
      if (preparation === attempt) preparation = null;
      return;
    }
    preparation = null;
    armCompletion('entering');
  };

  const beginPreparation = (animate: boolean) => {
    const operation = ++operationVersion;
    invalidateCompletion();
    if (!currentOperation(operation)) return;
    queuedIntent = null;
    const attempt: Preparation = {
      ready: false,
      finishing: false,
      animate,
      presentRequested: false,
    };
    preparation = attempt;
    setState('preparing');
    if (!isPreparing(attempt)) return;
    driver.setViewPresent(true);
    if (!isPreparing(attempt)) return;
    attempt.presentRequested = true;
    finishPreparation(attempt);
  };

  const invalidateCompletion = () => {
    generation += 1;
    activePresentation = null;
    acknowledged = false;
    acknowledgementCurrent = null;
    cancelTask();
  };

  const setState = (state: TransitionState): TransitionPresentationFrame | undefined => {
    const policy = driver.getCompletion?.() ?? 'timer';
    if (policy === 'timer') {
      driver.setState(state);
      return;
    }
    const moving = state === 'entering' || state === 'leaving';
    const duration = moving ? driver.getDuration(state) : 0;
    invalidDuration =
      !Number.isFinite(duration) || duration < 0 || (moving && duration >= policy.timeoutMs);
    publicationFailed = false;
    const frame: TransitionPresentationFrame = Object.freeze({
      revision: ++revision,
      phase: state,
      attempt: moving ? Object.freeze({ ownerEpoch, phaseAttempt: ++phaseAttempt }) : null,
      completion: 'presentation',
      // Invalid numeric inputs use the finite rejection boundary, never an animatable fallback.
      durationMs: Number.isFinite(duration) && duration >= 0 ? duration : policy.timeoutMs,
      timeoutMs: policy.timeoutMs,
    });
    activePresentation = moving ? frame : null;
    acknowledged = false;
    const operation = operationVersion;
    const previousStage = stagedState;
    stagedState = state;
    publishing = true;
    try {
      try {
        driver.publishPresentation?.(frame);
      } catch {
        publicationFailed = true;
      }
      const waitingOnSameAttempt =
        moving && activePresentation === frame && driver.getInterrupt() === 'wait' && !terminal;
      if (
        (!currentOperation(operation) && !waitingOnSameAttempt) ||
        (moving && activePresentation !== frame)
      ) {
        // A host observer can change the target before the State projection exists.
        // Restore a coherent published frame for the phase that actually survived.
        if (!terminal && moving && activePresentation === frame) {
          const repairOperation = operationVersion;
          invalidateCompletion();
          if (!currentOperation(repairOperation)) return;
          const actual = driver.getState();
          const repaired = setState(actual);
          if (
            repaired &&
            activePresentation === repaired &&
            (actual === 'entering' || actual === 'leaving')
          )
            armCompletion(actual);
        }
        return;
      }
      driver.setState(state);
    } finally {
      stagedState = previousStage;
      publishing = previousStage !== null;
    }
    if (
      moving &&
      acknowledged &&
      activePresentation === frame &&
      !terminal &&
      driver.getState() === state &&
      acknowledgementCurrent?.() &&
      activePresentation === frame &&
      !terminal &&
      driver.getState() === state
    )
      completeCurrent(true);
    return frame;
  };

  const settlePresentation = (frame: TransitionPresentationFrame, outcome: PresentationOutcome) => {
    if (!frame.attempt || !sameAttempt(frame.attempt)) return;
    try {
      driver.settlePresentation?.(outcome);
    } catch {
      /* A failed projection cannot block phase completion. */
    }
    if (sameAttempt(frame.attempt)) completeCurrent(true);
  };

  const armCompletion = (state: 'entering' | 'leaving') => {
    const frame = activePresentation;
    if (frame?.attempt) {
      if (invalidDuration) {
        settlePresentation(frame, 'invalid-policy');
        return;
      }
      if (publicationFailed) {
        settlePresentation(frame, 'projection-failed');
        return;
      }
      if (frame.durationMs === 0) {
        settlePresentation(frame, 'zero-duration');
        return;
      }
      try {
        const task = driver.schedule(frame.timeoutMs!, () => {
          if (!frame.attempt || !sameAttempt(frame.attempt)) return;
          pendingTask = null;
          settlePresentation(frame, 'deadline');
        });
        if (sameAttempt(frame.attempt)) pendingTask = task;
        else {
          try {
            task.cancel();
          } catch {}
        }
      } catch {
        settlePresentation(frame, 'scheduler-failed');
      }
      return;
    }
    invalidateCompletion();
    const activeGeneration = generation;
    pendingTask = driver.schedule(driver.getDuration(state), () => {
      if (activeGeneration !== generation || driver.getState() !== state) return;
      pendingTask = null;
      completeCurrent(true);
    });
  };

  const beginEnter = (cold = true) => {
    if (terminal || !targetOpen) return;
    if (starting?.kind === 'enter' && currentOperation(starting.version)) return;
    if (cold && driver.requiresColdPreparation?.()) {
      beginPreparation(true);
      return;
    }
    const operation = { kind: 'enter' as const, version: ++operationVersion };
    starting = operation;
    const current = () => currentOperation(operation.version) && targetOpen;
    try {
      driver.setViewPresent(true);
      if (!current() || !viewMounted) return;
      queuedIntent = null;
      driver.emit('beforeEnter');
      if (!current() || !viewMounted) return;
      invalidateCompletion();
      if (!current()) return;
      const frame = setState('entering');
      if (
        frame &&
        activePresentation === frame &&
        activePresentation?.phase === 'entering' &&
        !terminal &&
        viewMounted &&
        driver.getState() === 'entering'
      ) {
        armCompletion('entering');
        return;
      }
      if (!current() || !viewMounted || driver.getState() !== 'entering') return;
      armCompletion('entering');
    } finally {
      if (starting === operation) starting = null;
    }
  };

  const beginLeave = () => {
    if (terminal || targetOpen) return;
    const operation = { kind: 'leave' as const, version: ++operationVersion };
    starting = operation;
    const current = () => currentOperation(operation.version) && !targetOpen;
    try {
      queuedIntent = null;
      driver.emit('beforeLeave');
      if (!current()) return;
      invalidateCompletion();
      if (!current()) return;
      const frame = setState('leaving');
      if (
        frame &&
        activePresentation === frame &&
        activePresentation?.phase === 'leaving' &&
        !terminal &&
        driver.getState() === 'leaving'
      ) {
        armCompletion('leaving');
        return;
      }
      if (!current() || driver.getState() !== 'leaving') return;
      armCompletion('leaving');
    } finally {
      if (starting === operation) starting = null;
    }
  };

  const consumeQueuedIntent = () => {
    const next = queuedIntent;
    queuedIntent = null;
    if (next === 'enter') enter();
    else if (next === 'leave') leave();
  };

  const completeCurrent = (consumeQueue: boolean) => {
    const current = driver.getState();
    if (current !== 'entering' && current !== 'leaving') return false;
    const operation = ++operationVersion;
    invalidateCompletion();
    if (!currentOperation(operation)) return false;

    if (current === 'entering') {
      setState('entered');
      if (!currentOperation(operation) || driver.getState() !== 'entered') return false;
      driver.emit('afterEnter');
    } else {
      setState('closed');
      if (!currentOperation(operation) || driver.getState() !== 'closed') return false;
      driver.emit('afterLeave');
      if (!currentOperation(operation) || driver.getState() !== 'closed') return false;
      driver.setViewPresent(false);
    }

    if (consumeQueue && currentOperation(operation)) consumeQueuedIntent();
    return currentOperation(operation);
  };

  const enter = () => {
    if (terminal) return;
    updateTarget(true);
    if (starting?.kind === 'enter' && currentOperation(starting.version)) return;
    const current = stagedState ?? driver.getState();
    if (current === 'entered' || current === 'preparing') return;

    if (current === 'closed') {
      beginEnter();
      return;
    }

    if (current === 'entering') {
      if (
        starting?.kind === 'leave' &&
        !activePresentation &&
        driver.getCompletion?.() !== 'timer' &&
        driver.getCompletion
      ) {
        beginEnter(false);
        return;
      }
      if (driver.getInterrupt() === 'wait') queuedIntent = null;
      return;
    }

    const interrupt = driver.getInterrupt();
    if (interrupt === 'wait') {
      queuedIntent = 'enter';
    } else if (interrupt === 'immediate') {
      if (completeCurrent(false)) beginEnter(false);
    } else {
      beginEnter(false);
    }
  };

  const leave = () => {
    if (terminal) return;
    updateTarget(false);
    if (starting?.kind === 'leave' && currentOperation(starting.version)) return;
    const current = stagedState ?? driver.getState();
    if (current === 'preparing') {
      cancelPreparation();
      invalidateCompletion();
      queuedIntent = null;
      setState('closed');
      if (!targetOpen && driver.getState() === 'closed') driver.setViewPresent(false);
      return;
    }

    if (current === 'closed') {
      driver.setViewPresent(false);
      return;
    }

    if (current === 'leaving') {
      if (
        starting?.kind === 'enter' &&
        !activePresentation &&
        driver.getCompletion?.() !== 'timer' &&
        driver.getCompletion
      ) {
        beginLeave();
        return;
      }
      if (driver.getInterrupt() === 'wait') queuedIntent = null;
      return;
    }

    if (current === 'entered') {
      beginLeave();
      return;
    }

    const interrupt = driver.getInterrupt();
    if (interrupt === 'wait') {
      queuedIntent = 'leave';
    } else if (interrupt === 'immediate') {
      if (completeCurrent(false)) beginLeave();
    } else {
      beginLeave();
    }
  };

  const initialize = (open: boolean, appear: boolean) => {
    if (terminal) return;
    const operation = ++operationVersion;
    ownerEpoch += 1;
    cancelPreparation();
    targetOpen = open;
    queuedIntent = null;
    invalidateCompletion();
    if (!currentOperation(operation)) return;

    if (!open) {
      setState('closed');
      if (!currentOperation(operation) || targetOpen) return;
      driver.setViewPresent(false);
      return;
    }

    if (driver.requiresColdPreparation?.()) {
      beginPreparation(appear);
      return;
    }
    driver.setViewPresent(true);
    if (!currentOperation(operation) || !targetOpen) return;
    if (!appear) setState('entered');
  };

  const mounted = () => {
    if (terminal) return;
    viewMounted = true;
    if (preparation) {
      finishPreparation(preparation);
      return;
    }
    if (targetOpen && driver.getState() === 'closed') beginEnter();
  };

  const unmounted = () => {
    ownerEpoch += 1;
    const operation = ++operationVersion;
    cancelPreparation();
    viewMounted = false;
    invalidateCompletion();
    if (!currentOperation(operation)) return;
    queuedIntent = null;
    if (driver.getState() !== 'closed') setState('closed');
  };

  const dispose = () => {
    terminal = true;
    ownerEpoch += 1;
    operationVersion += 1;
    cancelPreparation();
    viewMounted = false;
    queuedIntent = null;
    invalidateCompletion();
  };

  return {
    initialize,
    setTarget(open) {
      if (terminal) return;
      if (open === targetOpen) return;
      if (open) enter();
      else leave();
    },
    enter,
    leave,
    complete: () => {
      if (!terminal) completeCurrent(true);
    },
    completePresentation: (attempt, isCurrent = () => true) => {
      const validate = () => {
        try {
          return isCurrent();
        } catch {
          return false;
        }
      };
      if (!sameAttempt(attempt) || !validate() || !sameAttempt(attempt)) return false;
      if (publishing) {
        acknowledged = true;
        acknowledgementCurrent = validate;
        return true;
      }
      return completeCurrent(true);
    },
    capturePreparation: () => {
      const attempt = preparation;
      if (!attempt || !isPreparing(attempt)) return null;
      return () => {
        if (!isPreparing(attempt) || attempt.finishing) return;
        attempt.ready = true;
        finishPreparation(attempt);
      };
    },
    mounted,
    unmounted,
    dispose,
  };
}
