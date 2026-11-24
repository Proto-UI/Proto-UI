// Neutral content projection: the Image View module keeps owning the native
// image target; ordinary framing travels through the existing style projection.
// Under Apple HIG Materials, Liquid Glass belongs exclusively to floating
// functional controls above content, never on the content image itself.
import { definePrototype, tw } from '@proto.ui/core';
import {
  asImageRoot,
  type ImageRootProps,
  type ImageRootExposes,
} from '@proto.ui/prototypes-base/image';

export type LiquidGlassImageRadius = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

export interface LiquidGlassImageRootProps extends ImageRootProps {
  /** Optional concentric corner framing inside rounded content containers. */
  radius?: LiquidGlassImageRadius;
}

const RADIUS_TOKENS = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  full: 'rounded-full',
} as const;

export const imageRoot = definePrototype<LiquidGlassImageRootProps, ImageRootExposes>({
  name: 'liquid-glass-image-root',
  // The declared Image View module travels with the projection unchanged.
  modules: asImageRoot.modules,
  setup(def) {
    def.props.define({
      radius: {
        type: 'enum',
        empty: 'fallback',
        options: ['none', 'sm', 'md', 'lg', 'xl', '2xl', 'full'],
      },
    });
    def.props.setDefaults({ radius: 'none' });

    // Base owns source/a11yMode/alternativeText/fit projection, loadingStatus
    // exposes and the loadingStatusChange event through the host-owned target.
    // The null render and host ImageView owner are preserved; no slot is
    // fabricated and no optical material is claimed on the image.
    const behavior = asImageRoot();
    // Neutral responsive framing on the adapter-selected image surface; fit,
    // source and loading remain with the existing host-owned Image View protocol.
    def.feedback.style.use(tw('block max-w-full h-auto'));

    for (const [radius, token] of Object.entries(RADIUS_TOKENS) as Array<
      [keyof typeof RADIUS_TOKENS, string]
    >) {
      def.rule({
        when: (w) => w.prop('radius').eq(radius),
        intent: (i) => i.feedback.style.use(tw(token)),
      });
    }

    return behavior.render;
  },
});

export default imageRoot;
