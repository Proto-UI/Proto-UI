import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerContent,
  type DrawerContentProps,
  type DrawerContentExposes,
} from '@proto.ui/prototypes-base/drawer';

export default definePrototype<DrawerContentProps, DrawerContentExposes>({
  name: 'bootstrap-2-3-2-drawer-content',
  setup(def) {
    const behavior = asDrawerContent();
    // A Proto extension using modal box vocabulary, not a Bootstrap Drawer or
    // jQuery component. Base retains extent, edge, scroll and input ownership.
    def.feedback.style.use(
      tw(
        'min-w-0 flex flex-col border border-border bg-background bg-clip-padding text-foreground text-[14px] leading-[20px] shadow-[0_3px_7px_rgb(0_0_0/30%)] outline-none'
      )
    );

    const side = def.state.string('drawerMotionSide', '');
    behavior.acceptedSide.observe((value) =>
      side.set(value ?? '', 'reason: accepted bootstrap drawer side')
    );
    def.lifecycle.onCreated(() => side.set(behavior.acceptedSide.read() ?? ''));

    for (const [value, radius] of [
      ['bottom', tw('rounded-t-[6px]')],
      ['top', tw('rounded-b-[6px]')],
      ['left', tw('rounded-r-[6px]')],
      ['right', tw('rounded-l-[6px]')],
    ] as const) {
      def.rule({
        when: (w) => w.state(side).eq(value),
        intent: (i) => i.feedback.style.use(radius),
      });
    }

    behavior.asTransition.configure({
      enterDuration: 300,
      leaveDuration: 300,
      completion: { kind: 'presentation', timeoutMs: 600 },
    });
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
      easing: [0.25, 0.1, 0.25, 1],
    });
  },
});
