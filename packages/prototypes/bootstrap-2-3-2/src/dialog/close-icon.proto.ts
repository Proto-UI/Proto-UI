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
    asDialogClose();
    asAccessible().name('Close');
    def.feedback.style.use(
      tw(
        'absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-[3px] p-0 text-[20px] font-bold leading-[20px] text-current opacity-40 outline-none'
      )
    );
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
