import { definePrototype } from '@proto.ui/core';
import { asSwitchRoot } from '@proto.ui/prototypes-base/switch';
import { setupLiquidSwitchRootVisual } from './root-visual';
import type { LiquidGlassSwitchRootExposes, LiquidGlassSwitchRootProps } from './types';

// Proto design-language Switch, not an Apple-native switch implementation.
// Base remains the sole owner of checked, drag preview, activation,
// cancellation, focus and disabled; this setup adds family paint only.
export default definePrototype<LiquidGlassSwitchRootProps, LiquidGlassSwitchRootExposes>({
  name: 'liquid-glass-switch-root',
  modules: asSwitchRoot.modules,
  setup(def) {
    const inherited = asSwitchRoot();
    const state = inherited.stateHandles;
    if (!state) throw new Error('[liquid-glass-switch-root] Base Switch states are required.');
    setupLiquidSwitchRootVisual(def, state);
    // The inherited render is preserved; the track does not paint a thumb.
    return inherited.render;
  },
});
