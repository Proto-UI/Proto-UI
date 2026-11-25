import { definePrototype, tw } from '@proto.ui/core';
import {
  asNavigationMenuRoot,
  type NavigationMenuRootProps as BaseNavigationMenuRootProps,
  type NavigationMenuRootExposes,
} from '@proto.ui/prototypes-base/navigation-menu';

export type NavigationMenuRootProps = BaseNavigationMenuRootProps & {
  /** Auto enhances the floating navigation bar; pass opaque to opt out. */
  material?: 'auto' | 'opaque';
};

export default definePrototype<NavigationMenuRootProps, NavigationMenuRootExposes>({
  name: 'liquid-glass-navigation-menu-root',
  modules: asNavigationMenuRoot.modules,
  setup(def) {
    def.props.define({
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ material: 'auto' });
    const behavior = asNavigationMenuRoot();
    def.feedback.style.use(
      tw(
        'relative inline-flex max-w-max min-w-0 flex-wrap items-center gap-1 rounded-full border border-border bg-secondary p-1 text-secondary-foreground shadow-sm'
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
