import { asAccessible } from '@proto.ui/hooks';
import { definePrototype, tw } from '@proto.ui/core';
import { asDialogClose } from '@proto.ui/prototypes-base/dialog';
import type { ShadcnDialogCloseExposes, ShadcnDialogCloseProps } from './types';

const dialogCloseIcon = definePrototype<ShadcnDialogCloseProps, ShadcnDialogCloseExposes>({
  name: 'shadcn-dialog-close-icon',
  setup(def) {
    const accessible = asAccessible();
    const state = asDialogClose().stateHandles;
    if (!state) throw new Error('[shadcn-dialog-close-icon] command states are required.');
    const { disabled, hovered, focusVisible } = state;

    accessible.name('Close');
    def.feedback.style.use(
      tw(
        'absolute right-4 top-4 inline-flex items-center justify-center rounded-sm opacity-70 transition-opacity outline-none ring-offset-0'
      )
    );
    def.rule({
      when: (w) => w.state(hovered).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-100')),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2 ring-offset-background')),
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

export default dialogCloseIcon;
