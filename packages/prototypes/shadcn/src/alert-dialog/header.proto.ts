import { definePrototype, tw } from '@proto.ui/core';
import { ALERT_DIALOG_FAMILY } from '@proto.ui/prototypes-base/alert-dialog';
import type { ShadcnAlertDialogHeaderProps, ShadcnAlertDialogHeaderExposes } from './types';
import { setupOverlayPaint } from '../dialog/style';
import { ALERT_HEADER } from './recipes';

/** Passive AlertDialog header group; responsive breakpoint parity remains separate. */
export default definePrototype<ShadcnAlertDialogHeaderProps, ShadcnAlertDialogHeaderExposes>({
  name: 'shadcn-alert-dialog-header',
  setup(def) {
    def.anatomy.claim(ALERT_DIALOG_FAMILY, { role: 'header' });
    def.props.define({
      align: { type: 'enum', empty: 'fallback', options: ['start', 'center'] },
    });
    def.props.setDefaults({ align: 'start' });
    def.feedback.style.use(tw('grid min-w-0'));
    const style = setupOverlayPaint(def, ALERT_HEADER);
    def.rule({
      when: (w) => w.all(w.not(w.state(style).eq('new-york-v4')), w.prop('align').eq('start')),
      intent: (i) => i.feedback.style.use(tw('text-start')),
    });
    def.rule({
      when: (w) => w.all(w.not(w.state(style).eq('new-york-v4')), w.prop('align').eq('center')),
      intent: (i) => i.feedback.style.use(tw('place-items-center text-center')),
    });
    return (renderer) => renderer.r.slot();
  },
});
