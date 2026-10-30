import type { ShadcnSelectSurfaceProps } from './types';
import { definePrototype } from '@proto.ui/core';
import { asSelectSurface } from '@proto.ui/prototypes-base/select';

import { setupSelectPaint } from './visual';

export default definePrototype<ShadcnSelectSurfaceProps>({
  name: 'shadcn-select-surface',
  setup(def) {
    const inherited = asSelectSurface();
    const backdrop = setupSelectPaint(def);
    return (r) => {
      const body = inherited.render?.(r) ?? r.r.slot();
      return [r.decoration(backdrop), ...(Array.isArray(body) ? body : [body])];
    };
  },
});
