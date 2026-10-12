import type { DelayTask } from '@proto.ui/core';
import type { TransitionInterrupt, TransitionState } from './types';

type TransitionIntent = 'enter' | 'leave';
type TransitionEvent = 'beforeEnter' | 'afterEnter' | 'beforeLeave' | 'afterLeave';

export type TransitionMachineDriver = {
  getState(): TransitionState;
  setState(state: TransitionState): void;
  getInterrupt(): TransitionInterrupt;
  requiresColdPreparation?(): boolean;
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
    setState('entering');
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
    operationVersion += 1;
    invalidateCompletion();
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
    pendingTask?.cancel();
    pendingTask = null;
  };

  const setState = (state: TransitionState) => {
    driver.setState(state);
  };

  const armCompletion = (state: 'entering' | 'leaving') => {
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
      setState('entering');
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
      setState('leaving');
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
    invalidateCompletion();
    const operation = ++operationVersion;

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
    const current = driver.getState();
    if (current === 'entered' || current === 'preparing') return;

    if (current === 'closed') {
      beginEnter();
      return;
    }

    if (current === 'entering') {
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
    const current = driver.getState();
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
    cancelPreparation();
    targetOpen = open;
    queuedIntent = null;
    invalidateCompletion();

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
    operationVersion += 1;
    cancelPreparation();
    viewMounted = false;
    invalidateCompletion();
    queuedIntent = null;
    if (driver.getState() !== 'closed') setState('closed');
  };

  const dispose = () => {
    terminal = true;
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
