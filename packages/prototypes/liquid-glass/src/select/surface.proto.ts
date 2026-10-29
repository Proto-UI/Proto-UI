import { definePrototype, tw } from '@proto.ui/core';
import { asSelectSurface, SELECT_CONTEXT } from '@proto.ui/prototypes-base/select';
import type { LiquidGlassSelectSurfaceProps } from './types';

// In the complete Surface/Viewport/ItemText composition Content is only the
// portal frame: this Surface is the single eligible owner of the popup paint
// and material slot, so no overlapping nested owners exist.
export default definePrototype<LiquidGlassSelectSurfaceProps>({
  name: 'liquid-glass-select-surface',
  setup(def) {
    asSelectSurface();
    const open = def.state.bool('open', false);
    const sync = (value: { open: boolean }) => {
      open.set(value.open, 'reason: select surface open sync');
    };
    def.context.subscribe(SELECT_CONTEXT, (_run, next) => sync(next));
    def.lifecycle.onCreated((run) => sync(run.context.read(SELECT_CONTEXT)));
    // Identical version-2 slot as legacy Content: only one owner per surface.
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) => w.state(open).eq(true),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass' }),
    });
    // Same panel geometry and opaque colors as the former Content paint.
    // Clipping is not another scrollport; Viewport alone owns scrolling.
    def.feedback.style.use(
      tw(
        'z-50 relative flex flex-col min-w-0 w-[max(var(--proto-ui-anchor-width),12rem)] max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-hidden outline-none rounded-2xl border border-border bg-secondary text-secondary-foreground shadow-md'
      )
    );
    return (renderer) => [renderer.r.slot()];
  },
});
