import {
  defineAsHook,
  defineHook,
  definePrototype,
  type AsHookResult,
  type OwnedStateHandle,
} from '@proto.ui/core';

const install = defineHook<
  {},
  {},
  { state: { flag: OwnedStateHandle<boolean> } },
  { init: () => void }
>({
  name: 'options-capture',
  setup(_def, options) {
    options.init();
  },
});

export default definePrototype({
  name: 'native-options-capture',
  setup(def) {
    const captured = install({
      init: () => {
        const flag = def.state.bool('flag', true);
        def.expose.method('readFlag', () => flag.get());
      },
    });
    const flag = captured.getState?.('flag');
    def.expose.value('flagValue', flag?.get());
    return (r) => r.el('div', []);
  },
});

export const Factory = definePrototype({
  name: 'native-options-capture-factory',
  setup(def) {
    const make = (callback: () => void) => ({ init: () => callback() });
    const alias = make;
    const options = alias(() => {
      const flag = def.state.bool('flag', true);
      def.expose.method('readFlag', () => flag.get());
    });
    const captured = install(options);
    const flag = captured.getState?.('flag');
    def.expose.value('flagValue', flag?.get());
    return (r) => r.el('div', []);
  },
});

const multiple = defineHook<
  {},
  {},
  { state: { first: OwnedStateHandle<boolean>; second: OwnedStateHandle<number> } },
  { init: () => void }
>({
  name: 'multiple-options',
  mode: 'multiple',
  setup(_def, options) {
    options.init();
  },
});

export const Multiple = definePrototype({
  name: 'native-multiple-options',
  setup(def) {
    const first = multiple({
      init: () => {
        def.state.bool('first', true);
      },
    });
    const second = multiple({
      init: () => {
        def.state.numberDiscrete('second', 2);
      },
    });
    def.expose.value('first', first.getState?.('first')?.get());
    def.expose.value('second', second.getState?.('second')?.get());
    def.expose.value('firstLeaksSecond', !!first.getState?.('second'));
    def.expose.value('secondLeaksFirst', !!second.getState?.('first'));
    return (r) => r.el('div', []);
  },
});

const inner = defineAsHook<{}, {}, { state: { flag: OwnedStateHandle<boolean> } }>({
  name: 'inner',
  setup(def) {
    def.state.bool('flag', true);
  },
});
const outer = defineHook<
  {},
  {},
  {
    state: { flag: OwnedStateHandle<boolean> };
    asHooks: { inner: AsHookResult<{}, { state: { flag: OwnedStateHandle<boolean> } }> };
  },
  { init: () => void }
>({
  name: 'outer-options',
  setup(_def, options) {
    options.init();
  },
});

export const Nested = definePrototype({
  name: 'native-nested-options',
  setup(def) {
    const captured = outer({
      init: () => {
        inner();
      },
    });
    const nested = captured.getAsHookHandle?.('inner');
    def.expose.value('outerLeaksState', !!captured.getState?.('flag'));
    def.expose.value('innerState', nested?.getState?.('flag')?.get());
    return (r) => r.el('div', []);
  },
});
