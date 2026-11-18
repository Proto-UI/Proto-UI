import { definePrototype } from '@proto.ui/core';

export default definePrototype({
  name: 'projected-record-mutation',
  setup(def) {
    const record = { action: () => 7 };
    def.expose.method('getRecord', () => record);
    def.expose.method('replaceRecord', (value: { action: () => number }) => {
      value.action = () => 9;
      return value;
    });
    return (r) => r.el('div', []);
  },
});
