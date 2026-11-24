import { definePrototype, tw } from '@proto.ui/core';
import {
  asAlertDialogContent,
  type AlertDialogContentExposes,
} from '@proto.ui/prototypes-base/alert-dialog';
import type { AlertDialogContentProps } from './types';
import { setupOverlayDarkRing, setupOverlayPaint } from '../dialog/style';
import { ALERT_PANEL } from './recipes';

export default definePrototype<AlertDialogContentProps, AlertDialogContentExposes>({
  name: 'shadcn-alert-dialog-content',
  setup(def) {
    def.props.define({
      size: { type: 'enum', empty: 'fallback', options: ['default', 'sm'] },
    });
    def.props.setDefaults({ size: 'default' });
    const behavior = asAlertDialogContent();
    const style = setupOverlayPaint(def, ALERT_PANEL);
    setupOverlayDarkRing(def, style);
    def.feedback.style.use(
      tw(
        'fixed z-50 left-[var(--proto-ui-available-region-center-x,50%)] top-[var(--proto-ui-available-region-center-y,50%)] -translate-x-1/2 -translate-y-1/2 w-full max-h-[calc(var(--proto-ui-available-region-height,100%)_-_2rem)] overflow-y-auto grid outline-none transition-opacity'
      )
    );
    def.rule({
      when: (w) => w.all(w.state(style).eq('new-york-v4'), w.prop('size').eq('default')),
      intent: (i) =>
        i.feedback.style.use(
          tw('max-w-[min(32rem,calc(var(--proto-ui-available-region-width,100%)_-_2rem))]')
        ),
    });
    def.rule({
      when: (w) => w.all(w.not(w.state(style).eq('new-york-v4')), w.prop('size').eq('default')),
      intent: (i) =>
        i.feedback.style.use(
          tw('max-w-[min(28rem,calc(var(--proto-ui-available-region-width,100%)_-_2rem))]')
        ),
    });
    def.rule({
      when: (w) => w.prop('size').eq('sm'),
      intent: (i) =>
        i.feedback.style.use(
          tw('max-w-[min(20rem,calc(var(--proto-ui-available-region-width,100%)_-_2rem))]')
        ),
    });
    const { open } = behavior.stateHandles;
    def.rule({
      when: (w) => w.state(open).eq(true),
      intent: (i) => i.feedback.style.use(tw('animate-in fade-in-0 zoom-in-95')),
    });
    def.rule({
      when: (w) => w.state(open).eq(false),
      intent: (i) => i.feedback.style.use(tw('animate-out fade-out-0 zoom-out-95')),
    });
    behavior.asTransition.configure({ enterDuration: 150, leaveDuration: 150 });
  },
});
