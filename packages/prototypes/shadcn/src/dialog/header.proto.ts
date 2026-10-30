import { definePrototype, tw } from '@proto.ui/core';
import { DIALOG_FAMILY } from '@proto.ui/prototypes-base/dialog';
import type { ShadcnStyleProps } from '../style-scope';
import { setupOverlayPaint } from './style';
import { DIALOG_HEADER } from './recipes';

const dialogHeader = definePrototype<ShadcnStyleProps>({
  name: 'shadcn-dialog-header',
  setup(def) {
    def.anatomy.claim(DIALOG_FAMILY, { role: 'header' });
    def.feedback.style.use(tw('flex min-w-0 flex-col'));
    setupOverlayPaint(def, DIALOG_HEADER);
    return (renderer) => renderer.r.slot();
  },
});

export default dialogHeader;
