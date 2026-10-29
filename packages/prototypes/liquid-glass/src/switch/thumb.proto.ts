import { definePrototype, tw } from '@proto.ui/core';
import { asSwitchThumb } from '@proto.ui/prototypes-base/switch';
import type { LiquidGlassSwitchThumbExposes, LiquidGlassSwitchThumbProps } from './types';

// Passive context-derived indicator: the sliding circle on the track. It owns
// no value, focus, event, input or material owner and mirrors the Root's
// published percentage (settled checked value or live directional preview)
// through the existing --pui-percentage expose projection.
export default definePrototype<LiquidGlassSwitchThumbProps, LiquidGlassSwitchThumbExposes>({
  name: 'liquid-glass-switch-thumb',
  setup(def) {
    const inherited = asSwitchThumb();
    const state = inherited.stateHandles;
    if (!state)
      throw new Error('[liquid-glass-switch-thumb] Base Switch Thumb states are required.');
    const { direction } = state;
    // size-6 (1.5rem) thumb inside the h-7 (1.75rem) track with p-0.5 (0.125rem)
    // track padding: offset = padding + (track width - 2*padding - thumb) * p/100.
    def.feedback.style.use(
      tw(
        'absolute left-[calc(0.125rem_+_(100%_-_1.75rem)_*_var(--pui-percentage)_/_100)] top-1/2 block size-6 -translate-y-1/2 rounded-full border border-border bg-primary-foreground shadow-sm pointer-events-none'
      )
    );
    def.rule({
      when: (w) => w.state(direction).eq('rtl'),
      intent: (i) =>
        i.feedback.style.use(
          tw('left-auto right-[calc(0.125rem_+_(100%_-_1.75rem)_*_var(--pui-percentage)_/_100)]')
        ),
    });
    return inherited.render;
  },
});
