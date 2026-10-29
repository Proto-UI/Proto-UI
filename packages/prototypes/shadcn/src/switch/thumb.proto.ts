import { definePrototype, tw, type AnatomyPartView, type RunHandle } from '@proto.ui/core';
import { asSwitchThumb, SWITCH_FAMILY } from '@proto.ui/prototypes-base/switch';
import { SHADCN_STYLE_IDS, type ShadcnStyleId } from '../style-scope';
import { SWITCH_VISUAL, normalizeSwitchSize } from './visual';
import type { ShadcnSwitchThumbExposes, ShadcnSwitchThumbProps } from './types';

// `.cn-switch-thumb` in the eight pinned style sheets. Flat profile-size keys
// keep the finite source vocabulary reachable to the public token extractor.
const THUMB_SIZE: Readonly<Record<`${ShadcnStyleId}-${'default' | 'sm'}`, string>> = {
  'new-york-v4-default': 'size-4',
  'new-york-v4-sm': 'size-3',
  'vega-default': 'size-4',
  'vega-sm': 'size-3',
  'nova-default': 'size-4',
  'nova-sm': 'size-3',
  'maia-default': 'size-4',
  'maia-sm': 'size-3',
  'lyra-default': 'size-4',
  'lyra-sm': 'size-3',
  'mira-default': 'size-3.5',
  'mira-sm': 'size-3',
  'luma-default': 'h-4 w-6',
  'luma-sm': 'h-3 w-4',
  'sera-default': 'size-3.5',
  'sera-sm': 'size-2.5',
  'rhea-default': 'size-4',
  'rhea-sm': 'size-3',
};
const THUMB_SURFACE: Readonly<Record<ShadcnStyleId, string>> = {
  'new-york-v4': 'rounded-full',
  vega: 'rounded-full',
  nova: 'rounded-full',
  maia: 'rounded-full',
  lyra: 'rounded-full',
  mira: 'rounded-full',
  luma: 'rounded-full shadow-sm',
  // Sera's recipe has no corner radius; explicitly clear the retained baseline.
  sera: 'rounded-none',
  rhea: 'rounded-[var(--pui-radius-2xl)] shadow-sm',
};
const THUMB_CHECKED_TRANSLATE: Readonly<Record<ShadcnStyleId, string>> = {
  'new-york-v4': 'translate-x-[calc(100%_-_2px)]',
  vega: 'translate-x-[calc(100%_-_2px)]',
  nova: 'translate-x-[calc(100%_-_2px)]',
  maia: 'translate-x-[calc(100%_-_2px)]',
  lyra: 'translate-x-[calc(100%_-_2px)]',
  mira: 'translate-x-[calc(100%_-_2px)]',
  luma: 'translate-x-[calc(100%_-_8px)]',
  sera: 'translate-x-[calc(100%_+_2px)]',
  rhea: 'translate-x-[calc(100%_-_4px)]',
};

const switchThumb = definePrototype<ShadcnSwitchThumbProps, ShadcnSwitchThumbExposes>({
  name: 'shadcn-switch-thumb',
  setup(def) {
    // P-SHADCN-SWITCH-THUMB-BASE-INHERITANCE: exactly one borrowed Base indicator.
    const switchState = asSwitchThumb().stateHandles;
    if (!switchState) {
      throw new Error(
        '[shadcn-switch-thumb] asSwitchThumb must project Switch thumb state handles.'
      );
    }
    const { checked } = switchState;
    // Context invalidates, but only this Thumb's actual Switch-domain Root
    // decides style and size. No second style selector or value owner is added.
    const size = def.state.enum('switchVisualSize', 'default', { options: ['default', 'sm'] });
    const style = def.state.enum('switchVisualStyle', 'new-york-v4', {
      options: SHADCN_STYLE_IDS,
    });
    let mounted = false;
    let rootAvailable = false;
    const syncParts = (parts: readonly AnatomyPartView[]) => {
      rootAvailable = parts.length === 1;
      const readSize = parts[0]?.getExpose('getVisualSize');
      const readStyle = parts[0]?.getExpose('getVisualStyle');
      const nextStyle = typeof readStyle === 'function' ? readStyle() : 'new-york-v4';
      if (!SHADCN_STYLE_IDS.includes(nextStyle as ShadcnStyleId))
        throw new Error('[shadcn-switch-thumb] Unsupported actual Root style');
      style.set(nextStyle as ShadcnStyleId, 'reason: Switch Thumb actual Root style');
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
      style.set('new-york-v4', 'reason: Switch Thumb visual detach');
    });
    def.feedback.style.use(
      tw(
        'pointer-events-none block bg-background ring-0 ring-offset-0 transition-transform duration-150 ease-in-out'
      )
    );
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) => i.feedback.style.use(tw(THUMB_SURFACE[profile])),
      });
      for (const named of ['default', 'sm'] as const) {
        def.rule({
          when: (w) => w.all(w.state(style).eq(profile), w.state(size).eq(named)),
          intent: (i) => i.feedback.style.use(tw(THUMB_SIZE[`${profile}-${named}`])),
        });
      }
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.state(checked).eq(false)),
        intent: (i) =>
          i.feedback.style.use(profile === 'sera' ? tw('translate-x-0.25') : tw('translate-x-0')),
      });
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.state(checked).eq(true)),
        intent: (i) => i.feedback.style.use(tw(THUMB_CHECKED_TRANSLATE[profile])),
      });
    }
    for (const profile of ['luma', 'rhea'] as const) {
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.not(w.meta('colorScheme').eq('dark'))),
        intent: (i) => i.feedback.style.use(tw('bg-clip-padding')),
      });
    }
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

export default switchThumb;
