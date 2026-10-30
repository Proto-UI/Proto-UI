import { definePrototype, tw } from '@proto.ui/core';
import { DIALOG_FAMILY } from '@proto.ui/prototypes-base/dialog';
import type { ShadcnStyleProps } from '../style-scope';
import { setupOverlayPaint } from './style';
import { DIALOG_FOOTER } from './recipes';

const dialogFooter = definePrototype<ShadcnStyleProps>({
  name: 'shadcn-dialog-footer',
  setup(def) {
    def.anatomy.claim(DIALOG_FAMILY, { role: 'footer' });
    def.feedback.style.use(tw('flex min-w-0 flex-wrap-reverse items-center justify-end'));
    setupOverlayPaint(def, DIALOG_FOOTER);
    return (renderer) => renderer.r.slot();
  },
});

export default dialogFooter;
