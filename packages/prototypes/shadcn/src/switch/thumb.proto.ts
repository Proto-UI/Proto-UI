import { definePrototype, tw, type AnatomyPartView, type RunHandle } from '@proto.ui/core';
import { asSwitchThumb, SWITCH_FAMILY } from '@proto.ui/prototypes-base/switch';
import { SWITCH_VISUAL, normalizeSwitchSize } from './visual';
import type { ShadcnSwitchThumbExposes, ShadcnSwitchThumbProps } from './types';

const THUMB_TOKENS = [
  'pointer-events-none',
  'block',
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
    // P-SHADCN-SWITCH-THUMB-VISUAL-SIZE: Context invalidates; actual Root decides.
    const size = def.state.enum('switchVisualSize', 'default', { options: ['default', 'sm'] });
    let mounted = false;
    let rootAvailable = false;
    const syncParts = (parts: readonly AnatomyPartView[]) => {
      rootAvailable = parts.length === 1;
      const readSize = parts[0]?.getExpose('getVisualSize');
      size.set(
        normalizeSwitchSize(typeof readSize === 'function' ? readSize() : undefined),
        'reason: shadcn switch Thumb actual Root visual size'
      );
    };
    const syncCurrentRoot = (run: RunHandle<ShadcnSwitchThumbProps>) => {
      if (mounted && rootAvailable) syncParts(run.anatomy.partsOf(SWITCH_FAMILY, 'root'));
    };
    def.anatomy.subscribeParts(SWITCH_FAMILY, 'root', (_run, parts) => {
      // Structural revocation supplies [] without weakening strict author queries.
      if (mounted) syncParts(parts);
    });
    def.context.trySubscribe(SWITCH_VISUAL, syncCurrentRoot);
    def.lifecycle.onMounted((run) => {
      mounted = true;
      syncParts(run.anatomy.partsOf(SWITCH_FAMILY, 'root'));
    });
    def.lifecycle.onUpdated(syncCurrentRoot);
    def.lifecycle.onUnmounted(() => {
      mounted = false;
      rootAvailable = false;
      size.set('default', 'reason: shadcn switch Thumb visual detach');
    });
    def.rule({
      when: (w) => w.state(size).eq('default'),
      intent: (i) => i.feedback.style.use(tw('size-4')),
    });
    def.rule({
      when: (w) => w.state(size).eq('sm'),
      intent: (i) => i.feedback.style.use(tw('size-3')),
    });
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
