import { describe, expect, it } from 'vitest';
import {
  createAnatomyFamily,
  type AnatomyPartView,
  type ContextMenuInputIntent,
  type RunHandle,
} from '@proto.ui/core';
import type { AnatomyPort } from '@proto.ui/module-anatomy';
import { CapsVault, SYS_CAP, type SystemCaps } from '@proto.ui/module-base';
import { ContextMenuInputModuleImpl } from '../src/context-menu-input';
import {
  CONTEXT_MENU_INPUT_HOST_CAP,
  CONTEXT_MENU_INPUT_RUN_IN_CALLBACK_CAP,
  type ContextMenuInputHostBinding,
} from '../src/caps';
function harness(withHost = true) {
  let phase: 'setup' | 'callback' = 'setup';
  const run = {} as RunHandle<any>;
  const callback = (fn: () => void) => {
    const old = phase;
    phase = 'callback';
    try {
      fn();
    } finally {
      phase = old;
    }
  };
  const sys = {
    ensureSetup() {
      if (phase !== 'setup') throw Error('setup');
    },
    ensureCallback() {
      if (phase !== 'callback') throw Error('callback');
    },
    isDisposed: () => false,
    getCallbackCtx: () => (phase === 'callback' ? run : undefined),
  } as unknown as SystemCaps;
  const caps = new CapsVault();
  caps.attachBase([[SYS_CAP, sys]]);
  const records: { binding: ContextMenuInputHostBinding; disposed: boolean; disabled: boolean }[] =
    [];
  const host = {
    attach(binding: ContextMenuInputHostBinding) {
      const record = { binding, disposed: false, disabled: binding.disabled };
      records.push(record);
      return {
        update({ disabled }: { disabled: boolean }) {
          record.disabled = disabled;
        },
        dispose() {
          record.disposed = true;
        },
      };
    },
  };
  const attach = () =>
    caps.attach([
      [CONTEXT_MENU_INPUT_HOST_CAP, host],
      [CONTEXT_MENU_INPUT_RUN_IN_CALLBACK_CAP, callback],
    ]);
  if (withHost) attach();
  const family = createAnatomyFamily('context-input-fixture', {
    roles: {
      root: { cardinality: { min: 1, max: 1 } },
      trigger: { cardinality: { min: 0, max: '*' } },
    },
  });
  const self = {} as AnatomyPartView,
    other = {} as AnatomyPartView;
  let target: unknown = {};
  const watchers = new Set<() => void>();
  const subscribe = (_: unknown, fn: () => void) => {
    watchers.add(fn);
    return () => watchers.delete(fn);
  };
  const anatomy = {
    resolveSelfRole: () => 'trigger',
    resolveSelfInstance: () => self,
    resolvePartInstance: (part: AnatomyPartView) => part,
    resolvePartTarget: (part: AnatomyPartView) => (part === self ? target : { wrong: true }),
    order: { partsOf: () => [other, self] },
    subscribeOrder: subscribe,
    subscribeTargets: subscribe,
  } as unknown as AnatomyPort;
  const module = new ContextMenuInputModuleImpl(caps, anatomy);
  const input = module.declare();
  input.configure({ anatomy: family, inputRole: 'trigger' });
  const intents: ContextMenuInputIntent[] = [];
  input.on((receivedRun, intent) => {
    expect(receivedRun).toBe(run);
    intents.push(intent);
    return true;
  });
  return {
    module,
    input,
    records,
    intents,
    caps,
    attach,
    callback,
    watchers,
    replace(next: unknown) {
      target = next;
      watchers.forEach((fn) => fn());
    },
    mount() {
      callback(() => input.sync({ disabled: false }));
      module.onMountPhase('mounted', 1);
    },
  };
}
const intent = { origin: 'pointer', anchor: Object.freeze({}) } as ContextMenuInputIntent;
describe('ContextMenu input module lifetime', () => {
  it('resolves only its own part and routes accepted semantic intent through callback scope', () => {
    const f = harness();
    f.mount();
    expect(f.records).toHaveLength(1);
    expect(f.records[0].binding.target).not.toEqual({ wrong: true });
    expect(f.records[0].binding.onIntent(intent)).toBe(true);
    expect(f.intents).toEqual([intent]);
    expect(() => f.input.sync({ disabled: true })).toThrow('callback');
    f.callback(() => f.input.sync({ disabled: true }));
    expect(f.records[0].disabled).toBe(true);
    expect(f.records[0].binding.onIntent(intent)).toBe(false);
    f.module.dispose();
  });
  it('invalidates stale target/caps/unmount callbacks, remounts and disposes terminally', () => {
    const f = harness();
    f.mount();
    const old = f.records[0];
    f.replace({});
    expect(old.disposed).toBe(true);
    expect(old.binding.onIntent(intent)).toBe(false);
    f.module.onMountPhase('detached', 1);
    expect(f.records[1].disposed).toBe(true);
    f.module.onMountPhase('mounted', 2);
    expect(f.records).toHaveLength(3);
    f.caps.resetAttached();
    expect(f.records[2].disposed).toBe(true);
    f.attach();
    expect(f.records).toHaveLength(4);
    expect(f.records[3].binding.onIntent(intent)).toBe(true);
    f.module.dispose();
    f.attach();
    f.module.onMountPhase('mounted', 3);
    expect(f.records).toHaveLength(4);
    expect(f.watchers.size).toBe(0);
    expect(f.records[3].binding.onIntent(intent)).toBe(false);
  });
  it('retains declarations without a host and cannot attach after disposal', () => {
    const f = harness(false);
    f.mount();
    expect(f.records).toHaveLength(0);
    f.attach();
    expect(f.records).toHaveLength(1);
    f.module.dispose();
    f.replace({});
    expect(f.records).toHaveLength(1);
  });
});
