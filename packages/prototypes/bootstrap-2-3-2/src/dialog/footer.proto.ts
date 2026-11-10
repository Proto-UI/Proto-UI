import { definePrototype, tw } from '@proto.ui/core';
import { DIALOG_FAMILY } from '@proto.ui/prototypes-base/dialog';

/** Passive Bootstrap modal-footer wrapper; actions retain their own command owners. */
const dialogFooter = definePrototype({
  name: 'bootstrap-2-3-2-dialog-footer',
  setup(def) {
    def.anatomy.claim(DIALOG_FAMILY, { role: 'footer' });
    def.feedback.style.use(
      tw(
        'flex min-w-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-secondary text-secondary-foreground px-[15px] pt-[14px] pb-[15px] rounded-b-[6px] shadow-none'
      )
    );
    return (renderer) => renderer.r.slot();
  },
});

export default dialogFooter;
