import { definePrototype, tw } from '@proto.ui/core';
import {
  asToolbarButton,
  type ToolbarButtonProps,
  type ToolbarButtonExposes,
} from '@proto.ui/prototypes-base/toolbar';
import { COMMAND_DISABLED, COMMAND_FOCUS, COMMAND_PRESS } from '../interactive-surface';

export type LiquidGlassToolbarButtonVariant = 'regular' | 'prominent' | 'destructive';
export type LiquidGlassToolbarButtonSize = 'default' | 'sm' | 'icon';

export interface LiquidGlassToolbarButtonProps extends ToolbarButtonProps {
  variant?: LiquidGlassToolbarButtonVariant;
  size?: LiquidGlassToolbarButtonSize;
}

const SIZE_TOKENS: Record<LiquidGlassToolbarButtonSize, string> = {
  default: 'px-3.5 py-1.5 text-sm',
  sm: 'px-2.5 py-1 text-xs',
  icon: 'size-8 p-0 text-sm',
};

// Child controls inside a Liquid Glass toolbar never declare a nested material
// surface (avoiding glass-on-glass stacking). Prominence and hover/press states
// use vibrant borderless pills with concentric geometry and readable fallbacks.
export default definePrototype<LiquidGlassToolbarButtonProps, ToolbarButtonExposes>({
  name: 'liquid-glass-toolbar-button',
  modules: asToolbarButton.modules,
  setup(def) {
    def.props.define({
      variant: {
        type: 'enum',
        options: ['regular', 'prominent', 'destructive'],
        empty: 'fallback',
      },
      size: {
        type: 'enum',
        options: ['default', 'sm', 'icon'],
        empty: 'fallback',
      },
    });
    def.props.setDefaults({ variant: 'regular', size: 'default' });

    const behavior = asToolbarButton();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[liquid-glass-toolbar] Button state unavailable.');
    const { disabled, focusVisible } = state;

    const hovered = def.state.bool('liquidGlassToolbarHovered', false);
    const pressed = def.state.bool('liquidGlassToolbarPressed', false);
    const clearPointer = () => {
      hovered.set(false, 'liquid glass toolbar button hover reset');
      pressed.set(false, 'liquid glass toolbar button press reset');
    };
    def.event.on('pointer.enter', () => {
      if (!disabled.get()) hovered.set(true, 'liquid glass toolbar button hover enter');
    });
    def.event.on('pointer.leave', clearPointer);
    def.event.on('pointer.cancel', clearPointer);
    def.event.on('pointer.down', () => {
      if (!disabled.get()) pressed.set(true, 'liquid glass toolbar button press down');
    });
    def.event.on('pointer.up', () => pressed.set(false, 'liquid glass toolbar button press up'));
    def.lifecycle.onUnmounted(clearPointer);
    if ('watch' in disabled) {
      disabled.watch((_run, event) => {
        if (event.type === 'next' && event.next) clearPointer();
      });
    }

    def.feedback.style.use(
      tw(
        'rounded-full border border-transparent inline-flex min-w-0 items-center justify-center gap-1.5 font-medium whitespace-nowrap select-none cursor-pointer outline-none transition-all'
      )
    );
    def.rule({
      when: (w) => w.meta('preference.reducedMotion').eq('reduce'),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
    });

    (Object.keys(SIZE_TOKENS) as LiquidGlassToolbarButtonSize[]).forEach((size) => {
      def.rule({
        when: (w) => w.prop('size').eq(size),
        intent: (i) => i.feedback.style.use(tw(SIZE_TOKENS[size])),
      });
    });

    // Regular (default) borderless vibrant pill
    def.rule({
      when: (w) => w.prop('variant').eq('regular'),
      intent: (i) => i.feedback.style.use(tw('bg-transparent text-secondary-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq('regular'),
          w.state(disabled).eq(false),
          w.any(w.state(hovered).eq(true), w.state(pressed).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
    });

    // Prominent tinted pill for the primary action
    def.rule({
      when: (w) => w.prop('variant').eq('prominent'),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground shadow-xs')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq('prominent'),
          w.state(disabled).eq(false),
          w.state(hovered).eq(true),
          w.state(pressed).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-primary/90 shadow-sm')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq('prominent'),
          w.state(disabled).eq(false),
          w.state(pressed).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-primary/80 shadow-none')),
    });

    // Destructive pill
    def.rule({
      when: (w) => w.prop('variant').eq('destructive'),
      intent: (i) => i.feedback.style.use(tw('bg-transparent text-destructive')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq('destructive'),
          w.state(disabled).eq(false),
          w.state(hovered).eq(true),
          w.state(pressed).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-destructive text-destructive-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq('destructive'),
          w.state(disabled).eq(false),
          w.state(pressed).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-destructive/90 text-destructive-foreground')),
    });

    def.rule({
      when: (w) =>
        w.all(
          w.state(pressed).eq(true),
          w.state(disabled).eq(false),
          w.not(w.prop('variant').eq('prominent'))
        ),
      intent: (i) => i.feedback.style.use(tw(COMMAND_PRESS)),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(`${COMMAND_DISABLED} bg-muted text-muted-foreground`)),
    });
    return behavior.render;
  },
});
