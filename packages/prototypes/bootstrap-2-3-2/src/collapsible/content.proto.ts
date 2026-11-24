import { definePrototype, tw } from '@proto.ui/core';
import { asCollapsibleContent } from '@proto.ui/prototypes-base/collapsible';
import { asTransition } from '@proto.ui/prototypes-base/transition';
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
    const transition = asTransition();
    const inherited = asCollapsibleContent();
    inherited.bindPresence(transition);
    transition.configure({
      enterDuration: 350,
      leaveDuration: 350,
      interrupt: 'reverse',
      completion: { kind: 'presentation', timeoutMs: 1000 },
    });
    def.feedback.style.presence({
      owner: transition.presentationOwner,
      closed: { blockSize: 0 },
      entered: { blockSize: 'intrinsic' },
      easing: [0.25, 0.1, 0.25, 1],
    });
    // P-BOOTSTRAP-2-3-2-COLLAPSIBLE-CONTENT-VISUAL-SAFETY: no fixed width/height or clipped long label.
    def.feedback.style.use(
      tw('block min-w-0 max-w-full text-foreground wrap-anywhere text-[14px] leading-[20px]')
    );
    return (renderer) =>
      renderer.el(
        'div',
        {
          style: tw('border-t border-[#e5e5e5] px-[15px] py-[9px]'),
        },
        renderer.slot()
      );
  },
});

export default collapsibleContent;
