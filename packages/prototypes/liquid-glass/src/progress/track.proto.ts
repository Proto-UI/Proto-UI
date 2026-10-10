import { definePrototype, tw } from '@proto.ui/core';
import { asProgressTrack } from '@proto.ui/prototypes-base/progress';
export default definePrototype({
  name: 'liquid-glass-progress-track',
  setup(def) {
    const inherited = asProgressTrack();
    def.feedback.style.use(
      tw('block h-4 w-full overflow-hidden rounded-full border border-border bg-muted')
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
