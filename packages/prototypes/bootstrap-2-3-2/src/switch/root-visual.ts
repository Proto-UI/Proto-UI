import { tw, type DefHandle, type State } from '@proto.ui/core';
import type { SwitchRootProps, SwitchRootStateHandles } from '@proto.ui/prototypes-base/switch';

/** Shared visual projection only; checked, activation and Field validity retain their Base owners. */
export function setupSwitchRootVisual(
  def: DefHandle<SwitchRootProps>,
  state: SwitchRootStateHandles,
  invalid?: State<boolean>
) {
  def.feedback.style.use(
    tw(
      'inline-flex h-6 w-11 shrink-0 items-center justify-start border border-border px-0.5 bg-muted select-none cursor-pointer rounded-[4px] shadow-[inset_0_1px_1px_rgb(0_0_0/7.5%)]'
    )
  );
  def.rule({
    when: (w) => w.state(state.checked).eq(true),
    intent: (i) => i.feedback.style.use(tw('bg-primary border-primary justify-end')),
  });
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
    intent: (i) => i.feedback.style.use(tw('opacity-65 cursor-not-allowed')),
  });
  if (invalid) {
    def.rule({
      when: (w) => w.state(invalid).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-destructive ring-2 ring-destructive')),
    });
  }
}
