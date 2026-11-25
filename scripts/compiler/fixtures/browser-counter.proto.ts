import { definePrototype } from '@proto.ui/core';

export default definePrototype({
  name: 'browser-native-counter',
  setup(def) {
    const count = def.state.numberDiscrete('count', 0);
    def.event.on('host:click', () => {
      count.set(count.get() + 1);
    });
    def.event.on('key.up', (run) => {
      run.update();
    });
    return (renderer) => renderer.el('button', count.get());
  },
});
