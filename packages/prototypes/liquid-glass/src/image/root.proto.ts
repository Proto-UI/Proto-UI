// Neutral content projection: the Image View module keeps owning the native
// image target; ordinary framing travels through the existing style projection.
import { definePrototype, tw } from '@proto.ui/core';
import {
  asImageRoot,
  type ImageRootProps,
  type ImageRootExposes,
} from '@proto.ui/prototypes-base/image';

export const imageRoot = definePrototype<ImageRootProps, ImageRootExposes>({
  name: 'liquid-glass-image-root',
  // The declared Image View module travels with the projection unchanged.
  modules: asImageRoot.modules,
  setup(def) {
    // Base owns source/a11yMode/alternativeText/fit projection, loadingStatus
    // exposes and the loadingStatusChange event through the host-owned target.
    // The null render and host ImageView owner are preserved; no slot is
    // fabricated and no optical material is claimed on the image.
    const behavior = asImageRoot();
    // Neutral framing on the adapter-selected image surface; fit, source and
    // loading remain with the existing host-owned Image View protocol.
    def.feedback.style.use(tw('block max-w-full'));
    return behavior.render;
  },
});

export default imageRoot;
