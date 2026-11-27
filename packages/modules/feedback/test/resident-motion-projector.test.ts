import { describe, it, expect } from 'vitest';
import {
  createResidentMotionProjector,
  type MotionEnvironment,
  type MotionPresentation,
} from '../src/motion/projector';
import type { ResidentMotionFrame } from '../src/motion/sink';
import type { ResidentMotionProperty } from '@proto.ui/core';
import { colorToMotionVector, motionVectorToColor } from '../src/motion/color';
function harness() {
  let now = 0,
    revision = 0;
  let listener = () => {};
  let projectReceipt = () => ['translate', 'background-color'] as readonly ResidentMotionProperty[];
  let next = 0;
  let schedule: ((cb: () => void) => number) | null = null;
  const callbacks = new Map<number, () => void>(),
    all = new Map<number, () => void>();
  let env: MotionEnvironment = {
    preference: 'no-preference',
    visible: true,
    supportedProperties: ['translate', 'background-color'],
    rootFontPx: 16,
    width: 16,
    height: 16,
    palette: { input: [0, 0, 0, 1], primary: [1, 1, 1, 1] },
    paletteRevision: 0,
  };
  const writes: { tokens: string[]; p: MotionPresentation }[] = [];
  const requests: {
    declared: readonly ResidentMotionProperty[];
    targets: readonly ResidentMotionProperty[] | undefined;
  }[] = [];
  let reasons: readonly string[] = [];
  const sink = createResidentMotionProjector({
    now: () => now,
    environment: (declared, targets) => {
      requests.push({ declared, targets });
      return env;
    },
    subscribe: (cb) => {
      listener = cb;
      return () => {
        listener = () => {};
      };
    },
    requestFrame: (cb) => {
      if (schedule) return schedule(cb);
      callbacks.set(++next, cb);
      all.set(next, cb);
      return next;
    },
    cancelFrame: (id) => {
      callbacks.delete(id as number);
    },
    project: (s, p) => {
      writes.push({ tokens: s.tokens, p });
      return projectReceipt();
    },
    diagnostics: (r) => {
      reasons = r;
    },
  });
  const commit = (tokens: string[], view = 1) =>
    sink.commit({
      view,
      revision: ++revision,
      style: { kind: 'tw', tokens },
      declarations: [
        { properties: ['translate', 'background-color'], durationMs: 100, easing: [0, 0, 1, 1] },
      ],
    });
  return {
    sink,
    requests,
    receipt(fn: typeof projectReceipt) {
      projectReceipt = fn;
    },
    scheduling(fn: (cb: () => void) => number) {
      schedule = fn;
    },
    commit,
    writes,
    all,
    callbacks,
    get reasons() {
      return reasons;
    },
    clock: (n: number) => {
      now = n;
    },
    time: (n: number) => {
      now = n;
      for (const [id, cb] of [...callbacks]) {
        callbacks.delete(id);
        cb();
      }
    },
    environment: (patch: Partial<MotionEnvironment>) => {
      env = { ...env, ...patch };
      listener();
    },
    get last() {
      return writes.at(-1)!;
    },
  };
}
describe('resident projection lifecycle', () => {
  it('consumes final target, keeps source immutable and projects only owned translate', () => {
    const h = harness();
    const tokens = ['rounded-full', 'translate-x-0', 'bg-input'];
    h.commit(tokens);
    h.time(0);
    h.commit(['rounded-full', 'translate-x-[calc(100%-2px)]', 'bg-primary']);
    h.time(50);
    expect(h.last.p.translate![0]).toBeCloseTo(7);
    expect(h.last.tokens).toEqual(['rounded-full', 'bg-primary']);
    expect(tokens).toEqual(['rounded-full', 'translate-x-0', 'bg-input']);
    expect(h.last.p.backgroundColor![0]).toBeGreaterThan(0);
    expect(h.last.p.backgroundColor![0]).toBeLessThan(1);
  });
  it('reduces live, cancels frames and does not replay on preference return', () => {
    const h = harness();
    h.commit(['translate-x-0', 'bg-input']);
    h.time(0);
    h.commit(['translate-x-4', 'bg-primary']);
    h.time(30);
    h.environment({ preference: 'reduce' });
    expect(h.last.p.translate).toEqual([16, 0]);
    expect(h.callbacks.size).toBe(0);
    h.environment({ preference: 'no-preference' });
    expect(h.callbacks.size).toBe(0);
  });
  it('unknown preference, hidden updates and reveal settle', () => {
    const h = harness();
    h.commit(['translate-x-0', 'bg-input']);
    h.time(0);
    h.environment({ visible: false });
    h.commit(['translate-x-4', 'bg-primary']);
    h.environment({ visible: true });
    expect(h.last.p.translate).toEqual([16, 0]);
    expect(h.callbacks.size).toBe(0);
    h.environment({ preference: 'unknown' });
    h.commit(['translate-x-0', 'bg-input']);
    h.time(0);
    expect(h.last.p.translate).toEqual([0, 0]);
  });
  it('missing geometry or palette clears presentation instead of guessing', () => {
    const h = harness();
    h.commit(['translate-x-0', 'bg-input']);
    h.time(0);
    h.environment({ width: null, palette: {} });
    h.commit(['translate-x-[calc(100%-2px)]', 'bg-primary']);
    expect(h.last.p).toEqual({});
    expect(h.last.tokens).toContain('translate-x-[calc(100%-2px)]');
    expect(h.reasons).toContain('translate:unresolved-target-settled');
    h.environment({ width: 16 });
    expect(h.last.p.translate).toEqual([14, 0]);
    expect(h.callbacks.size).toBe(0);
  });
  it('view epochs settle and stale callbacks/revisions/dispose cannot paint', () => {
    const h = harness();
    h.commit(['translate-x-0', 'bg-input']);
    h.time(0);
    h.commit(['translate-x-4', 'bg-primary']);
    const old = [...h.all.values()][0];
    h.commit(['translate-x-0', 'bg-input'], 2);
    expect(h.last.p.translate).toEqual([0, 0]);
    let count = h.writes.length;
    old();
    expect(h.writes.length).toBe(count);
    h.sink.release(2);
    h.commit(['translate-x-4', 'bg-primary'], 3);
    old();
    expect(h.writes.length).toBe(count);
  });
  it('premultiplied colors roundtrip without transparent color fringes', () => {
    const c = [0.2, 0.4, 0.6, 0.7] as const;
    const back = motionVectorToColor(colorToMotionVector(c));
    back.forEach((v, i) => expect(v).toBeCloseTo(c[i], 5));
    expect(colorToMotionVector([1, 0, 0, 0])).toEqual([0, 0, 0, 0]);
  });
});

it('initial commits and replacement epochs settle until their first presentation frame', () => {
  const h = harness();
  h.commit(['translate-x-0', 'bg-input']);
  h.commit(['translate-x-4', 'bg-primary']);
  expect(h.last.p.translate).toEqual([16, 0]);
  expect(h.last.p.backgroundColor![0]).toBeCloseTo(1, 5);
  expect(h.last.p.backgroundColorState).toBe('settled');
  expect(h.callbacks.size).toBe(1);
  h.time(0);
  expect(h.callbacks.size).toBe(0);
  h.commit(['translate-x-0', 'bg-input']);
  h.time(50);
  expect(h.last.p.backgroundColorState).toBe('active');
  expect(h.last.p.backgroundColor![0]).toBeGreaterThan(0);
  h.commit(['translate-x-0', 'bg-input'], 2);
  h.commit(['translate-x-4', 'bg-primary'], 2);
  expect(h.last.p.backgroundColorState).toBe('settled');
  expect(h.last.p.backgroundColor![0]).toBeCloseTo(1, 5);
  h.time(50);
  expect(h.callbacks.size).toBe(0);
});
it('color endpoint and reduced/unknown states are explicitly settled', () => {
  const h = harness();
  h.commit(['bg-input']);
  h.time(0);
  h.commit(['bg-primary']);
  h.time(100);
  expect(h.last.p.backgroundColorState).toBe('settled');
  h.commit(['bg-input']);
  h.environment({ preference: 'reduce' });
  expect(h.last.p.backgroundColorState).toBe('settled');
  h.environment({ preference: 'unknown' });
  h.commit(['bg-primary']);
  expect(h.last.p.backgroundColorState).toBe('settled');
});

it('first-frame scheduler reentry is cancel-safe and has no idle loop', () => {
  const h = harness();
  h.scheduling((cb) => {
    cb();
    return 42;
  });
  h.commit(['bg-primary']);
  expect(h.last.p.backgroundColorState).toBe('settled');
  expect(h.writes.length).toBe(2);
  expect(h.callbacks.size).toBe(0);
  const released = harness();
  released.scheduling(() => {
    released.sink.release(1);
    return 7;
  });
  released.commit(['bg-primary']);
  const count = released.writes.length;
  released.time(10);
  expect(released.writes.length).toBe(count);
  expect(released.callbacks.size).toBe(0);
});
it('hidden reduced initialization and epoch replacement reject abandoned first frames', () => {
  const h = harness();
  h.environment({ visible: false, preference: 'reduce' });
  h.commit(['bg-input']);
  const old = [...h.all.values()][0];
  h.commit(['bg-primary'], 2);
  const count = h.writes.length;
  old();
  expect(h.writes.length).toBe(count);
  h.time(0);
  h.environment({ visible: true, preference: 'no-preference' });
  expect(h.last.p.backgroundColorState).toBe('settled');
  expect(h.callbacks.size).toBe(0);
});

it('a cancelled old first frame cannot erase the replacement view pending ticket', () => {
  const h = harness();
  h.commit(['bg-input']);
  const old = [...h.all.values()][0];
  h.commit(['bg-primary'], 2);
  expect(h.callbacks.size).toBe(1);
  old();
  expect(h.callbacks.size).toBe(1);
  h.sink.release(2);
  expect(h.callbacks.size).toBe(0);
});

it('retargets between delayed RAFs from last presented translate and color', () => {
  const h = harness();
  h.commit(['translate-x-0', 'bg-input']);
  h.time(0);
  h.commit(['translate-x-4', 'bg-primary']);
  h.time(30);
  const before = h.last.p;
  h.clock(70);
  h.commit(['translate-x-0', 'bg-input']);
  expect(h.last.p.translate).toEqual(before.translate);
  expect(h.last.p.backgroundColor).toEqual(before.backgroundColor);
  h.time(80);
  expect(h.last.p.translate![0]).toBeLessThan(before.translate![0]);
});
it('same-target commits do not advance paint between RAFs or restart motion', () => {
  const h = harness();
  h.commit(['translate-x-0', 'bg-input']);
  h.time(0);
  h.commit(['translate-x-4', 'bg-primary']);
  h.time(30);
  const before = h.last.p;
  h.clock(70);
  h.commit(['translate-x-4', 'bg-primary', 'rounded-full']);
  expect(h.last.p.translate).toEqual(before.translate);
  expect(h.last.p.backgroundColor).toEqual(before.backgroundColor);
  h.time(100);
  expect(h.last.p.translate).toEqual([16, 0]);
  expect(h.last.p.backgroundColorState).toBe('settled');
});

it('a rejected channel loses its cache and stops scheduling while admitted channels continue', () => {
  const h = harness();
  h.commit(['translate-x-0', 'bg-input']);
  h.time(0);
  h.commit(['translate-x-4', 'bg-primary']);
  h.time(20);
  h.receipt(() => ['background-color']);
  h.clock(60);
  h.commit(['translate-x-0', 'bg-input']);
  expect(h.callbacks.size).toBe(1);
  expect(h.reasons).toContain('translate:projection-rejected');
  h.receipt(() => []);
  h.time(70);
  expect(h.callbacks.size).toBe(0);
  h.receipt(() => ['translate', 'background-color']);
  h.commit(['translate-x-4', 'bg-primary']);
  expect(h.last.p.translate).toEqual([16, 0]);
  expect(h.last.p.backgroundColorState).toBe('settled');
});
it('same-frame third targets and overdue reverse keep the last acknowledged sample', () => {
  const h = harness();
  h.commit(['translate-x-0', 'bg-input']);
  h.time(0);
  h.commit(['translate-x-4', 'bg-primary']);
  h.time(20);
  const before = h.last.p;
  h.clock(180);
  h.commit(['translate-x-8', 'bg-input']);
  expect(h.last.p.translate).toEqual(before.translate);
  h.commit(['translate-x-0', 'bg-primary']);
  expect(h.last.p.translate).toEqual(before.translate);
  expect(h.last.p.backgroundColor).toEqual(before.backgroundColor);
});
it('reentrant retirement cannot acknowledge the attempted frame or retain scheduling', () => {
  const h = harness();
  h.commit(['translate-x-0', 'bg-input']);
  h.time(0);
  h.commit(['translate-x-4', 'bg-primary']);
  h.time(20);
  h.receipt(() => {
    h.sink.release(1);
    return ['translate', 'background-color'];
  });
  h.clock(70);
  h.commit(['translate-x-0', 'bg-input']);
  expect(h.callbacks.size).toBe(0);
  const count = h.writes.length;
  h.time(100);
  expect(h.writes.length).toBe(count);
});

function widthFrame(
  tokens: string[],
  revision: number,
  numbers?: Readonly<Record<string, number>>
): ResidentMotionFrame {
  return {
    view: 1,
    revision,
    style: { kind: 'tw', tokens },
    declarations: [{ properties: ['width'], durationMs: 100, easing: [0, 0, 1, 1] }],
    ...(numbers ? { numbers } : {}),
  };
}

describe('static motion target demand', () => {
  it.each([
    { tokens: [], reason: 'missing-or-ambiguous-target' },
    { tokens: ['w-auto'], reason: 'length-unavailable' },
    { tokens: ['w-[100px]', 'w-[300px]'], reason: 'missing-or-ambiguous-target' },
    { tokens: ['hover:w-4'], reason: 'selector-dependent-target' },
  ])(
    'keeps declared width and its original failure for $tokens without asking for a width basis',
    ({ tokens, reason }) => {
      const h = harness();
      h.environment({ supportedProperties: ['width'], containingBlockWidth: 400 });
      h.receipt(() => ['width']);
      h.sink.commit(widthFrame(tokens, 1));
      expect(h.requests.at(-1)).toEqual({ declared: ['width'], targets: [] });
      expect(Object.isFrozen(h.requests.at(-1)!.targets)).toBe(true);
      expect(h.last.p).toEqual({});
      expect(h.last.tokens).toEqual(tokens);
      expect(h.reasons).toContain(`width:${reason}`);
      expect(h.reasons).toContain('width:unresolved-target-settled');
      h.time(0);
      expect(h.requests.at(-1)).toEqual({ declared: ['width'], targets: [] });
    }
  );

  it('keeps a pending percentage observable and reevaluates later Rule targets from each new frame', () => {
    const h = harness();
    h.environment({ supportedProperties: ['width'], containingBlockWidth: null });
    h.receipt(() => ['width']);
    h.sink.commit(widthFrame([], 1));
    expect(h.requests.at(-1)!.targets).toEqual([]);
    h.sink.commit(widthFrame(['w-1/2'], 2));
    expect(h.requests.at(-1)).toEqual({ declared: ['width'], targets: ['width'] });
    expect(h.last.p.width).toBeUndefined();
    expect(h.last.tokens).toEqual(['w-1/2']);
    h.environment({ containingBlockWidth: 400 });
    expect(h.last.p.width).toBe(200);
    h.sink.commit(widthFrame(['w-auto'], 3));
    expect(h.requests.at(-1)!.targets).toEqual([]);
    h.sink.commit(widthFrame(['w-[100px]'], 4));
    expect(h.requests.at(-1)!.targets).toEqual(['width']);
    expect(h.last.p.width).toBe(100);
    h.sink.commit(widthFrame([], 1));
    expect(h.requests.at(-1)!.targets).toEqual(['width']);
  });

  it('does not turn a parsed target hint into host capability', () => {
    const h = harness();
    h.receipt(() => ['width']);
    h.sink.commit(widthFrame(['w-[100px]'], 1));
    expect(h.requests.at(-1)).toEqual({ declared: ['width'], targets: ['width'] });
    expect(h.last.p.width).toBeUndefined();
    expect(h.last.tokens).toEqual(['w-[100px]']);
    expect(h.reasons).toContain('width:host-property-unavailable');
    h.environment({ supportedProperties: ['width'] });
    expect(h.last.p.width).toBe(100);
  });

  it('retains the admitted numeric snapshot while the host basis remains live', () => {
    const h = harness();
    h.environment({ supportedProperties: ['width'], containingBlockWidth: 400 });
    h.receipt(() => ['width']);
    const tokens = ['w-[calc(var(--pui-progress)*1%)]'];
    const numbers = { progress: 25 };
    h.sink.commit(widthFrame(tokens, 1, numbers));
    expect(h.last.p.width).toBe(100);
    tokens[0] = 'w-auto';
    numbers.progress = 99;
    h.environment({ containingBlockWidth: 200 });
    expect(h.requests.at(-1)!.targets).toEqual(['width']);
    expect(h.last.p.width).toBe(50);
    h.sink.commit(widthFrame(['w-[calc(var(--pui-progress)*1%)]'], 2, numbers));
    expect(h.last.p.width).toBe(198);
  });

  it('does not evaluate an unknown numeric getter to establish target demand', () => {
    const h = harness();
    h.environment({ supportedProperties: ['width'], containingBlockWidth: 400 });
    h.receipt(() => ['width']);
    let reads = 0;
    const numbers = Object.defineProperty({}, 'progress', {
      enumerable: true,
      get() {
        reads++;
        return 25;
      },
    });
    h.sink.commit(widthFrame(['w-[calc(var(--pui-progress)*1%)]'], 1, numbers));
    expect(reads).toBe(0);
    expect(h.requests.at(-1)!.targets).toEqual([]);
    expect(h.last.p.width).toBeUndefined();
    expect(h.reasons).toContain('width:numeric-source-unavailable');
  });
});
