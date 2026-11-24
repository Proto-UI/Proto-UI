import { definePrototype, tw } from '@proto.ui/core';
import { asTooltipContent } from '@proto.ui/prototypes-base/tooltip';
import type { ShadcnTooltipContentExposes, ShadcnTooltipContentProps } from './types';
import { setupOverlayPaint } from '../dialog/style';
import { TOOLTIP_PANEL } from './recipes';
import { setupPopupMotion } from '../popover/motion';

const tooltipContent = definePrototype<ShadcnTooltipContentProps, ShadcnTooltipContentExposes>({
  name: 'shadcn-tooltip-content',
  setup(def) {
    const behavior = asTooltipContent();
    setupOverlayPaint(def, TOOLTIP_PANEL, 'nova');
    def.feedback.style.use(tw('z-50 px-3 py-1.5 text-xs duration-150'));
    behavior.asTransition.configure({ enterDuration: 150, leaveDuration: 100 });
    const { open } = behavior.stateHandles;
    setupPopupMotion(def, open);
    def.rule({
      when: (w) => w.meta('preference.reducedMotion').eq('reduce'),
      intent: (i) => i.feedback.style.use(tw('animate-none transition-none')),
    });
    return (renderer) => [renderer.r.slot()];
  },
});

export default tooltipContent;
