import { definePrototype } from '@proto.ui/core';

export function negate(value: number): number {
  return -value;
}

export default definePrototype<{ label: string }>({
  name: 'pinned-counter',
  setup(def) {
    def.props.define({ label: { type: 'string', default: 'Count:' } });
    const count = def.state.numberDiscrete('count', 0);
    def.event.on('host:click', () => {
      count.set(count.get() + 1);
    });
    return (render) => render.el('div', [render.read.props.get().label, count.get()]);
  },
});
