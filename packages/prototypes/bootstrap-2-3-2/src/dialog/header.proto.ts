import { definePrototype, tw } from '@proto.ui/core';
import { DIALOG_FAMILY } from '@proto.ui/prototypes-base/dialog';

/** Passive Bootstrap modal-header wrapper; title content remains authored. */
const dialogHeader = definePrototype({
  name: 'bootstrap-2-3-2-dialog-header',
  setup(def) {
    def.anatomy.claim(DIALOG_FAMILY, { role: 'header' });
    def.feedback.style.use(tw('block min-w-0 pr-[48px] border-b border-border pl-[15px] py-[9px]'));
    return (renderer) => renderer.r.slot();
  },
});

export default dialogHeader;
