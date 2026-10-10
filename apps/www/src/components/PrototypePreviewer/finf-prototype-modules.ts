import type { Prototype } from '@proto.ui/core';
import { registerPrototype } from './registry';

// Explicit source slices. This registry does not confer catalog or release admission.
export const finfPrototypeModules: Record<string, () => Promise<void>> = {
  'base-alert-dialog-root': async () => {
    const module = await import('@proto.ui/prototypes-base/alert-dialog');
    registerExactPrototype('base-alert-dialog-root', module.alertDialogRoot);
  },
  'base-alert-dialog-trigger': async () => {
    const module = await import('@proto.ui/prototypes-base/alert-dialog');
    registerExactPrototype('base-alert-dialog-trigger', module.alertDialogTrigger);
  },
  'base-alert-dialog-content': async () => {
    const module = await import('@proto.ui/prototypes-base/alert-dialog');
    registerExactPrototype('base-alert-dialog-content', module.alertDialogContent);
  },
  'base-alert-dialog-title': async () => {
    const module = await import('@proto.ui/prototypes-base/alert-dialog');
    registerExactPrototype('base-alert-dialog-title', module.alertDialogTitle);
  },
  'base-alert-dialog-description': async () => {
    const module = await import('@proto.ui/prototypes-base/alert-dialog');
    registerExactPrototype('base-alert-dialog-description', module.alertDialogDescription);
  },
  'base-alert-dialog-cancel': async () => {
    const module = await import('@proto.ui/prototypes-base/alert-dialog');
    registerExactPrototype('base-alert-dialog-cancel', module.alertDialogCancel);
  },
  'base-alert-dialog-action': async () => {
    const module = await import('@proto.ui/prototypes-base/alert-dialog');
    registerExactPrototype('base-alert-dialog-action', module.alertDialogAction);
  },
  'base-alert-dialog-mask': async () => {
    const module = await import('@proto.ui/prototypes-base/alert-dialog');
    registerExactPrototype('base-alert-dialog-mask', module.alertDialogMask);
  },
  'shadcn-alert-dialog-root': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/alert-dialog');
    registerExactPrototype('shadcn-alert-dialog-root', module.alertDialogRoot);
  },
  'shadcn-alert-dialog-trigger': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/alert-dialog');
    registerExactPrototype('shadcn-alert-dialog-trigger', module.alertDialogTrigger);
  },
  'shadcn-alert-dialog-content': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/alert-dialog');
    registerExactPrototype('shadcn-alert-dialog-content', module.alertDialogContent);
  },
  'shadcn-alert-dialog-title': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/alert-dialog');
    registerExactPrototype('shadcn-alert-dialog-title', module.alertDialogTitle);
  },
  'shadcn-alert-dialog-description': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/alert-dialog');
    registerExactPrototype('shadcn-alert-dialog-description', module.alertDialogDescription);
  },
  'shadcn-alert-dialog-cancel': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/alert-dialog');
    registerExactPrototype('shadcn-alert-dialog-cancel', module.alertDialogCancel);
  },
  'shadcn-alert-dialog-action': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/alert-dialog');
    registerExactPrototype('shadcn-alert-dialog-action', module.alertDialogAction);
  },
  'shadcn-alert-dialog-mask': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/alert-dialog');
    registerExactPrototype('shadcn-alert-dialog-mask', module.alertDialogMask);
  },
  'brutalist-alert-dialog-root': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/alert-dialog');
    registerExactPrototype('brutalist-alert-dialog-root', module.alertDialogRoot);
  },
  'brutalist-alert-dialog-trigger': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/alert-dialog');
    registerExactPrototype('brutalist-alert-dialog-trigger', module.alertDialogTrigger);
  },
  'brutalist-alert-dialog-content': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/alert-dialog');
    registerExactPrototype('brutalist-alert-dialog-content', module.alertDialogContent);
  },
  'brutalist-alert-dialog-title': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/alert-dialog');
    registerExactPrototype('brutalist-alert-dialog-title', module.alertDialogTitle);
  },
  'brutalist-alert-dialog-description': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/alert-dialog');
    registerExactPrototype('brutalist-alert-dialog-description', module.alertDialogDescription);
  },
  'brutalist-alert-dialog-cancel': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/alert-dialog');
    registerExactPrototype('brutalist-alert-dialog-cancel', module.alertDialogCancel);
  },
  'brutalist-alert-dialog-action': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/alert-dialog');
    registerExactPrototype('brutalist-alert-dialog-action', module.alertDialogAction);
  },
  'brutalist-alert-dialog-mask': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/alert-dialog');
    registerExactPrototype('brutalist-alert-dialog-mask', module.alertDialogMask);
  },
  'bootstrap-2-3-2-alert-dialog-root': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/alert-dialog');
    registerExactPrototype('bootstrap-2-3-2-alert-dialog-root', module.alertDialogRoot);
  },
  'bootstrap-2-3-2-alert-dialog-trigger': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/alert-dialog');
    registerExactPrototype('bootstrap-2-3-2-alert-dialog-trigger', module.alertDialogTrigger);
  },
  'bootstrap-2-3-2-alert-dialog-content': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/alert-dialog');
    registerExactPrototype('bootstrap-2-3-2-alert-dialog-content', module.alertDialogContent);
  },
  'bootstrap-2-3-2-alert-dialog-title': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/alert-dialog');
    registerExactPrototype('bootstrap-2-3-2-alert-dialog-title', module.alertDialogTitle);
  },
  'bootstrap-2-3-2-alert-dialog-description': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/alert-dialog');
    registerExactPrototype(
      'bootstrap-2-3-2-alert-dialog-description',
      module.alertDialogDescription
    );
  },
  'bootstrap-2-3-2-alert-dialog-cancel': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/alert-dialog');
    registerExactPrototype('bootstrap-2-3-2-alert-dialog-cancel', module.alertDialogCancel);
  },
  'bootstrap-2-3-2-alert-dialog-action': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/alert-dialog');
    registerExactPrototype('bootstrap-2-3-2-alert-dialog-action', module.alertDialogAction);
  },
  'bootstrap-2-3-2-alert-dialog-mask': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/alert-dialog');
    registerExactPrototype('bootstrap-2-3-2-alert-dialog-mask', module.alertDialogMask);
  },
  'liquid-glass-alert-dialog-root': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/alert-dialog');
    registerExactPrototype('liquid-glass-alert-dialog-root', module.alertDialogRoot);
  },
  'liquid-glass-alert-dialog-trigger': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/alert-dialog');
    registerExactPrototype('liquid-glass-alert-dialog-trigger', module.alertDialogTrigger);
  },
  'liquid-glass-alert-dialog-content': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/alert-dialog');
    registerExactPrototype('liquid-glass-alert-dialog-content', module.alertDialogContent);
  },
  'liquid-glass-alert-dialog-title': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/alert-dialog');
    registerExactPrototype('liquid-glass-alert-dialog-title', module.alertDialogTitle);
  },
  'liquid-glass-alert-dialog-description': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/alert-dialog');
    registerExactPrototype('liquid-glass-alert-dialog-description', module.alertDialogDescription);
  },
  'liquid-glass-alert-dialog-cancel': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/alert-dialog');
    registerExactPrototype('liquid-glass-alert-dialog-cancel', module.alertDialogCancel);
  },
  'liquid-glass-alert-dialog-action': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/alert-dialog');
    registerExactPrototype('liquid-glass-alert-dialog-action', module.alertDialogAction);
  },
  'liquid-glass-alert-dialog-mask': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/alert-dialog');
    registerExactPrototype('liquid-glass-alert-dialog-mask', module.alertDialogMask);
  },
  'base-drawer-root': async () => {
    const module = await import('@proto.ui/prototypes-base/drawer');
    registerExactPrototype('base-drawer-root', module.drawerRoot);
  },
  'base-drawer-trigger': async () => {
    const module = await import('@proto.ui/prototypes-base/drawer');
    registerExactPrototype('base-drawer-trigger', module.drawerTrigger);
  },
  'base-drawer-content': async () => {
    const module = await import('@proto.ui/prototypes-base/drawer');
    registerExactPrototype('base-drawer-content', module.drawerContent);
  },
  'base-drawer-title': async () => {
    const module = await import('@proto.ui/prototypes-base/drawer');
    registerExactPrototype('base-drawer-title', module.drawerTitle);
  },
  'base-drawer-description': async () => {
    const module = await import('@proto.ui/prototypes-base/drawer');
    registerExactPrototype('base-drawer-description', module.drawerDescription);
  },
  'base-drawer-close': async () => {
    const module = await import('@proto.ui/prototypes-base/drawer');
    registerExactPrototype('base-drawer-close', module.drawerClose);
  },
  'base-drawer-mask': async () => {
    const module = await import('@proto.ui/prototypes-base/drawer');
    registerExactPrototype('base-drawer-mask', module.drawerMask);
  },
  'shadcn-drawer-root': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/drawer');
    registerExactPrototype('shadcn-drawer-root', module.drawerRoot);
  },
  'shadcn-drawer-trigger': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/drawer');
    registerExactPrototype('shadcn-drawer-trigger', module.drawerTrigger);
  },
  'shadcn-drawer-content': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/drawer');
    registerExactPrototype('shadcn-drawer-content', module.drawerContent);
  },
  'shadcn-drawer-title': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/drawer');
    registerExactPrototype('shadcn-drawer-title', module.drawerTitle);
  },
  'shadcn-drawer-description': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/drawer');
    registerExactPrototype('shadcn-drawer-description', module.drawerDescription);
  },
  'shadcn-drawer-close': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/drawer');
    registerExactPrototype('shadcn-drawer-close', module.drawerClose);
  },
  'shadcn-drawer-mask': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/drawer');
    registerExactPrototype('shadcn-drawer-mask', module.drawerMask);
  },
  'brutalist-drawer-root': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/drawer');
    registerExactPrototype('brutalist-drawer-root', module.drawerRoot);
  },
  'brutalist-drawer-trigger': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/drawer');
    registerExactPrototype('brutalist-drawer-trigger', module.drawerTrigger);
  },
  'brutalist-drawer-content': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/drawer');
    registerExactPrototype('brutalist-drawer-content', module.drawerContent);
  },
  'brutalist-drawer-title': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/drawer');
    registerExactPrototype('brutalist-drawer-title', module.drawerTitle);
  },
  'brutalist-drawer-description': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/drawer');
    registerExactPrototype('brutalist-drawer-description', module.drawerDescription);
  },
  'brutalist-drawer-close': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/drawer');
    registerExactPrototype('brutalist-drawer-close', module.drawerClose);
  },
  'brutalist-drawer-mask': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/drawer');
    registerExactPrototype('brutalist-drawer-mask', module.drawerMask);
  },
  'bootstrap-2-3-2-drawer-root': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/drawer');
    registerExactPrototype('bootstrap-2-3-2-drawer-root', module.drawerRoot);
  },
  'bootstrap-2-3-2-drawer-trigger': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/drawer');
    registerExactPrototype('bootstrap-2-3-2-drawer-trigger', module.drawerTrigger);
  },
  'bootstrap-2-3-2-drawer-content': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/drawer');
    registerExactPrototype('bootstrap-2-3-2-drawer-content', module.drawerContent);
  },
  'bootstrap-2-3-2-drawer-title': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/drawer');
    registerExactPrototype('bootstrap-2-3-2-drawer-title', module.drawerTitle);
  },
  'bootstrap-2-3-2-drawer-description': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/drawer');
    registerExactPrototype('bootstrap-2-3-2-drawer-description', module.drawerDescription);
  },
  'bootstrap-2-3-2-drawer-close': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/drawer');
    registerExactPrototype('bootstrap-2-3-2-drawer-close', module.drawerClose);
  },
  'bootstrap-2-3-2-drawer-mask': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/drawer');
    registerExactPrototype('bootstrap-2-3-2-drawer-mask', module.drawerMask);
  },
  'liquid-glass-drawer-root': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/drawer');
    registerExactPrototype('liquid-glass-drawer-root', module.drawerRoot);
  },
  'liquid-glass-drawer-trigger': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/drawer');
    registerExactPrototype('liquid-glass-drawer-trigger', module.drawerTrigger);
  },
  'liquid-glass-drawer-content': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/drawer');
    registerExactPrototype('liquid-glass-drawer-content', module.drawerContent);
  },
  'liquid-glass-drawer-title': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/drawer');
    registerExactPrototype('liquid-glass-drawer-title', module.drawerTitle);
  },
  'liquid-glass-drawer-description': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/drawer');
    registerExactPrototype('liquid-glass-drawer-description', module.drawerDescription);
  },
  'liquid-glass-drawer-close': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/drawer');
    registerExactPrototype('liquid-glass-drawer-close', module.drawerClose);
  },
  'liquid-glass-drawer-mask': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/drawer');
    registerExactPrototype('liquid-glass-drawer-mask', module.drawerMask);
  },
  'base-popover-root': async () => {
    const module = await import('@proto.ui/prototypes-base/popover');
    registerExactPrototype('base-popover-root', module.popoverRoot);
  },
  'base-popover-trigger': async () => {
    const module = await import('@proto.ui/prototypes-base/popover');
    registerExactPrototype('base-popover-trigger', module.popoverTrigger);
  },
  'base-popover-content': async () => {
    const module = await import('@proto.ui/prototypes-base/popover');
    registerExactPrototype('base-popover-content', module.popoverContent);
  },
  'base-popover-title': async () => {
    const module = await import('@proto.ui/prototypes-base/popover');
    registerExactPrototype('base-popover-title', module.popoverTitle);
  },
  'base-popover-description': async () => {
    const module = await import('@proto.ui/prototypes-base/popover');
    registerExactPrototype('base-popover-description', module.popoverDescription);
  },
  'base-popover-close': async () => {
    const module = await import('@proto.ui/prototypes-base/popover');
    registerExactPrototype('base-popover-close', module.popoverClose);
  },
  'shadcn-popover-root': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/popover');
    registerExactPrototype('shadcn-popover-root', module.popoverRoot);
  },
  'shadcn-popover-trigger': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/popover');
    registerExactPrototype('shadcn-popover-trigger', module.popoverTrigger);
  },
  'shadcn-popover-content': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/popover');
    registerExactPrototype('shadcn-popover-content', module.popoverContent);
  },
  'shadcn-popover-title': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/popover');
    registerExactPrototype('shadcn-popover-title', module.popoverTitle);
  },
  'shadcn-popover-description': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/popover');
    registerExactPrototype('shadcn-popover-description', module.popoverDescription);
  },
  'shadcn-popover-close': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/popover');
    registerExactPrototype('shadcn-popover-close', module.popoverClose);
  },
  'brutalist-popover-root': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/popover');
    registerExactPrototype('brutalist-popover-root', module.popoverRoot);
  },
  'brutalist-popover-trigger': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/popover');
    registerExactPrototype('brutalist-popover-trigger', module.popoverTrigger);
  },
  'brutalist-popover-content': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/popover');
    registerExactPrototype('brutalist-popover-content', module.popoverContent);
  },
  'brutalist-popover-title': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/popover');
    registerExactPrototype('brutalist-popover-title', module.popoverTitle);
  },
  'brutalist-popover-description': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/popover');
    registerExactPrototype('brutalist-popover-description', module.popoverDescription);
  },
  'brutalist-popover-close': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/popover');
    registerExactPrototype('brutalist-popover-close', module.popoverClose);
  },
  'bootstrap-2-3-2-popover-root': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/popover');
    registerExactPrototype('bootstrap-2-3-2-popover-root', module.popoverRoot);
  },
  'bootstrap-2-3-2-popover-trigger': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/popover');
    registerExactPrototype('bootstrap-2-3-2-popover-trigger', module.popoverTrigger);
  },
  'bootstrap-2-3-2-popover-content': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/popover');
    registerExactPrototype('bootstrap-2-3-2-popover-content', module.popoverContent);
  },
  'bootstrap-2-3-2-popover-title': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/popover');
    registerExactPrototype('bootstrap-2-3-2-popover-title', module.popoverTitle);
  },
  'bootstrap-2-3-2-popover-description': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/popover');
    registerExactPrototype('bootstrap-2-3-2-popover-description', module.popoverDescription);
  },
  'bootstrap-2-3-2-popover-close': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/popover');
    registerExactPrototype('bootstrap-2-3-2-popover-close', module.popoverClose);
  },
  'liquid-glass-popover-root': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/popover');
    registerExactPrototype('liquid-glass-popover-root', module.popoverRoot);
  },
  'liquid-glass-popover-trigger': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/popover');
    registerExactPrototype('liquid-glass-popover-trigger', module.popoverTrigger);
  },
  'liquid-glass-popover-content': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/popover');
    registerExactPrototype('liquid-glass-popover-content', module.popoverContent);
  },
  'liquid-glass-popover-title': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/popover');
    registerExactPrototype('liquid-glass-popover-title', module.popoverTitle);
  },
  'liquid-glass-popover-description': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/popover');
    registerExactPrototype('liquid-glass-popover-description', module.popoverDescription);
  },
  'liquid-glass-popover-close': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/popover');
    registerExactPrototype('liquid-glass-popover-close', module.popoverClose);
  },
  'base-progress-root': async () => {
    const module = await import('@proto.ui/prototypes-base/progress');
    registerExactPrototype('base-progress-root', module.progressRoot);
  },
  'base-progress-label': async () => {
    const module = await import('@proto.ui/prototypes-base/progress');
    registerExactPrototype('base-progress-label', module.progressLabel);
  },
  'base-progress-track': async () => {
    const module = await import('@proto.ui/prototypes-base/progress');
    registerExactPrototype('base-progress-track', module.progressTrack);
  },
  'base-progress-indicator': async () => {
    const module = await import('@proto.ui/prototypes-base/progress');
    registerExactPrototype('base-progress-indicator', module.progressIndicator);
  },
  'base-progress-value': async () => {
    const module = await import('@proto.ui/prototypes-base/progress');
    registerExactPrototype('base-progress-value', module.progressValue);
  },
  'base-meter-root': async () => {
    const module = await import('@proto.ui/prototypes-base/meter');
    registerExactPrototype('base-meter-root', module.meterRoot);
  },
  'base-meter-label': async () => {
    const module = await import('@proto.ui/prototypes-base/meter');
    registerExactPrototype('base-meter-label', module.meterLabel);
  },
  'base-meter-track': async () => {
    const module = await import('@proto.ui/prototypes-base/meter');
    registerExactPrototype('base-meter-track', module.meterTrack);
  },
  'base-meter-indicator': async () => {
    const module = await import('@proto.ui/prototypes-base/meter');
    registerExactPrototype('base-meter-indicator', module.meterIndicator);
  },
  'base-meter-value': async () => {
    const module = await import('@proto.ui/prototypes-base/meter');
    registerExactPrototype('base-meter-value', module.meterValue);
  },
  'shadcn-progress-root': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/progress');
    registerExactPrototype('shadcn-progress-root', module.progressRoot);
  },
  'shadcn-progress-label': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/progress');
    registerExactPrototype('shadcn-progress-label', module.progressLabel);
  },
  'shadcn-progress-track': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/progress');
    registerExactPrototype('shadcn-progress-track', module.progressTrack);
  },
  'shadcn-progress-indicator': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/progress');
    registerExactPrototype('shadcn-progress-indicator', module.progressIndicator);
  },
  'shadcn-progress-value': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/progress');
    registerExactPrototype('shadcn-progress-value', module.progressValue);
  },
  'shadcn-meter-root': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/meter');
    registerExactPrototype('shadcn-meter-root', module.meterRoot);
  },
  'shadcn-meter-label': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/meter');
    registerExactPrototype('shadcn-meter-label', module.meterLabel);
  },
  'shadcn-meter-track': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/meter');
    registerExactPrototype('shadcn-meter-track', module.meterTrack);
  },
  'shadcn-meter-indicator': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/meter');
    registerExactPrototype('shadcn-meter-indicator', module.meterIndicator);
  },
  'shadcn-meter-value': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/meter');
    registerExactPrototype('shadcn-meter-value', module.meterValue);
  },
  'brutalist-progress-root': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/progress');
    registerExactPrototype('brutalist-progress-root', module.progressRoot);
  },
  'brutalist-progress-label': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/progress');
    registerExactPrototype('brutalist-progress-label', module.progressLabel);
  },
  'brutalist-progress-track': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/progress');
    registerExactPrototype('brutalist-progress-track', module.progressTrack);
  },
  'brutalist-progress-indicator': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/progress');
    registerExactPrototype('brutalist-progress-indicator', module.progressIndicator);
  },
  'brutalist-progress-value': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/progress');
    registerExactPrototype('brutalist-progress-value', module.progressValue);
  },
  'brutalist-meter-root': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/meter');
    registerExactPrototype('brutalist-meter-root', module.meterRoot);
  },
  'brutalist-meter-label': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/meter');
    registerExactPrototype('brutalist-meter-label', module.meterLabel);
  },
  'brutalist-meter-track': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/meter');
    registerExactPrototype('brutalist-meter-track', module.meterTrack);
  },
  'brutalist-meter-indicator': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/meter');
    registerExactPrototype('brutalist-meter-indicator', module.meterIndicator);
  },
  'brutalist-meter-value': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/meter');
    registerExactPrototype('brutalist-meter-value', module.meterValue);
  },
  'bootstrap-2-3-2-progress-root': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/progress');
    registerExactPrototype('bootstrap-2-3-2-progress-root', module.progressRoot);
  },
  'bootstrap-2-3-2-progress-label': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/progress');
    registerExactPrototype('bootstrap-2-3-2-progress-label', module.progressLabel);
  },
  'bootstrap-2-3-2-progress-track': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/progress');
    registerExactPrototype('bootstrap-2-3-2-progress-track', module.progressTrack);
  },
  'bootstrap-2-3-2-progress-indicator': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/progress');
    registerExactPrototype('bootstrap-2-3-2-progress-indicator', module.progressIndicator);
  },
  'bootstrap-2-3-2-progress-value': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/progress');
    registerExactPrototype('bootstrap-2-3-2-progress-value', module.progressValue);
  },
  'bootstrap-2-3-2-meter-root': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/meter');
    registerExactPrototype('bootstrap-2-3-2-meter-root', module.meterRoot);
  },
  'bootstrap-2-3-2-meter-label': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/meter');
    registerExactPrototype('bootstrap-2-3-2-meter-label', module.meterLabel);
  },
  'bootstrap-2-3-2-meter-track': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/meter');
    registerExactPrototype('bootstrap-2-3-2-meter-track', module.meterTrack);
  },
  'bootstrap-2-3-2-meter-indicator': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/meter');
    registerExactPrototype('bootstrap-2-3-2-meter-indicator', module.meterIndicator);
  },
  'bootstrap-2-3-2-meter-value': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/meter');
    registerExactPrototype('bootstrap-2-3-2-meter-value', module.meterValue);
  },
  'liquid-glass-progress-root': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/progress');
    registerExactPrototype('liquid-glass-progress-root', module.progressRoot);
  },
  'liquid-glass-progress-label': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/progress');
    registerExactPrototype('liquid-glass-progress-label', module.progressLabel);
  },
  'liquid-glass-progress-track': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/progress');
    registerExactPrototype('liquid-glass-progress-track', module.progressTrack);
  },
  'liquid-glass-progress-indicator': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/progress');
    registerExactPrototype('liquid-glass-progress-indicator', module.progressIndicator);
  },
  'liquid-glass-progress-value': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/progress');
    registerExactPrototype('liquid-glass-progress-value', module.progressValue);
  },
  'liquid-glass-meter-root': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/meter');
    registerExactPrototype('liquid-glass-meter-root', module.meterRoot);
  },
  'liquid-glass-meter-label': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/meter');
    registerExactPrototype('liquid-glass-meter-label', module.meterLabel);
  },
  'liquid-glass-meter-track': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/meter');
    registerExactPrototype('liquid-glass-meter-track', module.meterTrack);
  },
  'liquid-glass-meter-indicator': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/meter');
    registerExactPrototype('liquid-glass-meter-indicator', module.meterIndicator);
  },
  'liquid-glass-meter-value': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/meter');
    registerExactPrototype('liquid-glass-meter-value', module.meterValue);
  },
  'base-calendar-root': async () => {
    const module = await import('@proto.ui/prototypes-base/calendar');
    registerExactPrototype('base-calendar-root', module.calendarRoot);
  },
  'base-calendar-grid': async () => {
    const module = await import('@proto.ui/prototypes-base/calendar');
    registerExactPrototype('base-calendar-grid', module.calendarGrid);
  },
  'base-calendar-row': async () => {
    const module = await import('@proto.ui/prototypes-base/calendar');
    registerExactPrototype('base-calendar-row', module.calendarRow);
  },
  'base-calendar-day': async () => {
    const module = await import('@proto.ui/prototypes-base/calendar');
    registerExactPrototype('base-calendar-day', module.calendarDay);
  },
  'base-calendar-heading': async () => {
    const module = await import('@proto.ui/prototypes-base/calendar');
    registerExactPrototype('base-calendar-heading', module.calendarHeading);
  },
  'base-calendar-previous': async () => {
    const module = await import('@proto.ui/prototypes-base/calendar');
    registerExactPrototype('base-calendar-previous', module.calendarPrevious);
  },
  'base-calendar-next': async () => {
    const module = await import('@proto.ui/prototypes-base/calendar');
    registerExactPrototype('base-calendar-next', module.calendarNext);
  },
  'shadcn-calendar-root': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/calendar');
    registerExactPrototype('shadcn-calendar-root', module.calendarRoot);
  },
  'shadcn-calendar-grid': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/calendar');
    registerExactPrototype('shadcn-calendar-grid', module.calendarGrid);
  },
  'shadcn-calendar-row': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/calendar');
    registerExactPrototype('shadcn-calendar-row', module.calendarRow);
  },
  'shadcn-calendar-day': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/calendar');
    registerExactPrototype('shadcn-calendar-day', module.calendarDay);
  },
  'shadcn-calendar-heading': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/calendar');
    registerExactPrototype('shadcn-calendar-heading', module.calendarHeading);
  },
  'shadcn-calendar-previous': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/calendar');
    registerExactPrototype('shadcn-calendar-previous', module.calendarPrevious);
  },
  'shadcn-calendar-next': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/calendar');
    registerExactPrototype('shadcn-calendar-next', module.calendarNext);
  },
  'brutalist-calendar-root': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/calendar');
    registerExactPrototype('brutalist-calendar-root', module.calendarRoot);
  },
  'brutalist-calendar-grid': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/calendar');
    registerExactPrototype('brutalist-calendar-grid', module.calendarGrid);
  },
  'brutalist-calendar-row': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/calendar');
    registerExactPrototype('brutalist-calendar-row', module.calendarRow);
  },
  'brutalist-calendar-day': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/calendar');
    registerExactPrototype('brutalist-calendar-day', module.calendarDay);
  },
  'brutalist-calendar-heading': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/calendar');
    registerExactPrototype('brutalist-calendar-heading', module.calendarHeading);
  },
  'brutalist-calendar-previous': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/calendar');
    registerExactPrototype('brutalist-calendar-previous', module.calendarPrevious);
  },
  'brutalist-calendar-next': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/calendar');
    registerExactPrototype('brutalist-calendar-next', module.calendarNext);
  },
  'bootstrap-2-3-2-calendar-root': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/calendar');
    registerExactPrototype('bootstrap-2-3-2-calendar-root', module.calendarRoot);
  },
  'bootstrap-2-3-2-calendar-grid': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/calendar');
    registerExactPrototype('bootstrap-2-3-2-calendar-grid', module.calendarGrid);
  },
  'bootstrap-2-3-2-calendar-row': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/calendar');
    registerExactPrototype('bootstrap-2-3-2-calendar-row', module.calendarRow);
  },
  'bootstrap-2-3-2-calendar-day': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/calendar');
    registerExactPrototype('bootstrap-2-3-2-calendar-day', module.calendarDay);
  },
  'bootstrap-2-3-2-calendar-heading': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/calendar');
    registerExactPrototype('bootstrap-2-3-2-calendar-heading', module.calendarHeading);
  },
  'bootstrap-2-3-2-calendar-previous': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/calendar');
    registerExactPrototype('bootstrap-2-3-2-calendar-previous', module.calendarPrevious);
  },
  'bootstrap-2-3-2-calendar-next': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/calendar');
    registerExactPrototype('bootstrap-2-3-2-calendar-next', module.calendarNext);
  },
  'liquid-glass-calendar-root': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/calendar');
    registerExactPrototype('liquid-glass-calendar-root', module.calendarRoot);
  },
  'liquid-glass-calendar-grid': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/calendar');
    registerExactPrototype('liquid-glass-calendar-grid', module.calendarGrid);
  },
  'liquid-glass-calendar-row': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/calendar');
    registerExactPrototype('liquid-glass-calendar-row', module.calendarRow);
  },
  'liquid-glass-calendar-day': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/calendar');
    registerExactPrototype('liquid-glass-calendar-day', module.calendarDay);
  },
  'liquid-glass-calendar-heading': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/calendar');
    registerExactPrototype('liquid-glass-calendar-heading', module.calendarHeading);
  },
  'liquid-glass-calendar-previous': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/calendar');
    registerExactPrototype('liquid-glass-calendar-previous', module.calendarPrevious);
  },
  'liquid-glass-calendar-next': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/calendar');
    registerExactPrototype('liquid-glass-calendar-next', module.calendarNext);
  },
};

function registerExactPrototype(id: string, prototype: Prototype<any, any>): void {
  if (prototype.name !== id) throw new Error(`[Finf] source identity mismatch for ${id}`);
  registerPrototype(id, prototype);
}
