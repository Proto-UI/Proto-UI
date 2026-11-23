import { definePrototype } from '@proto.ui/core';
import { asTransition } from '../../../prototypes/base/src/transition/as-transition.proto';

// The same authored input is consumed by Runtime and the native source compiler.
// Expected behavior belongs to C-AS-TRANSITION-0001 and
// C-TRANSITION-COLD-PREPARATION-0001, not either implementation.
export default definePrototype({
  name: 'independent-transition-owner',
  setup(def) {
    const transition = asTransition();
    const repeated = asTransition();
    transition.configure({ coldEntryPreparation: true, enterDuration: 5, leaveDuration: 7 });
    let interruptNext = false;
    let trace = '';
    transition.transitionState.watch((_run, event) => {
      if (event.type !== 'next') return;
      trace = trace + event.next + ',';
      if (interruptNext && event.next === 'entering') {
        interruptNext = false;
        transition.controls.leave();
      }
    });
    def.expose.value('sameHandle', transition === repeated);
    def.expose.method('readTrace', () => trace);
    def.expose.method('interruptNext', () => {
      interruptNext = true;
    });
    return (r) => r.el('section', [transition.transitionState.get(), r.slot()]);
  },
});
