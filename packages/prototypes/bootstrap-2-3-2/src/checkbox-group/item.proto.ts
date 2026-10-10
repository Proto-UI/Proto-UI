import { checkboxGroupGlyph } from './indicator-paint';
import type {
  CheckboxGroupItemProps,
  CheckboxGroupItemExposes,
} from '@proto.ui/prototypes-base/checkbox-group';
import { definePrototype, tw } from '@proto.ui/core';
import { asCheckboxGroupItem } from '@proto.ui/prototypes-base/checkbox-group';
export default definePrototype<CheckboxGroupItemProps, CheckboxGroupItemExposes>({
  name: 'bootstrap-2-3-2-checkbox-group-item',
  setup(def) {
    const inherited = asCheckboxGroupItem();
    def.feedback.style.use(
      tw(
        'inline-flex min-h-8 items-center gap-2 rounded-[4px] border border-border bg-secondary px-3 py-2 text-secondary-foreground shadow-[inset_0_1px_1px_rgb(0_0_0/7.5%)] outline-none'
      )
    );
    const state = inherited.stateHandles!;
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-65 cursor-not-allowed')),
    });
    def.rule({
      when: (w) => w.state(state.checked).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-primary bg-primary text-primary-foreground')),
    });
    def.rule({
      when: (w) => w.state(state.indeterminate).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-primary bg-primary text-primary-foreground')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2')),
    });
    const glyph = checkboxGroupGlyph(def, state);
    return (renderer) => [glyph(renderer), renderer.r.slot()];
  },
});
