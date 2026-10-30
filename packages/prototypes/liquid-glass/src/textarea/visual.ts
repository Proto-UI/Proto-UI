import { tw, type DefHandle, type State } from '@proto.ui/core';
import type {
  TextareaRootProps,
  TextareaRootStateHandles,
} from '@proto.ui/prototypes-base/textarea';
import { COMMAND_FOCUS } from '../interactive-surface';

/** Paint only, shared with the exact Field-bound editor (never another editor). */
export function setupLiquidTextareaVisual(
  def: DefHandle<TextareaRootProps>,
  state: TextareaRootStateHandles,
  invalid?: State<boolean>
) {
  // HIG Text Views informs a legible multiline editing region. Deliberately
  // ordinary opaque content presentation: no extra glass on an editing layer,
  // custom auto-resize, rich text or replacement physical surface.
  def.feedback.style.use(
    tw(
      'block min-h-24 w-full min-w-0 resize-y rounded-2xl border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground outline-none'
    )
  );
  def.rule({
    when: (w) => w.state(state.focusVisible).eq(true),
    intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
  });
  def.rule({
    when: (w) => w.state(state.disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw('bg-muted cursor-not-allowed')),
  });
  if (invalid) {
    // The existing Field Control frame convention; Error supplies the textual
    // explanation through Base Field's current anatomy relationship.
    def.rule({
      when: (w) => w.state(invalid).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-2 border-foreground')),
    });
  }
}
