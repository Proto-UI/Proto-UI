import { describe, expect, it } from 'vitest';
import {
  createAnatomyFamily,
  type AnatomyPartView,
  type AxisInputHost,
  type AxisInputHostBinding,
  type AxisInputSample,
  type RunHandle,
} from '@proto.ui/core';
import { CapsVault, SYS_CAP, type SystemCaps } from '@proto.ui/module-base';
import type { AnatomyPort } from '@proto.ui/module-anatomy';
import { createAxisInputModule } from '../src/create';
import { AXIS_INPUT_HOST_CAP, AXIS_INPUT_RUN_IN_CALLBACK_CAP } from '../src/caps';

function harness(withHost = true) {
  let phase: 'setup' | 'callback' = 'setup';
  const run = { update() {} } as RunHandle<Record<string, unknown>>;
  const sys = {
    ensureSetup() {
      if (phase !== 'setup') throw Error('setup only');
    },
    ensureCallback() {
      if (phase !== 'callback') throw Error('callback only');
    },
    isDisposed: () => false,
    getCallbackCtx: () => (phase === 'callback' ? run : undefined),
  } as unknown as SystemCaps;
  const callback = (fn: () => void) => {
    const old = phase;
    phase = 'callback';
    try {
      fn();
    } finally {
      phase = old;
    }
  };
  const vault = new CapsVault();
  vault.attachBase([[SYS_CAP, sys]]);
  const records: { binding: AxisInputHostBinding; disposed: boolean }[] = [];
  const host: AxisInputHost = {
    attach(binding) {
      const record = { binding, disposed: false };
      records.push(record);
      return {
        update(next) {
          record.binding = next;
        },
        dispose() {
          record.disposed = true;
        },
      };
    },
  };
  if (withHost)
    vault.attach([
      [AXIS_INPUT_HOST_CAP, host],
      [AXIS_INPUT_RUN_IN_CALLBACK_CAP, callback],
    ]);
  const family = createAnatomyFamily('axis-unit', {
    roles: {
      root: { cardinality: { min: 1, max: 1 } },
      handle: { cardinality: { min: 1, max: '*' } },
    },
  });
  const root = { role: 'root' } as AnatomyPartView;
  const self = { role: 'handle' } as AnatomyPartView;
  const other = { role: 'handle' } as AnatomyPartView;
  let target: object | null = {};
  const geometry = {};
  const watchers = new Set<() => void>();
  const subscribe = (_family: unknown, fn: () => void) => {
    watchers.add(fn);
    return () => watchers.delete(fn);
  };
  const anatomy = {
    resolveSelfRole: () => 'handle',
    resolveSelfInstance: () => self,
    resolvePartInstance: (part: AnatomyPartView) => part,
    resolveAncestorInstance: () => root,
    resolvePartTarget: (part: AnatomyPartView) =>
      part === self ? target : part === root ? geometry : {},
    order: {
      partsOf: (_family: unknown, role: string) => (role === 'handle' ? [other, self] : [root]),
    },
    subscribeOrder: subscribe,
    subscribeTargets: subscribe,
  } as unknown as AnatomyPort;
  const module = createAxisInputModule({
    init: { prototypeName: 'axis-fixture', declarations: [] },
    caps: vault,
    deps: {
      requirePort: () => anatomy as never,
      requireFacade: () => {
        throw Error('unused');
      },
      tryPort: () => undefined,
      tryFacade: () => undefined,
    },
  });
  const input = module.facade.declare();
  input.configure({ anatomy: family, inputRole: 'handle', geometryRole: 'root' });
  const samples: AxisInputSample[] = [];
  input.on((_run, sample) => {
    expect(_run).toBe(run);
    samples.push(sample);
  });
  const mount = () => {
    callback(() => input.sync({ disabled: false }));
    module.hooks.onMountPhase?.('mounted', 1);
  };
  const replace = () => {
    target = {};
    watchers.forEach((fn) => fn());
  };
  return {
    input,
    module,
    vault,
    records,
    samples,
    callback,
    mount,
    replace,
    watchers,
    target,
    geometry,
  };
}
const sample = (phase: 'start' | 'move' | 'end'): AxisInputSample => ({
  phase,
  position: 0.5,
  delta: 0,
  totalDelta: 0,
});

describe('axis-input module ownership', () => {
  it('resolves only its own input and nearest geometry; dispatches in callback scope', () => {
    const h = harness();
    h.mount();
    expect(h.records[0].binding.inputTarget).toBe(h.target);
    expect(h.records[0].binding.geometryTarget).toBe(h.geometry);
    h.records[0].binding.onSample(sample('start'));
    h.records[0].binding.onSample(sample('end'));
    expect(h.samples.map((s) => s.phase)).toEqual(['start', 'end']);
    h.module.hooks.dispose?.();
    expect(h.watchers.size).toBe(0);
  });
  it('cancels once and rejects stale callbacks after target replacement and detach', () => {
    const h = harness();
    h.mount();
    const old = h.records[0];
    old.binding.onSample(sample('start'));
    h.replace();
    expect(old.disposed).toBe(true);
    expect(h.samples.at(-1)).toEqual({ phase: 'cancel', reason: 'target-replaced' });
    old.binding.onSample(sample('end'));
    expect(h.samples).toHaveLength(2);
    const next = h.records[1];
    next.binding.onSample(sample('start'));
    h.module.hooks.onMountPhase?.('detached', 2);
    next.binding.onSample(sample('end'));
    expect(h.samples.map((s) => s.phase)).toEqual(['start', 'cancel', 'start', 'cancel']);
    h.module.hooks.dispose?.();
  });
  it('does not resurrect an attachment when cancel callback disposes the module', () => {
    const h = harness();
    h.input.on((_run, s) => {
      if (s.phase === 'cancel') h.module.hooks.dispose?.();
    });
    h.mount();
    h.records[0].binding.onSample(sample('start'));
    h.replace();
    expect(h.records).toHaveLength(1);
    expect(h.records[0].disposed).toBe(true);
  });
  it('stays inert when the host capability is absent', () => {
    const h = harness(false);
    h.mount();
    expect(h.records).toHaveLength(0);
    h.module.hooks.dispose?.();
  });
  it('enforces setup/callback boundaries and ordered samples', () => {
    const h = harness();
    expect(() => h.input.sync({ disabled: false })).toThrow('callback only');
    h.mount();
    const binding = h.records[0].binding;
    binding.onSample(sample('move'));
    binding.onSample(sample('end'));
    binding.onSample(sample('start'));
    binding.onSample(sample('start'));
    binding.onSample(sample('end'));
    expect(h.samples.map((s) => s.phase)).toEqual(['start', 'end']);
    h.module.hooks.dispose?.();
  });
});
