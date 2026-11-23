import { definePrototype, tw } from '@proto.ui/core';
import { asTransition } from '../../../prototypes/base/src/transition/as-transition.proto';

/** Ordinary authored Transition plus a same-owner nominal endpoint selection. */
export default definePrototype({
  name: 'presence-presentation-owner',
  setup(def) {
    const transition = asTransition();
    transition.configure({
      enterDuration: 160,
      leaveDuration: 160,
      completion: { kind: 'presentation', timeoutMs: 1000 },
    });
    def.props.define({ side: { type: 'enum', options: ['left', 'right'], default: 'left' } });
    const side = def.state.enum('presentationSide', 'left', { options: ['left', 'right'] });
    def.lifecycle.onCreated((run) => side.set(run.props.get().side));
    def.props.watch(['side'], (_run, next) => side.set(next.side));
    def.feedback.style.use(tw('block'));
    def.feedback.style.presence({
      owner: transition.presentationOwner,
      closed: {
        opacity: 0,
        translate: {
          source: side,
          cases: {
            left: [
              { px: 0, rootText: 0, ownBox: -1 },
              { px: 0, rootText: 0, ownBox: 0 },
            ],
            right: [
              { px: 0, rootText: 0, ownBox: 1 },
              { px: 0, rootText: 0, ownBox: 0 },
            ],
          },
        },
      },
      entered: {
        opacity: 1,
        translate: [
          { px: 0, rootText: 0, ownBox: 0 },
          { px: 0, rootText: 0, ownBox: 0 },
        ],
      },
      easing: [0, 0, 1, 1],
    });
    return (r) => r.el('section', [transition.transitionState.get(), r.slot()]);
  },
});
