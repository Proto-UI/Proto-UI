import { definePrototype, tw } from '@proto.ui/core';
import { asDialogContent, type DialogContentExposes } from '@proto.ui/prototypes-base/dialog';

export interface CommandDialogContentProps {}
export type CommandDialogContentExposes = Pick<
  DialogContentExposes,
  'open' | 'transitionState' | 'isPresent'
>;

/** MIT visual reference: neobrutalism-components 3306a802, command.tsx.
 * Content owns no Command query or second Dialog state. The inner Command,
 * not this borderless outer panel, owns its 2px border (separate anatomy debt).
 */
export default definePrototype<CommandDialogContentProps, CommandDialogContentExposes>({
  name: 'brutalist-command-dialog-content',
  setup(def) {
    // P-BRUTALIST-COMMAND-DIALOG-OWNERSHIP
    const dialog = asDialogContent();
    dialog.asTransition.configure({ enterDuration: 200, leaveDuration: 200, interrupt: 'reverse' });
    const { open } = dialog.stateHandles;
    // P-BRUTALIST-COMMAND-DIALOG-GEOMETRY: direct recipe, never p6 followed by p0.
    def.feedback.style.use(
      tw(
        'fixed left-[var(--proto-ui-available-region-center-x,50%)] top-[var(--proto-ui-available-region-center-y,50%)] grid min-w-0 w-full max-w-[min(32rem,calc(var(--proto-ui-available-region-width,100%)_-_2rem))] max-h-[calc(var(--proto-ui-available-region-height,100%)_-_2rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden gap-4 rounded-none border-0 bg-background text-foreground font-sans font-medium p-0 shadow-[4px_4px_0_0_#000] outline-none duration-200'
      )
    );
    // P-BRUTALIST-COMMAND-DIALOG-MOTION: safe unknown/reduced preference has no CSS motion.
    def.rule({
      when: (w) =>
        w.all(w.state(open).eq(true), w.meta('preference.reducedMotion').eq('no-preference')),
      intent: (i) => i.feedback.style.use(tw('animate-in fade-in-0 zoom-in-95')),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(open).eq(false), w.meta('preference.reducedMotion').eq('no-preference')),
      intent: (i) => i.feedback.style.use(tw('animate-out fade-out-0 zoom-out-95')),
    });
  },
});
