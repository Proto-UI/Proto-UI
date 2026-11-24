import { definePrototype, tw } from '@proto.ui/core';
import {
  asDropdownContent,
  type DropdownContentProps as BaseDropdownContentProps,
  type DropdownContentExposes,
} from '@proto.ui/prototypes-base/dropdown';

export interface DropdownContentProps extends BaseDropdownContentProps {
  /** Opaque suppresses optical glass when nested inside another glass surface. */
  material?: 'auto' | 'opaque';
}

export default definePrototype<DropdownContentProps, DropdownContentExposes>({
  name: 'liquid-glass-dropdown-content',
  modules: asDropdownContent.modules,
  setup(def) {
    def.props.define({
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ material: 'auto' });
    const behavior = asDropdownContent();
    behavior.asTransition.configure({ enterDuration: 0, leaveDuration: 0 });
    // Concentric radii: rounded-2xl (16px) outer - p-2 (8px) = rounded-lg (8px) items.
    def.feedback.style.use(
      tw(
        'z-50 min-w-32 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-x-hidden overflow-y-auto outline-none rounded-2xl border border-border ring-1 ring-inset ring-border bg-secondary text-secondary-foreground p-2 shadow-lg'
      )
    );
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) =>
        w.all(w.prop('material').eq('auto'), w.state(behavior.stateHandles.open).eq(true)),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass' }),
    });
    def.rule({
      when: (w) => w.state(behavior.stateHandles.open).eq(true),
      intent: (i) => i.feedback.style.use(tw('animate-in fade-in-0 zoom-in-95 duration-150')),
    });
  },
});
