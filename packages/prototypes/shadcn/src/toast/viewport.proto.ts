import { definePrototype, tw, type StyleHandle } from '@proto.ui/core';
import {
  asToastViewport,
  type ToastPosition,
  type ToastViewportExposes,
} from '@proto.ui/prototypes-base/toast';
import type { ToastViewportProps } from './types';
import { setupShadcnStyleScope } from '../style-scope';

const VIEWPORT_POSITION_STYLES: Record<ToastPosition, StyleHandle> = {
  'top-left': tw('top-6 left-6'),
  'top-center': tw('top-6 left-1/2 -translate-x-1/2'),
  'top-right': tw('top-6 right-6'),
  'bottom-left': tw('bottom-6 left-6'),
  'bottom-center': tw('bottom-6 left-1/2 -translate-x-1/2'),
  'bottom-right': tw('bottom-6 right-6'),
};

export default definePrototype<ToastViewportProps, ToastViewportExposes>({
  name: 'shadcn-toast-viewport',
  setup(def) {
    const behavior = asToastViewport();
    const state = behavior.stateHandles!;
    setupShadcnStyleScope(def);
    def.feedback.style.use(
      tw('fixed z-50 w-[356px] max-w-[calc(100vw_-_2rem)] pointer-events-none')
    );
    for (const pos of Object.keys(VIEWPORT_POSITION_STYLES) as ToastPosition[]) {
      def.rule({
        when: (w) => w.state(state.position).eq(pos),
        intent: (i) => i.feedback.style.use(VIEWPORT_POSITION_STYLES[pos]),
      });
    }
    def.rule({
      when: (w) => w.state(state.expanded).eq(false),
      intent: (i) => i.feedback.style.use(tw('block')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.expanded).eq(true),
          w.any(
            w.state(state.position).eq('bottom-left'),
            w.state(state.position).eq('bottom-center'),
            w.state(state.position).eq('bottom-right')
          )
        ),
      intent: (i) => i.feedback.style.use(tw('flex flex-col-reverse gap-3.5')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.expanded).eq(true),
          w.any(
            w.state(state.position).eq('top-left'),
            w.state(state.position).eq('top-center'),
            w.state(state.position).eq('top-right')
          )
        ),
      intent: (i) => i.feedback.style.use(tw('flex flex-col gap-3.5')),
    });
    return behavior.render;
  },
});
