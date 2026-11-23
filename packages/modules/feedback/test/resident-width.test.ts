import { describe, expect, it, vi } from 'vitest';
import {
  createResidentMotionProjector,
  type MotionEnvironment,
  type MotionPresentation,
} from '../src/motion/projector';
import { createMotionNumericSources } from '../src/motion/numeric-sources';
import {
  extractResidentMotionTarget,
  resolveMotionWidth,
  type MotionLength,
} from '../src/motion/targets';
import type { StatePort } from '@proto.ui/module-state';
import type { ResidentMotionProperty } from '@proto.ui/core';

const variable = 'w-[calc(var(--pui-percentage)*1%)]';
function harness() {
  let now = 0,
    revision = 0,
    next = 0;
  let invalidate = () => {};
  let accepted: readonly ResidentMotionProperty[] = ['width'];
  let env: MotionEnvironment = {
    visible: true,
    preference: 'no-preference',
    supportedProperties: ['width'],
    width: 17,
    height: 9,
    containingBlockWidth: 400,
    rootFontPx: 16,
    palette: {},
    paletteRevision: 0,
  };
  const callbacks = new Map<number, () => void>();
  const writes: { tokens: readonly string[]; presentation: MotionPresentation }[] = [];
  const sink = createResidentMotionProjector({
    now: () => now,
    environment: () => env,
    subscribe: (fn) => {
      invalidate = fn;
      return () => {
        invalidate = () => {};
      };
    },
    requestFrame: (fn) => {
      callbacks.set(++next, fn);
      return next;
    },
    cancelFrame: (id) => {
      callbacks.delete(id as number);
    },
    project: (style, presentation) => {
      writes.push({ tokens: style.tokens, presentation });
      return accepted;
    },
  });
  return {
    sink,
    callbacks,
    get last() {
      return writes.at(-1)!;
    },
    commit(tokens: string[], percentage?: number) {
      sink.commit({
        view: 1,
        revision: ++revision,
        style: { kind: 'tw', tokens },
        declarations: [{ properties: ['width'], durationMs: 100, easing: [0, 0, 1, 1] }],
        numbers: percentage === undefined ? {} : { percentage },
      });
    },
    clock(time: number) {
      now = time;
    },
    frame(time: number) {
      now = time;
      for (const [id, cb] of [...callbacks]) {
        callbacks.delete(id);
        cb();
      }
    },
    environment(patch: Partial<MotionEnvironment>) {
      env = { ...env, ...patch };
      invalidate();
    },
    receipt(properties: readonly ResidentMotionProperty[]) {
      accepted = properties;
    },
  };
}

describe('typed resident width', () => {
  it('uses the containing block, supports affine units and refuses unresolved or hostile inputs', () => {
    const resolve = (tokens: string[], numbers = {}) => {
      const target = extractResidentMotionTarget(tokens, 'width', numbers);
      return target.supported
        ? resolveMotionWidth(target.value as MotionLength, {
            rootFontPx: 16,
            containingBlockWidth: 400,
          })
        : null;
    };
    expect(resolve(['w-1/3'])![0]).toBeCloseTo(400 / 3);
    expect(resolve(['w-px'])).toEqual([1]);
    expect(resolve(['w-[calc(50%_-_2rem)]'])).toEqual([168]);
    expect(resolve([variable], { percentage: 75 })).toEqual([300]);
    expect(resolve([variable])).toBeNull();
    expect(resolve([variable], { percentage: Infinity })).toBeNull();
    expect(resolve([variable], { percentage: -1 })).toBeNull();
    expect(resolve(['w-1/0'])).toBeNull();
    expect(resolve(['w-[-10px]'])).toBeNull();
    expect(resolve(['data-[active]:w-full'])).toBeNull();
    expect(resolve(['w-full', 'transition-all'])).toBeNull();
    const target = extractResidentMotionTarget(['w-1/2'], 'width');
    expect(
      target.supported &&
        resolveMotionWidth(target.value as MotionLength, {
          rootFontPx: 16,
          containingBlockWidth: null,
        })
    ).toBeNull();
    const getter = vi.fn(() => 90);
    const numbers = Object.defineProperty({}, 'percentage', { get: getter });
    expect(resolve([variable], numbers)).toBeNull();
    expect(getter).not.toHaveBeenCalled();
  });

  it('retains the final token, follows numeric updates and reverses from the acknowledged sample', () => {
    const h = harness();
    h.commit([variable], 25);
    h.frame(0);
    expect(h.last.presentation).toEqual({ width: 100, widthState: 'settled' });
    h.commit([variable], 75);
    expect(h.last.presentation.width).toBe(100);
    h.frame(25);
    expect(h.last.presentation.width).toBeCloseTo(150);
    h.clock(200); // No delivered frame at the later clock.
    h.commit([variable], 25);
    expect(h.last.presentation.width).toBeCloseTo(150);
    h.frame(212.5);
    expect(h.last.presentation.width).toBeCloseTo(125);
    h.frame(225);
    expect(h.last.presentation).toEqual({ width: 100, widthState: 'settled' });
    expect(h.last.tokens).toEqual([variable]);
    expect(h.callbacks.size).toBe(0);
    h.commit([variable], 25); // Controlled refusal / unchanged final target.
    expect(h.callbacks.size).toBe(0);
  });

  it('settles missing basis, suppressed target and unknown/reduced preference without replay', () => {
    const h = harness();
    h.commit([variable], 0);
    h.frame(0);
    h.commit([variable], 100);
    h.frame(30);
    h.environment({ containingBlockWidth: null });
    expect(h.last.presentation).toEqual({});
    expect(h.last.tokens).toEqual([variable]);
    expect(h.callbacks.size).toBe(0);
    h.environment({ containingBlockWidth: 800 });
    expect(h.last.presentation.width).toBe(800);
    expect(h.last.presentation.widthState).toBe('settled');
    h.commit(['rounded-full']);
    expect(h.last.presentation).toEqual({});
    h.commit([variable], 25);
    expect(h.last.presentation.width).toBe(200);
    h.environment({ preference: 'reduce' });
    h.commit([variable], 75);
    expect(h.last.presentation.width).toBe(600);
    h.environment({ preference: 'no-preference' });
    expect(h.callbacks.size).toBe(0);
    h.environment({ preference: 'unknown' });
    h.commit([variable], 50);
    expect(h.last.presentation.width).toBe(400);
    expect(h.callbacks.size).toBe(0);
  });

  it('rejects a host-refused anchor and cannot revive stale frame callbacks after release', () => {
    const h = harness();
    h.commit(['w-0']);
    h.frame(0);
    h.commit(['w-full']);
    const stale = [...h.callbacks.values()][0];
    h.receipt([]);
    h.frame(20);
    expect(h.callbacks.size).toBe(0);
    expect(h.sink.diagnostics?.()).toContain('width:projection-rejected');
    h.receipt(['width']);
    h.commit(['w-1/2']);
    expect(h.last.presentation.width).toBe(200);
    h.sink.release(1);
    const before = h.last;
    stale();
    expect(h.last).toBe(before);
    expect(h.callbacks.size).toBe(0);
  });
});

describe('resident numeric source identity and lifetime', () => {
  it('reads only exact registered numeric State, prunes suppression and rejects disconnects', () => {
    let number = 25;
    const source = {
      __stateKind: 'number.range',
      __stateSemantic: 'percentage',
      get: () => number,
    };
    let exposed: unknown = source;
    const callbacks = new Set<(run: unknown, event: any) => void>();
    const off = vi.fn();
    const state = {
      watch: (_handle: unknown, cb: (run: unknown, event: any) => void) => {
        callbacks.add(cb);
        return () => {
          callbacks.delete(cb);
          off();
        };
      },
    } as unknown as StatePort;
    const invalidated = vi.fn();
    const inputs = createMotionNumericSources({
      expose: () => exposed,
      state: () => state,
      invalidate: invalidated,
    });
    inputs.register(source);
    const initial = inputs.snapshot([variable]);
    expect(initial.numbers).toEqual({ percentage: 25 });
    expect(Object.isFrozen(initial.numbers)).toBe(true);
    number = 75;
    callbacks.forEach((cb) => cb({}, { type: 'next', next: 75 }));
    expect(invalidated).toHaveBeenCalledOnce();
    expect(inputs.snapshot([variable]).numbers).toEqual({ percentage: 75 });
    expect(initial.numbers).toEqual({ percentage: 25 });
    inputs.snapshot(['w-1/2']);
    expect(off).toHaveBeenCalledOnce();
    expect(callbacks.size).toBe(0);
    inputs.snapshot([variable]);
    callbacks.forEach((cb) => cb({}, { type: 'disconnect' }));
    expect(inputs.snapshot([variable]).numbers).toEqual({});
    expect(callbacks.size).toBe(0);
    const fakeGet = vi.fn(() => 100);
    exposed = { ...source, get: fakeGet };
    expect(inputs.snapshot([variable]).numbers).toEqual({});
    expect(fakeGet).not.toHaveBeenCalled();
    inputs.dispose();
  });

  it('does not invoke accessor-backed or mismatched-semantic exposures', () => {
    const get = vi.fn(() => () => 50);
    const source = Object.defineProperty(
      { __stateKind: 'number.range', __stateSemantic: 'percentage' },
      'get',
      { get }
    );
    let exposed: unknown = source;
    const watch = vi.fn();
    const inputs = createMotionNumericSources({
      expose: () => exposed,
      state: () => ({ watch }) as unknown as StatePort,
      invalidate: vi.fn(),
    });
    inputs.register(source);
    expect(inputs.snapshot([variable]).numbers).toEqual({});
    expect(get).not.toHaveBeenCalled();
    exposed = { __stateKind: 'number.range', __stateSemantic: 'other', get: vi.fn(() => 50) };
    inputs.register(exposed as object);
    expect(inputs.snapshot([variable]).numbers).toEqual({});
    expect(watch).not.toHaveBeenCalled();
  });
});
