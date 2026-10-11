import { definePrototype, tw } from '@proto.ui/core';
import { asCollapsibleRoot } from '@proto.ui/prototypes-base/collapsible';
import type { Bootstrap232CollapsibleRootProps, Bootstrap232CollapsibleRootExposes } from './types';

// P-BOOTSTRAP-2-3-2-COLLAPSIBLE-BASE-INHERITANCE: Base is the only semantic owner.
const collapsibleRoot = definePrototype<
  Bootstrap232CollapsibleRootProps,
  Bootstrap232CollapsibleRootExposes
>({
  name: 'bootstrap-2-3-2-collapsible-root',
  setup(def) {
    asCollapsibleRoot();
    // P-BOOTSTRAP-2-3-2-COLLAPSIBLE-VISUAL-SAFETY: no fixed width/height or clipped long label.
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground w-full grid gap-0 rounded-[4px] border border-border bg-background'
      )
    );
  },
});

export default collapsibleRoot;
