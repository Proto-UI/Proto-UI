import { definePrototype } from '@proto.ui/core';

export default definePrototype({
  name: 'public-roundtrip-identity',
  setup(def) {
    const action = () => 7;
    const record = { action };
    def.expose.method('getRecord', () => record);
    def.expose.method('echoRecord', (value: { action: () => number }) => value);
    def.expose.method('getFunction', () => action);
    def.expose.method('echoFunction', (value: () => number) => value);
    return (r) => r.el('div', []);
  },
});
