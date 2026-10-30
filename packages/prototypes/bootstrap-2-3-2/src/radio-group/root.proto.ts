import type {
  RadioGroupRootProps,
  RadioGroupRootExposes,
} from '@proto.ui/prototypes-base/radio-group';
import { definePrototype, tw } from '@proto.ui/core';
import { asRadioGroupRoot } from '@proto.ui/prototypes-base/radio-group';

// Independently expressed Bootstrap 2.3.2 design-language projection.
// Base retains all semantics; source attribution: ../../THIRD_PARTY_NOTICES.md.
// Extension: upstream 2.3.2 uses the native radio control; the custom Proto
// Root/Item/Indicator parts are design-language extensions, not DOM parity.
export default definePrototype<RadioGroupRootProps, RadioGroupRootExposes>({
  name: 'bootstrap-2-3-2-radio-group-root',
  setup(def) {
    // Base alone owns value, collection order, roving focus and controlled requests.
    const inherited = asRadioGroupRoot();
    def.feedback.style.use(tw('flex w-full min-w-0 flex-col gap-2 text-foreground'));
    return inherited.render;
  },
});
