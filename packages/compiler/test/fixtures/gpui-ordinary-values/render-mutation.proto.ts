import { definePrototype } from '@proto.ui/core';

export default definePrototype<{ tick: number }>({
  name: 'native-late-render-mutation',
  setup(def) {
    def.props.define({ tick: { type: 'number', default: 0 } });
    def.props.watch(['tick'], (run) => run.update());
    const box = { invoke: () => 1 };
    def.expose.method('replace', () => {
      box.invoke = () => 9;
    });
    return (r) => r.el('output', box.invoke());
  },
});
