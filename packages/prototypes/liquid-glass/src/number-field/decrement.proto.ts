import type {
  NumberFieldPartProps,
  NumberFieldStepExposes,
} from '@proto.ui/prototypes-base/number-field';
import { definePrototype } from '@proto.ui/core';
import { asNumberFieldDecrement } from '@proto.ui/prototypes-base/number-field';
import { setupNumberFieldStepVisual } from './step-visual';

export type LiquidGlassNumberFieldDecrementProps = NumberFieldPartProps & {
  material?: 'auto' | 'opaque';
};

export default definePrototype<LiquidGlassNumberFieldDecrementProps, NumberFieldStepExposes>({
  name: 'liquid-glass-number-field-decrement',
  modules: asNumberFieldDecrement.modules,
  setup(def) {
    def.props.define({
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ material: 'auto' });
    const inherited = asNumberFieldDecrement();
    setupNumberFieldStepVisual(def, inherited.stateHandles!);
    return inherited.render;
  },
});
