import { checkboxGroupGlyph } from './indicator-paint';
import type {
  CheckboxGroupItemProps,
  CheckboxGroupItemExposes,
} from '@proto.ui/prototypes-base/checkbox-group';
import { definePrototype, tw } from '@proto.ui/core';
import { asCheckboxGroupAll } from '@proto.ui/prototypes-base/checkbox-group';
export default definePrototype<CheckboxGroupItemProps, CheckboxGroupItemExposes>({
  name: 'liquid-glass-checkbox-group-all',
  setup(def) {
    const inherited = asCheckboxGroupAll();
    // Content-layer checkbox rows stay compact and neutral (no glass-on-glass card slabs).
    def.feedback.style.use(
      tw(
        'inline-flex min-h-6 min-w-0 items-center gap-2.5 text-sm font-medium leading-5 text-foreground select-none cursor-pointer outline-none'
      )
    );
    const state = inherited.stateHandles!;
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      // Avoid whole-host opacity so opaque fallback contrast stays readable.
      intent: (i) =>
        i.feedback.style.use(tw('text-muted-foreground cursor-not-allowed shadow-none')),
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
    const render = inherited.render;
    if (!render) throw new Error('[liquid-glass-checkbox-group-all] Missing Base renderer.');
    return (renderer) => {
      const content = render(renderer);
      return [
        glyph(renderer),
        renderer.el(
          'span',
          { style: tw('min-w-0 whitespace-normal break-words') },
          ...(Array.isArray(content) ? content : [content])
        ),
      ];
    };
  },
});
