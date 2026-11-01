import { definePrototype, delay, tw } from '@proto.ui/core';
import {
  asRadioGroupIndicator,
  type RadioGroupIndicatorProps,
  type RadioGroupIndicatorExposes,
} from '@proto.ui/prototypes-base/radio-group';

// Independently expressed Bootstrap 2.3.2 design-language projection.
// Base retains all semantics; source attribution: ../../THIRD_PARTY_NOTICES.md.
// Visual reference only: the 2.3.2 native radio renders as an empty ring with a
// filled dot when checked. Checked/disabled remain solely the Item's context.
export default definePrototype<RadioGroupIndicatorProps, RadioGroupIndicatorExposes>({
  name: 'bootstrap-2-3-2-radio-group-indicator',
  setup(def) {
    const state = asRadioGroupIndicator().stateHandles;
    if (!state)
      throw new Error('[bootstrap-2-3-2-radio-group-indicator] Base context state required.');
    // Outer radio ring; the inner dot is painted by the renderer below.
    def.feedback.style.use(
      tw(
        'pointer-events-none inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-border bg-secondary shadow-[inset_0_1px_1px_rgb(0_0_0/7.5%)]'
      )
    );
    def.rule({
      when: (w) => w.state(state.checked).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-primary bg-primary')),
    });
    let update: { cancel(): void } | null = null;
    const refresh = (run: { update(): void }, event: { type: string }) => {
      if (event.type !== 'next') return;
      update?.cancel();
      update = delay(0, () => {
        update = null;
        run.update();
      });
    };
    state.checked.watch(refresh);
    state.disabled.watch(refresh);
    def.lifecycle.onUnmounted(() => {
      update?.cancel();
      update = null;
    });
    return (renderer) => [
      renderer.r.slot(),
      renderer.el('span', {
        style: state.checked.get()
          ? tw('block size-2 rounded-full bg-primary-foreground')
          : tw('hidden'),
      }),
    ];
  },
});
