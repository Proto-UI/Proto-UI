import { definePrototype, tw } from '@proto.ui/core';
import { DIALOG_FAMILY } from '@proto.ui/prototypes-base/dialog';

const dialogHeader = definePrototype({
  name: 'shadcn-dialog-header',
  setup(def) {
    def.anatomy.claim(DIALOG_FAMILY, { role: 'header' });
    def.feedback.style.use(tw('flex min-w-0 flex-col gap-2 text-left'));
    return (renderer) => renderer.r.slot();
  },
});

export default dialogHeader;
