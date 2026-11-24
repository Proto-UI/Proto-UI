import { definePrototype, tw } from '@proto.ui/core';
import {
  asToolbarButton,
  type ToolbarButtonProps,
  type ToolbarButtonExposes,
} from '@proto.ui/prototypes-base/toolbar';
import {
  bootstrapButtonRestFill,
  bootstrapButtonInteractiveFill,
  bootstrapButtonFlatFill,
  bootstrapButtonPressedFill,
  bootstrapButtonRaised,
  bootstrapButtonPressed,
} from '../button/paint';

export type BootstrapToolbarButtonVariant =
  | 'default'
  | 'primary'
  | 'warning'
  | 'danger'
  | 'success'
  | 'info'
  | 'inverse';
export type BootstrapToolbarButtonSize = 'default' | 'small' | 'mini';

export interface BootstrapToolbarButtonProps extends ToolbarButtonProps {
  variant?: BootstrapToolbarButtonVariant;
  size?: BootstrapToolbarButtonSize;
}

const SIZE_TOKENS: Record<BootstrapToolbarButtonSize, string> = {
  default: 'px-[12px] py-[4px] text-[14px] rounded-[4px]',
  small: 'px-[10px] py-[2px] text-[11.9px] rounded-[3px]',
  mini: 'px-[6px] py-[0px] text-[10.5px] rounded-[3px]',
};

export default definePrototype<BootstrapToolbarButtonProps, ToolbarButtonExposes>({
  name: 'bootstrap-2-3-2-toolbar-button',
  modules: asToolbarButton.modules,
  setup(def) {
    def.props.define({
      variant: {
        type: 'enum',
        options: ['default', 'primary', 'warning', 'danger', 'success', 'info', 'inverse'],
        empty: 'fallback',
      },
      size: {
        type: 'enum',
        options: ['default', 'small', 'mini'],
        empty: 'fallback',
      },
    });
    def.props.setDefaults({ variant: 'default', size: 'default' });

    const behavior = asToolbarButton();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[bootstrap-2-3-2-toolbar] Button state unavailable.');
    const { disabled, focused, focusVisible } = state;

    const hovered = def.state.bool('bootstrapToolbarHovered', false);
    const pressed = def.state.bool('bootstrapToolbarPressed', false);
    const clearPointer = () => {
      hovered.set(false, 'bootstrap toolbar button hover reset');
      pressed.set(false, 'bootstrap toolbar button press reset');
    };
    def.event.on('pointer.enter', () => {
      if (!disabled.get()) hovered.set(true, 'bootstrap toolbar button hover enter');
    });
    def.event.on('pointer.leave', clearPointer);
    def.event.on('pointer.cancel', clearPointer);
    def.event.on('pointer.down', () => {
      if (!disabled.get()) pressed.set(true, 'bootstrap toolbar button press down');
    });
    def.event.on('pointer.up', () => pressed.set(false, 'bootstrap toolbar button press up'));
    def.lifecycle.onUnmounted(clearPointer);
    if ('watch' in disabled) {
      disabled.watch((_run, event) => {
        if (event.type === 'next' && event.next) clearPointer();
      });
    }

    def.feedback.style.use(
      tw(
        'inline-flex min-w-0 shrink-0 items-center justify-center border font-normal leading-[20px] whitespace-nowrap select-none cursor-pointer transition-none'
      )
    );
    def.feedback.style.use(tw(bootstrapButtonRaised));
    def.rule({
      when: (w) =>
        w.all(
          w.state(disabled).eq(false),
          w.any(w.state(hovered).eq(true), w.state(focused).eq(true)),
          w.not(w.meta('preference.reducedMotion').eq('reduce'))
        ),
      intent: (i) =>
        i.feedback.style.use(tw('transition-[background-position] duration-100 ease-linear')),
    });

    (Object.keys(SIZE_TOKENS) as BootstrapToolbarButtonSize[]).forEach((size) => {
      def.rule({
        when: (w) => w.prop('size').eq(size),
        intent: (i) => i.feedback.style.use(tw(SIZE_TOKENS[size])),
      });
    });

    def.rule({
      when: (w) => w.prop('variant').eq('default'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'text-paint-[#333_0_1px_1px_rgb(255_255_255/75%)] border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_#b3b3b3_rgb(0_0_0/10%)]'
          )
        ),
    });
    def.rule({
      when: (w) => w.not(w.prop('variant').eq('default')),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'text-paint-[#fff_0_-1px_0_rgb(0_0_0/25%)] border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_rgb(0_0_0/25%)_rgb(0_0_0/10%)]'
          )
        ),
    });

    (Object.keys(bootstrapButtonRestFill) as BootstrapToolbarButtonVariant[]).forEach((variant) => {
      def.rule({
        when: (w) =>
          w.all(
            w.prop('variant').eq(variant),
            w.state(disabled).eq(false),
            w.state(pressed).eq(false),
            w.state(focused).eq(false),
            w.state(hovered).eq(false)
          ),
        intent: (i) => i.feedback.style.use(tw(bootstrapButtonRestFill[variant])),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.prop('variant').eq(variant),
            w.state(disabled).eq(false),
            w.state(pressed).eq(false),
            w.any(w.state(focused).eq(true), w.state(hovered).eq(true))
          ),
        intent: (i) => i.feedback.style.use(tw(bootstrapButtonInteractiveFill[variant])),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.prop('variant').eq(variant),
            w.any(
              w.state(disabled).eq(true),
              w.all(
                w.state(pressed).eq(true),
                w.state(hovered).eq(false),
                w.state(focused).eq(false)
              )
            )
          ),
        intent: (i) => i.feedback.style.use(tw(bootstrapButtonFlatFill[variant])),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.prop('variant').eq(variant),
            w.state(disabled).eq(false),
            w.state(pressed).eq(true),
            w.any(w.state(hovered).eq(true), w.state(focused).eq(true))
          ),
        intent: (i) => i.feedback.style.use(tw(bootstrapButtonPressedFill[variant])),
      });
    });

    def.rule({
      when: (w) => w.all(w.state(disabled).eq(false), w.state(pressed).eq(true)),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonPressed)),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'outline-none forced-colors-focus-outline ring-2 ring-ring ring-offset-2 ring-offset-background'
          )
        ),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('opacity-65 pointer-events-none cursor-default shadow-none')),
    });
    return behavior.render;
  },
});
