import { definePrototype, tw } from '@proto.ui/core';
import {
  asDialogContent,
  type DialogContentProps,
  type DialogContentExposes,
} from '@proto.ui/prototypes-base/dialog';

// Upstream .modal: fixed top 10% left 50% width 560px margin-left -280px, 6px radius,
// rgba(0,0,0,.3) border over #999, box-shadow 0 3px 7px rgba(0,0,0,.3), padding-box clip,
// outline none; .modal.fade fades in with opacity .3s linear and slides top from -25%
// (https://github.com/twbs/bootstrap/blob/b4c4072679943773a7582daa63f545ba818fa627/less/modals.less).
// The available-region clamps retain the surface within the Proto overlay. Top
// uses the positioning containing block, independently of the panel's own height.
export default definePrototype<DialogContentProps, DialogContentExposes>({
  name: 'bootstrap-2-3-2-dialog-content',
  setup(def) {
    const behavior = asDialogContent();
    def.feedback.style.use(
      tw(
        'fixed z-50 left-[50%] top-[10%] -translate-x-1/2 w-[560px] max-w-[min(560px,var(--proto-ui-available-region-width,100%))] max-h-[calc(var(--proto-ui-available-region-height,100%)_-_20%)] overflow-y-auto bg-background text-foreground border border-border rounded-[6px] shadow-[0_3px_7px_rgb(0_0_0/30%)] bg-clip-padding outline-none'
      )
    );
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
