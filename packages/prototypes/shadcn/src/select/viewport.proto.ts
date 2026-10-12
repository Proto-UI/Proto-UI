import { definePrototype, tw } from '@proto.ui/core';
import { asSelectViewport } from '@proto.ui/prototypes-base/select';
import { SELECT_VISUAL } from './visual';

export default definePrototype({
  name: 'shadcn-select-viewport',
  setup(def) {
    asSelectViewport();
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
    def.feedback.style.use(tw('relative flex-1 min-h-0 overflow-hidden overflow-y-auto p-1'));
    def.rule({
      when: (w) => w.state(position).eq('popper'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'h-[var(--proto-ui-anchor-height)] w-full min-w-[var(--proto-ui-anchor-width)] scroll-my-1'
          )
        ),
    });
  },
});
