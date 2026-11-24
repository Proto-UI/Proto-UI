import { definePrototype, tw } from '@proto.ui/core';
import {
  asDialogMask,
  type DialogMaskProps,
  type DialogMaskExposes,
} from '@proto.ui/prototypes-base/dialog';

export default definePrototype<DialogMaskProps, DialogMaskExposes>({
  name: 'liquid-glass-dialog-mask',
  setup(def) {
    const behavior = asDialogMask();
    def.feedback.style.use(tw('fixed inset-0 z-40 bg-black/50 transition-opacity duration-150'));
    behavior.asTransition.configure({ enterDuration: 150, leaveDuration: 150 });
    def.rule({
      when: (w) =>
        w.all(
          w.state(behavior.stateHandles.open).eq(true),
          w.not(w.meta('preference.reducedMotion').eq('reduce'))
        ),
      intent: (i) => i.feedback.style.use(tw('animate-in fade-in-0')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(behavior.stateHandles.open).eq(false),
          w.not(w.meta('preference.reducedMotion').eq('reduce'))
        ),
      intent: (i) => i.feedback.style.use(tw('animate-out fade-out-0')),
    });
  },
});
