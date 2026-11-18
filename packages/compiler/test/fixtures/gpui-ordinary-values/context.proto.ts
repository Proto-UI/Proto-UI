import { createAnatomyFamily, createContextKey, definePrototype } from '@proto.ui/core';
import { TABLE_STRUCTURE_FAMILY } from '@proto.ui/module-table-structure';

const KEY = createContextKey<{ value: number }>('private-collision-control');
const FAMILY = createAnatomyFamily('private-family', {
  roles: { root: { cardinality: { min: 1, max: 1 } }, item: { cardinality: { min: 0, max: '*' } } },
});

export const Provider = definePrototype({
  name: 'native-private-context-provider',
  setup(def) {
    def.context.provide(KEY, { value: 73 });
    def.anatomy.claim(FAMILY, { role: 'root' });
    def.anatomy.claim(TABLE_STRUCTURE_FAMILY, { role: 'root' });
    return (renderer) => renderer.el('section', renderer.slot());
  },
});

export default definePrototype({
  name: 'native-private-context-consumer',
  setup(def) {
    def.anatomy.claim(FAMILY, { role: 'item' });
    def.anatomy.claim(TABLE_STRUCTURE_FAMILY, { role: 'row' });
    const value = def.state.numberDiscrete('value', 0);
    def.context.trySubscribe(KEY);
    def.lifecycle.onCreated((run) => {
      value.set(run.context.tryRead(KEY)?.value ?? -1);
    });
    def.expose.state('value', value);
    return (renderer) => renderer.el('output', value.get());
  },
});
