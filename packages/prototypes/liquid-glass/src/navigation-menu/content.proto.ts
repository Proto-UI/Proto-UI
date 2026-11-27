import { createContextKey, definePrototype, tw } from '@proto.ui/core';
import {
  asNavigationMenuContent,
  type NavigationMenuContentProps,
  type NavigationMenuContentExposes,
} from '@proto.ui/prototypes-base/navigation-menu';

export const LIQUID_GLASS_NAVIGATION_CONTENT_PAINT = createContextKey<{ content: boolean }>(
  'liquid-glass-navigation-content-paint'
);

export interface LiquidGlassNavigationMenuContentProps extends NavigationMenuContentProps {
  material?: 'auto' | 'opaque';
}

export default definePrototype<LiquidGlassNavigationMenuContentProps, NavigationMenuContentExposes>(
  {
    name: 'liquid-glass-navigation-menu-content',
    modules: asNavigationMenuContent.modules,
    setup(def) {
      const behavior = asNavigationMenuContent();
      def.context.provide(LIQUID_GLASS_NAVIGATION_CONTENT_PAINT, { content: true });
      def.props.define({
        material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
      });
      def.props.setDefaults({ material: 'auto' });
      def.feedback.style.use(
        tw(
          'rounded-2xl border border-border bg-secondary text-secondary-foreground shadow-md z-50 min-w-48 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto p-1 outline-none'
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
  }
);
