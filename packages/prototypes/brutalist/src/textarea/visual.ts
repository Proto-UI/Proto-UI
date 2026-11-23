import { tw, type DefHandle, type ObservedStateHandle, type State } from '@proto.ui/core';
import type {
  TextareaRootProps,
  TextareaRootStateHandles,
} from '@proto.ui/prototypes-base/textarea';
import { BRUTALIST_FOCUS_TOKENS } from '../style';

/** One visual projection for the ordinary editor and its explicit Field composition. */
export function setupTextareaVisual(
  def: DefHandle<TextareaRootProps>,
  state: TextareaRootStateHandles,
  invalid?: State<boolean> | ObservedStateHandle<boolean, TextareaRootProps>
) {
  def.feedback.style.use(
    tw(
      'flex min-h-[80px] w-full resize-y rounded-base border-2 border-border bg-secondary-background px-3 py-2 font-sans font-medium text-sm text-foreground outline-none selection:bg-main selection:text-main-foreground'
    )
  );
  def.rule({
    when: (w) => w.state(state.focusVisible).eq(true),
    intent: (i) => i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS)),
  });
  def.rule({
    when: (w) => w.state(state.disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw('cursor-not-allowed opacity-50')),
  });
  if (invalid)
    def.rule({
      when: (w) => w.state(invalid).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-2 border-foreground')),
    });
}
