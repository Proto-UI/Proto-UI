import { definePrototype, tw } from '@proto.ui/core';
import { asDialogClose } from '@proto.ui/prototypes-base/dialog';
import type { BrutalistDialogCloseExposes, BrutalistDialogCloseProps } from './types';

const dialogCloseIcon = definePrototype<BrutalistDialogCloseProps, BrutalistDialogCloseExposes>({
  name: 'brutalist-dialog-close-icon',
  setup(def) {
    // P-BRUTALIST-DIALOG-CLOSE-ICON-BASE-INHERITANCE: inherit Base Dialog Close (close/disabled/hovered/focusVisible) once, as precomposed close-icon variant.
    const state = asDialogClose().stateHandles;
    if (!state) throw new Error('[brutalist-dialog-close-icon] command states are required.');
    const { disabled, hovered, focusVisible } = state;

    // P-BRUTALIST-DIALOG-CLOSE-ICON-A11Y-NAME: a11y accessible name 'Close'.
    def.a11y.name('Close');
    // P-BRUTALIST-DIALOG-CLOSE-ICON-VISUAL-GRAMMAR + P-BRUTALIST-DIALOG-CLOSE-ICON-PAIR-INVARIANT: fixed bg-canary/text-canary-foreground surface, square border-2 black, hard shadow-3, trailing X icon.
    def.feedback.style.use(
      tw(
        'absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-none border-2 border-black bg-canary text-canary-foreground shadow-[3px_3px_0_0_#000] outline-none transition-none'
      )
    );
    // P-BRUTALIST-DIALOG-CLOSE-ICON-INTERACTION: hover → bg-coral with its own paired foreground and deeper shadow; focus-visible → ring-3; disabled → opacity-50 pointer-events-none.
    def.rule({
      when: (w) => w.state(hovered).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('bg-coral text-coral-foreground shadow-[4px_4px_0_0_#000]')),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-3 ring-ring/50')),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
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
        },
        [renderer.svg.path({ d: 'M18 6 6 18' }), renderer.svg.path({ d: 'm6 6 12 12' })]
      ),
    ];
  },
});

// P-BRUTALIST-DIALOG-CLOSE-ICON-ENTRY: `brutalist-dialog-close-icon` is the only public Dialog close-icon entry in this slice.

export default dialogCloseIcon;
