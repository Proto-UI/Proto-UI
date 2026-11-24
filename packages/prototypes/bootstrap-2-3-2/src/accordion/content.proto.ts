import { definePrototype, tw } from '@proto.ui/core';
import { asTransition } from '@proto.ui/prototypes-base/transition';
import {
  asAccordionContent,
  type AccordionContentProps,
  type AccordionContentExposes,
} from '@proto.ui/prototypes-base/accordion';
export default definePrototype<AccordionContentProps, AccordionContentExposes>({
  name: 'bootstrap-2-3-2-accordion-content',
  setup(def) {
    const transition = asTransition();
    const inherited = asAccordionContent();
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
    def.feedback.style.use(tw('block min-w-0 text-[14px] leading-[20px] break-words'));
    return (renderer) =>
      renderer.el(
        'div',
        {
          style: tw('border-t border-[#e5e5e5] px-[15px] py-[9px] overflow-x-auto'),
        },
        renderer.slot()
      );
  },
});
