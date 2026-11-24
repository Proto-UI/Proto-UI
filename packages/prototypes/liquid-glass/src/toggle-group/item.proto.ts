import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { asToggleGroupItem } from '@proto.ui/prototypes-base/toggle-group';
import { COMMAND_DISABLED, COMMAND_FOCUS } from '../interactive-surface';
import type {
  LiquidGlassToggleGroupItemExposes,
  LiquidGlassToggleGroupItemProps,
  LiquidGlassToggleGroupSize,
} from './types';
import { TOGGLE_GROUP_VISUAL_CONTEXT } from './visual';

const SIZE_TOKENS: Record<LiquidGlassToggleGroupSize, string> = {
  sm: 'px-2.5 py-1 text-xs',
  default: 'px-3.5 py-1.5 text-sm',
  lg: 'px-4 py-2 text-sm',
};

/** Borderless glass segments inside Root: never declares a second glass surface.
 * Horizontal capsules use `rounded-full`; vertical segments use concentric
 * `rounded-xl` (12px) inside the Root's `rounded-2xl` (16px) + `p-1` (4px) frame.
 */
export default definePrototype<LiquidGlassToggleGroupItemProps, LiquidGlassToggleGroupItemExposes>({
  name: 'liquid-glass-toggle-group-item',
  modules: asToggleGroupItem.modules,
  setup(def) {
    def.props.define({
      variant: { type: 'enum', options: ['regular', 'prominent'], empty: 'fallback' },
      size: { type: 'enum', options: ['default', 'sm', 'lg'], empty: 'fallback' },
    });
    const behavior = asToggleGroupItem();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[liquid-glass-toggle-group] Item state unavailable.');
    const { active, disabled, focusVisible } = state;
    const hovered = def.state.bool('liquidGlassToggleGroupHovered', false);
    const axis = def.state.string('liquidGlassToggleGroupAxis', 'horizontal');
    const resolvedVariant = def.state.string('liquidGlassToggleGroupVariant', 'regular');
    const resolvedSize = def.state.string('liquidGlassToggleGroupSize', 'default');

    const clearHover = () => hovered.set(false, 'liquid glass toggle group item hover reset');
    def.event.on('pointer.enter', () => {
      if (!disabled.get()) hovered.set(true, 'liquid glass toggle group item hover enter');
    });
    def.event.on('pointer.leave', clearHover);
    def.event.on('pointer.cancel', clearHover);
    def.lifecycle.onUnmounted(clearHover);
    if ('watch' in disabled) {
      disabled.watch((_run, event) => {
        if (event.type === 'next' && event.next) clearHover();
      });
    }

    const syncVisual = (run: RunHandle<LiquidGlassToggleGroupItemProps>) => {
      const ctx = run.context.tryRead(TOGGLE_GROUP_VISUAL_CONTEXT);
      const props = run.props.get();
      axis.set(ctx?.orientation ?? 'horizontal', 'liquid glass toggle group observed axis');
      resolvedVariant.set(
        props.variant ?? ctx?.variant ?? 'regular',
        'liquid glass toggle group observed variant'
      );
      resolvedSize.set(
        props.size ?? ctx?.size ?? 'default',
        'liquid glass toggle group observed size'
      );
    };
    def.context.trySubscribe(TOGGLE_GROUP_VISUAL_CONTEXT, syncVisual);
    def.props.watch(['variant', 'size'], syncVisual);
    def.lifecycle.onCreated(syncVisual);
    def.lifecycle.onMounted(syncVisual);

    def.feedback.style.use(
      tw(
        'border border-transparent inline-flex min-w-0 items-center justify-center gap-1.5 font-medium whitespace-nowrap select-none cursor-pointer outline-none bg-transparent text-secondary-foreground transition-colors duration-150'
      )
    );
    def.rule({
      when: (w) => w.meta('preference.reducedMotion').eq('reduce'),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
    });
    def.rule({
      when: (w) => w.state(axis).eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('rounded-full')),
    });
    def.rule({
      when: (w) => w.state(axis).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('rounded-xl')),
    });
    (Object.keys(SIZE_TOKENS) as LiquidGlassToggleGroupSize[]).forEach((size) => {
      def.rule({
        when: (w) => w.state(resolvedSize).eq(size),
        intent: (i) => i.feedback.style.use(tw(SIZE_TOKENS[size])),
      });
    });
    def.rule({
      when: (w) =>
        w.all(w.state(hovered).eq(true), w.state(active).eq(false), w.state(disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-muted/80 text-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.state(active).eq(true), w.state(resolvedVariant).eq('regular')),
      intent: (i) =>
        i.feedback.style.use(
          tw('bg-primary text-primary-foreground shadow-sm ring-1 ring-inset ring-foreground/15')
        ),
    });
    def.rule({
      when: (w) => w.all(w.state(active).eq(true), w.state(resolvedVariant).eq('prominent')),
      intent: (i) =>
        i.feedback.style.use(
          tw('bg-primary text-primary-foreground shadow-md ring-1 ring-inset ring-foreground/20')
        ),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(`${COMMAND_DISABLED} text-muted-foreground`)),
    });
    return behavior.render;
  },
});
