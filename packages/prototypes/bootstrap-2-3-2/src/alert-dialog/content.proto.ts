import { definePrototype, tw } from '@proto.ui/core';
import {
  asAlertDialogContent,
  type AlertDialogContentExposes,
} from '@proto.ui/prototypes-base/alert-dialog';
import type { BootstrapAlertDialogContentProps } from './types';

export default definePrototype<BootstrapAlertDialogContentProps, AlertDialogContentExposes>({
  name: 'bootstrap-2-3-2-alert-dialog-content',
  modules: asAlertDialogContent.modules,
  setup(def) {
    def.props.define({
      size: { type: 'enum', empty: 'fallback', options: ['default', 'sm'] },
    });
    def.props.setDefaults({ size: 'default' });
    const behavior = asAlertDialogContent();
    // b4c4072 less/modals.less: .modal's entered geometry and palette. The
    // available-region cap is a Proto safety constraint, not a Bootstrap rule.
    def.feedback.style.use(
      tw(
        'fixed z-50 left-[50%] top-[10%] -translate-x-1/2 max-h-[calc(var(--proto-ui-available-region-height,100%)_-_20%)] overflow-y-auto bg-background text-foreground font-sans text-[14px] leading-[20px] border border-border rounded-[6px] shadow-[0_3px_7px_rgb(0_0_0/30%)] bg-clip-padding outline-none'
      )
    );
    def.rule({
      when: (w) => w.prop('size').eq('default'),
      intent: (i) =>
        i.feedback.style.use(
          tw('w-[560px] max-w-[min(560px,var(--proto-ui-available-region-width,100%))]')
        ),
    });
    def.rule({
      when: (w) => w.prop('size').eq('sm'),
      intent: (i) =>
        i.feedback.style.use(
          tw('w-[360px] max-w-[min(360px,var(--proto-ui-available-region-width,100%))]')
        ),
    });
    // Top and opacity borrow the same Transition attempt and independent deadline.
    behavior.asTransition.configure({
      enterDuration: 300,
      leaveDuration: 300,
      completion: { kind: 'presentation', timeoutMs: 1000 },
    });
    def.feedback.style.presence({
      owner: behavior.asTransition.presentationOwner,
      closed: { opacity: 0, top: { px: 0, rootText: 0, containingBlock: -0.25 } },
      entered: { opacity: 1, top: { px: 0, rootText: 0, containingBlock: 0.1 } },
      easing: [0, 0, 1, 1],
      channelEasing: { top: [0, 0, 0.58, 1] },
    });
  },
});
