import { definePrototype, tw } from '@proto.ui/core';
import { asToastViewport, type ToastViewportExposes } from '@proto.ui/prototypes-base/toast';
import type { ToastViewportProps } from './types';
import { setupShadcnStyleScope } from '../style-scope';

const VIEWPORT_PLACEMENTS = [
  ['top-left', tw('top-6 left-6')],
  ['top-center', tw('top-6 left-1/2 -translate-x-1/2')],
  ['top-right', tw('top-6 right-6')],
  ['bottom-left', tw('bottom-6 left-6')],
  ['bottom-center', tw('bottom-6 left-1/2 -translate-x-1/2')],
  ['bottom-right', tw('bottom-6 right-6')],
] as const;

export default definePrototype<ToastViewportProps, ToastViewportExposes>({
  name: 'shadcn-toast-viewport',
  setup(def) {
    const behavior = asToastViewport();
    const state = behavior.stateHandles!;
    setupShadcnStyleScope(def);
    def.feedback.style.use(tw('fixed z-50 w-[356px] max-w-[calc(100vw_-_2rem)]'));
    // While collapsed or empty, keep the viewport click-through so only open
    // cards receive pointer hits. Once expanded with open messages, switch the
    // viewport itself to pointer-events-auto so inter-card gaps stay inside the
    // hover region and cannot oscillate between expanded and collapsed states.
    def.rule({
      when: (w) => w.any(w.state(state.hasOpen).eq(false), w.state(state.expanded).eq(false)),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.hasOpen).eq(true), w.state(state.expanded).eq(true)),
      intent: (i) => i.feedback.style.use(tw('pointer-events-auto')),
    });
    for (const [position, placement] of VIEWPORT_PLACEMENTS) {
      def.rule({
        when: (w) => w.state(state.position).eq(position),
        intent: (i) => i.feedback.style.use(placement),
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
