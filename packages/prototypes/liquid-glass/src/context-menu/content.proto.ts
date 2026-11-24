import { definePrototype, tw } from '@proto.ui/core';
import {
  asContextMenuContent,
  type ContextMenuContentProps as BaseContextMenuContentProps,
  type ContextMenuContentExposes,
} from '@proto.ui/prototypes-base/context-menu';

export type ContextMenuContentProps = BaseContextMenuContentProps & {
  /** Auto enhances only when live host material capability and user preferences allow it. */
  material?: 'auto' | 'opaque';
};

export default definePrototype<ContextMenuContentProps, ContextMenuContentExposes>({
  name: 'liquid-glass-context-menu-content',
  modules: asContextMenuContent.modules,
  setup(def) {
    def.props.define({
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ material: 'auto' });

    const behavior = asContextMenuContent();
    behavior.asTransition.configure({ enterDuration: 0, leaveDuration: 100 });
    const { open } = behavior.stateHandles;

    // Outer 16px (rounded-2xl) + 4px inset (p-1) pairs concentrically with 12px (rounded-xl) items.
    def.feedback.style.use(
      tw(
        'rounded-2xl border border-border ring-1 ring-inset ring-foreground/10 bg-secondary text-secondary-foreground shadow-lg z-50 min-w-40 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto p-1 outline-none'
      )
    );
    def.rule({
      when: (w) => w.all(w.state(open).eq(true), w.not(w.meta('reducedMotion').eq(true))),
      intent: (i) => i.feedback.style.use(tw('animate-in fade-in-0 zoom-in-95 duration-150')),
    });
    def.rule({
      when: (w) => w.all(w.state(open).eq(false), w.not(w.meta('reducedMotion').eq(true))),
      intent: (i) => i.feedback.style.use(tw('animate-out fade-out-0 zoom-out-95 duration-100')),
    });
    def.rule({
      when: (w) => w.meta('reducedMotion').eq(true),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
    });
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) => w.all(w.state(open).eq(true), w.prop('material').eq('auto')),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass' }),
    });
  },
});
