import { definePrototype, tw } from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import {
  asDialogClose,
  type DialogCloseExposes,
  type DialogCloseProps,
} from '@proto.ui/prototypes-base/dialog';

/** Icon-only form of the inherited Bootstrap close command. */
const dialogCloseIcon = definePrototype<DialogCloseProps, DialogCloseExposes>({
  name: 'bootstrap-2-3-2-dialog-close-icon',
  setup(def) {
    const behavior = asDialogClose();
    const state = behavior.getState!;
    asAccessible().name('Close');
    def.feedback.style.use(
      tw(
        'absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-[3px] p-0 text-[20px] font-bold leading-[20px] text-foreground bg-transparent border-0 cursor-pointer outline-none'
      )
    );
    def.rule({
      when: (w) => w.state(state('hovered')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
    });
    def.rule({
      when: (w) => w.state(state('focusVisible')!).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2 ring-offset-background')),
    });
    def.rule({
      when: (w) => w.state(state('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 pointer-events-none cursor-not-allowed')),
    });
    return (renderer) => [
      renderer.r.slot(),
      renderer.svg.root(
        {
          viewBox: '0 0 24 24',
          width: 16,
          height: 16,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
        [renderer.svg.path({ d: 'M18 6 6 18' }), renderer.svg.path({ d: 'm6 6 12 12' })]
      ),
    ];
  },
});

export default dialogCloseIcon;
