// @vitest-environment node
import { expect, it } from 'vitest';
import { StateModuleImpl } from '../../modules/state/src/impl';

function fixture() {
  let phase: 'setup' | 'callback' = 'setup';
  const requirePhase = (expected: string | readonly string[]) => {
    if (!(Array.isArray(expected) ? expected : [expected]).includes(phase))
      throw new Error('unexpected fixture phase');
  };
  const module = new StateModuleImpl({
    execPhase: () => phase,
    domain: () => (phase === 'setup' ? 'setup' : 'runtime'),
    protoPhase: () => 'setup',
    isDisposed: () => false,
    ensureNotDisposed() {},
    ensureExecPhase(_op: string, expected: string | readonly string[]) {
      requirePhase(expected);
    },
    ensureSetup() {
      requirePhase('setup');
    },
    ensureRuntime() {
      requirePhase('callback');
    },
    ensureCallback() {
      requirePhase('callback');
    },
    getCallbackCtx() {
      return undefined;
    },
  } as any);
  const owned = module.facade.numberDiscrete('value', 0);
  const borrowed = module.port.createBorrowedHandle(owned);
  return {
    module,
    owned,
    borrowed,
    write(next: number) {
      phase = 'callback';
      try {
        owned.set(next);
      } finally {
        phase = 'setup';
      }
    },
  };
}

it('keeps duplicate borrowed-State registrations distinct even when their callback is identical', () => {
  const owner = fixture();
  const trace: number[] = [];
  const callback = (_run: unknown, event: any) => {
    if (event.type === 'next') trace.push(event.next);
  };
  const first = owner.borrowed.watch(callback);
  const second = owner.borrowed.watch(callback);
  owner.write(1);
  expect(trace).toEqual([1, 1]);
  first();
  owner.write(2);
  expect(trace).toEqual([1, 1, 2]);
  second();
  owner.write(3);
  expect(trace).toEqual([1, 1, 2]);
});

it('skips a canceled borrowed-State registration before delivering its already-recorded event', () => {
  const owner = fixture();
  const trace: string[] = [];
  let cancelSecond = () => {};
  owner.borrowed.watch((_run, event) => {
    if (event.type === 'next') {
      trace.push(`a${event.next}`);
      cancelSecond();
    }
  });
  cancelSecond = owner.borrowed.watch((_run, event) => {
    if (event.type === 'next') trace.push(`b${event.next}`);
  });
  owner.write(1);
  expect(trace).toEqual(['a1']);
  owner.write(2);
  expect(trace).toEqual(['a1', 'a2']);
});

it('does not deliver an old event to a new module-port registration reusing the same callback', () => {
  const owner = fixture();
  const trace: string[] = [];
  let cancelSecond = () => {};
  const second = (_run: unknown, event: any) => {
    if (event.type === 'next') trace.push(`b${event.next}`);
  };
  owner.module.port.watch(owner.owned, (_run, event) => {
    if (event.type === 'next') {
      trace.push(`a${event.next}`);
      if (event.next === 1) {
        cancelSecond();
        owner.module.port.watch(owner.owned, second);
      }
    }
  });
  cancelSecond = owner.module.port.watch(owner.owned, second);
  owner.write(1);
  expect(trace).toEqual(['a1']);
  owner.write(2);
  expect(trace).toEqual(['a1', 'a2', 'b2']);
});
