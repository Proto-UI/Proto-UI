import { checkboxGroupGlyph } from './indicator-paint';
import type {
  CheckboxGroupItemProps,
  CheckboxGroupItemExposes,
} from '@proto.ui/prototypes-base/checkbox-group';
import { definePrototype, tw } from '@proto.ui/core';
import { asCheckboxGroupAll } from '@proto.ui/prototypes-base/checkbox-group';
import { BRUTALIST_DISABLED_TOKENS } from '../style';
export default definePrototype<CheckboxGroupItemProps, CheckboxGroupItemExposes>({
  name: 'brutalist-checkbox-group-all',
  setup(def) {
    const inherited = asCheckboxGroupAll();
    // Ordinary checkbox row; typography follows design-contract (DM Sans 500).
    def.feedback.style.use(
      tw(
        'inline-flex min-h-6 min-w-0 items-center gap-2 font-sans text-sm font-medium leading-5 text-foreground select-none cursor-pointer outline-none transition-none'
      )
    );
    const state = inherited.stateHandles!;
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(`${BRUTALIST_DISABLED_TOKENS} cursor-not-allowed`)),
    });
    def.rule({
      when: (w) => w.all(w.state(state.readOnly).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('cursor-default')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('forced-colors-focus-outline')),
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
