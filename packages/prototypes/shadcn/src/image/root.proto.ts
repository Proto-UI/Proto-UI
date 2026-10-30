import { definePrototype } from '@proto.ui/core';
import {
  asImageRoot,
  type ImageRootExposes,
  type ImageRootProps,
} from '@proto.ui/prototypes-base/image';

/** Proto extension: neutral Image View, not Shadcn Avatar or an image loader. */
export const imageRoot = definePrototype<ImageRootProps, ImageRootExposes>({
  name: 'shadcn-image-root',
  modules: asImageRoot.modules,
  setup() {
    // Preserve the module-owned target and Base's explicitly contentless render.
    return asImageRoot().render;
  },
});

export default imageRoot;
