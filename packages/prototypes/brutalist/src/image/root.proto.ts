import { definePrototype, tw } from '@proto.ui/core';
import { asImageRoot } from '@proto.ui/prototypes-base/image';
import type { BrutalistImageRootExposes, BrutalistImageRootProps } from './types';

// Source: neobrutalism-components@3306a802. The pinned collection has no
// standalone image component; ImageCard (image-card.tsx) is its only authored
// framed image surface, wearing `rounded-base border-2 border-border ...
// shadow-shadow`. This layer projects that framed-photo grammar onto the
// host-owned image target under the family's Card physical mapping
// (border-black, 4px/4px solid offset shadow). Sizing stays consumer-owned:
// `block max-w-full h-auto` mirrors the sibling family framing while width,
// height and fit remain author inputs. The image is passive — it paints no
// interaction, loading or error chrome of its own; loadingStatus stays a
// Base-exposed fact for consumers.
const IMAGE_SURFACE_TOKENS = [
  'block',
  'max-w-full',
  'h-auto',
  'rounded-base',
  'border-2',
  'border-black',
  'shadow-[4px_4px_0_0_#000]',
].join(' ');

const imageRoot = definePrototype<BrutalistImageRootProps, BrutalistImageRootExposes>({
  name: 'brutalist-image-root',
  // The declared Image View module travels with the projection unchanged; the
  // host-owned target performs the actual loading and rendering.
  modules: asImageRoot.modules,
  setup(def) {
    const behavior = asImageRoot();
    def.feedback.style.use(tw(IMAGE_SURFACE_TOKENS));
    // Base owns source/a11yMode/alternativeText/fit projection, loadingStatus
    // exposes and the loadingStatusChange event; preserve its contentless
    // render without fabricating a slot or a second image owner.
    return behavior.render;
  },
});

export default imageRoot;
