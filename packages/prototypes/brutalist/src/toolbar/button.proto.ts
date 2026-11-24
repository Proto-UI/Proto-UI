import { definePrototype, tw } from '@proto.ui/core';
import {
  asToolbarButton,
  type ToolbarButtonProps,
  type ToolbarButtonExposes,
} from '@proto.ui/prototypes-base/toolbar';
import { BRUTALIST_DISABLED_TOKENS, BRUTALIST_FOCUS_TOKENS } from '../style';

export type BrutalistToolbarButtonVariant = 'surface' | 'solid' | 'destructive';
export type BrutalistToolbarButtonSize = 'default' | 'sm' | 'icon';

export interface BrutalistToolbarButtonProps extends ToolbarButtonProps {
  variant?: BrutalistToolbarButtonVariant;
  size?: BrutalistToolbarButtonSize;
}

const SIZE_TOKENS: Record<BrutalistToolbarButtonSize, string> = {
  default: 'px-3 py-1.5 text-sm leading-5',
  sm: 'px-2.5 py-1 text-xs leading-4',
  icon: 'size-9 p-0 text-sm leading-5',
};

export default definePrototype<BrutalistToolbarButtonProps, ToolbarButtonExposes>({
  name: 'brutalist-toolbar-button',
  modules: asToolbarButton.modules,
  setup(def) {
    def.props.define({
      variant: { type: 'enum', options: ['surface', 'solid', 'destructive'], empty: 'fallback' },
      size: { type: 'enum', options: ['default', 'sm', 'icon'], empty: 'fallback' },
    });
    def.props.setDefaults({ variant: 'surface', size: 'default' });

    const behavior = asToolbarButton();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[brutalist-toolbar] Button state unavailable.');
    const { disabled, focusVisible } = state;

    const hovered = def.state.bool('brutalistToolbarHovered', false);
    const pressed = def.state.bool('brutalistToolbarPressed', false);
    const clearPointer = () => {
      hovered.set(false, 'brutalist toolbar button hover reset');
      pressed.set(false, 'brutalist toolbar button press reset');
    };
    def.event.on('pointer.enter', () => {
      if (!disabled.get()) hovered.set(true, 'brutalist toolbar button hover enter');
    });
    def.event.on('pointer.leave', clearPointer);
    def.event.on('pointer.cancel', clearPointer);
    def.event.on('pointer.down', () => {
      if (!disabled.get()) pressed.set(true, 'brutalist toolbar button press down');
    });
    def.event.on('pointer.up', () => pressed.set(false, 'brutalist toolbar button press up'));
    def.lifecycle.onUnmounted(clearPointer);
    if ('watch' in disabled) {
      disabled.watch((_run, event) => {
        if (event.type === 'next' && event.next) clearPointer();
      });
    }

    def.feedback.style.use(
      tw(
        'rounded-base border-2 border-black inline-flex min-w-0 items-center justify-center gap-1.5 font-sans font-medium whitespace-nowrap select-none cursor-pointer outline-none transition-none'
      )
    );
    (Object.keys(SIZE_TOKENS) as BrutalistToolbarButtonSize[]).forEach((size) => {
      def.rule({
        when: (w) => w.prop('size').eq(size),
        intent: (i) => i.feedback.style.use(tw(SIZE_TOKENS[size])),
      });
    });

    // Surface variant (default)
    def.rule({
      when: (w) => w.prop('variant').eq('surface'),
      intent: (i) => i.feedback.style.use(tw('bg-secondary-background text-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq('surface'),
          w.state(disabled).eq(false),
          w.any(w.state(hovered).eq(true), w.state(pressed).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-main text-main-foreground')),
    });

    // Solid variant
    def.rule({
      when: (w) => w.prop('variant').eq('solid'),
      intent: (i) => i.feedback.style.use(tw('bg-main text-main-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq('solid'),
          w.state(disabled).eq(false),
          w.any(w.state(hovered).eq(true), w.state(pressed).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-canary text-canary-foreground')),
    });

    // Destructive variant
    def.rule({
      when: (w) => w.prop('variant').eq('destructive'),
      intent: (i) => i.feedback.style.use(tw('bg-destructive text-destructive-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq('destructive'),
          w.state(disabled).eq(false),
          w.any(w.state(hovered).eq(true), w.state(pressed).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-coral text-coral-foreground')),
    });

    // Instant-snap pressed feedback without moving the hit envelope
    def.rule({
      when: (w) => w.all(w.state(pressed).eq(true), w.state(disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('shadow-[inset_2px_2px_0_0_#000]')),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(`${BRUTALIST_FOCUS_TOKENS} forced-colors-focus-outline`)),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_DISABLED_TOKENS)),
    });
    return behavior.render;
  },
});
