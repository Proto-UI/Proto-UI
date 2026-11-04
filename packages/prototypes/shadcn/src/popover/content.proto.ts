import { definePrototype, tw } from '@proto.ui/core';
import { asPopoverContent, type PopoverContentExposes } from '@proto.ui/prototypes-base/popover';
import type { PopoverContentProps } from './types';
import { setupOverlayStyle } from '../dialog/style';
import { SHADCN_STYLE_IDS } from '../style-scope';
import {
  POPOVER_PANEL,
  POPOVER_NAVIGATION_PANEL,
  POPOVER_NAVIGATION_SUPPORTED_TRANSLUCENCY,
} from './recipes';
import { POPUP_OPEN_MOTION, POPUP_CLOSE_MOTION, POPUP_SIDE_MOTION } from './motion';

export default definePrototype<PopoverContentProps, PopoverContentExposes>({
  name: 'shadcn-popover-content',
  setup(def) {
    const behavior = asPopoverContent();
    def.props.define({
      presentation: { type: 'enum', empty: 'fallback', options: ['default', 'navigation'] },
    });
    def.props.setDefaults({ presentation: 'default' });
    const style = setupOverlayStyle(def, 'nova');
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) => w.all(w.prop('presentation').eq('default'), w.state(style).eq(profile)),
        intent: (i) => i.feedback.style.use(POPOVER_PANEL[profile]),
      });
    }
    for (const profile of ['luma', 'rhea'] as const) {
      def.rule({
        when: (w) =>
          w.all(
            w.prop('presentation').eq('default'),
            w.state(style).eq(profile),
            w.meta('colorScheme').eq('dark')
          ),
        intent: (i) => i.feedback.style.use(tw('ring-foreground/10')),
      });
    }
    def.rule({
      when: (w) => w.prop('presentation').eq('default'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'z-50 w-72 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto outline-none'
          )
        ),
    });
    def.rule({
      when: (w) => w.prop('presentation').eq('navigation'),
      intent: (i) => i.feedback.style.use(POPOVER_NAVIGATION_PANEL),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('presentation').eq('navigation'),
          w.meta('preference.reducedTransparency').eq('no-preference'),
          w.meta('preference.forcedColors').eq('none'),
          w.meta('styleSupport.backdropBlur4px').eq(true)
        ),
      intent: (i) => i.feedback.style.use(POPOVER_NAVIGATION_SUPPORTED_TRANSLUCENCY),
    });
    const { open } = behavior.stateHandles;
    // Concrete presentation conditions compose the shared pure motion recipes.
    // Other popup authors retain the unchanged side-only setup helper.
    const defaultMotionRule: typeof def.rule = (rule) =>
      def.rule({
        ...rule,
        when: (w) => w.all(w.prop('presentation').eq('default'), rule.when(w)),
      });
    defaultMotionRule({
      when: (w) => w.state(open).eq(true),
      intent: (i) => i.feedback.style.use(POPUP_OPEN_MOTION),
    });
    defaultMotionRule({
      when: (w) => w.state(open).eq(false),
      intent: (i) => i.feedback.style.use(POPUP_CLOSE_MOTION),
    });
    for (const [side, animation] of POPUP_SIDE_MOTION) {
      defaultMotionRule({
        when: (w) => w.prop('side').eq(side),
        intent: (i) => i.feedback.style.use(animation),
      });
    }
    def.rule({
      when: (w) => w.all(w.prop('presentation').eq('navigation'), w.state(open).eq(true)),
      intent: (i) => i.feedback.style.use(tw('animate-none')),
    });
    def.rule({
      when: (w) => w.all(w.prop('presentation').eq('navigation'), w.state(open).eq(false)),
      intent: (i) => i.feedback.style.use(POPUP_CLOSE_MOTION),
    });
    // The existing zero-duration default remains a retention-policy gap; CSS
    // animation tokens alone do not establish a retained native leave frame.
    behavior.asTransition.configure({ enterDuration: 0, leaveDuration: 0 });
  },
});
