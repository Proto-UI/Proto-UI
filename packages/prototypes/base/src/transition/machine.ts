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
    if (cold && driver.requiresColdPreparation?.()) {
      beginPreparation(true);
      return;
    }
    driver.setViewPresent(true);
    if (!viewMounted) return;
    queuedIntent = null;
    driver.emit('beforeEnter');
    setState('entering');
    armCompletion('entering');
  };

  const beginLeave = () => {
    queuedIntent = null;
    driver.emit('beforeLeave');
    setState('leaving');
    armCompletion('leaving');
  };

  const consumeQueuedIntent = () => {
    const next = queuedIntent;
    queuedIntent = null;
    if (next === 'enter') enter();
    else if (next === 'leave') leave();
  };

  const completeCurrent = (consumeQueue: boolean) => {
    const current = driver.getState();
    if (current !== 'entering' && current !== 'leaving') return;
    invalidateCompletion();

    if (current === 'entering') {
      setState('entered');
      driver.emit('afterEnter');
    } else {
      setState('closed');
      driver.emit('afterLeave');
      driver.setViewPresent(false);
    }

    if (consumeQueue) consumeQueuedIntent();
  };

  const enter = () => {
    if (terminal) return;
    targetOpen = true;
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
      completeCurrent(false);
      beginEnter(false);
    } else {
      invalidateCompletion();
      beginEnter(false);
    }
  };

  const leave = () => {
    if (terminal) return;
    targetOpen = false;
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
      completeCurrent(false);
      beginLeave();
    } else {
      invalidateCompletion();
      beginLeave();
    }
  };

  const initialize = (open: boolean, appear: boolean) => {
    if (terminal) return;
    cancelPreparation();
    targetOpen = open;
    queuedIntent = null;
    invalidateCompletion();

    if (!open) {
      setState('closed');
      driver.setViewPresent(false);
      return;
    }

    if (driver.requiresColdPreparation?.()) {
      beginPreparation(appear);
      return;
    }
    driver.setViewPresent(true);
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
    cancelPreparation();
    viewMounted = false;
    invalidateCompletion();
    queuedIntent = null;
    if (driver.getState() !== 'closed') setState('closed');
  };

  const dispose = () => {
    terminal = true;
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
