import { definePrototype, tw } from '@proto.ui/core';
import {
  asImageRoot,
  type ImageRootExposes,
  type ImageRootProps,
} from '@proto.ui/prototypes-base/image';
import { setupShadcnStyleSelection, type ShadcnStyleProps } from '../style-scope';

export type ShadcnImageRadius = 'default' | 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ShadcnImageRootProps extends ImageRootProps, ShadcnStyleProps {
  /** Optional corner framing; `'default'` follows the active Shadcn style profile. */
  radius?: ShadcnImageRadius;
}

const EXPLICIT_RADIUS = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
} as const;

/** Proto extension: neutral Image View with Shadcn framing and style-profile radii. */
export const imageRoot = definePrototype<ShadcnImageRootProps, ImageRootExposes>({
  name: 'shadcn-image-root',
  modules: asImageRoot.modules,
  setup(def) {
    def.props.define({
      radius: {
        type: 'enum',
        empty: 'fallback',
        options: ['default', 'none', 'sm', 'md', 'lg', 'xl', 'full'],
      },
    });
    def.props.setDefaults({ radius: 'default' });

    const behavior = asImageRoot();
    const style = setupShadcnStyleSelection(def, 'new-york-v4');

    // Neutral responsive framing on the host-owned image target.
    def.feedback.style.use(tw('block max-w-full h-auto'));

    // Profile-driven default corner radii when `radius` is `'default'`.
    def.rule({
      when: (w) =>
        w.all(
          w.prop('radius').eq('default'),
          w.any(w.state(style).eq('lyra'), w.state(style).eq('sera'))
        ),
      intent: (i) => i.feedback.style.use(tw('rounded-none')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('radius').eq('default'),
          w.any(
            w.state(style).eq('vega'),
            w.state(style).eq('mira'),
            w.state(style).eq('new-york-v4')
          )
        ),
      intent: (i) => i.feedback.style.use(tw('rounded-md')),
    });
    def.rule({
      when: (w) => w.all(w.prop('radius').eq('default'), w.state(style).eq('nova')),
      intent: (i) => i.feedback.style.use(tw('rounded-lg')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('radius').eq('default'),
          w.any(w.state(style).eq('maia'), w.state(style).eq('luma'), w.state(style).eq('rhea'))
        ),
      intent: (i) => i.feedback.style.use(tw('rounded-xl')),
    });

    // Explicit caller radius overrides.
    for (const [radius, token] of Object.entries(EXPLICIT_RADIUS) as Array<
      [keyof typeof EXPLICIT_RADIUS, string]
    >) {
      def.rule({
        when: (w) => w.prop('radius').eq(radius),
        intent: (i) => i.feedback.style.use(tw(token)),
      });
    }

    // Preserve the module-owned target and Base's explicitly contentless render.
    return behavior.render;
  },
});

export default imageRoot;
