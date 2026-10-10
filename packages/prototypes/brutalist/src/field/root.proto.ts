import { definePrototype, tw } from '@proto.ui/core';
import {
  asFieldRoot,
  type FieldRootProps,
  type FieldRootExposes,
} from '@proto.ui/prototypes-base/field';
export default definePrototype<FieldRootProps, FieldRootExposes>({
  name: 'brutalist-field-root',
  setup(def) {
    const inherited = asFieldRoot();
    def.feedback.style.use(
      tw('flex w-full min-w-0 flex-col gap-2 font-sans font-medium text-foreground')
    );
    // Existing Base validity remains the sole owner; Labels inherit this ink.
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.invalid).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-destructive-ink')),
    });
    return inherited.render;
  },
});
