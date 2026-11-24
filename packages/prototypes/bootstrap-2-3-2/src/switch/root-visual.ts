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
      'relative inline-flex h-6 w-10 shrink-0 items-center justify-start border border-foreground overflow-hidden bg-[#e6e6e6_linear-gradient(#fff,#e6e6e6)_0_-15px_repeat-x] select-none cursor-pointer rounded-[5px] shadow-[inset_0_2px_4px_rgb(0_0_0/15%),0_1px_2px_rgb(0_0_0/5%)]'
    )
  );
  def.rule({
    when: (w) => w.state(state.checked).eq(true),
    intent: (i) => i.feedback.style.use(tw('bg-[#006dcc_linear-gradient(#08c,#04c)_0_0_repeat-x]')),
  });
  def.rule({
    when: (w) =>
      invalid
        ? w.all(w.state(state.focusVisible).eq(true), w.state(invalid).eq(false))
        : w.state(state.focusVisible).eq(true),
    intent: (i) =>
      i.feedback.style.use(
        tw(
          'outline-none ring-2 ring-ring ring-offset-2 ring-offset-background forced-colors-focus-outline'
        )
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
