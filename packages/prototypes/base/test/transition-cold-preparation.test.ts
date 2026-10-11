import { describe, expect, it } from 'vitest';
import { createTransitionMachine, type TransitionMachineDriver } from '../src/transition/machine';
import type { TransitionInterrupt, TransitionState } from '../src/transition/types';

function fixture(
  options: { enabled?: boolean; interrupt?: TransitionInterrupt; duration?: number } = {}
) {
  let state: TransitionState = 'closed';
  const events: string[] = [],
    presence: boolean[] = [];
  const tasks: Array<{ cancelled: boolean; fn(): void; duration: number }> = [];
  let boundary: (kind: string) => void = () => {};
  const driver: TransitionMachineDriver = {
    getState: () => state,
    setState(next) {
      state = next;
      boundary(`state:${next}`);
    },
    getInterrupt: () => options.interrupt ?? 'reverse',
    requiresColdPreparation: () => options.enabled !== false,
    getDuration: () => options.duration ?? 150,
    schedule(duration, fn) {
      const task = { duration, fn, cancelled: false };
      tasks.push(task);
      return {
        cancel() {
          task.cancelled = true;
        },
      };
    },
    setViewPresent(next) {
      presence.push(next);
      boundary(`present:${next}`);
    },
    emit(event) {
      events.push(event);
      boundary(`event:${event}`);
    },
  };
  const machine = createTransitionMachine(driver);
  const release = () => {
    const fn = machine.capturePreparation();
    if (!fn) throw new Error('Expected a current cold attempt');
    return fn;
  };
  return {
    machine,
    release,
    events,
    presence,
    tasks,
    state: () => state,
    at: (fn: typeof boundary) => {
      boundary = fn;
    },
  };
}

describe('cold entry preparation', () => {
  it.each([false, true])('initial appear=%s waits for readiness and mount', (appear) => {
    const f = fixture();
    f.machine.initialize(true, appear);
    expect(f.state()).toBe('preparing');
    expect(f.presence).toEqual([true]);
    const release = f.release();
    release();
    release();
    f.machine.enter();
    f.machine.complete();
    expect(f.state()).toBe('preparing');
    expect(f.events).toEqual([]);
    expect(f.tasks).toEqual([]);
    f.machine.mounted();
    expect(f.state()).toBe(appear ? 'entering' : 'entered');
    expect(f.events).toEqual(appear ? ['beforeEnter'] : []);
    expect(f.tasks).toHaveLength(appear ? 1 : 0);
    release();
    expect(f.tasks).toHaveLength(appear ? 1 : 0);
    expect(f.machine.capturePreparation()).toBeNull();
  });

  it('mounted alone does not release and ordinary cold entry starts its timer only after release', () => {
    const f = fixture();
    f.machine.initialize(false, false);
    f.machine.enter();
    f.machine.mounted();
    expect(f.state()).toBe('preparing');
    expect(f.events).toEqual([]);
    expect(f.tasks).toEqual([]);
    f.release()();
    expect(f.state()).toBe('entering');
    expect(f.tasks[0]?.duration).toBe(150);
    f.tasks[0]?.fn();
    expect(f.state()).toBe('entered');
    expect(f.events).toEqual(['beforeEnter', 'afterEnter']);
  });

  it('close invalidates a released-before-mount attempt and old callbacks cannot reveal a reopen', () => {
    const f = fixture();
    f.machine.initialize(true, true);
    const old = f.release();
    old();
    f.machine.leave();
    expect(f.state()).toBe('closed');
    expect(f.events).toEqual([]);
    expect(f.presence.at(-1)).toBe(false);
    f.machine.enter();
    f.machine.mounted();
    old();
    expect(f.state()).toBe('preparing');
    expect(f.tasks).toEqual([]);
    f.release()();
    expect(f.state()).toBe('entering');
  });

  it.each(['unmount', 'initialize', 'dispose'] as const)(
    '%s invalidates captured readiness',
    (action) => {
      const f = fixture();
      f.machine.initialize(true, true);
      const old = f.release();
      old();
      if (action === 'unmount') f.machine.unmounted();
      else if (action === 'initialize') f.machine.initialize(true, true);
      else f.machine.dispose();
      f.machine.mounted();
      old();
      expect(f.tasks).toEqual([]);
      expect(f.events).toEqual([]);
      if (action !== 'dispose') {
        expect(f.state()).toBe('preparing');
        f.release()();
        expect(f.state()).toBe('entering');
      } else {
        expect(f.machine.capturePreparation()).toBeNull();
        f.machine.enter();
        expect(f.tasks).toEqual([]);
      }
    }
  );

  it.each(['state:preparing', 'present:true', 'event:beforeEnter', 'state:entering'])(
    'reentrant close at %s cannot arm an entry timer',
    (boundary) => {
      const f = fixture();
      let once = false;
      f.at((kind) => {
        if (kind === boundary && !once) {
          once = true;
          f.machine.leave();
        }
      });
      f.machine.initialize(true, true);
      f.machine.mounted();
      f.machine.capturePreparation()?.();
      expect(f.state()).toBe(boundary === 'state:entering' ? 'leaving' : 'closed');
      expect(f.tasks).toHaveLength(boundary === 'state:entering' ? 1 : 0);
      if (boundary === 'state:entering') {
        f.tasks[0]?.fn();
        expect(f.state()).toBe('closed');
      }
    }
  );

  it('beforeEnter disposal and reentrant release cannot resume the old attempt', () => {
    const f = fixture();
    f.machine.initialize(true, true);
    f.machine.mounted();
    const release = f.release();
    f.at((kind) => {
      if (kind === 'event:beforeEnter') {
        release();
        f.machine.dispose();
      }
    });
    release();
    expect(f.events).toEqual(['beforeEnter']);
    expect(f.tasks).toEqual([]);
    release();
    expect(f.tasks).toEqual([]);
  });

  it('requests presence before a state-listener release can enter during a retained detach window', () => {
    const f = fixture();
    f.machine.initialize(true, false);
    f.machine.mounted();
    f.release()();
    f.machine.leave();
    f.machine.complete();
    // The ViewIntent is detached, but its asynchronous unmounted notification has not arrived.
    expect(f.state()).toBe('closed');
    expect(f.presence.at(-1)).toBe(false);
    f.at((kind) => {
      if (kind === 'state:preparing') f.machine.capturePreparation()?.();
    });
    f.machine.enter();
    expect(f.presence.at(-1)).toBe(true);
    expect(f.state()).toBe('entering');
    expect(f.events).toEqual(['beforeLeave', 'afterLeave', 'beforeEnter']);
  });

  it('defers synchronous mounted and release inside the presence request until that request returns', () => {
    const f = fixture();
    f.at((kind) => {
      if (kind !== 'present:true') return;
      f.machine.mounted();
      f.machine.capturePreparation()?.();
      expect(f.state()).toBe('preparing');
      expect(f.events).toEqual([]);
    });
    f.machine.initialize(true, true);
    expect(f.state()).toBe('entering');
    expect(f.events).toEqual(['beforeEnter']);
    expect(f.tasks).toHaveLength(1);
  });

  it('zero duration still waits for preparation', () => {
    const f = fixture({ duration: 0 });
    f.machine.initialize(true, true);
    f.machine.mounted();
    expect(f.tasks).toEqual([]);
    f.release()();
    expect(f.tasks[0]?.duration).toBe(0);
  });

  it.each(['reverse', 'wait', 'immediate'] as const)(
    'does not freeze the existing warm %s path',
    (interrupt) => {
      const f = fixture({ interrupt });
      f.machine.initialize(true, false);
      f.machine.mounted();
      f.release()();
      f.machine.leave();
      f.machine.enter();
      if (interrupt === 'wait') {
        expect(f.state()).toBe('leaving');
        f.machine.complete();
        expect(f.state()).toBe('preparing');
      } else expect(f.state()).toBe('entering');
    }
  );

  it('default-disabled initial and ordinary entry keep their previous path', () => {
    const f = fixture({ enabled: false });
    f.machine.initialize(true, false);
    expect(f.state()).toBe('entered');
    expect(f.machine.capturePreparation()).toBeNull();
    f.machine.mounted();
    f.machine.leave();
    f.machine.complete();
    f.machine.enter();
    expect(f.state()).toBe('entering');
  });
});
