import { definePrototype, tw } from '@proto.ui/core';
import { asDrawerContent, type DrawerContentExposes } from '@proto.ui/prototypes-base/drawer';
import type { DrawerContentProps } from './types';

export default definePrototype<DrawerContentProps, DrawerContentExposes>({
  name: 'liquid-glass-drawer-content',
  setup(def) {
    const behavior = asDrawerContent();
    def.props.define({
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ material: 'auto' });

    def.feedback.style.use(
      tw(
        'border border-border bg-secondary text-secondary-foreground shadow-lg ring-1 ring-inset ring-foreground/10 p-5 flex flex-col gap-4 outline-none'
      )
    );

    const side = def.state.string('drawerMotionSide', '');
    behavior.acceptedSide.observe((value) =>
      side.set(value ?? '', 'reason: accepted liquid-glass drawer side')
    );
    def.lifecycle.onCreated(() => side.set(behavior.acceptedSide.read() ?? ''));

    for (const [value, radius] of [
      ['bottom', tw('rounded-t-xl')],
      ['top', tw('rounded-b-xl')],
      ['left', tw('rounded-r-xl')],
      ['right', tw('rounded-l-xl')],
    ] as const) {
      def.rule({
        when: (w) => w.state(side).eq(value),
        intent: (i) => i.feedback.style.use(radius),
      });
    }

    behavior.asTransition.configure({
      enterDuration: 320,
      leaveDuration: 240,
      completion: { kind: 'presentation', timeoutMs: 800 },
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
      easing: [0.22, 1, 0.36, 1],
    });

    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) => w.all(w.state(behavior.stateHandles.open).eq(true), w.prop('material').eq('auto')),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass' }),
    });
  },
});
