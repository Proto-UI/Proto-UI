import { definePrototype, tw } from '@proto.ui/core';
import { asDrawerContent, type DrawerContentExposes } from '@proto.ui/prototypes-base/drawer';
import type { DrawerContentProps } from './types';
import { SHADCN_STYLE_IDS } from '../style-scope';
import { setupOverlayPaint } from '../dialog/style';
import { DRAWER_CONTENT, DRAWER_INSET } from './recipes';

export default definePrototype<DrawerContentProps, DrawerContentExposes>({
  name: 'shadcn-drawer-content',
  setup(def) {
    const behavior = asDrawerContent();
    const style = setupOverlayPaint(def, DRAWER_CONTENT);
    def.props.setDefaults({ maxExtent: { unit: 'available-minus-root-text', value: 6 } });
    const inset = def.feedback.style.declareDecoration();
    for (const profile of ['maia', 'mira', 'luma', 'rhea'] as const) {
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) => i.feedback.style.to(inset).use(tw(DRAWER_INSET[profile])),
      });
    }
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
    for (const profile of SHADCN_STYLE_IDS) {
      if (profile === 'maia' || profile === 'mira' || profile === 'luma' || profile === 'rhea')
        continue;
      for (const [value, border] of [
        ['top', tw('border-b border-border')],
        ['bottom', tw('border-t border-border')],
        ['left', tw('border-r border-border')],
        ['right', tw('border-l border-border')],
      ] as const) {
        def.rule({
          when: (w) => w.all(w.state(style).eq(profile), w.state(side).eq(value)),
          intent: (i) => i.feedback.style.use(border),
        });
      }
    }
    for (const profile of ['vega', 'nova'] as const) {
      for (const [value, radius] of [
        ['top', tw('rounded-b-xl')],
        ['bottom', tw('rounded-t-xl')],
        ['left', tw('rounded-r-xl')],
        ['right', tw('rounded-l-xl')],
      ] as const) {
        def.rule({
          when: (w) => w.all(w.state(style).eq(profile), w.state(side).eq(value)),
          intent: (i) => i.feedback.style.use(radius),
        });
      }
    }
    def.rule({
      when: (w) => w.all(w.state(style).eq('new-york-v4'), w.state(side).eq('top')),
      intent: (i) => i.feedback.style.use(tw('rounded-b-lg')),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq('new-york-v4'), w.state(side).eq('bottom')),
      intent: (i) => i.feedback.style.use(tw('rounded-t-lg')),
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
