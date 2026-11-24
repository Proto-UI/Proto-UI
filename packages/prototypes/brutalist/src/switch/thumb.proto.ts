import { definePrototype, tw, type AnatomyPartView, type RunHandle } from '@proto.ui/core';
import { asSwitchThumb, SWITCH_FAMILY } from '@proto.ui/prototypes-base/switch';
import type { BrutalistSwitchThumbExposes, BrutalistSwitchThumbProps } from './types';
import { BRUTALIST_SWITCH_VISUAL, normalizeBrutalistSwitchSize } from './visual';

// Source: switch.tsx@3306a802, 16px white disc and 20px checked travel.
// Physical placement keeps identical 6px end insets even in an RTL parent;
// only Thumb transform moves, and the containing Root never shifts padding.
const THUMB_TOKENS = [
  'pointer-events-none',
  'absolute',
  'left-1',
  'top-1/2',
  '-translate-y-1/2',
  'block',
  'size-4',
  'rounded-full',
  'border-2',
  'border-black',
  'bg-white',
  'translate-x-0',
].join(' ');

const switchThumb = definePrototype<BrutalistSwitchThumbProps, BrutalistSwitchThumbExposes>({
  // P-BRUTALIST-SWITCH-THUMB-ENTRY
  name: 'brutalist-switch-thumb',
  setup(def) {
    // P-BRUTALIST-SWITCH-THUMB-BASE-INHERITANCE
    const inherited = asSwitchThumb();
    const switchState = inherited.stateHandles;
    if (!switchState) {
      throw new Error(
        '[brutalist-switch-thumb] asSwitchThumb must project Switch thumb state handles.'
      );
    }
    // Base Switch thumb only projects checked/disabled. Press feedback remains on Root.
    const { checked } = switchState;
    const size = def.state.enum('switchVisualSize', 'default', { options: ['default', 'sm'] });
    let mounted = false;
    let rootAvailable = false;
    const syncParts = (parts: readonly AnatomyPartView[]) => {
      rootAvailable = parts.length === 1;
      const readSize = parts[0]?.getExpose('getVisualSize');
      size.set(
        normalizeBrutalistSwitchSize(typeof readSize === 'function' ? readSize() : undefined),
        'reason: brutalist switch Thumb actual Root visual size'
      );
    };
    const syncCurrentRoot = (run: RunHandle<BrutalistSwitchThumbProps>) => {
      if (mounted && rootAvailable) syncParts(run.anatomy.partsOf(SWITCH_FAMILY, 'root'));
    };
    def.anatomy.subscribeParts(SWITCH_FAMILY, 'root', (_run, parts) => {
      if (mounted) syncParts(parts);
    });
    def.context.trySubscribe(BRUTALIST_SWITCH_VISUAL, syncCurrentRoot);
    def.lifecycle.onMounted((run) => {
      mounted = true;
      syncParts(run.anatomy.partsOf(SWITCH_FAMILY, 'root'));
    });
    def.lifecycle.onUpdated(syncCurrentRoot);
    def.lifecycle.onUnmounted(() => {
      mounted = false;
      rootAvailable = false;
      size.set('default', 'reason: brutalist switch Thumb visual detach');
    });

    // P-BRUTALIST-SWITCH-THUMB-RESIDENT-MOTION: the draft family timing,
    // not an explicit duration in the upstream switch.tsx source.
    def.feedback.style.transition({
      properties: ['translate'],
      durationMs: 150,
      easing: [0.4, 0, 0.2, 1],
    });
    def.feedback.style.use(tw(THUMB_TOKENS));
    def.rule({
      when: (w) => w.state(size).eq('sm'),
      intent: (i) => i.feedback.style.use(tw('size-3')),
    });
    // P-BRUTALIST-SWITCH-THUMB-SINGLE-MOVEMENT — checked: one 20px transform delta (12px for sm).
    def.rule({
      when: (w) => w.state(checked).eq(true),
      intent: (i) => i.feedback.style.use(tw('translate-x-5')),
    });
    def.rule({
      when: (w) => w.all(w.state(checked).eq(true), w.state(size).eq('sm')),
      intent: (i) => i.feedback.style.use(tw('translate-x-3')),
    });
    return inherited.render;
  },
});

export default switchThumb;
