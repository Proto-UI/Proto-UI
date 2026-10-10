import { definePrototype, tw } from '@proto.ui/core';
import { asFieldsetRoot } from '@proto.ui/prototypes-base/fieldset';
export default definePrototype({
  name: 'liquid-glass-fieldset-root',
  setup(def) {
    const inherited = asFieldsetRoot();
    def.feedback.style.use(
      tw('flex w-full min-w-0 flex-col gap-3 text-foreground rounded-2xl border border-border p-4')
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
