import { definePrototype, tw } from '@proto.ui/core';
import {
  asDialogContent,
  asDialogMask,
  type DialogContentProps,
  type DialogContentExposes,
  type DialogMaskProps,
  type DialogMaskExposes,
} from '@proto.ui/prototypes-base/dialog';
import './documentation-image-zoom.proto.css';

export const IMAGE_ZOOM_DURATION = 220;

/** Website-private media presentation, not a Shadcn/Brutalist Dialog variant.
 * The adjacent Web style asset consumes the public Transition phase projection.
 * Base retains open, presence, focus, outside-boundary and Escape ownership.
 */
export const imageZoomContent = definePrototype<DialogContentProps, DialogContentExposes>({
  name: 'website-image-zoom-content',
  setup(def) {
    const dialog = asDialogContent();
    dialog.asTransition.configure({
      enterDuration: IMAGE_ZOOM_DURATION,
      leaveDuration: IMAGE_ZOOM_DURATION,
      interrupt: 'reverse',
    });
    def.feedback.style.use(tw('block fixed outline-none docs-image-zoom-content'));
  },
});

export const imageZoomMask = definePrototype<DialogMaskProps, DialogMaskExposes>({
  name: 'website-image-zoom-mask',
  setup(def) {
    const dialog = asDialogMask();
    dialog.asTransition.configure({
      enterDuration: IMAGE_ZOOM_DURATION,
      leaveDuration: IMAGE_ZOOM_DURATION,
      interrupt: 'reverse',
    });
    def.feedback.style.use(tw('block fixed inset-0 docs-image-zoom-mask'));
  },
});
