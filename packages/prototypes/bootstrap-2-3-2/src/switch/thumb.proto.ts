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
    def.feedback.style.use(
      tw(
        'block size-5 shrink-0 bg-secondary border border-border pointer-events-none rounded-[4px] shadow-[inset_0_1px_0_rgb(255_255_255/20%),0_1px_2px_rgb(0_0_0/5%)]'
      )
    );
  },
});
