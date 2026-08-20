import { definePrototype, tw } from '@proto.ui/core';
import { DIALOG_FAMILY } from '@proto.ui/prototypes-base/dialog';

const dialogHeader = definePrototype({
  name: 'brutalist-dialog-header',
  // P-BRUTALIST-DIALOG-HEADER-ENTRY: direct entry name `brutalist-dialog-header`.
  setup(def) {
    // P-BRUTALIST-DIALOG-HEADER-ANATOMY: claim DIALOG_FAMILY header role.
    def.anatomy.claim(DIALOG_FAMILY, { role: 'header' });
    // P-BRUTALIST-DIALOG-HEADER-VISUAL-GRAMMAR: grid gap with a 2px bottom rule in the theme foreground.
    def.feedback.style.use(tw('grid gap-1 border-b-2 border-foreground pb-3 text-left'));
    return (renderer) => renderer.r.slot();
  },
});

// P-BRUTALIST-DIALOG-HEADER-ENTRY: `brutalist-dialog-header` is the only public Dialog header entry in this slice (anatomy-only, no Base prototype inherited).

export default dialogHeader;
