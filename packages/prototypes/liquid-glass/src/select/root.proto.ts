import { definePrototype, tw } from '@proto.ui/core';
import { asSelectRoot } from '@proto.ui/prototypes-base/select';
import type { LiquidGlassSelectRootProps, LiquidGlassSelectRootExposes } from './types';

export default definePrototype<LiquidGlassSelectRootProps, LiquidGlassSelectRootExposes>({
  name: 'liquid-glass-select-root',
  setup(def) {
    // Base alone owns open, selection, collection and controlled requests.
    asSelectRoot();
    def.feedback.style.use(tw('inline-flex min-w-0 max-w-full'));
  },
});
