import { asAccessible } from '@proto.ui/hooks';
import { definePrototype, tw } from '@proto.ui/core';
import { asDialogClose } from '@proto.ui/prototypes-base/dialog';
import type { ShadcnDialogCloseExposes, ShadcnDialogCloseProps } from './types';
import { MODERN_OVERLAY_STYLES, setupOverlayPaint } from './style';
import { DIALOG_CLOSE_ICON } from './recipes';
import { SHADCN_ACTION_FOCUS } from '../button/profiles';

const dialogCloseIcon = definePrototype<ShadcnDialogCloseProps, ShadcnDialogCloseExposes>({
  name: 'shadcn-dialog-close-icon',
  setup(def) {
    const accessible = asAccessible();
    const state = asDialogClose().stateHandles;
    if (!state) throw new Error('[shadcn-dialog-close-icon] command states are required.');
    const { disabled, hovered, focusVisible, pressed } = state;
    const style = setupOverlayPaint(def, DIALOG_CLOSE_ICON);

    accessible.name('Close');
    def.feedback.style.use(tw('inline-flex items-center justify-center'));
    def.rule({
      when: (w) => w.all(w.state(style).eq('new-york-v4'), w.state(hovered).eq(true)),
      intent: (i) => i.feedback.style.use(tw('opacity-100')),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq('new-york-v4'), w.state(focusVisible).eq(true)),
      intent: (i) =>
        i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2 ring-offset-background')),
    });
    for (const profile of MODERN_OVERLAY_STYLES) {
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.state(hovered).eq(true)),
        intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.state(hovered).eq(true),
            w.meta('colorScheme').eq('dark')
          ),
        intent: (i) => i.feedback.style.use(tw('bg-muted/50')),
      });
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.state(focusVisible).eq(true)),
        intent: (i) => i.feedback.style.use(tw(SHADCN_ACTION_FOCUS[profile])),
      });
      def.rule({
        when: (w) =>
          w.all(w.state(style).eq(profile), w.state(pressed).eq(true), w.state(disabled).eq(false)),
        intent: (i) => i.feedback.style.use(tw('translate-y-px')),
      });
    }
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
    });

    return (renderer) => [
      renderer.r.slot(),
      renderer.svg.root(
        {
          viewBox: '0 0 24 24',
          width: 16,
          height: 16,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        },
        [renderer.svg.path({ d: 'M18 6 6 18' }), renderer.svg.path({ d: 'm6 6 12 12' })]
      ),
    ];
  },
});

export default dialogCloseIcon;
