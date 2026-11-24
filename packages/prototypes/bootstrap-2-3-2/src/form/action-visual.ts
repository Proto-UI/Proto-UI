import { tw, type DefHandle, type State } from '@proto.ui/core';
import type { FormActionProps } from '@proto.ui/prototypes-base/form';
import {
  bootstrapButtonRestFill,
  bootstrapButtonInteractiveFill,
  bootstrapButtonFlatFill,
  bootstrapButtonPressedFill,
  bootstrapButtonRaised,
  bootstrapButtonPressed,
} from '../button/paint';

export type BootstrapFormActionVariant =
  | 'default'
  | 'primary'
  | 'danger'
  | 'success'
  | 'info'
  | 'warning'
  | 'inverse';

export interface BootstrapFormActionProps extends FormActionProps {
  variant?: BootstrapFormActionVariant;
}

type FormActionVisualFacts = {
  disabled: State<boolean>;
  focusVisible: State<boolean>;
  hovered: State<boolean>;
  pressed: State<boolean>;
  focused?: State<boolean>;
};

const BOOTSTRAP_ACTION_VARIANTS: readonly BootstrapFormActionVariant[] = [
  'default',
  'primary',
  'danger',
  'success',
  'info',
  'warning',
  'inverse',
];

const DEFAULT_TEXT_BORDER =
  'text-paint-[#333_0_1px_1px_rgb(255_255_255/75%)] border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_#b3b3b3_rgb(0_0_0/10%)]';
const COLORED_TEXT_BORDER =
  'text-paint-[#fff_0_-1px_0_rgb(0_0_0/25%)] border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_rgb(0_0_0/25%)_rgb(0_0_0/10%)]';

/** Paint only: Base Form remains the sole action owner. The rules stay in the
 * owning Form directory so source collection sees the borrowed action states. */
export function setupFormActionVisual<Exposes>(
  def: DefHandle<BootstrapFormActionProps, Exposes>,
  state: FormActionVisualFacts,
  defaultVariant: BootstrapFormActionVariant = 'default'
): void {
  def.props.define({
    variant: {
      type: 'enum',
      options: ['default', 'primary', 'danger', 'success', 'info', 'warning', 'inverse'],
      empty: 'fallback',
    },
  });
  def.props.setDefaults({ variant: defaultVariant });

  def.feedback.style.use(
    tw(
      'inline-flex shrink-0 items-center justify-center rounded-[4px] border px-[12px] py-[4px] font-sans text-[14px] font-normal leading-[20px] text-center align-middle whitespace-nowrap select-none cursor-pointer'
    )
  );
  def.feedback.style.use(tw(bootstrapButtonRaised));

  const focused = state.focused ?? state.focusVisible;
  for (const variant of BOOTSTRAP_ACTION_VARIANTS) {
    def.rule({
      when: (w) => w.prop('variant').eq(variant),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            variant === 'default' ? DEFAULT_TEXT_BORDER : COLORED_TEXT_BORDER,
            bootstrapButtonRestFill[variant]
          )
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq(variant),
          w.state(state.disabled).eq(false),
          w.any(w.state(state.hovered).eq(true), w.state(focused).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonInteractiveFill[variant])),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq(variant),
          w.state(state.disabled).eq(false),
          w.state(state.pressed).eq(true)
        ),
      intent: (i) =>
        i.feedback.style.use(tw(bootstrapButtonFlatFill[variant], bootstrapButtonPressed)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq(variant),
          w.state(state.disabled).eq(false),
          w.state(state.pressed).eq(true),
          w.any(w.state(state.hovered).eq(true), w.state(focused).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonPressedFill[variant])),
    });
    def.rule({
      when: (w) => w.all(w.prop('variant').eq(variant), w.state(state.disabled).eq(true)),
      intent: (i) =>
        i.feedback.style.use(
          tw(bootstrapButtonFlatFill[variant], 'opacity-65 cursor-default shadow-none')
        ),
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
  // Source background-position .1s linear motion is not supplied by a timer or
  // a generic transition-all token; its neutral projection remains separate.
}
