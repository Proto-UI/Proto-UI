import type {
  NumberFieldPartProps,
  NumberFieldStepExposes,
} from '@proto.ui/prototypes-base/number-field';
import { definePrototype } from '@proto.ui/core';
import { asNumberFieldIncrement } from '@proto.ui/prototypes-base/number-field';
import { setupNumberFieldStepVisual } from './step-visual';

export type LiquidGlassNumberFieldIncrementProps = NumberFieldPartProps & {
  material?: 'auto' | 'opaque';
};

export default definePrototype<LiquidGlassNumberFieldIncrementProps, NumberFieldStepExposes>({
  name: 'liquid-glass-number-field-increment',
  modules: asNumberFieldIncrement.modules,
  setup(def) {
    def.props.define({
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ material: 'auto' });
    const inherited = asNumberFieldIncrement();
    setupNumberFieldStepVisual(def, inherited.stateHandles!);
    return inherited.render;
  },
});
