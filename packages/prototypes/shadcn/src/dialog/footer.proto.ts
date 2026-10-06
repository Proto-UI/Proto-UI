import { definePrototype, tw } from '@proto.ui/core';
import { DIALOG_FAMILY } from '@proto.ui/prototypes-base/dialog';

const dialogFooter = definePrototype({
  name: 'shadcn-dialog-footer',
  setup(def) {
    def.anatomy.claim(DIALOG_FAMILY, { role: 'footer' });
    def.feedback.style.use(tw('flex min-w-0 flex-wrap-reverse gap-2 items-center justify-end'));
    return (renderer) => renderer.r.slot();
  },
});

export default dialogFooter;
