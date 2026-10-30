import { definePrototype, tw, type AnatomyPartView, type RunHandle } from '@proto.ui/core';
import { asSwitchThumb, SWITCH_FAMILY } from '@proto.ui/prototypes-base/switch';
import { SWITCH_VISUAL, normalizeSwitchSize } from './visual';
import type { ShadcnSwitchThumbExposes, ShadcnSwitchThumbProps } from './types';

const THUMB_TOKENS = [
  'pointer-events-none',
  'block',
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
    const { checked, draggable, dragging, direction } = switchState;
    // P-SHADCN-SWITCH-THUMB-VISUAL-SIZE: Context invalidates; actual Root decides.
    const size = def.state.enum('switchVisualSize', 'default', { options: ['default', 'sm'] });
    const style = def.state.enum('switchVisualStyle', 'new-york-v4', {
      options: ['new-york-v4', 'rhea'],
    });
    let mounted = false;
    let rootAvailable = false;
    const syncParts = (parts: readonly AnatomyPartView[]) => {
      rootAvailable = parts.length === 1;
      const readSize = parts[0]?.getExpose('getVisualSize');
      const readStyle = parts[0]?.getExpose('getVisualStyle');
      const nextStyle = typeof readStyle === 'function' ? readStyle() : 'new-york-v4';
      if (nextStyle !== 'new-york-v4' && nextStyle !== 'rhea')
        throw new Error('[shadcn-switch-thumb] Unsupported actual Root style');
      style.set(nextStyle, 'reason: Switch Thumb actual Root style');
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
    def.rule({
      when: (w) => w.state(size).eq('default'),
      intent: (i) => i.feedback.style.use(tw('size-4')),
    });
    def.rule({
      when: (w) => w.state(size).eq('sm'),
      intent: (i) => i.feedback.style.use(tw('size-3')),
    });
    // P-SHADCN-SWITCH-THUMB-CURRENT-VISUAL-SURFACE
    def.feedback.style.use(tw('transition-transform duration-150 ease-in-out'));
    def.rule({
      when: (w) => w.state(style).eq('new-york-v4'),
      intent: (i) => i.feedback.style.use(tw('rounded-full')),
    });
    def.rule({
      when: (w) => w.state(style).eq('rhea'),
      intent: (i) => i.feedback.style.use(tw('rounded-[var(--pui-radius-2xl)] shadow-sm')),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq('rhea'), w.not(w.meta('colorScheme').eq('dark'))),
      intent: (i) => i.feedback.style.use(tw('bg-clip-padding')),
    });
    def.feedback.style.use(tw(THUMB_TOKENS));
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.state(checked).eq(true),
          w.state(draggable).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('translate-x-[calc(100%_-_2px)]')),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(style).eq('rhea'), w.state(checked).eq(true), w.state(draggable).eq(false)),
      intent: (i) => i.feedback.style.use(tw('translate-x-[calc(100%_-_4px)]')),
    });
    // P-SHADCN-SWITCH-THUMB-DIRECTIONAL-PREVIEW: the existing exposed
    // number.range projects --pui-percentage; no DOM read or state writer.
    // Keep literal tokens visible to the source-derived preset generator.
    def.rule({
      when: (w) =>
        w.all(
          w.state(draggable).eq(true),
          w.state(style).eq('new-york-v4'),
          w.state(direction).eq('ltr')
        ),
      intent: (i) =>
        i.feedback.style.use(tw('translate-x-[calc((100%_-_2px)*var(--pui-percentage)/100)]')),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(draggable).eq(true), w.state(style).eq('rhea'), w.state(direction).eq('ltr')),
      intent: (i) =>
        i.feedback.style.use(tw('translate-x-[calc((100%_-_4px)*var(--pui-percentage)/100)]')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(draggable).eq(true),
          w.state(style).eq('new-york-v4'),
          w.state(direction).eq('rtl')
        ),
      intent: (i) =>
        i.feedback.style.use(tw('translate-x-[calc((2px_-_100%)*var(--pui-percentage)/100)]')),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(draggable).eq(true), w.state(style).eq('rhea'), w.state(direction).eq('rtl')),
      intent: (i) =>
        i.feedback.style.use(tw('translate-x-[calc((4px_-_100%)*var(--pui-percentage)/100)]')),
    });
    // Direct manipulation follows its owner without a trailing CSS animation.
    // Withdrawal restores the source transition for settled value changes.
    def.rule({
      when: (w) => w.state(dragging).eq(true),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.any(w.state(style).eq('new-york-v4'), w.state(style).eq('rhea')),
          w.meta('colorScheme').eq('dark'),
          w.state(checked).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.any(w.state(style).eq('new-york-v4'), w.state(style).eq('rhea')),
          w.meta('colorScheme').eq('dark'),
          w.state(checked).eq(true)
        ),
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
