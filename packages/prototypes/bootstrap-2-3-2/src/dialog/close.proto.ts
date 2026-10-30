import { definePrototype, tw } from '@proto.ui/core';
import {
  asDialogClose,
  type DialogCloseProps,
  type DialogCloseExposes,
} from '@proto.ui/prototypes-base/dialog';

// Upstream .close: float right, 20px bold @black at opacity .2, white 0 1px 0
// text-shadow, and opacity .4/no underline on hover/focus. The button variant removes
// padding, background and border. The inherited Dialog command keeps sole ownership.
// https://github.com/twbs/bootstrap/blob/b4c4072679943773a7582daa63f545ba818fa627/less/close.less
export default definePrototype<DialogCloseProps, DialogCloseExposes>({
  name: 'bootstrap-2-3-2-dialog-close',
  setup(def) {
    const behavior = asDialogClose();
    const state = behavior.getState!;
    def.feedback.style.use(
      tw(
        'float-right p-0 bg-transparent border-0 text-[20px] font-bold leading-[20px] text-paint-[#000_0_1px_0_rgb(255_255_255/100%)] opacity-20 cursor-pointer select-none outline-none'
      )
    );
    def.rule({
      when: (w) => w.state(state('hovered')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-40 no-underline')),
    });
    def.rule({
      when: (w) => w.state(state('focused')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-40 no-underline')),
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
  },
});
