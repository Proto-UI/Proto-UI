import { definePrototype, tw } from '@proto.ui/core';
import { asSwitchThumb } from '@proto.ui/prototypes-base/switch';
import type { ShadcnSwitchThumbExposes, ShadcnSwitchThumbProps } from './types';

const THUMB_TOKENS = [
  'pointer-events-none',
  'block',
  'size-4',
  'rounded-full',
  'bg-background',
  'ring-0',
  'ring-offset-0',

  'translate-x-0',
].join(' ');

const switchThumb = definePrototype<ShadcnSwitchThumbProps, ShadcnSwitchThumbExposes>({
  name: 'shadcn-switch-thumb',
  setup(def) {
    // P-SHADCN-SWITCH-THUMB-BASE-INHERITANCE,
    // P-SHADCN-SWITCH-THUMB-CURRENT-BASE-DEVIATIONS,
    // P-SHADCN-SWITCH-THUMB-CONTEXT-INDICATOR
    const switchState = asSwitchThumb().stateHandles;
    if (!switchState) {
      throw new Error(
        '[shadcn-switch-thumb] asSwitchThumb must project Switch thumb state handles.'
      );
    }
    const { checked } = switchState;
    // P-SHADCN-SWITCH-THUMB-CURRENT-VISUAL-SURFACE
    def.feedback.style.transition({
      properties: ['translate'],
      durationMs: 150,
      easing: [0.4, 0, 0.2, 1],
    });
    def.feedback.style.use(tw(THUMB_TOKENS));
    def.rule({
      when: (w) => w.state(checked).eq(true),
      intent: (i) => i.feedback.style.use(tw('translate-x-[calc(100%_-_2px)]')),
    });
    def.rule({
      when: (w) => w.all(w.meta('colorScheme').eq('dark'), w.state(checked).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.meta('colorScheme').eq('dark'), w.state(checked).eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-primary-foreground')),
    });
  },
});

/**
 * P-SHADCN-SWITCH-THUMB-DIRECT-ENTRY exposes the current anatomy part.
 * P-SHADCN-SWITCH-THUMB-COMPATIBILITY-SUBSET keeps the upstream composition
 * and token differences outside the passing claim.
 */

export default switchThumb;
