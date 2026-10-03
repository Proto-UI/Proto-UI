import { definePrototype, tw } from '@proto.ui/core';
import { asButton, type ButtonProps, type ButtonExposes } from '@proto.ui/prototypes-base/button';
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

/** Media activation is a Base Button, not a stripped family action surface.
 * Its feedback keeps the source geometry fixed while preserving Button state,
 * keyboard activation, accessible naming and the real focus-visible owner.
 */
export const imageZoomTrigger = definePrototype<ButtonProps, ButtonExposes>({
  name: 'website-image-zoom-trigger',
  setup(def) {
    const button = asButton().stateHandles;
    if (!button) throw new Error('[image-zoom-trigger] missing Base Button state handles');
    def.feedback.style.use(tw('docs-image-zoom-trigger'));
    def.rule({
      when: (w) => w.state(button.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2 ring-offset-background')),
    });
  },
});

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
    // Content owns outside dismissal and FocusScope restoration. The passive
    // mask must not let this same pointer sample's native default steal focus
    // after that restoration; express prevention through the public event API.
    def.event.on('pointer.down', (_run, event) => {
      event.control.requestDefaultActionPrevention({
        reason: 'image-mask.preserve-return-focus',
        source: 'website-image-zoom-mask',
      });
    });
  },
});
