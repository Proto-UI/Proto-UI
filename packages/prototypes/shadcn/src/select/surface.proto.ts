import type { ShadcnSelectSurfaceProps } from './types';
import { definePrototype } from '@proto.ui/core';
import { asSelectSurface } from '@proto.ui/prototypes-base/select';

import { setupSelectPaint } from './visual';

export default definePrototype<ShadcnSelectSurfaceProps>({
  name: 'shadcn-select-surface',
  setup(def) {
    asSelectSurface();
    const backdrop = setupSelectPaint(def);
    return (r) => [r.decoration(backdrop), r.r.slot()];
  },
});
