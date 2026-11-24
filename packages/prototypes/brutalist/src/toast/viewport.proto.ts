import { definePrototype, tw, type StyleHandle } from '@proto.ui/core';
import {
  asToastViewport,
  type ToastPosition,
  type ToastViewportProps,
  type ToastViewportExposes,
} from '@proto.ui/prototypes-base/toast';

const VIEWPORT_POSITION_STYLES: Record<ToastPosition, StyleHandle> = {
  'top-left': tw('top-6 left-6'),
  'top-center': tw('top-6 left-1/2 -translate-x-1/2'),
  'top-right': tw('top-6 right-6'),
  'bottom-left': tw('bottom-6 left-6'),
  'bottom-center': tw('bottom-6 left-1/2 -translate-x-1/2'),
  'bottom-right': tw('bottom-6 right-6'),
};

export default definePrototype<ToastViewportProps, ToastViewportExposes>({
  name: 'brutalist-toast-viewport',
  modules: asToastViewport.modules,
  setup(def) {
    const behavior = asToastViewport();
    const state = behavior.stateHandles!;
    def.feedback.style.use(
      tw(
        'fixed z-50 grid w-96 max-w-[calc(100vw_-_2rem)] max-h-[calc(100vh_-_2rem)] overflow-y-auto p-1'
      )
    );
    for (const pos of Object.keys(VIEWPORT_POSITION_STYLES) as ToastPosition[]) {
      def.rule({
        when: (w) => w.state(state.position).eq(pos),
        intent: (i) => i.feedback.style.use(VIEWPORT_POSITION_STYLES[pos]),
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
