import { definePrototype, tw } from '@proto.ui/core';
import { BRUTALIST_PANEL_TOKENS } from '../style';
import { asDialogContent } from '@proto.ui/prototypes-base/dialog';
import type { BrutalistDialogContentExposes, BrutalistDialogContentProps } from './types';

const dialogContent = definePrototype<BrutalistDialogContentProps, BrutalistDialogContentExposes>({
  name: 'brutalist-dialog-content',
  setup(def) {
    // P-BRUTALIST-DIALOG-CONTENT-BASE-INHERITANCE: inherit Base open/transition ownership once.
    // P-BRUTALIST-DIALOG-CONTENT-PUBLIC-BOUNDARY: TypeScript boundary has no own props and keeps open/transitionState/isPresent.
    const dialog = asDialogContent();
    // P-BRUTALIST-DIALOG-CONTENT-TRANSITION
    dialog.asTransition.configure({ enterDuration: 200, leaveDuration: 200 });
    const dialogState = dialog.stateHandles;
    const { open } = dialogState;
    // P-BRUTALIST-DIALOG-CONTENT-VISUAL-GRAMMAR: centered hard-shadowed rounded modal panel (BRUTALIST_PANEL_TOKENS, fixed translate).
    def.feedback.style.use(
      tw(
        `fixed left-[var(--proto-ui-available-region-center-x,50%)] top-[var(--proto-ui-available-region-center-y,50%)] grid w-full max-w-[min(32rem,calc(var(--proto-ui-available-region-width,100%)_-_2rem))] max-h-[calc(var(--proto-ui-available-region-height,100%)_-_2rem)] overflow-y-auto gap-4 -translate-x-1/2 -translate-y-1/2 p-6 outline-none transition-opacity duration-200 ${BRUTALIST_PANEL_TOKENS} shadow-[4px_4px_0_0_#000]`
      )
    );

    def.rule({
      when: (w) => w.state(open).eq(true),
      intent: (i) => i.feedback.style.use(tw('animate-in fade-in-0 zoom-in-95')),
    });

    def.rule({
      when: (w) => w.state(open).eq(false),
      intent: (i) => i.feedback.style.use(tw('animate-out fade-out-0 zoom-out-95')),
    });
  },
});

/** P-BRUTALIST-DIALOG-CONTENT-ENTRY: `brutalist-dialog-content` is the only public Dialog content entry in this slice. */

export default dialogContent;
