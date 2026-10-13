import { describe, expect, it } from 'vitest';
import {
  createTransitionMachine,
  type TransitionMachineDriver,
  type TransitionPresentationFrame,
} from '../src/transition/machine';
import type { TransitionState } from '../src/transition/types';

function fixture(duration = 500, cold = false) {
  let state: TransitionState = 'closed';
  const frames: TransitionPresentationFrame[] = [];
  const outcomes: string[] = [];
  const presence: boolean[] = [];
  const tasks: { fn(): void; cancelled: boolean; duration: number }[] = [];
  let boundary: (name: string) => void = () => {};
  let interrupt: 'reverse' | 'wait' | 'immediate' = 'reverse';
  const driver: TransitionMachineDriver = {
    getState: () => state,
    requiresColdPreparation: () => cold,
    setState(next) {
      state = next;
      boundary(`state:${next}`);
    },
    getInterrupt: () => interrupt,
    getDuration: () => duration,
    getCompletion: () => ({ kind: 'presentation', timeoutMs: 1000 }),
    publishPresentation(frame) {
      frames.push(frame);
      boundary(`publish:${frame.phase}`);
    },
    settlePresentation(outcome) {
      outcomes.push(outcome);
      boundary(`settle:${outcome}`);
    },
    schedule(duration, fn) {
      boundary('schedule');
      const task = { duration, fn, cancelled: false };
      tasks.push(task);
      return {
        cancel() {
          task.cancelled = true;
          boundary('cancel');
        },
      };
    },
    setViewPresent(value) {
      presence.push(value);
    },
    emit(event) {
      boundary(event);
    },
  };
  const machine = createTransitionMachine(driver);
  machine.initialize(true, false);
  machine.mounted();
  return {
    machine,
    frames,
    tasks,
    outcomes,
    presence,
    state: () => state,
    at(fn: typeof boundary) {
      boundary = fn;
    },
    interrupt(value: typeof interrupt) {
      interrupt = value;
    },
    duration(value: number) {
      duration = value;
    },
  };
}

describe('Transition opt-in presentation completion', () => {
  it('starts entered without attempt, initial animation, or deadline', () => {
    const f = fixture();
    expect(f.frames.at(-1)).toMatchObject({ phase: 'entered', attempt: null, durationMs: 0 });
    expect(f.tasks).toHaveLength(0);
  });
  it('publishes stable attempt before phase watchers and accepts synchronous acknowledgement', () => {
    const f = fixture();
    f.at((name) => {
      if (name === 'state:leaving')
        expect(f.machine.completePresentation(f.frames.at(-1)!.attempt!)).toBe(true);
    });
    f.machine.leave();
    expect(f.state()).toBe('closed');
    expect(f.presence.at(-1)).toBe(false);
    expect(f.tasks).toHaveLength(0);
  });
  it('latches acknowledgement during publication until the phase is installed', () => {
    const f = fixture();
    f.at((name) => {
      if (name === 'publish:leaving') f.machine.completePresentation(f.frames.at(-1)!.attempt!);
    });
    f.machine.leave();
    expect(f.state()).toBe('closed');
  });
  it('uses one duration source and an independent non-frame watchdog', () => {
    const f = fixture();
    f.machine.leave();
    expect(f.frames.at(-1)).toMatchObject({ durationMs: 500, timeoutMs: 1000 });
    expect(f.tasks.map((t) => t.duration)).toEqual([1000]);
    f.tasks[0].fn();
    expect(f.outcomes).toEqual(['deadline']);
    expect(f.state()).toBe('closed');
  });
  it.each([0, 1000, 2000, NaN, Infinity, -1])(
    'settles duration %s immediately without frame waits',
    (value) => {
      const f = fixture(value);
      f.machine.leave();
      expect(f.state()).toBe('closed');
      expect(f.outcomes).toEqual([value === 0 ? 'zero-duration' : 'invalid-policy']);
      expect(f.tasks).toHaveLength(0);
    }
  );
  it('rejects stale acknowledgement and deadline after reversal', () => {
    const f = fixture();
    f.machine.leave();
    const old = f.frames.at(-1)!.attempt!;
    f.machine.enter();
    const current = f.frames.at(-1)!.attempt!;
    expect(current.phaseAttempt).not.toBe(old.phaseAttempt);
    expect(f.machine.completePresentation(old)).toBe(false);
    f.tasks[0].fn();
    expect(f.state()).toBe('entering');
    expect(f.machine.completePresentation(current)).toBe(true);
    expect(f.state()).toBe('entered');
  });
  it('unchanged target starts no new attempt', () => {
    const f = fixture();
    f.machine.leave();
    const length = f.frames.length;
    f.machine.setTarget(false);
    expect(f.frames).toHaveLength(length);
  });
  it('disposal rejects all late acknowledgements and timer callbacks', () => {
    const f = fixture();
    f.machine.leave();
    const token = f.frames.at(-1)!.attempt!;
    f.machine.dispose();
    f.tasks[0].fn();
    expect(f.machine.completePresentation(token)).toBe(false);
    expect(f.outcomes).toEqual([]);
    expect(f.tasks[0].cancelled).toBe(true);
  });
  it('settlement throw cannot leak a leaving view', () => {
    const f = fixture();
    f.machine.leave();
    f.at((name) => {
      if (name.startsWith('settle:')) throw Error('sink');
    });
    f.tasks[0].fn();
    expect(f.state()).toBe('closed');
  });
  it('reentrant settlement reversal cannot complete the new attempt', () => {
    const f = fixture();
    f.machine.leave();
    f.at((name) => {
      if (name === 'settle:deadline') f.machine.enter();
    });
    f.tasks[0].fn();
    expect(f.state()).toBe('entering');
    expect(f.tasks).toHaveLength(2);
  });
  it('cancellation throw cannot block a current completion', () => {
    const f = fixture();
    f.machine.leave();
    const token = f.frames.at(-1)!.attempt!;
    f.at((name) => {
      if (name === 'cancel') throw Error('cancel');
    });
    expect(f.machine.completePresentation(token)).toBe(true);
    expect(f.state()).toBe('closed');
  });
  it('disposal during cancellation prevents installing a replacement', () => {
    const f = fixture();
    f.machine.leave();
    const count = f.frames.length;
    f.at((name) => {
      if (name === 'cancel') f.machine.dispose();
    });
    f.machine.enter();
    expect(f.frames).toHaveLength(count);
    expect(f.tasks).toHaveLength(1);
  });
  it('nested reversal during cancellation owns a fresh bounded attempt', () => {
    const f = fixture();
    f.machine.leave();
    const old = f.frames.at(-1)!.attempt!;
    let once = true;
    f.at((name) => {
      if (name === 'cancel' && once) {
        once = false;
        f.machine.leave();
      }
    });
    f.machine.enter();
    expect(f.state()).toBe('leaving');
    expect(f.frames.at(-1)!.attempt).not.toEqual(old);
    expect(f.tasks).toHaveLength(2);
    f.tasks[1].fn();
    expect(f.state()).toBe('closed');
  });
  it('wait reversal from synchronous phase watcher retains a bounded current attempt', () => {
    const f = fixture();
    f.interrupt('wait');
    f.at((name) => {
      if (name === 'state:leaving') f.machine.enter();
    });
    f.machine.leave();
    expect(f.state()).toBe('leaving');
    expect(f.tasks).toHaveLength(1);
    f.tasks[0].fn();
    expect(f.state()).toBe('entering');
    expect(f.tasks).toHaveLength(2);
  });
  it('publication-time reopen creates a bounded entering attempt', () => {
    const f = fixture();
    f.at((name) => {
      if (name === 'publish:leaving') f.machine.enter();
    });
    f.machine.leave();
    expect(f.state()).toBe('entering');
    expect(f.frames.at(-1)!.phase).toBe('entering');
    expect(f.tasks).toHaveLength(1);
    f.tasks[0].fn();
    expect(f.state()).toBe('entered');
  });
  it('publication-time reclose restores the actual leaving phase with a fresh deadline', () => {
    const f = fixture();
    f.machine.leave();
    const old = f.frames.at(-1)!.attempt!;
    f.at((name) => {
      if (name === 'publish:entering') f.machine.leave();
    });
    f.machine.enter();
    expect(f.state()).toBe('leaving');
    expect(f.frames.at(-1)!.attempt).not.toEqual(old);
    expect(f.frames.at(-1)!.phase).toBe('leaving');
    expect(f.tasks).toHaveLength(2);
    f.tasks[1].fn();
    expect(f.state()).toBe('closed');
  });
  it('publication-time wait reversal retains one attempt and consumes its queue', () => {
    const f = fixture();
    f.interrupt('wait');
    f.at((name) => {
      if (name === 'publish:leaving') f.machine.enter();
    });
    f.machine.leave();
    expect(f.state()).toBe('leaving');
    expect(f.tasks).toHaveLength(1);
    f.tasks[0].fn();
    expect(f.state()).toBe('entering');
    expect(f.tasks).toHaveLength(2);
  });
  it('reopening during closed publication prevents stale detach', () => {
    const f = fixture();
    f.machine.leave();
    f.at((name) => {
      if (name === 'publish:closed') f.machine.enter();
    });
    f.tasks[0].fn();
    expect(f.state()).toBe('entering');
    expect(f.presence.at(-1)).toBe(true);
    expect(f.tasks).toHaveLength(2);
  });
  it('reclosing during entered publication preserves a bounded leave', () => {
    const f = fixture();
    f.machine.leave();
    f.machine.enter();
    f.at((name) => {
      if (name === 'publish:entered') f.machine.leave();
    });
    f.tasks[1].fn();
    expect(f.state()).toBe('leaving');
    expect(f.tasks).toHaveLength(3);
  });
  it('rechecks logical ownership after a reentrant receipt validator', () => {
    const f = fixture();
    f.machine.leave();
    const token = f.frames.at(-1)!.attempt!;
    expect(
      f.machine.completePresentation(token, () => {
        f.machine.enter();
        return true;
      })
    ).toBe(false);
    expect(f.state()).toBe('entering');
  });
  it('rechecks ownership after a deferred validator changes the attempt', () => {
    const f = fixture();
    let count = 0;
    f.at((name) => {
      if (name === 'publish:leaving')
        f.machine.completePresentation(f.frames.at(-1)!.attempt!, () => {
          if (++count === 2) f.machine.enter();
          return true;
        });
    });
    f.machine.leave();
    expect(f.state()).toBe('entering');
    expect(f.tasks).toHaveLength(1);
  });
  it('a failed deferred receipt validator leaves the independent deadline available', () => {
    const f = fixture();
    let count = 0;
    f.at((name) => {
      if (name === 'publish:leaving')
        f.machine.completePresentation(f.frames.at(-1)!.attempt!, () => {
          if (++count === 2) throw Error('validator');
          return true;
        });
    });
    f.machine.leave();
    expect(f.state()).toBe('leaving');
    expect(f.tasks).toHaveLength(1);
    f.tasks[0].fn();
    expect(f.state()).toBe('closed');
  });
  it('cold preparation release preserves a synchronous wait-reversal deadline', () => {
    const f = fixture(500, true);
    f.machine.capturePreparation()!();
    f.machine.leave();
    f.tasks[0].fn();
    f.interrupt('wait');
    f.machine.enter();
    expect(f.state()).toBe('preparing');
    f.at((name) => {
      if (name === 'state:entering') f.machine.leave();
    });
    f.machine.capturePreparation()!();
    expect(f.state()).toBe('entering');
    expect(f.tasks).toHaveLength(2);
    f.tasks[1].fn();
    expect(f.state()).toBe('leaving');
    expect(f.tasks).toHaveLength(3);
  });
  it('scheduler throw settles without retaining a leaving view', () => {
    const f = fixture();
    f.at((name) => {
      if (name === 'schedule') throw Error('clock');
    });
    f.machine.leave();
    expect(f.outcomes).toEqual(['scheduler-failed']);
    expect(f.state()).toBe('closed');
  });
});
