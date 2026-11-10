import { definePrototype } from '@proto.ui/core';

export default definePrototype({
  name: 'private-lexical-values',
  setup(def) {
    let armed = false;
    let count = 1;
    let label = 'ready';
    const snapshot = count;
    const change = () => {
      count = 20;
      return 2;
    };
    def.expose.method('arm', () => { armed = true; });
    def.expose.method('consume', () => {
      if (!armed) return;
      armed = false;
      count += change();
      label = 'used';
    });
    def.expose.method('read', () => count);
    def.expose.method('snapshot', () => snapshot);
    def.expose.method('post', () => count++);
    def.expose.method('pre', () => ++count);
    return (renderer) => renderer.el('output', label);
  },
});
