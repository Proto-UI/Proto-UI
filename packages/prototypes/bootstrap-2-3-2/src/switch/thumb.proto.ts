import { definePrototype, tw } from '@proto.ui/core';
import {
  asSwitchThumb,
  type SwitchThumbProps,
  type SwitchThumbExposes,
} from '@proto.ui/prototypes-base/switch';

// Independently expressed Bootstrap 2.3.2 design-language projection.
// Base retains all semantics; source attribution: ../../THIRD_PARTY_NOTICES.md.
// Extension: core Bootstrap 2.3.2 does not supply a Switch component.
export default definePrototype<SwitchThumbProps, SwitchThumbExposes>({
  name: 'bootstrap-2-3-2-switch-thumb',
  setup(def) {
    const state = asSwitchThumb().stateHandles;
    if (!state) throw new Error('[bootstrap-2-3-2-switch-thumb] Base state handles required.');
    // A full-height rigid face meets the housing edge rather than floating.
    // The 40px box has 38px inside its two borders. A 20px face leaves the
    // original 18px travel; the inherited percentage also drives dragging.
    def.feedback.style.use(
      tw(
        'absolute left-0 top-1/2 block w-5 h-full -translate-y-1/2 shrink-0 bg-[#f5f5f5_linear-gradient(#fff,#e6e6e6)_0_0_repeat-x] border border-[#b3b3b3] pointer-events-none rounded-none shadow-[inset_0_1px_0_rgb(255_255_255/20%),0_1px_2px_rgb(0_0_0/5%)] transition-transform duration-150 ease-in-out translate-x-[calc((100%_-_2px)_*_var(--pui-percentage)/100)]'
      )
    );
    // An explicit RTL direction mirrors the whole thumb: it rests against the
    // right housing edge and travels towards the left.
    def.rule({
      when: (w) => w.state(state.direction).eq('rtl'),
      intent: (i) =>
        i.feedback.style.use(
          tw('left-auto right-0 translate-x-[calc((2px_-_100%)_*_var(--pui-percentage)/100)]')
        ),
    });
    // Direct manipulation follows its owner without a trailing CSS animation.
    def.rule({
      when: (w) => w.state(state.dragging).eq(true),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
    });
  },
});
