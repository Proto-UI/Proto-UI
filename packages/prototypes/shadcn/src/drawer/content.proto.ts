import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerContent,
  type DrawerContentProps,
  type DrawerContentExposes,
} from '@proto.ui/prototypes-base/drawer';

export default definePrototype<DrawerContentProps, DrawerContentExposes>({
  name: 'shadcn-drawer-content',
  setup(def) {
    const behavior = asDrawerContent();
    def.props.setDefaults({ maxExtent: { unit: 'available-minus-root-text', value: 6 } });
    // Keep existing uniform edge paint until directional style translation is supported.
    def.feedback.style.use(
      tw('rounded-lg border border-border bg-background text-foreground flex flex-col')
    );
    // P-SHADCN-DRAWER-MOTION: fixed Vaul 1.1.2 presentation, separate safety bound.
    behavior.asTransition.configure({
      enterDuration: 500,
      leaveDuration: 500,
      completion: { kind: 'presentation', timeoutMs: 1000 },
    });
    const side = def.state.string('drawerMotionSide', '');
    behavior.acceptedSide.observe((value) =>
      side.set(value ?? '', 'reason: accepted drawer motion side')
    );
    def.lifecycle.onCreated(() => side.set(behavior.acceptedSide.read() ?? ''));
    const zero = { px: 0, rootText: 0, ownBox: 0 };
    const positive = { px: 0, rootText: 0, ownBox: 1 };
    const negative = { px: 0, rootText: 0, ownBox: -1 };
    def.feedback.style.presence({
      owner: behavior.asTransition.presentationOwner,
      closed: {
        translate: {
          source: side,
          cases: {
            top: [zero, negative],
            bottom: [zero, positive],
            left: [negative, zero],
            right: [positive, zero],
          },
        },
      },
      entered: { translate: [zero, zero] },
      easing: [0.32, 0.72, 0, 1],
    });
  },
});
