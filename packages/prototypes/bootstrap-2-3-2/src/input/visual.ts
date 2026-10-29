import { tw, type DefHandle, type State } from '@proto.ui/core';

type TextControlVisualFacts = {
  disabled: State<boolean>;
  focusVisible: State<boolean>;
  focused?: State<boolean>;
  readOnly?: State<boolean>;
};

/** Passive forms.less paint; the caller retains its one Base editor and Field binding. */
export function setupInputVisual<Props extends object, Exposes>(
  def: DefHandle<Props, Exposes>,
  state: TextControlVisualFacts,
  invalid?: State<boolean>,
  mode: 'single' | 'multiline' = 'single'
): void {
  def.feedback.style.use(
    tw(
      'inline-block box-content w-[206px] mb-[10px] rounded-[4px] border border-[#ccc] bg-white px-[6px] py-[4px] font-sans text-[14px] font-normal leading-[20px] text-[#555] align-middle shadow-[inset_0_1px_1px_rgb(0_0_0/7.5%)] outline-none transition-[border,box-shadow] duration-200 ease-linear',
      mode === 'multiline' ? 'h-auto' : 'h-[20px]'
    )
  );
  // OTP currently transports focusVisible only. Its missing focused/readOnly
  // facts remain a Base projection gap, not permission to inspect the editor.
  const focused = state.focused ?? state.focusVisible;
  def.rule({
    when: (w) =>
      invalid
        ? w.all(w.state(focused).eq(true), w.state(invalid).eq(false))
        : w.state(focused).eq(true),
    intent: (i) =>
      i.feedback.style.use(
        tw(
          'border-[rgb(82_168_236/80%)] shadow-[inset_0_1px_1px_rgb(0_0_0/7.5%),0_0_8px_rgb(82_168_236/60%)]'
        )
      ),
  });
  def.rule({
    when: (w) => w.state(state.focusVisible).eq(true),
    intent: (i) => i.feedback.style.use(tw('forced-colors-focus-outline')),
  });
  def.rule({
    when: (w) =>
      state.readOnly
        ? w.any(w.state(state.disabled).eq(true), w.state(state.readOnly).eq(true))
        : w.state(state.disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw('bg-[#eee] cursor-not-allowed')),
  });
  if (invalid) {
    def.rule({
      when: (w) => w.state(invalid).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-destructive text-destructive')),
    });
    def.rule({
      when: (w) => w.all(w.state(invalid).eq(true), w.state(focused).eq(true)),
      intent: (i) =>
        i.feedback.style.use(
          tw('border-[#953b39] shadow-[inset_0_1px_1px_rgb(0_0_0/7.5%),0_0_6px_#d59392]')
        ),
    });
  }
}
