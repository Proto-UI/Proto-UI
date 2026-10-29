import { tw, type DefHandle, type State } from '@proto.ui/core';
import {
  bootstrapButtonRestFill,
  bootstrapButtonInteractiveFill,
  bootstrapButtonFlatFill,
  bootstrapButtonRaised,
  bootstrapButtonPressed,
} from './paint';

type ButtonVisualFacts = {
  disabled: State<boolean>;
  focusVisible: State<boolean>;
  hovered?: State<boolean>;
  pressed?: State<boolean>;
  focused?: State<boolean>;
  active?: State<boolean>;
};

/** Paint only: never installs a Button, trigger, focus or activation owner. */
export function setupButtonVisual<Props extends object, Exposes>(
  def: DefHandle<Props, Exposes>,
  state: ButtonVisualFacts,
  variant: 'default' | 'primary' = 'default'
): void {
  def.feedback.style.use(
    tw(
      'inline-flex shrink-0 items-center justify-center rounded-[4px] border px-[12px] py-[4px] font-sans text-[14px] font-normal leading-[20px] text-center align-middle whitespace-nowrap select-none cursor-pointer'
    )
  );
  def.feedback.style.use(
    tw(
      variant === 'default'
        ? 'text-paint-[#333_0_1px_1px_rgb(255_255_255/75%)] border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_#b3b3b3_rgb(0_0_0/10%)]'
        : 'text-paint-[#fff_0_-1px_0_rgb(0_0_0/25%)] border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_rgb(0_0_0/25%)_rgb(0_0_0/10%)]'
    )
  );
  def.feedback.style.use(tw(bootstrapButtonRestFill[variant], bootstrapButtonRaised));
  const focused = state.focused ?? state.focusVisible;
  def.rule({
    when: (w) =>
      state.hovered
        ? w.any(w.state(state.hovered).eq(true), w.state(focused).eq(true))
        : w.state(focused).eq(true),
    intent: (i) => i.feedback.style.use(tw(bootstrapButtonInteractiveFill[variant])),
  });
  if (state.pressed) {
    def.rule({
      when: (w) => w.state(state.pressed!).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(bootstrapButtonFlatFill[variant], bootstrapButtonPressed)),
    });
  }
  if (state.active) {
    def.rule({
      when: (w) => w.state(state.active!).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(bootstrapButtonFlatFill[variant], bootstrapButtonPressed)),
    });
  }
  def.rule({
    when: (w) => w.state(state.focusVisible).eq(true),
    intent: (i) =>
      i.feedback.style.use(
        tw(
          'outline-none ring-2 ring-ring ring-offset-2 ring-offset-background forced-colors-focus-outline'
        )
      ),
  });
  def.rule({
    when: (w) => w.state(state.disabled).eq(true),
    intent: (i) =>
      i.feedback.style.use(
        tw(bootstrapButtonFlatFill[variant], 'opacity-65 cursor-default shadow-none')
      ),
  });
  // Source background-position .1s linear motion is not supplied by a timer or
  // a generic transition-all token; its neutral projection remains separate.
}
