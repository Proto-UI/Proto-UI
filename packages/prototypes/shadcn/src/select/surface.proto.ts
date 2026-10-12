import { definePrototype } from '@proto.ui/core';
import { asSelectSurface } from '@proto.ui/prototypes-base/select';
import { setupSelectPaint } from './visual';

export default definePrototype({
  name: 'shadcn-select-surface',
  setup(def) {
    asSelectSurface();
    setupSelectPaint(def);
  },
});
