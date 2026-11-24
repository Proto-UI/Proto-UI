import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { asToggleGroupItem, TOGGLE_GROUP_FAMILY } from '@proto.ui/prototypes-base/toggle-group';
import {
  SHADCN_STYLE_IDS,
  SHADCN_STYLE_SCOPE,
  setupShadcnStyleSelection,
  type ShadcnStyleId,
} from '../style-scope';
import {
  TOGGLE_COMMON,
  TOGGLE_PROFILE,
  TOGGLE_OUTLINE,
  TOGGLE_FOCUS,
  TOGGLE_SIZE,
} from '../toggle/profiles';
import { setupCollectionHover } from '../toolbar/action-visual';
import type { ShadcnToggleGroupItemProps, ShadcnToggleGroupItemExposes } from './types';
import { TOGGLE_GROUP_VISUAL_AXIS } from './visual';

function resolveToggleGroupItemSize(profile: ShadcnStyleId, size: 'default' | 'sm' | 'lg'): string {
  if (profile === 'new-york-v4' && size === 'default') return 'h-9 px-3';
  if (profile === 'nova' && size === 'sm')
    return 'h-7 min-w-7 rounded-[min(var(--pui-radius-md),12px)] px-2.5 text-[0.8rem]';
  if (profile === 'mira' && size === 'sm')
    return 'h-6 min-w-6 rounded-[min(var(--pui-radius-md),8px)] px-2 text-[0.625rem]';
  return TOGGLE_SIZE[`${profile}-${size}`];
}

const JOINED_ENDCAP_RADIUS: Record<
  ShadcnStyleId,
  { hFirst: string; hLast: string; vFirst: string; vLast: string } | null
> = {
  vega: {
    hFirst: 'rounded-l-md',
    hLast: 'rounded-r-md',
    vFirst: 'rounded-t-md',
    vLast: 'rounded-b-md',
  },
  mira: {
    hFirst: 'rounded-l-md',
    hLast: 'rounded-r-md',
    vFirst: 'rounded-t-md',
    vLast: 'rounded-b-md',
  },
  'new-york-v4': {
    hFirst: 'rounded-l-md',
    hLast: 'rounded-r-md',
    vFirst: 'rounded-t-md',
    vLast: 'rounded-b-md',
  },
  nova: {
    hFirst: 'rounded-l-lg',
    hLast: 'rounded-r-lg',
    vFirst: 'rounded-t-lg',
    vLast: 'rounded-b-lg',
  },
  rhea: {
    hFirst: 'rounded-l-[var(--pui-radius-2xl)]',
    hLast: 'rounded-r-[var(--pui-radius-2xl)]',
    vFirst: 'rounded-t-[var(--pui-radius-2xl)]',
    vLast: 'rounded-b-[var(--pui-radius-2xl)]',
  },
  luma: {
    hFirst: 'rounded-l-[var(--pui-radius-3xl)]',
    hLast: 'rounded-r-[var(--pui-radius-3xl)]',
    vFirst: 'rounded-t-[var(--pui-radius-3xl)]',
    vLast: 'rounded-b-[var(--pui-radius-3xl)]',
  },
  maia: {
    hFirst: 'rounded-l-[var(--pui-radius-4xl)]',
    hLast: 'rounded-r-[var(--pui-radius-4xl)]',
    vFirst: 'rounded-t-[var(--pui-radius-4xl)]',
    vLast: 'rounded-b-[var(--pui-radius-4xl)]',
  },
  lyra: null,
  sera: null,
};

/** Upstream ToggleGroupItem reuses toggleVariants; only that paint is shared.
 * asToggleGroupItem remains the sole Base hook, not asToggle or asButton.
 * Variant, size, and spacing flow from Root visual context (with item overrides).
 * Joined zero-spacing edge radii and collapsed seams use existing logical anatomy order.
 */
export default definePrototype<ShadcnToggleGroupItemProps, ShadcnToggleGroupItemExposes>({
  name: 'shadcn-toggle-group-item',
  modules: asToggleGroupItem.modules,
  setup(def) {
    def.props.define({
      variant: { type: 'enum', empty: 'fallback', options: ['default', 'outline'] },
      size: { type: 'enum', empty: 'fallback', options: ['default', 'sm', 'lg'] },
    });
    const behavior = asToggleGroupItem();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[shadcn-toggle-group] Item state unavailable.');
    const style = setupShadcnStyleSelection(def, 'nova');
    const hovered = setupCollectionHover(def, state.disabled);
    const first = def.state.bool('toggleGroupVisualFirst', false);
    const last = def.state.bool('toggleGroupVisualLast', false);
    const hasPrevious = def.state.bool('toggleGroupVisualPrevious', false);
    const axis = def.state.string('toggleGroupVisualAxis', 'horizontal');
    const resolvedVariant = def.state.string('toggleGroupVisualVariant', 'default');
    const resolvedSize = def.state.string('toggleGroupVisualSize', 'default');
    const joined = def.state.bool('toggleGroupVisualJoined', false);
    const syncOrder = (run: RunHandle<ShadcnToggleGroupItemProps>) => {
      const index = run.anatomy.order.indexOfSelf(TOGGLE_GROUP_FAMILY, 'item');
      first.set(index === 0, 'toggle group first logical item');
      last.set(
        index >= 0 && run.anatomy.order.nextOfSelf(TOGGLE_GROUP_FAMILY, 'item') === null,
        'toggle group last logical item'
      );
      hasPrevious.set(index > 0, 'toggle group preceding logical item');
    };
    def.anatomy.subscribeParts(TOGGLE_GROUP_FAMILY, 'item', (run, parts) => {
      if (parts.length) syncOrder(run);
      else {
        first.set(false, 'toggle group membership withdrawn');
        last.set(false, 'toggle group membership withdrawn');
        hasPrevious.set(false, 'toggle group membership withdrawn');
      }
    });
    def.lifecycle.onMounted(syncOrder);
    def.lifecycle.onUpdated(syncOrder);
    const syncVisual = (run: RunHandle<ShadcnToggleGroupItemProps>) => {
      const ctx = run.context.tryRead(TOGGLE_GROUP_VISUAL_AXIS);
      const props = run.props.get();
      axis.set(ctx?.orientation ?? 'horizontal', 'toggle group observed axis');
      resolvedVariant.set(
        props.variant ?? ctx?.variant ?? 'default',
        'toggle group observed variant'
      );
      resolvedSize.set(props.size ?? ctx?.size ?? 'default', 'toggle group observed size');
      const spacing = ctx?.spacing ?? (style.get() === 'new-york-v4' ? 0 : 2);
      joined.set(spacing === 0, 'toggle group observed spacing');
    };
    def.context.trySubscribe(TOGGLE_GROUP_VISUAL_AXIS, syncVisual);
    def.context.trySubscribe(SHADCN_STYLE_SCOPE, syncVisual);
    def.props.watch(['variant', 'size'], syncVisual);
    def.props.watchRaw(['styleProfile'], syncVisual);
    def.lifecycle.onCreated(syncVisual);
    def.lifecycle.onMounted(syncVisual);
    def.lifecycle.onUpdated(syncVisual);
    def.feedback.style.use(tw(TOGGLE_COMMON));
    def.feedback.style.use(tw('relative shrink-0 bg-transparent cursor-pointer'));
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) =>
          i.feedback.style.use(
            tw(
              profile === 'new-york-v4'
                ? 'w-auto min-w-0 shrink-0 rounded-none shadow-none gap-2 text-sm font-medium transition-[color,box-shadow]'
                : TOGGLE_PROFILE[profile]
            )
          ),
      });
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.state(resolvedVariant).eq('outline')),
        intent: (i) => i.feedback.style.use(tw(TOGGLE_OUTLINE[profile])),
      });
      if (profile !== 'luma' && profile !== 'rhea' && profile !== 'sera') {
        def.rule({
          when: (w) =>
            w.all(
              w.state(style).eq(profile),
              w.state(resolvedVariant).eq('outline'),
              w.state(state.active).eq(false),
              w.meta('colorScheme').eq('dark')
            ),
          intent: (i) => i.feedback.style.use(tw('bg-input/30 border-input')),
        });
      }
      for (const size of ['default', 'sm', 'lg'] as const) {
        def.rule({
          when: (w) => w.all(w.state(style).eq(profile), w.state(resolvedSize).eq(size)),
          intent: (i) => i.feedback.style.use(tw(resolveToggleGroupItemSize(profile, size))),
        });
      }
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.state(state.active).eq(true)),
        intent: (i) =>
          i.feedback.style.use(
            tw(
              profile === 'new-york-v4'
                ? 'bg-accent text-accent-foreground'
                : 'bg-muted text-foreground'
            )
          ),
      });
      if (profile === 'new-york-v4') {
        def.rule({
          when: (w) =>
            w.all(
              w.state(style).eq(profile),
              w.state(resolvedVariant).eq('default'),
              w.state(hovered).eq(true),
              w.state(state.disabled).eq(false),
              w.state(state.active).eq(false)
            ),
          intent: (i) => i.feedback.style.use(tw('bg-muted text-muted-foreground')),
        });
        def.rule({
          when: (w) =>
            w.all(
              w.state(style).eq(profile),
              w.state(resolvedVariant).eq('outline'),
              w.state(hovered).eq(true),
              w.state(state.disabled).eq(false),
              w.state(state.active).eq(false)
            ),
          intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
        });
      } else {
        def.rule({
          when: (w) =>
            w.all(
              w.state(style).eq(profile),
              w.state(hovered).eq(true),
              w.state(state.disabled).eq(false),
              w.state(state.active).eq(false)
            ),
          intent: (i) => i.feedback.style.use(tw('bg-muted/70 text-foreground')),
        });
      }
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.state(state.focusVisible).eq(true)),
        intent: (i) => i.feedback.style.use(tw(TOGGLE_FOCUS[profile])),
      });
      const endcaps = JOINED_ENDCAP_RADIUS[profile];
      if (endcaps) {
        def.rule({
          when: (w) =>
            w.all(
              w.state(style).eq(profile),
              w.state(joined).eq(true),
              w.state(first).eq(true),
              w.state(axis).eq('horizontal')
            ),
          intent: (i) => i.feedback.style.use(tw(endcaps.hFirst)),
        });
        def.rule({
          when: (w) =>
            w.all(
              w.state(style).eq(profile),
              w.state(joined).eq(true),
              w.state(last).eq(true),
              w.state(axis).eq('horizontal')
            ),
          intent: (i) => i.feedback.style.use(tw(endcaps.hLast)),
        });
        def.rule({
          when: (w) =>
            w.all(
              w.state(style).eq(profile),
              w.state(joined).eq(true),
              w.state(first).eq(true),
              w.state(axis).eq('vertical')
            ),
          intent: (i) => i.feedback.style.use(tw(endcaps.vFirst)),
        });
        def.rule({
          when: (w) =>
            w.all(
              w.state(style).eq(profile),
              w.state(joined).eq(true),
              w.state(last).eq(true),
              w.state(axis).eq('vertical')
            ),
          intent: (i) => i.feedback.style.use(tw(endcaps.vLast)),
        });
      }
    }
    def.rule({
      when: (w) => w.state(joined).eq(true),
      intent: (i) => i.feedback.style.use(tw('rounded-none shadow-none')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(joined).eq(true),
          w.state(resolvedVariant).eq('outline'),
          w.state(hasPrevious).eq(true),
          w.state(axis).eq('horizontal')
        ),
      intent: (i) => i.feedback.style.use(tw('-ml-px')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(joined).eq(true),
          w.state(resolvedVariant).eq('outline'),
          w.state(hasPrevious).eq(true),
          w.state(axis).eq('vertical')
        ),
      intent: (i) => i.feedback.style.use(tw('-mt-px')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(joined).eq(true),
          w.any(
            w.state(state.active).eq(true),
            w.all(w.state(hovered).eq(true), w.state(state.disabled).eq(false))
          )
        ),
      intent: (i) => i.feedback.style.use(tw('z-10')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('z-10 forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) => w.state(state.focused).eq(true),
      intent: (i) => i.feedback.style.use(tw('z-10')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
    });
    def.rule({
      when: (w) => w.meta('preference.reducedMotion').eq('reduce'),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
    });
    return behavior.render;
  },
});
