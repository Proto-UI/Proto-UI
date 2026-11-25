import { definePrototype, tw } from '@proto.ui/core';
import {
  asToastViewport,
  type ToastViewportProps,
  type ToastViewportExposes,
} from '@proto.ui/prototypes-base/toast';

const VIEWPORT_PLACEMENTS = [
  ['top-left', tw('top-6 left-6')],
  ['top-center', tw('top-6 left-1/2 -translate-x-1/2')],
  ['top-right', tw('top-6 right-6')],
  ['bottom-left', tw('bottom-6 left-6')],
  ['bottom-center', tw('bottom-6 left-1/2 -translate-x-1/2')],
  ['bottom-right', tw('bottom-6 right-6')],
] as const;

export default definePrototype<ToastViewportProps, ToastViewportExposes>({
  name: 'bootstrap-2-3-2-toast-viewport',
  modules: asToastViewport.modules,
  setup(def) {
    const behavior = asToastViewport();
    const state = behavior.stateHandles!;
    // Existing viewport geometry is a Proto extension. Bootstrap alerts do
    // not define a fixed toast stack, keyboard hotkey or focus-first owner.
    def.feedback.style.use(
      tw(
        'fixed z-50 grid w-96 max-w-[calc(100vw_-_2rem)] max-h-[calc(100vh_-_2rem)] overflow-y-auto p-1'
      )
    );
    for (const [position, placement] of VIEWPORT_PLACEMENTS) {
      def.rule({
        when: (w) => w.state(state.position).eq(position),
        intent: (i) => i.feedback.style.use(placement),
      });
    }
    def.rule({
      when: (w) => w.state(state.expanded).eq(false),
      intent: (i) => i.feedback.style.use(tw('gap-2')),
    });
    def.rule({
      when: (w) => w.state(state.expanded).eq(true),
      intent: (i) => i.feedback.style.use(tw('gap-3')),
    });
    return behavior.render;
  },
});
