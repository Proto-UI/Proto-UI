import { checkboxGroupGlyph } from './indicator-paint';
import type {
  CheckboxGroupItemProps,
  CheckboxGroupItemExposes,
} from '@proto.ui/prototypes-base/checkbox-group';
import { definePrototype, tw } from '@proto.ui/core';
import { asCheckboxGroupAll } from '@proto.ui/prototypes-base/checkbox-group';
export default definePrototype<CheckboxGroupItemProps, CheckboxGroupItemExposes>({
  name: 'bootstrap-2-3-2-checkbox-group-all',
  setup(def) {
    const inherited = asCheckboxGroupAll();
    // Ordinary checkbox row; card-label presentation is not an implicit variant.
    def.feedback.style.use(
      tw(
        'inline-flex min-h-6 min-w-0 items-center gap-1 font-normal text-sm leading-5 text-foreground outline-none'
      )
    );
    const state = inherited.stateHandles!;
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-65 cursor-not-allowed')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('forced-colors-focus-outline ring-2 ring-ring ring-offset-2')),
    });
    const glyph = checkboxGroupGlyph(def, state);
    return (renderer) => [
      glyph(renderer),
      renderer.el(
        'span',
        { style: tw('min-w-0 whitespace-normal break-words') },
        renderer.r.slot()
      ),
    ];
  },
});
