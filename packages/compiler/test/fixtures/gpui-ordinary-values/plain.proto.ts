import { definePrototype, delay } from '@proto.ui/core';
import { asFocusEntry, asOverlay } from '@proto.ui/hooks';
export default definePrototype({
  name: 'native-no-capabilities',
  setup(def) {
    let observedCalls = 0;
    const ignore = (callback: () => void) => {
      observedCalls++;
    };
    ignore(() => {
      asFocusEntry();
    });
    const box = {
      tag: 7,
      unused: () => {
        asOverlay();
        delay(0, () => {});
      },
    };
    const untouched = () => asFocusEntry();
    const alternate = () => asFocusEntry();
    def.expose.value('demand', {
      observedCalls,
      tag: box.tag,
      same: untouched === untouched,
      distinct: untouched !== alternate,
    });
    return (renderer) => renderer.el('div', 'plain');
  },
});

export const Duplicate = definePrototype({
  name: 'native-duplicate-expose-control',
  setup(def) {
    def.expose.value('same', 1);
    def.expose.value('same', 2);
    return (renderer) => renderer.el('div');
  },
});

export const CreatedFailure = definePrototype({
  name: 'native-created-failure-control',
  setup(def) {
    def.state.numberDiscrete('temporary', 0);
    def.lifecycle.onCreated(() => {
      throw 0;
    });
    return (renderer) => renderer.el('div');
  },
});
