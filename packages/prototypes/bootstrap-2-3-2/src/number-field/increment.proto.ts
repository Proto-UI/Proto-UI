import type {
  NumberFieldPartProps,
  NumberFieldStepExposes,
} from '@proto.ui/prototypes-base/number-field';
import { definePrototype, tw } from '@proto.ui/core';
import { asNumberFieldIncrement } from '@proto.ui/prototypes-base/number-field';
import { setupButtonVisual } from '../button/visual';
export default definePrototype<NumberFieldPartProps, NumberFieldStepExposes>({
  name: 'bootstrap-2-3-2-number-field-increment',
  modules: asNumberFieldIncrement.modules,
  setup(def) {
    const inherited = asNumberFieldIncrement();
    const state = inherited.stateHandles!;
    setupButtonVisual(def, state);
    def.feedback.style.use(tw('h-[30px] min-w-[30px] px-[10px] py-[4px]'));
    def.rule({
      when: (w) => w.state(state.disabled).eq(false),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'hover:bg-[#e6e6e6_linear-gradient(#fff,#e6e6e6)_0_-15px_repeat-x] active:bg-[#e6e6e6_none_0_-15px_repeat-x] active:shadow-[inset_0_2px_4px_rgb(0_0_0/15%),0_1px_2px_rgb(0_0_0/5%)]'
          )
        ),
    });
    return inherited.render;
  },
});
