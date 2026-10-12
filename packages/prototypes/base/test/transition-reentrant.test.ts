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

describe('transition synchronous phase continuation', () => {
  // T-BASE-TRANSITION-0001-CASE-REENTRANT-CONTINUATION
  it('preserves a beforeLeave reopen and its existing entry completion', () => {
    const f = fixture({ interrupt: 'reverse' });
    f.machine.initialize(false, false);
    f.machine.enter();
    f.machine.mounted();
    f.release()();
    const entry = f.tasks[0];
    f.at((kind) => {
      if (kind === 'event:beforeLeave') f.machine.enter();
    });
    f.machine.leave();
    expect(f.state()).toBe('entering');
    expect(entry?.cancelled).toBe(false);
    entry?.fn();
    expect(f.state()).toBe('entered');
    expect(f.events).not.toContain('afterLeave');
  });
  it('preserves a beforeEnter close and its existing leave completion', () => {
    const f = fixture({ enabled: false, interrupt: 'reverse' });
    f.machine.initialize(true, false);
    f.machine.mounted();
    f.machine.leave();
    const leave = f.tasks[0];
    f.at((kind) => {
      if (kind === 'event:beforeEnter') f.machine.leave();
    });
    f.machine.enter();
    expect(f.state()).toBe('leaving');
    expect(leave?.cancelled).toBe(false);
    leave?.fn();
    expect(f.state()).toBe('closed');
    expect(f.presence.at(-1)).toBe(false);
  });
  it.each(['event:beforeLeave', 'state:leaving'])(
    'disposal at %s arms no leave timer',
    (boundary) => {
      const f = fixture();
      f.machine.initialize(true, false);
      f.machine.mounted();
      f.release()();
      f.at((kind) => {
        if (kind === boundary) f.machine.dispose();
      });
      f.machine.leave();
      expect(f.tasks.filter((t) => !t.cancelled)).toHaveLength(0);
    }
  );
  it.each(['present:true', 'event:beforeEnter', 'state:entering'])(
    'disposal at %s arms no entry timer',
    (boundary) => {
      const f = fixture({ enabled: false });
      f.machine.initialize(false, false);
      f.machine.mounted();
      f.at((kind) => {
        if (kind === boundary) f.machine.dispose();
      });
      f.machine.enter();
      expect(f.tasks.filter((t) => !t.cancelled)).toHaveLength(0);
    }
  );
  it.each(['event:beforeEnter', 'event:beforeLeave'])(
    'repeated same-direction %s is idempotent',
    (boundary) => {
      const f = fixture({ enabled: false });
      f.machine.initialize(false, false);
      f.machine.mounted();
      f.at((kind) => {
        if (kind === boundary) boundary.endsWith('Enter') ? f.machine.enter() : f.machine.leave();
      });
      f.machine.enter();
      f.machine.complete();
      f.machine.leave();
      expect(f.events.filter((e) => e === 'beforeEnter')).toHaveLength(1);
      expect(f.events.filter((e) => e === 'beforeLeave')).toHaveLength(1);
      expect(f.state()).toBe('leaving');
    }
  );
  it.each(['state:closed', 'event:afterLeave', 'present:false'])(
    'reopen at %s retains the new cold view',
    (boundary) => {
      const f = fixture();
      f.machine.initialize(true, false);
      f.machine.mounted();
      f.release()();
      f.machine.leave();
      f.at((kind) => {
        if (kind === boundary) f.machine.enter();
      });
      f.machine.complete();
      expect(f.state()).toBe('preparing');
      expect(f.presence.at(-1)).toBe(true);
      const release = f.release();
      release();
      expect(f.state()).toBe('entering');
    }
  );
  it('an immediate interrupt cannot restart entry after afterLeave commits closed', () => {
    const f = fixture({ enabled: false, interrupt: 'immediate' });
    f.machine.initialize(true, false);
    f.machine.mounted();
    f.machine.leave();
    f.at((kind) => {
      if (kind === 'event:afterLeave') f.machine.leave();
    });
    f.machine.enter();
    expect(f.state()).toBe('closed');
    expect(f.presence.at(-1)).toBe(false);
    expect(f.events.filter((e) => e === 'beforeEnter')).toHaveLength(0);
  });
  it('initial closed projection cannot withdraw a synchronous new open', () => {
    const f = fixture();
    f.at((kind) => {
      if (kind === 'state:closed') f.machine.enter();
    });
    f.machine.initialize(false, false);
    expect(f.state()).toBe('preparing');
    expect(f.presence.at(-1)).toBe(true);
  });
  it('initial materialization disposal does not continue into entered', () => {
    const f = fixture({ enabled: false });
    f.at((kind) => {
      if (kind === 'present:true') f.machine.dispose();
    });
    f.machine.initialize(true, false);
    expect(f.state()).toBe('closed');
    expect(f.events).toEqual([]);
  });
  it('unmount in beforeLeave prevents a stale leave timer', () => {
    const f = fixture({ enabled: false });
    f.machine.initialize(true, false);
    f.machine.mounted();
    f.at((kind) => {
      if (kind === 'event:beforeLeave') f.machine.unmounted();
    });
    f.machine.leave();
    expect(f.state()).toBe('closed');
    expect(f.tasks.filter((t) => !t.cancelled)).toHaveLength(0);
  });
  it('synchronous mounted from materialization starts entry only once', () => {
    const f = fixture({ enabled: false });
    f.machine.initialize(false, false);
    f.at((kind) => {
      if (kind === 'present:true') f.machine.mounted();
    });
    f.machine.enter();
    expect(f.state()).toBe('entering');
    expect(f.events).toEqual(['beforeEnter']);
    expect(f.tasks).toHaveLength(1);
  });
});
