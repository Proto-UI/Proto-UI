import { definePrototype, tw } from '@proto.ui/core';
import {
  asFieldRoot,
  type FieldRootProps,
  type FieldRootExposes,
} from '@proto.ui/prototypes-base/field';
export default definePrototype<FieldRootProps, FieldRootExposes>({
  name: 'bootstrap-2-3-2-field-root',
  setup(def) {
    const inherited = asFieldRoot();
    def.feedback.style.use(
      tw('block min-w-0 mb-[10px] text-foreground text-[14px] leading-[20px]')
    );
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.invalid).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-destructive')),
    });
    return inherited.render;
  },
});
