import { tw, type DefHandle, type State } from '@proto.ui/core';
import {
  bootstrapButtonRestFill,
  bootstrapButtonInteractiveFill,
  bootstrapButtonFlatFill,
  bootstrapButtonPressedFill,
  bootstrapButtonRaised,
  bootstrapButtonPressed,
} from '../button/paint';

type SliderThumbVisualFacts = {
  orientation: State<string>;
  direction: State<string>;
  disabled: State<boolean>;
  readOnly: State<boolean>;
  hovered: State<boolean>;
  pressed: State<boolean>;
  focusVisible: State<boolean>;
};

/** Slider anatomy remains Base-owned; this is a passive 2.3.2-vocabulary extension. */
export function setupSliderThumbVisual<Props extends object, Exposes>(
  def: DefHandle<Props, Exposes>,
  state: SliderThumbVisualFacts,
  invalid?: State<boolean>
): void {
  def.feedback.style.use(
    tw(
      'absolute left-[calc(var(--pui-display-percentage)*1%)] top-1/2 block w-[20px] h-[20px] -translate-x-1/2 -translate-y-1/2 rounded-[4px] border border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_#b3b3b3_rgb(0_0_0/10%)] outline-none cursor-pointer'
    )
  );
  def.feedback.style.use(tw(bootstrapButtonRestFill.default, bootstrapButtonRaised));
  def.rule({
    when: (w) => w.state(state.hovered).eq(true),
    intent: (i) => i.feedback.style.use(tw(bootstrapButtonInteractiveFill.default)),
  });
  def.rule({
    when: (w) => w.state(state.pressed).eq(true),
    intent: (i) =>
      i.feedback.style.use(tw(bootstrapButtonFlatFill.default, bootstrapButtonPressed)),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(state.pressed).eq(true),
        w.any(w.state(state.hovered).eq(true), w.state(state.focusVisible).eq(true))
      ),
    intent: (i) => i.feedback.style.use(tw(bootstrapButtonPressedFill.default)),
  });
  def.rule({
    when: (w) => w.state(state.focusVisible).eq(true),
    intent: (i) =>
      i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2 forced-colors-focus-outline')),
  });
  def.rule({
    when: (w) => w.state(state.readOnly).eq(true),
    intent: (i) => i.feedback.style.use(tw('cursor-default')),
  });
  def.rule({
    when: (w) => w.state(state.disabled).eq(true),
    intent: (i) =>
      i.feedback.style.use(
        tw(bootstrapButtonFlatFill.default, 'opacity-65 cursor-default shadow-none')
      ),
  });
  if (invalid) {
    def.rule({
      when: (w) => w.state(invalid).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-destructive')),
    });
  }
  def.rule({
    when: (w) => w.state(state.orientation).eq('vertical'),
    intent: (i) =>
      i.feedback.style.use(
        tw('left-1/2 top-auto bottom-[calc(var(--pui-display-percentage)*1%)] translate-y-1/2')
      ),
  });
  def.rule({
    when: (w) =>
      w.all(w.state(state.direction).eq('rtl'), w.state(state.orientation).eq('horizontal')),
    intent: (i) =>
      i.feedback.style.use(
        tw('left-auto right-[calc(var(--pui-display-percentage)*1%)] translate-x-1/2')
      ),
  });
}
