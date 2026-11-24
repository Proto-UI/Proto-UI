import { definePrototype, tw } from '@proto.ui/core';
import {
  asToastViewport,
  type ToastPosition,
  type ToastViewportExposes,
} from '@proto.ui/prototypes-base/toast';
import type { ToastViewportProps } from './types';
import { setupShadcnStyleScope } from '../style-scope';

const VIEWPORT_POSITION_CLASSES: Record<ToastPosition, string> = {
  'top-left': 'top-4 start-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'top-right': 'top-4 end-4',
  'bottom-left': 'bottom-4 start-4',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  'bottom-right': 'bottom-4 end-4',
};

export default definePrototype<ToastViewportProps, ToastViewportExposes>({
  name: 'shadcn-toast-viewport',
  setup(def) {
    const behavior = asToastViewport();
    const state = behavior.stateHandles!;
    setupShadcnStyleScope(def);
    def.feedback.style.use(
      tw(
        'fixed z-50 grid w-96 max-w-[calc(100vw_-_2rem)] max-h-[calc(100vh_-_2rem)] overflow-y-auto p-1'
      )
    );
    for (const pos of Object.keys(VIEWPORT_POSITION_CLASSES) as ToastPosition[]) {
      def.rule({
        when: (w) => w.state(state.position).eq(pos),
        intent: (i) => i.feedback.style.use(tw(VIEWPORT_POSITION_CLASSES[pos])),
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
