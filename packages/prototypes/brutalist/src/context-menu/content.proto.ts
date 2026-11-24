import { definePrototype, tw } from '@proto.ui/core';
import { BRUTALIST_PANEL_TOKENS } from '../style';
import {
  asContextMenuContent,
  type ContextMenuContentProps,
  type ContextMenuContentExposes,
} from '@proto.ui/prototypes-base/context-menu';

export default definePrototype<ContextMenuContentProps, ContextMenuContentExposes>({
  name: 'brutalist-context-menu-content',
  modules: asContextMenuContent.modules,
  setup(def) {
    const behavior = asContextMenuContent();
    behavior.asTransition.configure({ enterDuration: 150, leaveDuration: 100 });
    const { open } = behavior.stateHandles;
    const { transitionState } = behavior.asTransition;

    // Design contract: floating menu content uses rounded-base, 2px black border, and 3px foreground shadow.
    def.feedback.style.use(
      tw(
        `${BRUTALIST_PANEL_TOKENS} shadow-[3px_3px_0_0_var(--pui-foreground)] z-50 min-w-40 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-x-hidden overflow-y-auto p-1 outline-none transition-none duration-150`
      )
    );
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.meta('reducedMotion').eq(true)),
          w.any(w.state(transitionState).eq('entering'), w.state(transitionState).eq('entered'))
        ),
      intent: (i) => i.feedback.style.use(tw('animate-in fade-in-0 zoom-in-95')),
    });
    def.rule({
      when: (w) => w.all(w.not(w.meta('reducedMotion').eq(true)), w.state(open).eq(false)),
      intent: (i) => i.feedback.style.use(tw('animate-out fade-out-0 zoom-out-95')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.meta('reducedMotion').eq(true)),
          w.state(open).eq(true),
          w.prop('side').eq('bottom')
        ),
      intent: (i) => i.feedback.style.use(tw('slide-in-from-top-2')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.meta('reducedMotion').eq(true)),
          w.state(open).eq(true),
          w.prop('side').eq('top')
        ),
      intent: (i) => i.feedback.style.use(tw('slide-in-from-bottom-2')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.meta('reducedMotion').eq(true)),
          w.state(open).eq(true),
          w.prop('side').eq('left')
        ),
      intent: (i) => i.feedback.style.use(tw('slide-in-from-right-2')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.meta('reducedMotion').eq(true)),
          w.state(open).eq(true),
          w.prop('side').eq('right')
        ),
      intent: (i) => i.feedback.style.use(tw('slide-in-from-left-2')),
    });
  },
});
