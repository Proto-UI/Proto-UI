import { definePrototype, tw } from '@proto.ui/core';
import {
  asMenubarRoot,
  type MenubarRootProps as BaseMenubarRootProps,
  type MenubarRootExposes,
} from '@proto.ui/prototypes-base/menubar';

export type MenubarRootProps = BaseMenubarRootProps & {
  /** Auto enhances the floating menu bar; pass opaque to opt out. */
  material?: 'auto' | 'opaque';
};

export default definePrototype<MenubarRootProps, MenubarRootExposes>({
  name: 'liquid-glass-menubar-root',
  modules: asMenubarRoot.modules,
  setup(def) {
    def.props.define({
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ material: 'auto' });
    const behavior = asMenubarRoot();
    def.feedback.style.use(
      tw(
        'relative inline-flex min-w-0 flex-wrap items-center gap-1 rounded-2xl border border-border bg-secondary p-1 text-secondary-foreground shadow-sm'
      )
    );
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) => w.prop('material').eq('auto'),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass', variant: 'regular' }),
    });
    return behavior.render;
  },
});
