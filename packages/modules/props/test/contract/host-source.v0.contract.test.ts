import { describe, expect, it } from 'vitest';
import { CapsVault } from '@proto.ui/module-base';

import { RAW_PROPS_SOURCE_CAP } from '../../src/caps';
import { createPropsModule } from '../../src/create';
import type { RawPropsSource } from '../../src/types';

type TestProps = {
  value?: number;
};

function createSource(initialValue: number) {
  let snapshot: Record<string, unknown> = { value: initialValue };
  const listeners = new Set<() => void>();
  let unsubscribeCount = 0;

  const source: RawPropsSource<TestProps> = {
    get: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        if (listeners.delete(listener)) unsubscribeCount += 1;
      };
    },
  };

  return {
    source,
    replace(nextValue: number) {
      snapshot = { value: nextValue };
    },
    invalidate() {
      for (const listener of Array.from(listeners)) listener();
    },
    get listenerCount() {
      return listeners.size;
    },
    get unsubscribeCount() {
      return unsubscribeCount;
    },
  };
}

function createModule(vault: CapsVault) {
  return createPropsModule<TestProps>({
    init: {
      prototypeName: 'props-host-source-test',
      declarations: [],
    },
    caps: vault,
    deps: {
      requireFacade() {
        throw new Error('Props has no module dependencies.');
      },
      requirePort() {
        throw new Error('Props has no module dependencies.');
      },
      tryFacade() {
        throw new Error('Props has no module dependencies.');
      },
      tryPort() {
        throw new Error('Props has no module dependencies.');
      },
    },
  });
}

describe('props: host source boundary', () => {
  it('keeps author facade separate from the privileged runtime port', () => {
    const module = createModule(new CapsVault());

    expect(Object.keys(module.facade).sort()).toEqual([
      'define',
      'get',
      'getRaw',
      'isProvided',
      'setDefaults',
      'watch',
      'watchAll',
      'watchRaw',
      'watchRawAll',
    ]);
    expect(Object.keys(module.port ?? {}).sort()).toEqual([
      'applyRaw',
      'consumeTasks',
      'getDiagnostics',
      'syncFromHost',
    ]);
    expect('syncFromHost' in module.facade).toBe(false);
    expect('consumeTasks' in module.facade).toBe(false);
  });

  it('treats source notifications as invalidation until the next runtime sync', () => {
    const vault = new CapsVault();
    const first = createSource(1);
    const module = createModule(vault);

    module.facade.define({ value: { type: 'number' } });
    vault.attach([[RAW_PROPS_SOURCE_CAP, first.source]]);
    module.port?.syncFromHost();

    expect(module.facade.get()).toEqual({ value: 1 });
    expect(first.listenerCount).toBe(1);

    first.replace(2);
    first.invalidate();

    expect(module.facade.get()).toEqual({ value: 1 });
    expect(module.port?.consumeTasks()).toEqual([]);

    module.port?.syncFromHost();
    expect(module.facade.get()).toEqual({ value: 2 });
  });

  it('unsubscribes the old source on replacement and the current source on disposal', () => {
    const vault = new CapsVault();
    const first = createSource(1);
    const second = createSource(2);
    const module = createModule(vault);

    module.facade.define({ value: { type: 'number' } });
    vault.attach([[RAW_PROPS_SOURCE_CAP, first.source]]);
    module.port?.syncFromHost();

    vault.attach([[RAW_PROPS_SOURCE_CAP, second.source]]);

    expect(first.listenerCount).toBe(0);
    expect(first.unsubscribeCount).toBe(1);
    expect(second.listenerCount).toBe(1);

    module.port?.syncFromHost();
    expect(module.facade.get()).toEqual({ value: 2 });

    module.hooks.dispose?.();

    expect(second.listenerCount).toBe(0);
    expect(second.unsubscribeCount).toBe(1);
  });
});
