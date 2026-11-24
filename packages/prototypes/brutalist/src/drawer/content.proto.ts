import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerContent,
  type DrawerContentProps,
  type DrawerContentExposes,
} from '@proto.ui/prototypes-base/drawer';

export default definePrototype<DrawerContentProps, DrawerContentExposes>({
  name: 'brutalist-drawer-content',
  setup(def) {
    const behavior = asDrawerContent();
    def.props.setDefaults({ maxExtent: { unit: 'available-minus-root-text', value: 6 } });
    def.feedback.style.use(
      tw(
        'border-2 border-black bg-background text-foreground font-sans font-medium shadow-[4px_4px_0_0_#000] p-4 flex flex-col gap-4 outline-none'
      )
    );

    const side = def.state.string('drawerMotionSide', '');
    behavior.acceptedSide.observe((value) =>
      side.set(value ?? '', 'reason: accepted brutalist drawer side')
    );
    def.lifecycle.onCreated(() => side.set(behavior.acceptedSide.read() ?? ''));

    // BRUTALIST_THEME maps --pui-radius-lg to 5px (rounded-base); round only the exposed edges.
    for (const [value, radius] of [
      ['bottom', tw('rounded-t-lg')],
      ['top', tw('rounded-b-lg')],
      ['left', tw('rounded-r-lg')],
      ['right', tw('rounded-l-lg')],
    ] as const) {
      def.rule({
        when: (w) => w.state(side).eq(value),
        intent: (i) => i.feedback.style.use(radius),
      });
    }

    behavior.asTransition.configure({
      enterDuration: 200,
      leaveDuration: 200,
      completion: { kind: 'presentation', timeoutMs: 500 },
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
      easing: [0.32, 0.72, 0, 1],
    });
  },
});
