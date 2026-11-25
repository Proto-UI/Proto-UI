import { definePrototype } from '@proto.ui/core';

// Explicit scalar-kernel fixture. The separate UI fixture requests a view update;
// that host operation must not be silently omitted to manufacture a kernel pass.
export function negate(value: number): number {
  return -value;
}

export default definePrototype({
  name: 'pinned-scalar-kernel',
  setup(def) {
    const count = def.state.numberDiscrete('count', 0);
    def.event.on('host:click', () => {
      count.set(count.get() + 1);
    });
    return (render) => render.el('div', count.get());
  },
});
