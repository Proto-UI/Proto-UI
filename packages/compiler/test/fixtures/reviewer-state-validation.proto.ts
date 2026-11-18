import { definePrototype } from '@proto.ui/core';

export default definePrototype({
  name: 'state-validation-boundary',
  setup(def) {
    const value = def.state.numberRange('value', 0, { min: 0, max: 1 });
    def.expose.method('attempt', () => {
      try {
        value.set(2);
        return false;
      } catch {
        return true;
      }
    });
    def.expose.method('invalid', () => value.set(2));
    def.expose.method('read', () => value.get());
    def.expose.method('valid', () => {
      value.set(1);
      return value.get();
    });
    return (r) => r.el('div', []);
  },
});
