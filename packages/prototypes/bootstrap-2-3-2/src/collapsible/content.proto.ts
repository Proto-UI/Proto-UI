import { definePrototype, tw } from '@proto.ui/core';
import { asCollapsibleContent } from '@proto.ui/prototypes-base/collapsible';
import type {
  Bootstrap232CollapsibleContentProps,
  Bootstrap232CollapsibleContentExposes,
} from './types';

// P-BOOTSTRAP-2-3-2-COLLAPSIBLE-CONTENT-BASE-INHERITANCE: Base is the only semantic owner.
const collapsibleContent = definePrototype<
  Bootstrap232CollapsibleContentProps,
  Bootstrap232CollapsibleContentExposes
>({
  name: 'bootstrap-2-3-2-collapsible-content',
  setup(def) {
    const inherited = asCollapsibleContent();
    // P-BOOTSTRAP-2-3-2-COLLAPSIBLE-CONTENT-VISUAL-SAFETY: no fixed width/height or clipped long label.
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground wrap-anywhere border-t border-[#e5e5e5] px-[15px] py-[9px] text-[14px] leading-[20px]'
      )
    );
    return inherited.render;
  },
});

export default collapsibleContent;
