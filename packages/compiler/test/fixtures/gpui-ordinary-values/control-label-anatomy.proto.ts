import { createAnatomyFamily, definePrototype } from '@proto.ui/core';
import { asControlLabel } from '@proto.ui/hooks';

const family = createAnatomyFamily('native-label-negative', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    caption: { cardinality: { min: 1, max: 1 } },
    control: { cardinality: { min: 1, max: 1 } },
  },
  relations: [
    { kind: 'contains', parent: 'root', child: 'caption' },
    { kind: 'contains', parent: 'root', child: 'control' },
  ],
});
export default definePrototype({
  name: 'native-label-anatomy-negative',
  setup() {
    asControlLabel().label({ family, labelRole: 'caption', targetRole: 'control' });
    return (renderer) => renderer.slot();
  },
});
