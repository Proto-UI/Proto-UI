import { expect, it } from 'vitest';
import {
  defineHook,
  defineAsHook,
  definePrototype,
  type AsHookResult,
  type OwnedStateHandle,
} from '@proto.ui/core';
import { executeWithHost, type RuntimeHost } from '../../runtime/src';

type Flag = { state: { flag: OwnedStateHandle<boolean> } };
const host: RuntimeHost<{}> = {
  prototypeName: 'options-runtime-reference',
  getRawProps: () => ({}),
  commit(_children, signal) {
    signal?.done();
  },
  schedule() {},
  onUnmountBegin() {},
};

it.each(['direct', 'factory'] as const)(
  'captures actual setup contributions from %s callable options',
  async (route) => {
    let capture: AsHookResult<{}, Flag> | undefined;
    const install = defineHook<{}, {}, Flag, { init: () => void }>({
      name: 'options',
      setup(_def, options) {
        options.init();
      },
    });
    const prototype = definePrototype({
      name: host.prototypeName,
      setup(def) {
        const init = () => {
          const flag = def.state.bool('flag', true);
          def.expose.method('readFlag', () => flag.get());
        };
        const make = (callback: () => void) => ({ init: () => callback() });
        const alias = make;
        capture = install(route === 'direct' ? { init } : alias(init));
      },
    });
    const runtime = executeWithHost(prototype, host);
    try {
      expect(capture?.getState?.('flag')?.get()).toBe(true);
      expect((capture?.getMethod?.('readFlag') as () => boolean)()).toBe(true);
    } finally {
      await runtime.session.dispose();
    }
  }
);

it('keeps multiple option-created states local to each capture', async () => {
  type Pair = { state: { first: OwnedStateHandle<boolean>; second: OwnedStateHandle<number> } };
  let first: AsHookResult<{}, Pair> | undefined, second: AsHookResult<{}, Pair> | undefined;
  const install = defineHook<{}, {}, Pair, { init: () => void }>({
    name: 'multiple-options',
    mode: 'multiple',
    setup(_def, options) {
      options.init();
    },
  });
  const prototype = definePrototype({
    name: host.prototypeName,
    setup(def) {
      first = install({
        init: () => {
          def.state.bool('first', true);
        },
      });
      second = install({
        init: () => {
          def.state.numberDiscrete('second', 2);
        },
      });
    },
  });
  const runtime = executeWithHost(prototype, host);
  try {
    expect(first?.getState?.('first')?.get()).toBe(true);
    expect(second?.getState?.('second')?.get()).toBe(2);
    expect(first?.getState?.('second')).toBeUndefined();
    expect(second?.getState?.('first')).toBeUndefined();
  } finally {
    await runtime.session.dispose();
  }
});

it('retains option-invoked child captures separately from their parent', async () => {
  const inner = defineAsHook<{}, {}, Flag>({
    name: 'inner',
    setup(def) {
      def.state.bool('flag', true);
    },
  });
  type Outer = Flag & { asHooks: { inner: AsHookResult<{}, Flag> } };
  let capture: AsHookResult<{}, Outer> | undefined;
  const outer = defineHook<{}, {}, Outer, { init: () => void }>({
    name: 'outer',
    setup(_def, options) {
      options.init();
    },
  });
  const prototype = definePrototype({
    name: host.prototypeName,
    setup() {
      capture = outer({
        init: () => {
          inner();
        },
      });
    },
  });
  const runtime = executeWithHost(prototype, host);
  try {
    expect(capture?.getState?.('flag')).toBeUndefined();
    expect(capture?.getAsHookHandle?.('inner')?.getState?.('flag')?.get()).toBe(true);
  } finally {
    await runtime.session.dispose();
  }
});
