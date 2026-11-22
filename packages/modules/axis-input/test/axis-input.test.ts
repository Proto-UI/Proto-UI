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

function harness(withHost = true, travelRole = false, originRole = false) {
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
      indicator: { cardinality: { min: 0, max: '*' } },
    },
  });
  const root = { role: 'root' } as AnatomyPartView;
  const self = { role: 'handle' } as AnatomyPartView;
  const other = { role: 'handle' } as AnatomyPartView;
  let selfPart = self;
  let domain = {};
  const indicator = { role: 'indicator' } as AnatomyPartView;
  const duplicate = { role: 'indicator' } as AnatomyPartView;
  let indicators: AnatomyPartView[] = [indicator];
  let foreign = false;
  const travelTarget = {};
  const foreignRoot = {};
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
    resolvePartInstance: (part: AnatomyPartView) => (part === selfPart ? self : part),
    resolveDomainScope: () => domain,
    isCurrentPart: (_family: unknown, part: AnatomyPartView) =>
      [root, selfPart, other, ...indicators].includes(part),
    resolveAncestorInstance: (_family: unknown, part: AnatomyPartView) =>
      foreign && indicators.includes(part) ? foreignRoot : root,
    resolvePartTarget: (part: AnatomyPartView) =>
      part === selfPart
        ? target
        : part === root
          ? geometry
          : indicators.includes(part)
            ? travelTarget
            : {},
    order: {
      partsOf: (_family: unknown, role: string) =>
        role === 'handle' ? [other, selfPart] : role === 'indicator' ? indicators : [root],
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
  input.configure({
    anatomy: family,
    inputRole: 'handle',
    geometryRole: 'root',
    ...(travelRole ? { travelRole: 'indicator' } : {}),
    ...(originRole ? { originRole: 'indicator' } : {}),
  });
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
    travelTarget,
    notify: () => watchers.forEach((fn) => fn()),
    reassociate: () => {
      domain = {};
    },
    replaceSilently: () => {
      target = {};
    },
    replaceClaim: () => {
      selfPart = { role: 'handle' } as AnatomyPartView;
    },
    setTravelCount: (count: number) => {
      indicators = count === 0 ? [] : count === 1 ? [indicator] : [indicator, duplicate];
    },
    setForeign: (value: boolean) => {
      foreign = value;
    },
  };
}
const sample = (phase: 'start' | 'move' | 'end'): AxisInputSample => ({
  phase,
  position: 0.5,
  delta: 0,
  totalDelta: 0,
});

describe('axis-input module ownership', () => {
  it('binds public origin order to one logical owner and rejects stale reassociated callbacks', () => {
    const h = harness(true, false, true);
    h.mount();
    const old = h.records[0];
    expect(old.binding.originTargets).toEqual([h.travelTarget]);
    old.binding.onSample({ ...sample('start'), originIndex: 0 });
    h.reassociate();
    old.binding.onSample({ ...sample('move'), originIndex: 0 });
    old.binding.onSample({ ...sample('end'), originIndex: 0 });
    expect(old.disposed).toBe(true);
    expect(h.samples.map((s) => s.phase)).toEqual(['start', 'cancel']);
    h.records[1].binding.onSample({ ...sample('start'), originIndex: null });
    h.setTravelCount(0);
    h.notify();
    expect(h.samples.map((s) => s.phase)).toEqual(['start', 'cancel', 'start', 'cancel']);
    expect(h.records.at(-1)?.binding.originTargets).toEqual([]);
    h.module.hooks.dispose?.();
  });
  it.each([undefined, -1, 0.5, 1])(
    'fails closed for missing or invalid opt-in origin %s',
    (originIndex) => {
      const h = harness(true, false, true);
      h.mount();
      h.records[0].binding.onSample({ ...sample('start'), originIndex });
      expect(h.samples).toEqual([]);
      expect(h.records[0].disposed).toBe(true);
      h.module.hooks.dispose?.();
    }
  );
  it('rejects a host that changes origin while one contact is active', () => {
    const h = harness(true, false, true);
    h.mount();
    h.records[0].binding.onSample({ ...sample('start'), originIndex: 0 });
    h.records[0].binding.onSample({ ...sample('move'), originIndex: null });
    expect(h.samples.map((s) => s.phase)).toEqual(['start', 'cancel']);
    expect(h.samples.at(-1)).toEqual({ phase: 'cancel', reason: 'host-cancel' });
    h.module.hooks.dispose?.();
  });
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
  it('does not enable input or reverse direction when optional sync keys are undefined', () => {
    const h = harness();
    h.callback(() =>
      h.input.sync({ disabled: undefined, reverse: undefined, direction: undefined })
    );
    h.module.hooks.onMountPhase?.('mounted', 1);
    expect(h.records[0].binding.config).toEqual({
      axis: 'horizontal',
      direction: 'ltr',
      disabled: true,
      readOnly: false,
      reverse: false,
      contactBasis: 'preserve-start',
      activation: 'immediate',
    });
    h.records[0].binding.onSample(sample('start'));
    expect(h.samples).toEqual([]);
    h.module.hooks.dispose?.();
  });
  it('invalidates the old stream when a start callback disposes its logical owner', () => {
    const h = harness();
    h.input.on((_run, event) => {
      if (event.phase === 'start') h.module.hooks.dispose?.();
    });
    h.mount();
    const binding = h.records[0].binding;
    binding.onSample(sample('start'));
    binding.onSample(sample('move'));
    binding.onSample(sample('end'));
    expect(h.samples.map((s) => s.phase)).toEqual(['start', 'cancel']);
    expect(h.records[0].disposed).toBe(true);
  });
});

// T-AXIS-INPUT-CONTACT-BASIS-0001-CASE-POLICY
describe('contact basis policy configuration', () => {
  it('defaults to preserve-start and preserves the policy through partial or undefined sync', () => {
    const h = harness();
    h.mount();
    expect(h.records[0].binding.config.contactBasis).toBe('preserve-start');
    h.callback(() => h.input.sync({ contactBasis: 'cancel-on-extent-change' }));
    expect(h.records[0].binding.config.contactBasis).toBe('cancel-on-extent-change');
    h.callback(() => h.input.sync({ reverse: true, contactBasis: undefined }));
    expect(h.records[0].binding.config.contactBasis).toBe('cancel-on-extent-change');
    h.callback(() => h.input.sync({ contactBasis: 'preserve-start' }));
    expect(h.records[0].binding.config.contactBasis).toBe('preserve-start');
    h.module.hooks.dispose?.();
  });
  it.each([null, '', 'unknown', 0])(
    'rejects invalid policy %s without changing the binding',
    (value) => {
      const h = harness();
      h.mount();
      const before = h.records[0].binding;
      expect(() => h.callback(() => h.input.sync({ contactBasis: value as any }))).toThrow(
        /contactBasis/
      );
      expect(h.records[0].binding).toBe(before);
      h.module.hooks.dispose?.();
    }
  );
});

// T-AXIS-INPUT-DIRECTIONAL-0001-CASE-COMPATIBILITY / TRAVEL / LIFETIME
// Nonbrowser module evidence only: no claim about native scrolling or paint.
describe('draft directional input ownership', () => {
  it('defaults to immediate, retains partial policy and rejects invalid updates atomically', () => {
    const h = harness();
    h.mount();
    expect(h.records[0].binding.config.activation).toBe('immediate');
    h.callback(() => h.input.sync({ activation: 'directional' }));
    const directional = h.records.at(-1)!;
    h.callback(() => h.input.sync({ activation: undefined, reverse: true }));
    expect(directional.binding.config.activation).toBe('directional');
    const before = directional.binding;
    h.callback(() => h.input.sync({ activation: 'directional' }));
    expect(directional.binding).toBe(before);
    for (const value of [null, '', 'unknown', 0]) {
      expect(() => h.callback(() => h.input.sync({ activation: value as any }))).toThrow(
        /activation/
      );
      expect(directional.binding).toBe(before);
    }
    h.callback(() => h.input.sync({ activation: 'immediate' }));
    expect(h.records.at(-1)!.binding.config.activation).toBe('immediate');
    h.module.hooks.dispose?.();
  });
  it.each([false, true])(
    'invalidates same-target domain reassociation with travel=%s',
    (travel) => {
      const h = harness(true, travel);
      h.callback(() => h.input.sync({ activation: 'directional' }));
      h.mount();
      const old = h.records[0];
      old.binding.onSample(sample('start'));
      h.reassociate();
      // Notification can arrive after an already queued native sample.
      old.binding.onSample(sample('end'));
      expect(old.disposed).toBe(true);
      expect(h.samples.map((s) => s.phase)).toEqual(['start', 'cancel']);
      h.notify();
      old.binding.onSample(sample('end'));
      expect(h.records).toHaveLength(2);
      expect(h.samples).toHaveLength(2);
      h.module.hooks.dispose?.();
    }
  );
  it('rejects a delayed end after same-claim target replacement before notification', () => {
    const h = harness();
    h.callback(() => h.input.sync({ activation: 'directional' }));
    h.mount();
    const old = h.records[0];
    old.binding.onSample(sample('start'));
    h.replaceSilently();
    old.binding.onSample(sample('end'));
    expect(old.disposed).toBe(true);
    expect(h.samples.map((s) => s.phase)).toEqual(['start', 'cancel']);
    h.module.hooks.dispose?.();
  });
  it('invalidates a replaced claim even when instance and host target are reused', () => {
    const h = harness();
    h.callback(() => h.input.sync({ activation: 'directional' }));
    h.mount();
    const old = h.records[0];
    old.binding.onSample(sample('start'));
    h.replaceClaim();
    h.notify();
    old.binding.onSample(sample('end'));
    expect(old.disposed).toBe(true);
    expect(h.samples.map((s) => s.phase)).toEqual(['start', 'cancel']);
    h.module.hooks.dispose?.();
  });
  it('uses exactly one same-owner travel target and refuses missing, duplicate or foreign geometry', () => {
    const h = harness(true, true);
    h.mount();
    expect(h.records[0].binding.travelTarget).toBe(h.travelTarget);
    for (const count of [0, 2]) {
      h.setTravelCount(count);
      h.notify();
      expect(h.records.at(-1)!.disposed).toBe(true);
      const length = h.records.length;
      h.notify();
      expect(h.records).toHaveLength(length);
      h.setTravelCount(1);
      h.notify();
      expect(h.records.at(-1)!.disposed).toBe(false);
    }
    h.setForeign(true);
    h.notify();
    expect(h.records.at(-1)!.disposed).toBe(true);
    h.module.hooks.dispose?.();
  });
});
