import { definePrototype, tw } from '@proto.ui/core';
import { asButton } from '../../../../prototypes/base/src/button/button.proto';

/** Presentation-only shell. All Button semantics come from the unchanged official source. */
export default definePrototype({
  name: 'compiler-ssr-button-fixture',
  setup(def) {
    asButton();
    def.feedback.style.use(
      tw(
        'inline-flex items-center justify-center px-4 py-2 rounded-md border border-black bg-white text-foreground text-sm leading-normal select-text'
      )
    );
    def.rule({
      when: (w) => w.prop('disabled').eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50')),
    });
  },
});
