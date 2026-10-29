import type { ShadcnSelectViewportProps } from './types';
import { definePrototype, tw } from '@proto.ui/core';
import { asSelectViewport } from '@proto.ui/prototypes-base/select';
import { SELECT_VISUAL } from './visual';
import { setupSelectStyle } from './style';

export default definePrototype<ShadcnSelectViewportProps>({
  name: 'shadcn-select-viewport',
  setup(def) {
    const inherited = asSelectViewport();
    const style = setupSelectStyle(def);
    const position = def.state.string('selectViewportPosition', 'item-aligned');
    def.context.subscribe(SELECT_VISUAL, (_run, next) =>
      position.set(next.position, 'reason: select viewport position')
    );
    def.lifecycle.onCreated((run) =>
      position.set(
        run.context.read(SELECT_VISUAL).position,
        'reason: select viewport initial position'
      )
    );
    def.feedback.style.use(tw('relative flex-1 min-h-0 overflow-hidden overflow-y-auto'));
    def.rule({
      when: (w) => w.state(style).eq('new-york-v4'),
      intent: (i) => i.feedback.style.use(tw('p-1')),
    });
    def.rule({
      when: (w) => w.not(w.state(style).eq('new-york-v4')),
      intent: (i) => i.feedback.style.use(tw('p-0')),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq('new-york-v4'), w.state(position).eq('popper')),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'h-[var(--proto-ui-anchor-height)] w-full min-w-[var(--proto-ui-anchor-width)] scroll-my-1'
          )
        ),
    });
    return inherited.render;
  },
});
