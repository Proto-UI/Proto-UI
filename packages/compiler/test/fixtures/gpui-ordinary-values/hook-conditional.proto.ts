import { defineHook, definePrototype } from '@proto.ui/core';

const once = defineHook<{}, {}, {}, { init: () => void }>({
  name: 'conditional-once',
  setup(_def, options) {
    options.init();
  },
});
const multiple = defineHook<{}, {}, {}, { init: () => void }>({
  name: 'conditional-multiple',
  mode: 'multiple',
  setup(_def, options) {
    options.init();
  },
});

export default definePrototype({
  name: 'native-conditional-once',
  setup(def) {
    let count = 0;
    const choice = def.state.bool('choice', false);
    if (choice.get()) once({ init: () => {} });
    once({
      init: () => {
        count = 1;
      },
    });
    def.expose.method('read', () => count);
    return (r) => r.el('div', []);
  },
});

export const Taken = definePrototype({
  name: 'native-conditional-once-taken',
  setup(def) {
    let count = 0;
    const choice = def.state.bool('choice', true);
    if (choice.get()) once({ init: () => {} });
    once({
      init: () => {
        count = 1;
      },
    });
    def.expose.method('read', () => count);
    return (r) => r.el('div', []);
  },
});

export const Multiple = definePrototype({
  name: 'native-conditional-multiple',
  setup(def) {
    let count = 0;
    const choice = def.state.bool('choice', true);
    if (choice.get()) multiple({ init: () => {} });
    multiple({
      init: () => {
        count = 1;
      },
    });
    def.expose.method('read', () => count);
    return (r) => r.el('div', []);
  },
});
