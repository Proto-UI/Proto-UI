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
    def.feedback.style.use(tw('z-50 bg-foreground px-3 py-1.5 text-xs text-background'));
    const { open } = behavior.stateHandles;
    setupPopupMotion(def, open);
    return (renderer) => [renderer.r.slot()];
  },
});

export default tooltipContent;
