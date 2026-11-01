import { definePrototype, tw } from '@proto.ui/core';
import {
  asDialogContent,
  type DialogContentProps,
  type DialogContentExposes,
} from '@proto.ui/prototypes-base/dialog';
import type { ShadcnStyleProps } from '../style-scope';
import { setupCommandStyle, setupCommandPresentation } from './visual';
import type { CommandPresentationProps } from './types';

/** The consumer binds both durations from the same selected profile as paint:
 * Rhea100ms; New York200ms. An inner CommandRoot scope cannot select its parent.
 * Runtime style-only changes do not implicitly mutate Transition configuration.
 */
export type CommandDialogContentProps = ShadcnStyleProps &
  CommandPresentationProps &
  Required<Pick<DialogContentProps, 'enterDuration' | 'leaveDuration'>>;
export type CommandDialogContentExposes = Pick<
  DialogContentExposes,
  'open' | 'transitionState' | 'isPresent'
>;

/** MIT visual reference: shadcn/ui3d98900e CommandDialog and style-rhea.css. */
export default definePrototype<CommandDialogContentProps, CommandDialogContentExposes>({
  name: 'shadcn-command-dialog-content',
  setup(def) {
    // P-SHADCN-COMMAND-DIALOG-OWNERSHIP: inherit exactly one Dialog owner.
    const dialog = asDialogContent();
    // Setup fallback only; required public duration props win for each runtime phase.
    dialog.asTransition.configure({ enterDuration: 200, leaveDuration: 200, interrupt: 'reverse' });
    const style = setupCommandStyle(def);
    setupCommandPresentation(def);
    const { open } = dialog.stateHandles;
    def.feedback.style.use(
      tw(
        'fixed left-[var(--proto-ui-available-region-center-x,50%)] grid min-w-0 w-full -translate-x-1/2 overflow-hidden p-0 outline-none'
      )
    );
    // P-SHADCN-COMMAND-DIALOG-PROFILE, P-SHADCN-COMMAND-DIALOG-GEOMETRY
    def.rule({
      when: (w) => w.all(w.state(style).eq('new-york-v4'), w.prop('presentation').eq('default')),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'top-[var(--proto-ui-available-region-center-y,50%)] -translate-y-1/2 max-w-[min(32rem,calc(var(--proto-ui-available-region-width,100%)_-_2rem))] max-h-[calc(var(--proto-ui-available-region-height,100%)_-_2rem)] gap-4 rounded-lg border border-border bg-background text-foreground shadow-lg duration-200'
          )
        ),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq('rhea'), w.prop('presentation').eq('default')),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'top-[calc(var(--proto-ui-available-region-center-y,50vh)_-_var(--proto-ui-available-region-height,100vh)/6)] translate-y-0 max-w-[min(28rem,calc(var(--proto-ui-available-region-width,100%)_-_2rem))] max-h-[calc(var(--proto-ui-available-region-height,100vh)*2/3_-_1rem)] gap-6 rounded-[var(--pui-radius-3xl)] bg-popover text-popover-foreground text-sm shadow-xl ring-1 ring-foreground/5 duration-100'
          )
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('rhea'),
          w.prop('presentation').eq('default'),
          w.meta('colorScheme').eq('dark')
        ),
      intent: (i) => i.feedback.style.use(tw('ring-foreground/10')),
    });
    // Explicit website recipe: top15%/32rem; ordinary default above is unchanged.
    // Root-relative available-region bounds keep the authored footer in the panel.
    def.rule({
      when: (w) => w.prop('presentation').eq('menu'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'top-[calc(var(--proto-ui-available-region-center-y,50vh)_-_var(--proto-ui-available-region-height,100vh)*0.35)] translate-y-0 max-w-[min(32rem,calc(var(--proto-ui-available-region-width,100%)_-_2rem))] max-h-[calc(var(--proto-ui-available-region-height,100vh)*0.85_-_1rem)] gap-0 rounded-xl border-0 bg-popover text-popover-foreground text-sm shadow-2xl ring-4 ring-border/80'
          )
        ),
    });
    // Durations remain selected by the same public style profile and consumer.
    for (const [profile, duration] of [
      ['rhea', 'duration-100'],
      ['new-york-v4', 'duration-200'],
    ] as const)
      def.rule({
        when: (w) => w.all(w.prop('presentation').eq('menu'), w.state(style).eq(profile)),
        intent: (i) => i.feedback.style.use(tw(duration)),
      });
    // P-SHADCN-COMMAND-DIALOG-MOTION: do not rely on a timer to suppress CSS motion.
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
