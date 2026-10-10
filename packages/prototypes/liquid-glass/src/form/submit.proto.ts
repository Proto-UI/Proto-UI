import { definePrototype, tw } from '@proto.ui/core';
import { asFormSubmit } from '@proto.ui/prototypes-base/form';
export default definePrototype({
  name: 'liquid-glass-form-submit',
  setup(def) {
    const inherited = asFormSubmit();
    def.feedback.style.use(
      tw(
        'inline-flex min-h-11 items-center justify-center rounded-2xl border border-border bg-primary px-4 py-2 text-primary-foreground outline-none'
      )
    );
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.feedback.material.use({ intent: 'liquid-glass' });
    return inherited.render;
  },
});
