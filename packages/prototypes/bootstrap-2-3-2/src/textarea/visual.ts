import { tw, type DefHandle, type State } from '@proto.ui/core';
import type {
  TextareaRootProps,
  TextareaRootStateHandles,
} from '@proto.ui/prototypes-base/textarea';

/** Shared visual projection only; Base and the optional Field keep every editing/validation fact. */
export function setupTextareaVisual(
  def: DefHandle<TextareaRootProps>,
  state: TextareaRootStateHandles,
  invalid?: State<boolean>
) {
  def.feedback.style.use(
    tw(
      'block w-full border border-border bg-background text-foreground rounded-[4px] px-1.5 py-1 text-sm font-normal leading-5 shadow-[inset_0_1px_1px_rgb(0_0_0/7.5%)] min-h-16 resize-y'
    )
  );
  def.rule({
    when: (w) =>
      invalid
        ? w.all(w.state(state.focusVisible).eq(true), w.state(invalid).eq(false))
        : w.state(state.focusVisible).eq(true),
    intent: (i) =>
      i.feedback.style.use(
        tw('outline-none ring-2 ring-ring ring-offset-2 ring-offset-background')
      ),
  });
  def.rule({
    when: (w) => w.state(state.disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw('opacity-65 cursor-not-allowed bg-muted')),
  });
  if (invalid) {
    def.rule({
      when: (w) => w.state(invalid).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-destructive ring-2 ring-destructive')),
    });
  }
}
