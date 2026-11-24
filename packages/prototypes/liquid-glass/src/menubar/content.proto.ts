import { definePrototype, tw } from '@proto.ui/core';
import {
  asMenubarContent,
  type MenubarContentProps as BaseMenubarContentProps,
  type MenubarContentExposes,
} from '@proto.ui/prototypes-base/menubar';

export type MenubarContentProps = BaseMenubarContentProps & {
  /** Opaque retains the same surface geometry and fallback colors without requesting glass material. */
  material?: 'auto' | 'opaque';
};

export default definePrototype<MenubarContentProps, MenubarContentExposes>({
  name: 'liquid-glass-menubar-content',
  modules: asMenubarContent.modules,
  setup(def) {
    def.props.define({
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ material: 'auto' });
    const behavior = asMenubarContent();
    def.feedback.style.use(
      tw(
        'rounded-2xl border border-border bg-secondary text-secondary-foreground ring-1 ring-inset ring-border shadow-md z-50 min-w-44 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto p-1 outline-none'
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
        w.all(w.state(behavior.getState!('open')!).eq(true), w.prop('material').eq('auto')),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass' }),
    });
    return behavior.render;
  },
});
