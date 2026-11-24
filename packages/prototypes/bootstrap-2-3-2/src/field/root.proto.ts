import { definePrototype, tw } from '@proto.ui/core';
import {
  asFieldRoot,
  type FieldRootProps,
  type FieldRootExposes,
} from '@proto.ui/prototypes-base/field';

export type Bootstrap232FieldOrientation = 'vertical' | 'horizontal';
export type Bootstrap232FieldRootProps = FieldRootProps & {
  orientation?: Bootstrap232FieldOrientation;
};

export default definePrototype<Bootstrap232FieldRootProps, FieldRootExposes>({
  name: 'bootstrap-2-3-2-field-root',
  modules: asFieldRoot.modules,
  setup(def) {
    const inherited = asFieldRoot();
    def.props.define({
      orientation: { type: 'enum', empty: 'fallback', options: ['vertical', 'horizontal'] },
    });
    def.props.setDefaults({ orientation: 'vertical' });
    def.feedback.style.use(tw('min-w-0 mb-[10px] text-foreground text-[14px] leading-[20px]'));
    def.rule({
      when: (w) => w.prop('orientation').eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('block')),
    });
    def.rule({
      when: (w) => w.prop('orientation').eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('flex flex-row items-center justify-between gap-3')),
    });
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.invalid).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-destructive')),
    });
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-65')),
    });
    return inherited.render;
  },
});
