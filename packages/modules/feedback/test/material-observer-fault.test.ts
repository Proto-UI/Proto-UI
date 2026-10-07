import { afterEach, describe, expect, it, vi } from 'vitest';
import { tw } from '@proto.ui/core';
import { CapsVault, SYS_CAP, type ModuleDeps, type SystemCaps } from '@proto.ui/module-base';
import { StateModuleImpl } from '../../state/src/impl';
import { RuleModuleImpl } from '../../rule/src/impl';
import { createFeedbackModule } from '../src/create';
import type { FeedbackInternalHooks, FeedbackPort } from '../src/types';
import { FINAL_STYLE_SINK_CAP, type FinalStyleFrame } from '../src/material/final-style-sink';
import { MATERIAL_BINDING_FACTORY_CAP } from '../src/material/runtime-cap';
import { createOwnedMaterialBinding, declareMaterial } from '../src/material/owned-slot';

function fixture(withRule = true) {
  const sys: SystemCaps = {
    execPhase: () => 'setup',
    domain: () => 'setup',
    protoPhase: () => 'setup',
    isDisposed: () => false,
    ensureExecPhase() {},
    ensureNotDisposed() {},
    ensureSetup() {},
    ensureRuntime() {},
    ensureCallback() {},
    getCallbackCtx: () => undefined,
  };
  const state = new StateModuleImpl(sys);
  const pressed = state.facade.bool('pressed', false);
  const disabled = state.facade.bool('disabled', false);
  const exposed = new Map([
    ['pressed', pressed],
    ['disabled', disabled],
  ]);
  const deps: ModuleDeps = {
    requireFacade() {
      throw new Error('unexpected dependency');
    },
    requirePort() {
      throw new Error('unexpected dependency');
    },
    tryFacade: () => undefined,
    tryPort: <T>(name: string) =>
      (name === 'state' ? state.port : name === 'expose' ? exposed : undefined) as T | undefined,
  };
  const caps = new CapsVault();
  caps.attachBase([[SYS_CAP, sys]]);
  const feedback = createFeedbackModule({
    init: {
      prototypeName: 'material-observer-fault',
      declarations: [
        declareMaterial({
          version: 1,
          material: { kind: 'refractive', variant: 'regular' },
          sampling: { kind: 'owned-scene', slot: 'scene' },
          shape: { kind: 'rounded-rect', geometry: 'style' },
          fallback: { fill: [1, 1, 1, 1], foreground: 'style' },
          interaction: { kind: 'button-press' },
        }),
      ],
    },
    caps,
    deps,
  });
  const hooks = feedback.hooks as FeedbackInternalHooks;
  const port = (feedback as typeof feedback & { port: FeedbackPort }).port;
  const frames: FinalStyleFrame[] = [];
  const sink = { commit: vi.fn((frame: FinalStyleFrame) => frames.push(frame)), release: vi.fn() };
  const rule = new RuleModuleImpl<Record<string, unknown>>();
  rule.attachExecutor(() => ({ statePort: state.port, feedbackPort: port }));
  if (withRule) {
    rule.define({
      when: (w) => w.state(pressed).eq(true),
      intent: (i) => i.feedback.style.use(tw('rounded-full')),
    });
    rule.define({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50')),
    });
  }
  feedback.facade.style.use(tw('rounded-lg text-white'));
  caps.attach([
    [MATERIAL_BINDING_FACTORY_CAP, createOwnedMaterialBinding],
    [FINAL_STYLE_SINK_CAP, sink],
  ]);
  // Match Runtime ordering: material connects at mounting, before Rule installs
  // semantic watchers at mounted. These are real State, Rule and Feedback owners.
  hooks.onMountPhase?.('mounting', 1);
  hooks.onProtoPhase?.('mounted');
  hooks.onMountPhase?.('mounted', 1);
  rule.onInstancePhase('alive');
  rule.onMountPhase('mounted');
  rule.onProtoPhase('mounted');
  const laterObserver = vi.fn();
  state.port.watch(pressed, laterObserver);
  state.port.watch(disabled, laterObserver);
  const reports: VoidFunction[] = [];
  vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((task) => reports.push(task));
  return {
    state,
    pressed,
    disabled,
    style: feedback.facade.style,
    port,
    hooks,
    frames,
    sink,
    reports,
    laterObserver,
    dispose() {
      hooks.dispose?.();
      rule.dispose();
      state.dispose();
    },
  };
}

afterEach(() => vi.restoreAllMocks());

describe('owned material observer host-fault isolation', () => {
  it('still evaluates Rule activation and removal after material projection fails', () => {
    const f = fixture();
    try {
      for (const [handle, value, tokens] of [
        [f.pressed, true, ['rounded-full', 'text-white']],
        [f.pressed, false, ['rounded-lg', 'text-white']],
        [f.disabled, true, ['rounded-lg', 'text-white', 'opacity-50']],
        [f.disabled, false, ['rounded-lg', 'text-white']],
      ] as const) {
        const failure = new Error('material projection failed');
        f.sink.commit.mockImplementationOnce(() => {
          throw failure;
        });
        const previousCalls = f.laterObserver.mock.calls.length;
        let synchronousFailure: unknown;
        try {
          f.state.port.set(handle, value);
        } catch (error) {
          synchronousFailure = error;
        }
        expect(handle.get()).toBe(value);
        expect(f.style.exportMerged().tokens).toEqual(tokens);
        expect(f.laterObserver).toHaveBeenCalledTimes(previousCalls + 1);
        expect(synchronousFailure).toBeUndefined();
        expect(f.frames.at(-1)?.style.tokens).toEqual(tokens);
        expect(f.frames.at(-1)?.material).toMatchObject({
          pressed: f.pressed.get(),
          disabled: f.disabled.get(),
        });
        // Projection errors stay observable, after synchronous semantic fan-out.
        expect(f.reports).toHaveLength(1);
        expect(f.reports.shift()!).toThrow(failure);
      }
    } finally {
      f.dispose();
    }
  });

  it('finishes independent Rule replacements during persistent projection failure and retries the complete result', () => {
    const f = fixture();
    const secondRule = new RuleModuleImpl<Record<string, unknown>>();
    secondRule.attachExecutor(() => ({ statePort: f.state.port, feedbackPort: f.port }));
    secondRule.define({
      when: (w) => w.state(f.pressed).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50')),
    });
    secondRule.onInstancePhase('alive');
    secondRule.onMountPhase('mounted');
    secondRule.onProtoPhase('mounted');
    const afterBothRules = vi.fn();
    f.state.port.watch(f.pressed, afterBothRules);
    const failure = new Error('persistent host failure');
    try {
      // Independent real Rule drivers deliberately exercise two semantic
      // observers, rather than two declarations batched by one driver.
      for (const [value, tokens] of [
        [true, ['rounded-full', 'text-white', 'opacity-50']],
        [false, ['rounded-lg', 'text-white']],
      ] as const) {
        const lastAcceptedFrame = f.frames.at(-1);
        const callsBefore = afterBothRules.mock.calls.length;
        f.sink.commit.mockImplementation(() => {
          throw failure;
        });
        let synchronousFailure: unknown;
        try {
          f.state.port.set(f.pressed, value);
        } catch (error) {
          synchronousFailure = error;
        }
        expect(f.pressed.get()).toBe(value);
        expect(f.style.exportMerged().tokens).toEqual(tokens);
        expect(synchronousFailure).toBeUndefined();
        expect(afterBothRules).toHaveBeenCalledTimes(callsBefore + 1);
        expect(f.frames.at(-1)).toBe(lastAcceptedFrame);
        expect(f.reports).toHaveLength(3);
        for (const report of f.reports.splice(0)) expect(report).toThrow(failure);
        // An explicit retry still reports its own host failure synchronously.
        expect(() => f.hooks.flushIfPossible()).toThrow(failure);
        expect(f.reports).toEqual([]);
        f.sink.commit.mockImplementation((frame) => f.frames.push(frame));
        f.hooks.flushIfPossible();
        expect(f.frames.at(-1)?.style.tokens).toEqual(tokens);
        expect(f.frames.at(-1)?.material?.pressed).toBe(value);
      }
      // Replacements returned their disposers despite host failure, so no
      // orphaned contribution survives a later healthy activate/remove cycle.
      f.state.port.set(f.pressed, true);
      expect(f.frames.at(-1)?.style.tokens).toEqual(['rounded-full', 'text-white', 'opacity-50']);
      f.state.port.set(f.pressed, false);
      expect(f.frames.at(-1)?.style.tokens).toEqual(['rounded-lg', 'text-white']);
      expect(f.reports).toEqual([]);
    } finally {
      f.sink.commit.mockImplementation((frame) => f.frames.push(frame));
      secondRule.dispose();
      f.dispose();
    }
  });

  it('keeps invalid Rule contributions and direct imperative projection errors synchronous', () => {
    const f = fixture(false);
    try {
      expect(() => f.port.replaceStyleRuntime(null, { kind: 'css', tokens: [] } as any)).toThrow();
      expect(f.reports).toEqual([]);
      const failure = new Error('direct host failure');
      f.sink.commit.mockImplementation(() => {
        throw failure;
      });
      expect(() => f.style.patch(tw('rounded-full'))).toThrow(failure);
      expect(() => f.port.applyMergedStyle(tw('shadow-sm'))).toThrow(failure);
      expect(() => f.hooks.afterRenderCommit()).toThrow(failure);
      f.hooks.onMountPhase?.('detached', 1);
      expect(() => f.hooks.onMountPhase?.('mounting', 2)).toThrow(failure);
      expect(f.reports).toEqual([]);
    } finally {
      f.dispose();
    }
  });

  it('retains failed no-Rule projection for explicit retry without another state transition', () => {
    const f = fixture(false);
    try {
      const failure = new Error('host remains unavailable');
      f.sink.commit.mockImplementationOnce(() => {
        throw failure;
      });
      expect(() => f.state.port.set(f.pressed, true)).not.toThrow();
      expect(f.pressed.get()).toBe(true);
      expect(f.frames.at(-1)?.material?.pressed).toBe(false);
      expect(f.laterObserver).toHaveBeenCalledOnce();
      expect(f.reports).toHaveLength(1);
      expect(f.reports.shift()!).toThrow(failure);
      f.hooks.flushIfPossible();
      expect(f.frames.at(-1)?.material?.pressed).toBe(true);
      expect(f.frames.at(-1)?.style.tokens).toEqual(['rounded-lg', 'text-white']);
    } finally {
      f.dispose();
    }
  });

  it('preserves synchronous successful projection and does not absorb semantic watcher errors', () => {
    const f = fixture(false);
    try {
      const failure = new Error('semantic observer failed');
      f.state.port.watch(f.pressed, (_ctx, event) => {
        if (event.type === 'next') throw failure;
      });
      expect(() => f.state.port.set(f.pressed, true)).toThrow(failure);
      expect(f.frames.at(-1)?.material?.pressed).toBe(true);
      expect(f.reports).toEqual([]);
    } finally {
      f.dispose();
    }
  });
});
