import { definePrototype } from '@proto.ui/core';
import { asTextControl } from '@proto.ui/hooks';
import { declareTextControl } from '@proto.ui/module-text-control';

export default definePrototype({
  name: 'native-text-reset-command',
  modules: [declareTextControl({ content: 'plain-text', lineMode: 'single', engine: 'host' })],
  setup(def) {
    def.props.define({ controlled: { type: 'boolean', default: false } });
    const text = asTextControl();
    def.lifecycle.onCreated((run) =>
      text.sync({
        valueMode: run.props.get().controlled ? 'controlled' : 'uncontrolled',
        value: 'truth',
        defaultValue: 'seed',
      })
    );
    def.expose.method('reset', (value?: string) => text.resetValue(value));
    def.expose.method('value', () => text.snapshot()?.value ?? '');
    def.expose.method('composing', () => text.snapshot()?.composing ?? false);
    def.expose.method('length', () => (text.snapshot()?.value ?? '').length);
    def.expose.method('math', (value: number) => {
      const rounded = Math.round(value);
      return { floor: Math.floor(value), round: rounded, negative: 1 / rounded < 0 };
    });
    def.expose.method('parse', (value: string) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? String(parsed) : 'invalid';
    });
    return (renderer) => renderer.slot();
  },
});
