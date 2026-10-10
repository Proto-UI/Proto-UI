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
  'base-drawer-handle': async () => {
    const module = await import('@proto.ui/prototypes-base/drawer');
    registerExactPrototype('base-drawer-handle', module.drawerHandle);
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
  'shadcn-drawer-handle': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/drawer');
    registerExactPrototype('shadcn-drawer-handle', module.drawerHandle);
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
  'brutalist-drawer-handle': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/drawer');
    registerExactPrototype('brutalist-drawer-handle', module.drawerHandle);
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
  'bootstrap-2-3-2-drawer-handle': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/drawer');
    registerExactPrototype('bootstrap-2-3-2-drawer-handle', module.drawerHandle);
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
  'liquid-glass-drawer-handle': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/drawer');
    registerExactPrototype('liquid-glass-drawer-handle', module.drawerHandle);
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
  'base-toggle-group-root': async () => {
    const module = await import('@proto.ui/prototypes-base/toggle-group');
    registerExactPrototype('base-toggle-group-root', module.toggleGroupRoot);
  },
  'base-toggle-group-item': async () => {
    const module = await import('@proto.ui/prototypes-base/toggle-group');
    registerExactPrototype('base-toggle-group-item', module.toggleGroupItem);
  },
  'shadcn-toggle-group-root': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/toggle-group');
    registerExactPrototype('shadcn-toggle-group-root', module.toggleGroupRoot);
  },
  'shadcn-toggle-group-item': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/toggle-group');
    registerExactPrototype('shadcn-toggle-group-item', module.toggleGroupItem);
  },
  'brutalist-toggle-group-root': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/toggle-group');
    registerExactPrototype('brutalist-toggle-group-root', module.toggleGroupRoot);
  },
  'brutalist-toggle-group-item': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/toggle-group');
    registerExactPrototype('brutalist-toggle-group-item', module.toggleGroupItem);
  },
  'bootstrap-2-3-2-toggle-group-root': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/toggle-group');
    registerExactPrototype('bootstrap-2-3-2-toggle-group-root', module.toggleGroupRoot);
  },
  'bootstrap-2-3-2-toggle-group-item': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/toggle-group');
    registerExactPrototype('bootstrap-2-3-2-toggle-group-item', module.toggleGroupItem);
  },
  'liquid-glass-toggle-group-root': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/toggle-group');
    registerExactPrototype('liquid-glass-toggle-group-root', module.toggleGroupRoot);
  },
  'liquid-glass-toggle-group-item': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/toggle-group');
    registerExactPrototype('liquid-glass-toggle-group-item', module.toggleGroupItem);
  },
  'base-toolbar-root': async () => {
    const module = await import('@proto.ui/prototypes-base/toolbar');
    registerExactPrototype('base-toolbar-root', module.toolbarRoot);
  },
  'base-toolbar-button': async () => {
    const module = await import('@proto.ui/prototypes-base/toolbar');
    registerExactPrototype('base-toolbar-button', module.toolbarButton);
  },
  'base-toolbar-separator': async () => {
    const module = await import('@proto.ui/prototypes-base/toolbar');
    registerExactPrototype('base-toolbar-separator', module.toolbarSeparator);
  },
  'shadcn-toolbar-root': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/toolbar');
    registerExactPrototype('shadcn-toolbar-root', module.toolbarRoot);
  },
  'shadcn-toolbar-button': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/toolbar');
    registerExactPrototype('shadcn-toolbar-button', module.toolbarButton);
  },
  'shadcn-toolbar-separator': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/toolbar');
    registerExactPrototype('shadcn-toolbar-separator', module.toolbarSeparator);
  },
  'brutalist-toolbar-root': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/toolbar');
    registerExactPrototype('brutalist-toolbar-root', module.toolbarRoot);
  },
  'brutalist-toolbar-button': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/toolbar');
    registerExactPrototype('brutalist-toolbar-button', module.toolbarButton);
  },
  'brutalist-toolbar-separator': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/toolbar');
    registerExactPrototype('brutalist-toolbar-separator', module.toolbarSeparator);
  },
  'bootstrap-2-3-2-toolbar-root': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/toolbar');
    registerExactPrototype('bootstrap-2-3-2-toolbar-root', module.toolbarRoot);
  },
  'bootstrap-2-3-2-toolbar-button': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/toolbar');
    registerExactPrototype('bootstrap-2-3-2-toolbar-button', module.toolbarButton);
  },
  'bootstrap-2-3-2-toolbar-separator': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/toolbar');
    registerExactPrototype('bootstrap-2-3-2-toolbar-separator', module.toolbarSeparator);
  },
  'liquid-glass-toolbar-root': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/toolbar');
    registerExactPrototype('liquid-glass-toolbar-root', module.toolbarRoot);
  },
  'liquid-glass-toolbar-button': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/toolbar');
    registerExactPrototype('liquid-glass-toolbar-button', module.toolbarButton);
  },
  'liquid-glass-toolbar-separator': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/toolbar');
    registerExactPrototype('liquid-glass-toolbar-separator', module.toolbarSeparator);
  },
  'base-toast-root': async () => {
    const module = await import('@proto.ui/prototypes-base/toast');
    registerExactPrototype('base-toast-root', module.toastRoot);
  },
  'base-toast-viewport': async () => {
    const module = await import('@proto.ui/prototypes-base/toast');
    registerExactPrototype('base-toast-viewport', module.toastViewport);
  },
  'base-toast-title': async () => {
    const module = await import('@proto.ui/prototypes-base/toast');
    registerExactPrototype('base-toast-title', module.toastTitle);
  },
  'base-toast-description': async () => {
    const module = await import('@proto.ui/prototypes-base/toast');
    registerExactPrototype('base-toast-description', module.toastDescription);
  },
  'base-toast-action': async () => {
    const module = await import('@proto.ui/prototypes-base/toast');
    registerExactPrototype('base-toast-action', module.toastAction);
  },
  'base-toast-close': async () => {
    const module = await import('@proto.ui/prototypes-base/toast');
    registerExactPrototype('base-toast-close', module.toastClose);
  },
  'shadcn-toast-root': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/toast');
    registerExactPrototype('shadcn-toast-root', module.toastRoot);
  },
  'shadcn-toast-viewport': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/toast');
    registerExactPrototype('shadcn-toast-viewport', module.toastViewport);
  },
  'shadcn-toast-title': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/toast');
    registerExactPrototype('shadcn-toast-title', module.toastTitle);
  },
  'shadcn-toast-description': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/toast');
    registerExactPrototype('shadcn-toast-description', module.toastDescription);
  },
  'shadcn-toast-action': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/toast');
    registerExactPrototype('shadcn-toast-action', module.toastAction);
  },
  'shadcn-toast-close': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/toast');
    registerExactPrototype('shadcn-toast-close', module.toastClose);
  },
  'brutalist-toast-root': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/toast');
    registerExactPrototype('brutalist-toast-root', module.toastRoot);
  },
  'brutalist-toast-viewport': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/toast');
    registerExactPrototype('brutalist-toast-viewport', module.toastViewport);
  },
  'brutalist-toast-title': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/toast');
    registerExactPrototype('brutalist-toast-title', module.toastTitle);
  },
  'brutalist-toast-description': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/toast');
    registerExactPrototype('brutalist-toast-description', module.toastDescription);
  },
  'brutalist-toast-action': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/toast');
    registerExactPrototype('brutalist-toast-action', module.toastAction);
  },
  'brutalist-toast-close': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/toast');
    registerExactPrototype('brutalist-toast-close', module.toastClose);
  },
  'bootstrap-2-3-2-toast-root': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/toast');
    registerExactPrototype('bootstrap-2-3-2-toast-root', module.toastRoot);
  },
  'bootstrap-2-3-2-toast-viewport': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/toast');
    registerExactPrototype('bootstrap-2-3-2-toast-viewport', module.toastViewport);
  },
  'bootstrap-2-3-2-toast-title': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/toast');
    registerExactPrototype('bootstrap-2-3-2-toast-title', module.toastTitle);
  },
  'bootstrap-2-3-2-toast-description': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/toast');
    registerExactPrototype('bootstrap-2-3-2-toast-description', module.toastDescription);
  },
  'bootstrap-2-3-2-toast-action': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/toast');
    registerExactPrototype('bootstrap-2-3-2-toast-action', module.toastAction);
  },
  'bootstrap-2-3-2-toast-close': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/toast');
    registerExactPrototype('bootstrap-2-3-2-toast-close', module.toastClose);
  },
  'liquid-glass-toast-root': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/toast');
    registerExactPrototype('liquid-glass-toast-root', module.toastRoot);
  },
  'liquid-glass-toast-viewport': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/toast');
    registerExactPrototype('liquid-glass-toast-viewport', module.toastViewport);
  },
  'liquid-glass-toast-title': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/toast');
    registerExactPrototype('liquid-glass-toast-title', module.toastTitle);
  },
  'liquid-glass-toast-description': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/toast');
    registerExactPrototype('liquid-glass-toast-description', module.toastDescription);
  },
  'liquid-glass-toast-action': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/toast');
    registerExactPrototype('liquid-glass-toast-action', module.toastAction);
  },
  'liquid-glass-toast-close': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/toast');
    registerExactPrototype('liquid-glass-toast-close', module.toastClose);
  },
  'base-autocomplete-root': async () => {
    const module = await import('@proto.ui/prototypes-base/autocomplete');
    registerExactPrototype('base-autocomplete-root', module.autocompleteRoot);
  },
  'base-autocomplete-input': async () => {
    const module = await import('@proto.ui/prototypes-base/autocomplete');
    registerExactPrototype('base-autocomplete-input', module.autocompleteInput);
  },
  'base-autocomplete-content': async () => {
    const module = await import('@proto.ui/prototypes-base/autocomplete');
    registerExactPrototype('base-autocomplete-content', module.autocompleteContent);
  },
  'base-autocomplete-item': async () => {
    const module = await import('@proto.ui/prototypes-base/autocomplete');
    registerExactPrototype('base-autocomplete-item', module.autocompleteItem);
  },
  'base-autocomplete-empty': async () => {
    const module = await import('@proto.ui/prototypes-base/autocomplete');
    registerExactPrototype('base-autocomplete-empty', module.autocompleteEmpty);
  },
  'base-autocomplete-trigger': async () => {
    const module = await import('@proto.ui/prototypes-base/autocomplete');
    registerExactPrototype('base-autocomplete-trigger', module.autocompleteTrigger);
  },
  'shadcn-autocomplete-root': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/autocomplete');
    registerExactPrototype('shadcn-autocomplete-root', module.autocompleteRoot);
  },
  'shadcn-autocomplete-input': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/autocomplete');
    registerExactPrototype('shadcn-autocomplete-input', module.autocompleteInput);
  },
  'shadcn-autocomplete-content': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/autocomplete');
    registerExactPrototype('shadcn-autocomplete-content', module.autocompleteContent);
  },
  'shadcn-autocomplete-item': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/autocomplete');
    registerExactPrototype('shadcn-autocomplete-item', module.autocompleteItem);
  },
  'shadcn-autocomplete-empty': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/autocomplete');
    registerExactPrototype('shadcn-autocomplete-empty', module.autocompleteEmpty);
  },
  'shadcn-autocomplete-trigger': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/autocomplete');
    registerExactPrototype('shadcn-autocomplete-trigger', module.autocompleteTrigger);
  },
  'brutalist-autocomplete-root': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/autocomplete');
    registerExactPrototype('brutalist-autocomplete-root', module.autocompleteRoot);
  },
  'brutalist-autocomplete-input': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/autocomplete');
    registerExactPrototype('brutalist-autocomplete-input', module.autocompleteInput);
  },
  'brutalist-autocomplete-content': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/autocomplete');
    registerExactPrototype('brutalist-autocomplete-content', module.autocompleteContent);
  },
  'brutalist-autocomplete-item': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/autocomplete');
    registerExactPrototype('brutalist-autocomplete-item', module.autocompleteItem);
  },
  'brutalist-autocomplete-empty': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/autocomplete');
    registerExactPrototype('brutalist-autocomplete-empty', module.autocompleteEmpty);
  },
  'brutalist-autocomplete-trigger': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/autocomplete');
    registerExactPrototype('brutalist-autocomplete-trigger', module.autocompleteTrigger);
  },
  'bootstrap-2-3-2-autocomplete-root': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/autocomplete');
    registerExactPrototype('bootstrap-2-3-2-autocomplete-root', module.autocompleteRoot);
  },
  'bootstrap-2-3-2-autocomplete-input': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/autocomplete');
    registerExactPrototype('bootstrap-2-3-2-autocomplete-input', module.autocompleteInput);
  },
  'bootstrap-2-3-2-autocomplete-content': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/autocomplete');
    registerExactPrototype('bootstrap-2-3-2-autocomplete-content', module.autocompleteContent);
  },
  'bootstrap-2-3-2-autocomplete-item': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/autocomplete');
    registerExactPrototype('bootstrap-2-3-2-autocomplete-item', module.autocompleteItem);
  },
  'bootstrap-2-3-2-autocomplete-empty': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/autocomplete');
    registerExactPrototype('bootstrap-2-3-2-autocomplete-empty', module.autocompleteEmpty);
  },
  'bootstrap-2-3-2-autocomplete-trigger': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/autocomplete');
    registerExactPrototype('bootstrap-2-3-2-autocomplete-trigger', module.autocompleteTrigger);
  },
  'liquid-glass-autocomplete-root': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/autocomplete');
    registerExactPrototype('liquid-glass-autocomplete-root', module.autocompleteRoot);
  },
  'liquid-glass-autocomplete-input': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/autocomplete');
    registerExactPrototype('liquid-glass-autocomplete-input', module.autocompleteInput);
  },
  'liquid-glass-autocomplete-content': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/autocomplete');
    registerExactPrototype('liquid-glass-autocomplete-content', module.autocompleteContent);
  },
  'liquid-glass-autocomplete-item': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/autocomplete');
    registerExactPrototype('liquid-glass-autocomplete-item', module.autocompleteItem);
  },
  'liquid-glass-autocomplete-empty': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/autocomplete');
    registerExactPrototype('liquid-glass-autocomplete-empty', module.autocompleteEmpty);
  },
  'liquid-glass-autocomplete-trigger': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/autocomplete');
    registerExactPrototype('liquid-glass-autocomplete-trigger', module.autocompleteTrigger);
  },
  'base-combobox-root': async () => {
    const module = await import('@proto.ui/prototypes-base/combobox');
    registerExactPrototype('base-combobox-root', module.comboboxRoot);
  },
  'base-combobox-input': async () => {
    const module = await import('@proto.ui/prototypes-base/combobox');
    registerExactPrototype('base-combobox-input', module.comboboxInput);
  },
  'base-combobox-content': async () => {
    const module = await import('@proto.ui/prototypes-base/combobox');
    registerExactPrototype('base-combobox-content', module.comboboxContent);
  },
  'base-combobox-item': async () => {
    const module = await import('@proto.ui/prototypes-base/combobox');
    registerExactPrototype('base-combobox-item', module.comboboxItem);
  },
  'base-combobox-empty': async () => {
    const module = await import('@proto.ui/prototypes-base/combobox');
    registerExactPrototype('base-combobox-empty', module.comboboxEmpty);
  },
  'base-combobox-trigger': async () => {
    const module = await import('@proto.ui/prototypes-base/combobox');
    registerExactPrototype('base-combobox-trigger', module.comboboxTrigger);
  },
  'shadcn-combobox-root': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/combobox');
    registerExactPrototype('shadcn-combobox-root', module.comboboxRoot);
  },
  'shadcn-combobox-input': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/combobox');
    registerExactPrototype('shadcn-combobox-input', module.comboboxInput);
  },
  'shadcn-combobox-content': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/combobox');
    registerExactPrototype('shadcn-combobox-content', module.comboboxContent);
  },
  'shadcn-combobox-item': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/combobox');
    registerExactPrototype('shadcn-combobox-item', module.comboboxItem);
  },
  'shadcn-combobox-empty': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/combobox');
    registerExactPrototype('shadcn-combobox-empty', module.comboboxEmpty);
  },
  'shadcn-combobox-trigger': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/combobox');
    registerExactPrototype('shadcn-combobox-trigger', module.comboboxTrigger);
  },
  'brutalist-combobox-root': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/combobox');
    registerExactPrototype('brutalist-combobox-root', module.comboboxRoot);
  },
  'brutalist-combobox-input': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/combobox');
    registerExactPrototype('brutalist-combobox-input', module.comboboxInput);
  },
  'brutalist-combobox-content': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/combobox');
    registerExactPrototype('brutalist-combobox-content', module.comboboxContent);
  },
  'brutalist-combobox-item': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/combobox');
    registerExactPrototype('brutalist-combobox-item', module.comboboxItem);
  },
  'brutalist-combobox-empty': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/combobox');
    registerExactPrototype('brutalist-combobox-empty', module.comboboxEmpty);
  },
  'brutalist-combobox-trigger': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/combobox');
    registerExactPrototype('brutalist-combobox-trigger', module.comboboxTrigger);
  },
  'bootstrap-2-3-2-combobox-root': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/combobox');
    registerExactPrototype('bootstrap-2-3-2-combobox-root', module.comboboxRoot);
  },
  'bootstrap-2-3-2-combobox-input': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/combobox');
    registerExactPrototype('bootstrap-2-3-2-combobox-input', module.comboboxInput);
  },
  'bootstrap-2-3-2-combobox-content': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/combobox');
    registerExactPrototype('bootstrap-2-3-2-combobox-content', module.comboboxContent);
  },
  'bootstrap-2-3-2-combobox-item': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/combobox');
    registerExactPrototype('bootstrap-2-3-2-combobox-item', module.comboboxItem);
  },
  'bootstrap-2-3-2-combobox-empty': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/combobox');
    registerExactPrototype('bootstrap-2-3-2-combobox-empty', module.comboboxEmpty);
  },
  'bootstrap-2-3-2-combobox-trigger': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/combobox');
    registerExactPrototype('bootstrap-2-3-2-combobox-trigger', module.comboboxTrigger);
  },
  'liquid-glass-combobox-root': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/combobox');
    registerExactPrototype('liquid-glass-combobox-root', module.comboboxRoot);
  },
  'liquid-glass-combobox-input': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/combobox');
    registerExactPrototype('liquid-glass-combobox-input', module.comboboxInput);
  },
  'liquid-glass-combobox-content': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/combobox');
    registerExactPrototype('liquid-glass-combobox-content', module.comboboxContent);
  },
  'liquid-glass-combobox-item': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/combobox');
    registerExactPrototype('liquid-glass-combobox-item', module.comboboxItem);
  },
  'liquid-glass-combobox-empty': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/combobox');
    registerExactPrototype('liquid-glass-combobox-empty', module.comboboxEmpty);
  },
  'liquid-glass-combobox-trigger': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/combobox');
    registerExactPrototype('liquid-glass-combobox-trigger', module.comboboxTrigger);
  },
  'base-command-root': async () => {
    const module = await import('@proto.ui/prototypes-base/command');
    registerExactPrototype('base-command-root', module.commandRoot);
  },
  'base-command-input': async () => {
    const module = await import('@proto.ui/prototypes-base/command');
    registerExactPrototype('base-command-input', module.commandInput);
  },
  'base-command-content': async () => {
    const module = await import('@proto.ui/prototypes-base/command');
    registerExactPrototype('base-command-content', module.commandContent);
  },
  'base-command-item': async () => {
    const module = await import('@proto.ui/prototypes-base/command');
    registerExactPrototype('base-command-item', module.commandItem);
  },
  'base-command-empty': async () => {
    const module = await import('@proto.ui/prototypes-base/command');
    registerExactPrototype('base-command-empty', module.commandEmpty);
  },
  'shadcn-command-root': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/command');
    registerExactPrototype('shadcn-command-root', module.commandRoot);
  },
  'shadcn-command-input': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/command');
    registerExactPrototype('shadcn-command-input', module.commandInput);
  },
  'shadcn-command-content': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/command');
    registerExactPrototype('shadcn-command-content', module.commandContent);
  },
  'shadcn-command-item': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/command');
    registerExactPrototype('shadcn-command-item', module.commandItem);
  },
  'shadcn-command-empty': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/command');
    registerExactPrototype('shadcn-command-empty', module.commandEmpty);
  },
  'brutalist-command-root': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/command');
    registerExactPrototype('brutalist-command-root', module.commandRoot);
  },
  'brutalist-command-input': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/command');
    registerExactPrototype('brutalist-command-input', module.commandInput);
  },
  'brutalist-command-content': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/command');
    registerExactPrototype('brutalist-command-content', module.commandContent);
  },
  'brutalist-command-item': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/command');
    registerExactPrototype('brutalist-command-item', module.commandItem);
  },
  'brutalist-command-empty': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/command');
    registerExactPrototype('brutalist-command-empty', module.commandEmpty);
  },
  'bootstrap-2-3-2-command-root': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/command');
    registerExactPrototype('bootstrap-2-3-2-command-root', module.commandRoot);
  },
  'bootstrap-2-3-2-command-input': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/command');
    registerExactPrototype('bootstrap-2-3-2-command-input', module.commandInput);
  },
  'bootstrap-2-3-2-command-content': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/command');
    registerExactPrototype('bootstrap-2-3-2-command-content', module.commandContent);
  },
  'bootstrap-2-3-2-command-item': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/command');
    registerExactPrototype('bootstrap-2-3-2-command-item', module.commandItem);
  },
  'bootstrap-2-3-2-command-empty': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/command');
    registerExactPrototype('bootstrap-2-3-2-command-empty', module.commandEmpty);
  },
  'liquid-glass-command-root': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/command');
    registerExactPrototype('liquid-glass-command-root', module.commandRoot);
  },
  'liquid-glass-command-input': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/command');
    registerExactPrototype('liquid-glass-command-input', module.commandInput);
  },
  'liquid-glass-command-content': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/command');
    registerExactPrototype('liquid-glass-command-content', module.commandContent);
  },
  'liquid-glass-command-item': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/command');
    registerExactPrototype('liquid-glass-command-item', module.commandItem);
  },
  'liquid-glass-command-empty': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/command');
    registerExactPrototype('liquid-glass-command-empty', module.commandEmpty);
  },
  'base-menubar-root': async () => {
    const module = await import('@proto.ui/prototypes-base/menubar');
    registerExactPrototype('base-menubar-root', module.menubarRoot);
  },
  'base-menubar-trigger': async () => {
    const module = await import('@proto.ui/prototypes-base/menubar');
    registerExactPrototype('base-menubar-trigger', module.menubarTrigger);
  },
  'base-menubar-content': async () => {
    const module = await import('@proto.ui/prototypes-base/menubar');
    registerExactPrototype('base-menubar-content', module.menubarContent);
  },
  'base-menubar-item': async () => {
    const module = await import('@proto.ui/prototypes-base/menubar');
    registerExactPrototype('base-menubar-item', module.menubarItem);
  },
  'shadcn-menubar-root': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/menubar');
    registerExactPrototype('shadcn-menubar-root', module.menubarRoot);
  },
  'shadcn-menubar-trigger': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/menubar');
    registerExactPrototype('shadcn-menubar-trigger', module.menubarTrigger);
  },
  'shadcn-menubar-content': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/menubar');
    registerExactPrototype('shadcn-menubar-content', module.menubarContent);
  },
  'shadcn-menubar-item': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/menubar');
    registerExactPrototype('shadcn-menubar-item', module.menubarItem);
  },
  'brutalist-menubar-root': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/menubar');
    registerExactPrototype('brutalist-menubar-root', module.menubarRoot);
  },
  'brutalist-menubar-trigger': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/menubar');
    registerExactPrototype('brutalist-menubar-trigger', module.menubarTrigger);
  },
  'brutalist-menubar-content': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/menubar');
    registerExactPrototype('brutalist-menubar-content', module.menubarContent);
  },
  'brutalist-menubar-item': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/menubar');
    registerExactPrototype('brutalist-menubar-item', module.menubarItem);
  },
  'bootstrap-2-3-2-menubar-root': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/menubar');
    registerExactPrototype('bootstrap-2-3-2-menubar-root', module.menubarRoot);
  },
  'bootstrap-2-3-2-menubar-trigger': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/menubar');
    registerExactPrototype('bootstrap-2-3-2-menubar-trigger', module.menubarTrigger);
  },
  'bootstrap-2-3-2-menubar-content': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/menubar');
    registerExactPrototype('bootstrap-2-3-2-menubar-content', module.menubarContent);
  },
  'bootstrap-2-3-2-menubar-item': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/menubar');
    registerExactPrototype('bootstrap-2-3-2-menubar-item', module.menubarItem);
  },
  'liquid-glass-menubar-root': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/menubar');
    registerExactPrototype('liquid-glass-menubar-root', module.menubarRoot);
  },
  'liquid-glass-menubar-trigger': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/menubar');
    registerExactPrototype('liquid-glass-menubar-trigger', module.menubarTrigger);
  },
  'liquid-glass-menubar-content': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/menubar');
    registerExactPrototype('liquid-glass-menubar-content', module.menubarContent);
  },
  'liquid-glass-menubar-item': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/menubar');
    registerExactPrototype('liquid-glass-menubar-item', module.menubarItem);
  },
  'base-navigation-menu-root': async () => {
    const module = await import('@proto.ui/prototypes-base/navigation-menu');
    registerExactPrototype('base-navigation-menu-root', module.navigationMenuRoot);
  },
  'base-navigation-menu-trigger': async () => {
    const module = await import('@proto.ui/prototypes-base/navigation-menu');
    registerExactPrototype('base-navigation-menu-trigger', module.navigationMenuTrigger);
  },
  'base-navigation-menu-content': async () => {
    const module = await import('@proto.ui/prototypes-base/navigation-menu');
    registerExactPrototype('base-navigation-menu-content', module.navigationMenuContent);
  },
  'base-navigation-menu-item': async () => {
    const module = await import('@proto.ui/prototypes-base/navigation-menu');
    registerExactPrototype('base-navigation-menu-item', module.navigationMenuItem);
  },
  'base-navigation-menu-link': async () => {
    const module = await import('@proto.ui/prototypes-base/navigation-menu');
    registerExactPrototype('base-navigation-menu-link', module.navigationMenuLink);
  },
  'shadcn-navigation-menu-root': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/navigation-menu');
    registerExactPrototype('shadcn-navigation-menu-root', module.navigationMenuRoot);
  },
  'shadcn-navigation-menu-trigger': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/navigation-menu');
    registerExactPrototype('shadcn-navigation-menu-trigger', module.navigationMenuTrigger);
  },
  'shadcn-navigation-menu-content': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/navigation-menu');
    registerExactPrototype('shadcn-navigation-menu-content', module.navigationMenuContent);
  },
  'shadcn-navigation-menu-item': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/navigation-menu');
    registerExactPrototype('shadcn-navigation-menu-item', module.navigationMenuItem);
  },
  'shadcn-navigation-menu-link': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/navigation-menu');
    registerExactPrototype('shadcn-navigation-menu-link', module.navigationMenuLink);
  },
  'brutalist-navigation-menu-root': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/navigation-menu');
    registerExactPrototype('brutalist-navigation-menu-root', module.navigationMenuRoot);
  },
  'brutalist-navigation-menu-trigger': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/navigation-menu');
    registerExactPrototype('brutalist-navigation-menu-trigger', module.navigationMenuTrigger);
  },
  'brutalist-navigation-menu-content': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/navigation-menu');
    registerExactPrototype('brutalist-navigation-menu-content', module.navigationMenuContent);
  },
  'brutalist-navigation-menu-item': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/navigation-menu');
    registerExactPrototype('brutalist-navigation-menu-item', module.navigationMenuItem);
  },
  'brutalist-navigation-menu-link': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/navigation-menu');
    registerExactPrototype('brutalist-navigation-menu-link', module.navigationMenuLink);
  },
  'bootstrap-2-3-2-navigation-menu-root': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/navigation-menu');
    registerExactPrototype('bootstrap-2-3-2-navigation-menu-root', module.navigationMenuRoot);
  },
  'bootstrap-2-3-2-navigation-menu-trigger': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/navigation-menu');
    registerExactPrototype('bootstrap-2-3-2-navigation-menu-trigger', module.navigationMenuTrigger);
  },
  'bootstrap-2-3-2-navigation-menu-content': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/navigation-menu');
    registerExactPrototype('bootstrap-2-3-2-navigation-menu-content', module.navigationMenuContent);
  },
  'bootstrap-2-3-2-navigation-menu-item': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/navigation-menu');
    registerExactPrototype('bootstrap-2-3-2-navigation-menu-item', module.navigationMenuItem);
  },
  'bootstrap-2-3-2-navigation-menu-link': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/navigation-menu');
    registerExactPrototype('bootstrap-2-3-2-navigation-menu-link', module.navigationMenuLink);
  },
  'liquid-glass-navigation-menu-root': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/navigation-menu');
    registerExactPrototype('liquid-glass-navigation-menu-root', module.navigationMenuRoot);
  },
  'liquid-glass-navigation-menu-trigger': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/navigation-menu');
    registerExactPrototype('liquid-glass-navigation-menu-trigger', module.navigationMenuTrigger);
  },
  'liquid-glass-navigation-menu-content': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/navigation-menu');
    registerExactPrototype('liquid-glass-navigation-menu-content', module.navigationMenuContent);
  },
  'liquid-glass-navigation-menu-item': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/navigation-menu');
    registerExactPrototype('liquid-glass-navigation-menu-item', module.navigationMenuItem);
  },
  'liquid-glass-navigation-menu-link': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/navigation-menu');
    registerExactPrototype('liquid-glass-navigation-menu-link', module.navigationMenuLink);
  },
  'base-context-menu-root': async () => {
    const module = await import('@proto.ui/prototypes-base/context-menu');
    registerExactPrototype('base-context-menu-root', module.contextMenuRoot);
  },
  'base-context-menu-trigger': async () => {
    const module = await import('@proto.ui/prototypes-base/context-menu');
    registerExactPrototype('base-context-menu-trigger', module.contextMenuTrigger);
  },
  'base-context-menu-content': async () => {
    const module = await import('@proto.ui/prototypes-base/context-menu');
    registerExactPrototype('base-context-menu-content', module.contextMenuContent);
  },
  'base-context-menu-item': async () => {
    const module = await import('@proto.ui/prototypes-base/context-menu');
    registerExactPrototype('base-context-menu-item', module.contextMenuItem);
  },
  'shadcn-context-menu-root': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/context-menu');
    registerExactPrototype('shadcn-context-menu-root', module.contextMenuRoot);
  },
  'shadcn-context-menu-trigger': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/context-menu');
    registerExactPrototype('shadcn-context-menu-trigger', module.contextMenuTrigger);
  },
  'shadcn-context-menu-content': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/context-menu');
    registerExactPrototype('shadcn-context-menu-content', module.contextMenuContent);
  },
  'shadcn-context-menu-item': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/context-menu');
    registerExactPrototype('shadcn-context-menu-item', module.contextMenuItem);
  },
  'brutalist-context-menu-root': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/context-menu');
    registerExactPrototype('brutalist-context-menu-root', module.contextMenuRoot);
  },
  'brutalist-context-menu-trigger': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/context-menu');
    registerExactPrototype('brutalist-context-menu-trigger', module.contextMenuTrigger);
  },
  'brutalist-context-menu-content': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/context-menu');
    registerExactPrototype('brutalist-context-menu-content', module.contextMenuContent);
  },
  'brutalist-context-menu-item': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/context-menu');
    registerExactPrototype('brutalist-context-menu-item', module.contextMenuItem);
  },
  'bootstrap-2-3-2-context-menu-root': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/context-menu');
    registerExactPrototype('bootstrap-2-3-2-context-menu-root', module.contextMenuRoot);
  },
  'bootstrap-2-3-2-context-menu-trigger': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/context-menu');
    registerExactPrototype('bootstrap-2-3-2-context-menu-trigger', module.contextMenuTrigger);
  },
  'bootstrap-2-3-2-context-menu-content': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/context-menu');
    registerExactPrototype('bootstrap-2-3-2-context-menu-content', module.contextMenuContent);
  },
  'bootstrap-2-3-2-context-menu-item': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/context-menu');
    registerExactPrototype('bootstrap-2-3-2-context-menu-item', module.contextMenuItem);
  },
  'liquid-glass-context-menu-root': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/context-menu');
    registerExactPrototype('liquid-glass-context-menu-root', module.contextMenuRoot);
  },
  'liquid-glass-context-menu-trigger': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/context-menu');
    registerExactPrototype('liquid-glass-context-menu-trigger', module.contextMenuTrigger);
  },
  'liquid-glass-context-menu-content': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/context-menu');
    registerExactPrototype('liquid-glass-context-menu-content', module.contextMenuContent);
  },
  'liquid-glass-context-menu-item': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/context-menu');
    registerExactPrototype('liquid-glass-context-menu-item', module.contextMenuItem);
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
  'base-fieldset-root': async () => {
    const module = await import('@proto.ui/prototypes-base/fieldset');
    registerExactPrototype('base-fieldset-root', module.fieldsetRoot);
  },
  'base-fieldset-legend': async () => {
    const module = await import('@proto.ui/prototypes-base/fieldset');
    registerExactPrototype('base-fieldset-legend', module.fieldsetLegend);
  },
  'base-fieldset-description': async () => {
    const module = await import('@proto.ui/prototypes-base/fieldset');
    registerExactPrototype('base-fieldset-description', module.fieldsetDescription);
  },
  'base-form-root': async () => {
    const module = await import('@proto.ui/prototypes-base/form');
    registerExactPrototype('base-form-root', module.formRoot);
  },
  'base-form-field': async () => {
    const module = await import('@proto.ui/prototypes-base/form');
    registerExactPrototype('base-form-field', module.formField);
  },
  'base-form-submit': async () => {
    const module = await import('@proto.ui/prototypes-base/form');
    registerExactPrototype('base-form-submit', module.formSubmit);
  },
  'base-checkbox-group-root': async () => {
    const module = await import('@proto.ui/prototypes-base/checkbox-group');
    registerExactPrototype('base-checkbox-group-root', module.checkboxGroupRoot);
  },
  'base-checkbox-group-item': async () => {
    const module = await import('@proto.ui/prototypes-base/checkbox-group');
    registerExactPrototype('base-checkbox-group-item', module.checkboxGroupItem);
  },
  'base-checkbox-group-all': async () => {
    const module = await import('@proto.ui/prototypes-base/checkbox-group');
    registerExactPrototype('base-checkbox-group-all', module.checkboxGroupAll);
  },
  'base-slider-root': async () => {
    const module = await import('@proto.ui/prototypes-base/slider');
    registerExactPrototype('base-slider-root', module.sliderRoot);
  },
  'base-slider-label': async () => {
    const module = await import('@proto.ui/prototypes-base/slider');
    registerExactPrototype('base-slider-label', module.sliderLabel);
  },
  'base-slider-track': async () => {
    const module = await import('@proto.ui/prototypes-base/slider');
    registerExactPrototype('base-slider-track', module.sliderTrack);
  },
  'base-slider-indicator': async () => {
    const module = await import('@proto.ui/prototypes-base/slider');
    registerExactPrototype('base-slider-indicator', module.sliderIndicator);
  },
  'base-slider-thumb': async () => {
    const module = await import('@proto.ui/prototypes-base/slider');
    registerExactPrototype('base-slider-thumb', module.sliderThumb);
  },
  'base-slider-value': async () => {
    const module = await import('@proto.ui/prototypes-base/slider');
    registerExactPrototype('base-slider-value', module.sliderValue);
  },
  'base-number-field-root': async () => {
    const module = await import('@proto.ui/prototypes-base/number-field');
    registerExactPrototype('base-number-field-root', module.numberFieldRoot);
  },
  'base-number-field-label': async () => {
    const module = await import('@proto.ui/prototypes-base/number-field');
    registerExactPrototype('base-number-field-label', module.numberFieldLabel);
  },
  'base-number-field-input': async () => {
    const module = await import('@proto.ui/prototypes-base/number-field');
    registerExactPrototype('base-number-field-input', module.numberFieldInput);
  },
  'base-number-field-increment': async () => {
    const module = await import('@proto.ui/prototypes-base/number-field');
    registerExactPrototype('base-number-field-increment', module.numberFieldIncrement);
  },
  'base-number-field-decrement': async () => {
    const module = await import('@proto.ui/prototypes-base/number-field');
    registerExactPrototype('base-number-field-decrement', module.numberFieldDecrement);
  },
  'base-input-otp-root': async () => {
    const module = await import('@proto.ui/prototypes-base/input-otp');
    registerExactPrototype('base-input-otp-root', module.inputOtpRoot);
  },
  'base-input-otp-input': async () => {
    const module = await import('@proto.ui/prototypes-base/input-otp');
    registerExactPrototype('base-input-otp-input', module.inputOtpInput);
  },
  'base-input-otp-slot': async () => {
    const module = await import('@proto.ui/prototypes-base/input-otp');
    registerExactPrototype('base-input-otp-slot', module.inputOtpSlot);
  },
  'base-input-otp-separator': async () => {
    const module = await import('@proto.ui/prototypes-base/input-otp');
    registerExactPrototype('base-input-otp-separator', module.inputOtpSeparator);
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
  'shadcn-fieldset-root': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/fieldset');
    registerExactPrototype('shadcn-fieldset-root', module.fieldsetRoot);
  },
  'shadcn-fieldset-legend': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/fieldset');
    registerExactPrototype('shadcn-fieldset-legend', module.fieldsetLegend);
  },
  'shadcn-fieldset-description': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/fieldset');
    registerExactPrototype('shadcn-fieldset-description', module.fieldsetDescription);
  },
  'shadcn-form-root': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/form');
    registerExactPrototype('shadcn-form-root', module.formRoot);
  },
  'shadcn-form-field': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/form');
    registerExactPrototype('shadcn-form-field', module.formField);
  },
  'shadcn-form-submit': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/form');
    registerExactPrototype('shadcn-form-submit', module.formSubmit);
  },
  'shadcn-checkbox-group-root': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/checkbox-group');
    registerExactPrototype('shadcn-checkbox-group-root', module.checkboxGroupRoot);
  },
  'shadcn-checkbox-group-item': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/checkbox-group');
    registerExactPrototype('shadcn-checkbox-group-item', module.checkboxGroupItem);
  },
  'shadcn-checkbox-group-all': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/checkbox-group');
    registerExactPrototype('shadcn-checkbox-group-all', module.checkboxGroupAll);
  },
  'shadcn-slider-root': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/slider');
    registerExactPrototype('shadcn-slider-root', module.sliderRoot);
  },
  'shadcn-slider-label': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/slider');
    registerExactPrototype('shadcn-slider-label', module.sliderLabel);
  },
  'shadcn-slider-track': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/slider');
    registerExactPrototype('shadcn-slider-track', module.sliderTrack);
  },
  'shadcn-slider-indicator': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/slider');
    registerExactPrototype('shadcn-slider-indicator', module.sliderIndicator);
  },
  'shadcn-slider-thumb': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/slider');
    registerExactPrototype('shadcn-slider-thumb', module.sliderThumb);
  },
  'shadcn-slider-value': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/slider');
    registerExactPrototype('shadcn-slider-value', module.sliderValue);
  },
  'shadcn-number-field-root': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/number-field');
    registerExactPrototype('shadcn-number-field-root', module.numberFieldRoot);
  },
  'shadcn-number-field-label': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/number-field');
    registerExactPrototype('shadcn-number-field-label', module.numberFieldLabel);
  },
  'shadcn-number-field-input': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/number-field');
    registerExactPrototype('shadcn-number-field-input', module.numberFieldInput);
  },
  'shadcn-number-field-increment': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/number-field');
    registerExactPrototype('shadcn-number-field-increment', module.numberFieldIncrement);
  },
  'shadcn-number-field-decrement': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/number-field');
    registerExactPrototype('shadcn-number-field-decrement', module.numberFieldDecrement);
  },
  'shadcn-input-otp-root': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/input-otp');
    registerExactPrototype('shadcn-input-otp-root', module.inputOtpRoot);
  },
  'shadcn-input-otp-input': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/input-otp');
    registerExactPrototype('shadcn-input-otp-input', module.inputOtpInput);
  },
  'shadcn-input-otp-slot': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/input-otp');
    registerExactPrototype('shadcn-input-otp-slot', module.inputOtpSlot);
  },
  'shadcn-input-otp-separator': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/input-otp');
    registerExactPrototype('shadcn-input-otp-separator', module.inputOtpSeparator);
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
  'brutalist-fieldset-root': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/fieldset');
    registerExactPrototype('brutalist-fieldset-root', module.fieldsetRoot);
  },
  'brutalist-fieldset-legend': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/fieldset');
    registerExactPrototype('brutalist-fieldset-legend', module.fieldsetLegend);
  },
  'brutalist-fieldset-description': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/fieldset');
    registerExactPrototype('brutalist-fieldset-description', module.fieldsetDescription);
  },
  'brutalist-form-root': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/form');
    registerExactPrototype('brutalist-form-root', module.formRoot);
  },
  'brutalist-form-field': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/form');
    registerExactPrototype('brutalist-form-field', module.formField);
  },
  'brutalist-form-submit': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/form');
    registerExactPrototype('brutalist-form-submit', module.formSubmit);
  },
  'brutalist-checkbox-group-root': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/checkbox-group');
    registerExactPrototype('brutalist-checkbox-group-root', module.checkboxGroupRoot);
  },
  'brutalist-checkbox-group-item': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/checkbox-group');
    registerExactPrototype('brutalist-checkbox-group-item', module.checkboxGroupItem);
  },
  'brutalist-checkbox-group-all': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/checkbox-group');
    registerExactPrototype('brutalist-checkbox-group-all', module.checkboxGroupAll);
  },
  'brutalist-slider-root': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/slider');
    registerExactPrototype('brutalist-slider-root', module.sliderRoot);
  },
  'brutalist-slider-label': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/slider');
    registerExactPrototype('brutalist-slider-label', module.sliderLabel);
  },
  'brutalist-slider-track': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/slider');
    registerExactPrototype('brutalist-slider-track', module.sliderTrack);
  },
  'brutalist-slider-indicator': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/slider');
    registerExactPrototype('brutalist-slider-indicator', module.sliderIndicator);
  },
  'brutalist-slider-thumb': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/slider');
    registerExactPrototype('brutalist-slider-thumb', module.sliderThumb);
  },
  'brutalist-slider-value': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/slider');
    registerExactPrototype('brutalist-slider-value', module.sliderValue);
  },
  'brutalist-number-field-root': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/number-field');
    registerExactPrototype('brutalist-number-field-root', module.numberFieldRoot);
  },
  'brutalist-number-field-label': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/number-field');
    registerExactPrototype('brutalist-number-field-label', module.numberFieldLabel);
  },
  'brutalist-number-field-input': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/number-field');
    registerExactPrototype('brutalist-number-field-input', module.numberFieldInput);
  },
  'brutalist-number-field-increment': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/number-field');
    registerExactPrototype('brutalist-number-field-increment', module.numberFieldIncrement);
  },
  'brutalist-number-field-decrement': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/number-field');
    registerExactPrototype('brutalist-number-field-decrement', module.numberFieldDecrement);
  },
  'brutalist-input-otp-root': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/input-otp');
    registerExactPrototype('brutalist-input-otp-root', module.inputOtpRoot);
  },
  'brutalist-input-otp-input': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/input-otp');
    registerExactPrototype('brutalist-input-otp-input', module.inputOtpInput);
  },
  'brutalist-input-otp-slot': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/input-otp');
    registerExactPrototype('brutalist-input-otp-slot', module.inputOtpSlot);
  },
  'brutalist-input-otp-separator': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/input-otp');
    registerExactPrototype('brutalist-input-otp-separator', module.inputOtpSeparator);
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
  'bootstrap-2-3-2-fieldset-root': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/fieldset');
    registerExactPrototype('bootstrap-2-3-2-fieldset-root', module.fieldsetRoot);
  },
  'bootstrap-2-3-2-fieldset-legend': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/fieldset');
    registerExactPrototype('bootstrap-2-3-2-fieldset-legend', module.fieldsetLegend);
  },
  'bootstrap-2-3-2-fieldset-description': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/fieldset');
    registerExactPrototype('bootstrap-2-3-2-fieldset-description', module.fieldsetDescription);
  },
  'bootstrap-2-3-2-form-root': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/form');
    registerExactPrototype('bootstrap-2-3-2-form-root', module.formRoot);
  },
  'bootstrap-2-3-2-form-field': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/form');
    registerExactPrototype('bootstrap-2-3-2-form-field', module.formField);
  },
  'bootstrap-2-3-2-form-submit': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/form');
    registerExactPrototype('bootstrap-2-3-2-form-submit', module.formSubmit);
  },
  'bootstrap-2-3-2-checkbox-group-root': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/checkbox-group');
    registerExactPrototype('bootstrap-2-3-2-checkbox-group-root', module.checkboxGroupRoot);
  },
  'bootstrap-2-3-2-checkbox-group-item': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/checkbox-group');
    registerExactPrototype('bootstrap-2-3-2-checkbox-group-item', module.checkboxGroupItem);
  },
  'bootstrap-2-3-2-checkbox-group-all': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/checkbox-group');
    registerExactPrototype('bootstrap-2-3-2-checkbox-group-all', module.checkboxGroupAll);
  },
  'bootstrap-2-3-2-slider-root': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/slider');
    registerExactPrototype('bootstrap-2-3-2-slider-root', module.sliderRoot);
  },
  'bootstrap-2-3-2-slider-label': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/slider');
    registerExactPrototype('bootstrap-2-3-2-slider-label', module.sliderLabel);
  },
  'bootstrap-2-3-2-slider-track': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/slider');
    registerExactPrototype('bootstrap-2-3-2-slider-track', module.sliderTrack);
  },
  'bootstrap-2-3-2-slider-indicator': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/slider');
    registerExactPrototype('bootstrap-2-3-2-slider-indicator', module.sliderIndicator);
  },
  'bootstrap-2-3-2-slider-thumb': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/slider');
    registerExactPrototype('bootstrap-2-3-2-slider-thumb', module.sliderThumb);
  },
  'bootstrap-2-3-2-slider-value': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/slider');
    registerExactPrototype('bootstrap-2-3-2-slider-value', module.sliderValue);
  },
  'bootstrap-2-3-2-number-field-root': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/number-field');
    registerExactPrototype('bootstrap-2-3-2-number-field-root', module.numberFieldRoot);
  },
  'bootstrap-2-3-2-number-field-label': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/number-field');
    registerExactPrototype('bootstrap-2-3-2-number-field-label', module.numberFieldLabel);
  },
  'bootstrap-2-3-2-number-field-input': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/number-field');
    registerExactPrototype('bootstrap-2-3-2-number-field-input', module.numberFieldInput);
  },
  'bootstrap-2-3-2-number-field-increment': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/number-field');
    registerExactPrototype('bootstrap-2-3-2-number-field-increment', module.numberFieldIncrement);
  },
  'bootstrap-2-3-2-number-field-decrement': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/number-field');
    registerExactPrototype('bootstrap-2-3-2-number-field-decrement', module.numberFieldDecrement);
  },
  'bootstrap-2-3-2-input-otp-root': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/input-otp');
    registerExactPrototype('bootstrap-2-3-2-input-otp-root', module.inputOtpRoot);
  },
  'bootstrap-2-3-2-input-otp-input': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/input-otp');
    registerExactPrototype('bootstrap-2-3-2-input-otp-input', module.inputOtpInput);
  },
  'bootstrap-2-3-2-input-otp-slot': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/input-otp');
    registerExactPrototype('bootstrap-2-3-2-input-otp-slot', module.inputOtpSlot);
  },
  'bootstrap-2-3-2-input-otp-separator': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/input-otp');
    registerExactPrototype('bootstrap-2-3-2-input-otp-separator', module.inputOtpSeparator);
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
  'liquid-glass-fieldset-root': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/fieldset');
    registerExactPrototype('liquid-glass-fieldset-root', module.fieldsetRoot);
  },
  'liquid-glass-fieldset-legend': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/fieldset');
    registerExactPrototype('liquid-glass-fieldset-legend', module.fieldsetLegend);
  },
  'liquid-glass-fieldset-description': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/fieldset');
    registerExactPrototype('liquid-glass-fieldset-description', module.fieldsetDescription);
  },
  'liquid-glass-form-root': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/form');
    registerExactPrototype('liquid-glass-form-root', module.formRoot);
  },
  'liquid-glass-form-field': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/form');
    registerExactPrototype('liquid-glass-form-field', module.formField);
  },
  'liquid-glass-form-submit': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/form');
    registerExactPrototype('liquid-glass-form-submit', module.formSubmit);
  },
  'liquid-glass-checkbox-group-root': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/checkbox-group');
    registerExactPrototype('liquid-glass-checkbox-group-root', module.checkboxGroupRoot);
  },
  'liquid-glass-checkbox-group-item': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/checkbox-group');
    registerExactPrototype('liquid-glass-checkbox-group-item', module.checkboxGroupItem);
  },
  'liquid-glass-checkbox-group-all': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/checkbox-group');
    registerExactPrototype('liquid-glass-checkbox-group-all', module.checkboxGroupAll);
  },
  'liquid-glass-slider-root': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/slider');
    registerExactPrototype('liquid-glass-slider-root', module.sliderRoot);
  },
  'liquid-glass-slider-label': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/slider');
    registerExactPrototype('liquid-glass-slider-label', module.sliderLabel);
  },
  'liquid-glass-slider-track': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/slider');
    registerExactPrototype('liquid-glass-slider-track', module.sliderTrack);
  },
  'liquid-glass-slider-indicator': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/slider');
    registerExactPrototype('liquid-glass-slider-indicator', module.sliderIndicator);
  },
  'liquid-glass-slider-thumb': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/slider');
    registerExactPrototype('liquid-glass-slider-thumb', module.sliderThumb);
  },
  'liquid-glass-slider-value': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/slider');
    registerExactPrototype('liquid-glass-slider-value', module.sliderValue);
  },
  'liquid-glass-number-field-root': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/number-field');
    registerExactPrototype('liquid-glass-number-field-root', module.numberFieldRoot);
  },
  'liquid-glass-number-field-label': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/number-field');
    registerExactPrototype('liquid-glass-number-field-label', module.numberFieldLabel);
  },
  'liquid-glass-number-field-input': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/number-field');
    registerExactPrototype('liquid-glass-number-field-input', module.numberFieldInput);
  },
  'liquid-glass-number-field-increment': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/number-field');
    registerExactPrototype('liquid-glass-number-field-increment', module.numberFieldIncrement);
  },
  'liquid-glass-number-field-decrement': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/number-field');
    registerExactPrototype('liquid-glass-number-field-decrement', module.numberFieldDecrement);
  },
  'liquid-glass-input-otp-root': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/input-otp');
    registerExactPrototype('liquid-glass-input-otp-root', module.inputOtpRoot);
  },
  'liquid-glass-input-otp-input': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/input-otp');
    registerExactPrototype('liquid-glass-input-otp-input', module.inputOtpInput);
  },
  'liquid-glass-input-otp-slot': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/input-otp');
    registerExactPrototype('liquid-glass-input-otp-slot', module.inputOtpSlot);
  },
  'liquid-glass-input-otp-separator': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/input-otp');
    registerExactPrototype('liquid-glass-input-otp-separator', module.inputOtpSeparator);
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
  'base-tree-root': async () => {
    const module = await import('@proto.ui/prototypes-base/tree');
    registerExactPrototype('base-tree-root', module.treeRoot);
  },
  'base-tree-item': async () => {
    const module = await import('@proto.ui/prototypes-base/tree');
    registerExactPrototype('base-tree-item', module.treeItem);
  },
  'base-tree-group': async () => {
    const module = await import('@proto.ui/prototypes-base/tree');
    registerExactPrototype('base-tree-group', module.treeGroup);
  },
  'base-tree-toggle': async () => {
    const module = await import('@proto.ui/prototypes-base/tree');
    registerExactPrototype('base-tree-toggle', module.treeToggle);
  },
  'base-message-scroller-root': async () => {
    const module = await import('@proto.ui/prototypes-base/message-scroller');
    registerExactPrototype('base-message-scroller-root', module.messageScrollerRoot);
  },
  'base-message-scroller-viewport': async () => {
    const module = await import('@proto.ui/prototypes-base/message-scroller');
    registerExactPrototype('base-message-scroller-viewport', module.messageScrollerViewport);
  },
  'base-message-scroller-jump': async () => {
    const module = await import('@proto.ui/prototypes-base/message-scroller');
    registerExactPrototype('base-message-scroller-jump', module.messageScrollerJump);
  },
  'shadcn-tree-root': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/tree');
    registerExactPrototype('shadcn-tree-root', module.treeRoot);
  },
  'shadcn-tree-item': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/tree');
    registerExactPrototype('shadcn-tree-item', module.treeItem);
  },
  'shadcn-tree-group': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/tree');
    registerExactPrototype('shadcn-tree-group', module.treeGroup);
  },
  'shadcn-tree-toggle': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/tree');
    registerExactPrototype('shadcn-tree-toggle', module.treeToggle);
  },
  'shadcn-message-scroller-root': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/message-scroller');
    registerExactPrototype('shadcn-message-scroller-root', module.messageScrollerRoot);
  },
  'shadcn-message-scroller-viewport': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/message-scroller');
    registerExactPrototype('shadcn-message-scroller-viewport', module.messageScrollerViewport);
  },
  'shadcn-message-scroller-jump': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/message-scroller');
    registerExactPrototype('shadcn-message-scroller-jump', module.messageScrollerJump);
  },
  'brutalist-tree-root': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/tree');
    registerExactPrototype('brutalist-tree-root', module.treeRoot);
  },
  'brutalist-tree-item': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/tree');
    registerExactPrototype('brutalist-tree-item', module.treeItem);
  },
  'brutalist-tree-group': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/tree');
    registerExactPrototype('brutalist-tree-group', module.treeGroup);
  },
  'brutalist-tree-toggle': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/tree');
    registerExactPrototype('brutalist-tree-toggle', module.treeToggle);
  },
  'brutalist-message-scroller-root': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/message-scroller');
    registerExactPrototype('brutalist-message-scroller-root', module.messageScrollerRoot);
  },
  'brutalist-message-scroller-viewport': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/message-scroller');
    registerExactPrototype('brutalist-message-scroller-viewport', module.messageScrollerViewport);
  },
  'brutalist-message-scroller-jump': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/message-scroller');
    registerExactPrototype('brutalist-message-scroller-jump', module.messageScrollerJump);
  },
  'bootstrap-2-3-2-tree-root': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/tree');
    registerExactPrototype('bootstrap-2-3-2-tree-root', module.treeRoot);
  },
  'bootstrap-2-3-2-tree-item': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/tree');
    registerExactPrototype('bootstrap-2-3-2-tree-item', module.treeItem);
  },
  'bootstrap-2-3-2-tree-group': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/tree');
    registerExactPrototype('bootstrap-2-3-2-tree-group', module.treeGroup);
  },
  'bootstrap-2-3-2-tree-toggle': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/tree');
    registerExactPrototype('bootstrap-2-3-2-tree-toggle', module.treeToggle);
  },
  'bootstrap-2-3-2-message-scroller-root': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/message-scroller');
    registerExactPrototype('bootstrap-2-3-2-message-scroller-root', module.messageScrollerRoot);
  },
  'bootstrap-2-3-2-message-scroller-viewport': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/message-scroller');
    registerExactPrototype(
      'bootstrap-2-3-2-message-scroller-viewport',
      module.messageScrollerViewport
    );
  },
  'bootstrap-2-3-2-message-scroller-jump': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/message-scroller');
    registerExactPrototype('bootstrap-2-3-2-message-scroller-jump', module.messageScrollerJump);
  },
  'liquid-glass-tree-root': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/tree');
    registerExactPrototype('liquid-glass-tree-root', module.treeRoot);
  },
  'liquid-glass-tree-item': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/tree');
    registerExactPrototype('liquid-glass-tree-item', module.treeItem);
  },
  'liquid-glass-tree-group': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/tree');
    registerExactPrototype('liquid-glass-tree-group', module.treeGroup);
  },
  'liquid-glass-tree-toggle': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/tree');
    registerExactPrototype('liquid-glass-tree-toggle', module.treeToggle);
  },
  'liquid-glass-message-scroller-root': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/message-scroller');
    registerExactPrototype('liquid-glass-message-scroller-root', module.messageScrollerRoot);
  },
  'liquid-glass-message-scroller-viewport': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/message-scroller');
    registerExactPrototype(
      'liquid-glass-message-scroller-viewport',
      module.messageScrollerViewport
    );
  },
  'liquid-glass-message-scroller-jump': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/message-scroller');
    registerExactPrototype('liquid-glass-message-scroller-jump', module.messageScrollerJump);
  },
  'base-resizable-root': async () => {
    const module = await import('@proto.ui/prototypes-base/resizable');
    registerExactPrototype('base-resizable-root', module.resizableRoot);
  },
  'base-resizable-panel': async () => {
    const module = await import('@proto.ui/prototypes-base/resizable');
    registerExactPrototype('base-resizable-panel', module.resizablePanel);
  },
  'base-resizable-handle': async () => {
    const module = await import('@proto.ui/prototypes-base/resizable');
    registerExactPrototype('base-resizable-handle', module.resizableHandle);
  },
  'base-carousel-root': async () => {
    const module = await import('@proto.ui/prototypes-base/carousel');
    registerExactPrototype('base-carousel-root', module.carouselRoot);
  },
  'base-carousel-viewport': async () => {
    const module = await import('@proto.ui/prototypes-base/carousel');
    registerExactPrototype('base-carousel-viewport', module.carouselViewport);
  },
  'base-carousel-slide': async () => {
    const module = await import('@proto.ui/prototypes-base/carousel');
    registerExactPrototype('base-carousel-slide', module.carouselSlide);
  },
  'base-carousel-previous': async () => {
    const module = await import('@proto.ui/prototypes-base/carousel');
    registerExactPrototype('base-carousel-previous', module.carouselPrevious);
  },
  'base-carousel-next': async () => {
    const module = await import('@proto.ui/prototypes-base/carousel');
    registerExactPrototype('base-carousel-next', module.carouselNext);
  },
  'base-virtual-list-root': async () => {
    const module = await import('@proto.ui/prototypes-base/virtual-list');
    registerExactPrototype('base-virtual-list-root', module.virtualListRoot);
  },
  'base-virtual-list-viewport': async () => {
    const module = await import('@proto.ui/prototypes-base/virtual-list');
    registerExactPrototype('base-virtual-list-viewport', module.virtualListViewport);
  },
  'base-virtual-list-content': async () => {
    const module = await import('@proto.ui/prototypes-base/virtual-list');
    registerExactPrototype('base-virtual-list-content', module.virtualListContent);
  },
  'base-date-picker-root': async () => {
    const module = await import('@proto.ui/prototypes-base/date-picker');
    registerExactPrototype('base-date-picker-root', module.datePickerRoot);
  },
  'base-date-picker-trigger': async () => {
    const module = await import('@proto.ui/prototypes-base/date-picker');
    registerExactPrototype('base-date-picker-trigger', module.datePickerTrigger);
  },
  'base-date-picker-content': async () => {
    const module = await import('@proto.ui/prototypes-base/date-picker');
    registerExactPrototype('base-date-picker-content', module.datePickerContent);
  },
  'base-date-picker-day': async () => {
    const module = await import('@proto.ui/prototypes-base/date-picker');
    registerExactPrototype('base-date-picker-day', module.datePickerDay);
  },
  'base-date-picker-value': async () => {
    const module = await import('@proto.ui/prototypes-base/date-picker');
    registerExactPrototype('base-date-picker-value', module.datePickerValue);
  },
  'base-data-table-root': async () => {
    const module = await import('@proto.ui/prototypes-base/data-table');
    registerExactPrototype('base-data-table-root', module.dataTableRoot);
  },
  'base-data-table-row': async () => {
    const module = await import('@proto.ui/prototypes-base/data-table');
    registerExactPrototype('base-data-table-row', module.dataTableRow);
  },
  'base-data-table-cell': async () => {
    const module = await import('@proto.ui/prototypes-base/data-table');
    registerExactPrototype('base-data-table-cell', module.dataTableCell);
  },
  'base-data-table-header': async () => {
    const module = await import('@proto.ui/prototypes-base/data-table');
    registerExactPrototype('base-data-table-header', module.dataTableHeader);
  },
  'base-data-table-caption': async () => {
    const module = await import('@proto.ui/prototypes-base/data-table');
    registerExactPrototype('base-data-table-caption', module.dataTableCaption);
  },
  'base-data-table-previous': async () => {
    const module = await import('@proto.ui/prototypes-base/data-table');
    registerExactPrototype('base-data-table-previous', module.dataTablePrevious);
  },
  'base-data-table-next': async () => {
    const module = await import('@proto.ui/prototypes-base/data-table');
    registerExactPrototype('base-data-table-next', module.dataTableNext);
  },
  'shadcn-resizable-root': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/resizable');
    registerExactPrototype('shadcn-resizable-root', module.resizableRoot);
  },
  'shadcn-resizable-panel': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/resizable');
    registerExactPrototype('shadcn-resizable-panel', module.resizablePanel);
  },
  'shadcn-resizable-handle': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/resizable');
    registerExactPrototype('shadcn-resizable-handle', module.resizableHandle);
  },
  'shadcn-carousel-root': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/carousel');
    registerExactPrototype('shadcn-carousel-root', module.carouselRoot);
  },
  'shadcn-carousel-viewport': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/carousel');
    registerExactPrototype('shadcn-carousel-viewport', module.carouselViewport);
  },
  'shadcn-carousel-slide': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/carousel');
    registerExactPrototype('shadcn-carousel-slide', module.carouselSlide);
  },
  'shadcn-carousel-previous': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/carousel');
    registerExactPrototype('shadcn-carousel-previous', module.carouselPrevious);
  },
  'shadcn-carousel-next': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/carousel');
    registerExactPrototype('shadcn-carousel-next', module.carouselNext);
  },
  'shadcn-virtual-list-root': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/virtual-list');
    registerExactPrototype('shadcn-virtual-list-root', module.virtualListRoot);
  },
  'shadcn-virtual-list-viewport': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/virtual-list');
    registerExactPrototype('shadcn-virtual-list-viewport', module.virtualListViewport);
  },
  'shadcn-virtual-list-content': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/virtual-list');
    registerExactPrototype('shadcn-virtual-list-content', module.virtualListContent);
  },
  'shadcn-date-picker-root': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/date-picker');
    registerExactPrototype('shadcn-date-picker-root', module.datePickerRoot);
  },
  'shadcn-date-picker-trigger': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/date-picker');
    registerExactPrototype('shadcn-date-picker-trigger', module.datePickerTrigger);
  },
  'shadcn-date-picker-content': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/date-picker');
    registerExactPrototype('shadcn-date-picker-content', module.datePickerContent);
  },
  'shadcn-date-picker-day': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/date-picker');
    registerExactPrototype('shadcn-date-picker-day', module.datePickerDay);
  },
  'shadcn-date-picker-value': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/date-picker');
    registerExactPrototype('shadcn-date-picker-value', module.datePickerValue);
  },
  'shadcn-data-table-root': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/data-table');
    registerExactPrototype('shadcn-data-table-root', module.dataTableRoot);
  },
  'shadcn-data-table-row': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/data-table');
    registerExactPrototype('shadcn-data-table-row', module.dataTableRow);
  },
  'shadcn-data-table-cell': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/data-table');
    registerExactPrototype('shadcn-data-table-cell', module.dataTableCell);
  },
  'shadcn-data-table-header': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/data-table');
    registerExactPrototype('shadcn-data-table-header', module.dataTableHeader);
  },
  'shadcn-data-table-caption': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/data-table');
    registerExactPrototype('shadcn-data-table-caption', module.dataTableCaption);
  },
  'shadcn-data-table-previous': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/data-table');
    registerExactPrototype('shadcn-data-table-previous', module.dataTablePrevious);
  },
  'shadcn-data-table-next': async () => {
    const module = await import('@proto.ui/prototypes-shadcn/data-table');
    registerExactPrototype('shadcn-data-table-next', module.dataTableNext);
  },
  'brutalist-resizable-root': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/resizable');
    registerExactPrototype('brutalist-resizable-root', module.resizableRoot);
  },
  'brutalist-resizable-panel': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/resizable');
    registerExactPrototype('brutalist-resizable-panel', module.resizablePanel);
  },
  'brutalist-resizable-handle': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/resizable');
    registerExactPrototype('brutalist-resizable-handle', module.resizableHandle);
  },
  'brutalist-carousel-root': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/carousel');
    registerExactPrototype('brutalist-carousel-root', module.carouselRoot);
  },
  'brutalist-carousel-viewport': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/carousel');
    registerExactPrototype('brutalist-carousel-viewport', module.carouselViewport);
  },
  'brutalist-carousel-slide': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/carousel');
    registerExactPrototype('brutalist-carousel-slide', module.carouselSlide);
  },
  'brutalist-carousel-previous': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/carousel');
    registerExactPrototype('brutalist-carousel-previous', module.carouselPrevious);
  },
  'brutalist-carousel-next': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/carousel');
    registerExactPrototype('brutalist-carousel-next', module.carouselNext);
  },
  'brutalist-virtual-list-root': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/virtual-list');
    registerExactPrototype('brutalist-virtual-list-root', module.virtualListRoot);
  },
  'brutalist-virtual-list-viewport': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/virtual-list');
    registerExactPrototype('brutalist-virtual-list-viewport', module.virtualListViewport);
  },
  'brutalist-virtual-list-content': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/virtual-list');
    registerExactPrototype('brutalist-virtual-list-content', module.virtualListContent);
  },
  'brutalist-date-picker-root': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/date-picker');
    registerExactPrototype('brutalist-date-picker-root', module.datePickerRoot);
  },
  'brutalist-date-picker-trigger': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/date-picker');
    registerExactPrototype('brutalist-date-picker-trigger', module.datePickerTrigger);
  },
  'brutalist-date-picker-content': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/date-picker');
    registerExactPrototype('brutalist-date-picker-content', module.datePickerContent);
  },
  'brutalist-date-picker-day': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/date-picker');
    registerExactPrototype('brutalist-date-picker-day', module.datePickerDay);
  },
  'brutalist-date-picker-value': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/date-picker');
    registerExactPrototype('brutalist-date-picker-value', module.datePickerValue);
  },
  'brutalist-data-table-root': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/data-table');
    registerExactPrototype('brutalist-data-table-root', module.dataTableRoot);
  },
  'brutalist-data-table-row': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/data-table');
    registerExactPrototype('brutalist-data-table-row', module.dataTableRow);
  },
  'brutalist-data-table-cell': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/data-table');
    registerExactPrototype('brutalist-data-table-cell', module.dataTableCell);
  },
  'brutalist-data-table-header': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/data-table');
    registerExactPrototype('brutalist-data-table-header', module.dataTableHeader);
  },
  'brutalist-data-table-caption': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/data-table');
    registerExactPrototype('brutalist-data-table-caption', module.dataTableCaption);
  },
  'brutalist-data-table-previous': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/data-table');
    registerExactPrototype('brutalist-data-table-previous', module.dataTablePrevious);
  },
  'brutalist-data-table-next': async () => {
    const module = await import('@proto.ui/prototypes-brutalist/data-table');
    registerExactPrototype('brutalist-data-table-next', module.dataTableNext);
  },
  'bootstrap-2-3-2-resizable-root': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/resizable');
    registerExactPrototype('bootstrap-2-3-2-resizable-root', module.resizableRoot);
  },
  'bootstrap-2-3-2-resizable-panel': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/resizable');
    registerExactPrototype('bootstrap-2-3-2-resizable-panel', module.resizablePanel);
  },
  'bootstrap-2-3-2-resizable-handle': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/resizable');
    registerExactPrototype('bootstrap-2-3-2-resizable-handle', module.resizableHandle);
  },
  'bootstrap-2-3-2-carousel-root': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/carousel');
    registerExactPrototype('bootstrap-2-3-2-carousel-root', module.carouselRoot);
  },
  'bootstrap-2-3-2-carousel-viewport': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/carousel');
    registerExactPrototype('bootstrap-2-3-2-carousel-viewport', module.carouselViewport);
  },
  'bootstrap-2-3-2-carousel-slide': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/carousel');
    registerExactPrototype('bootstrap-2-3-2-carousel-slide', module.carouselSlide);
  },
  'bootstrap-2-3-2-carousel-previous': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/carousel');
    registerExactPrototype('bootstrap-2-3-2-carousel-previous', module.carouselPrevious);
  },
  'bootstrap-2-3-2-carousel-next': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/carousel');
    registerExactPrototype('bootstrap-2-3-2-carousel-next', module.carouselNext);
  },
  'bootstrap-2-3-2-virtual-list-root': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/virtual-list');
    registerExactPrototype('bootstrap-2-3-2-virtual-list-root', module.virtualListRoot);
  },
  'bootstrap-2-3-2-virtual-list-viewport': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/virtual-list');
    registerExactPrototype('bootstrap-2-3-2-virtual-list-viewport', module.virtualListViewport);
  },
  'bootstrap-2-3-2-virtual-list-content': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/virtual-list');
    registerExactPrototype('bootstrap-2-3-2-virtual-list-content', module.virtualListContent);
  },
  'bootstrap-2-3-2-date-picker-root': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/date-picker');
    registerExactPrototype('bootstrap-2-3-2-date-picker-root', module.datePickerRoot);
  },
  'bootstrap-2-3-2-date-picker-trigger': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/date-picker');
    registerExactPrototype('bootstrap-2-3-2-date-picker-trigger', module.datePickerTrigger);
  },
  'bootstrap-2-3-2-date-picker-content': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/date-picker');
    registerExactPrototype('bootstrap-2-3-2-date-picker-content', module.datePickerContent);
  },
  'bootstrap-2-3-2-date-picker-day': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/date-picker');
    registerExactPrototype('bootstrap-2-3-2-date-picker-day', module.datePickerDay);
  },
  'bootstrap-2-3-2-date-picker-value': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/date-picker');
    registerExactPrototype('bootstrap-2-3-2-date-picker-value', module.datePickerValue);
  },
  'bootstrap-2-3-2-data-table-root': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/data-table');
    registerExactPrototype('bootstrap-2-3-2-data-table-root', module.dataTableRoot);
  },
  'bootstrap-2-3-2-data-table-row': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/data-table');
    registerExactPrototype('bootstrap-2-3-2-data-table-row', module.dataTableRow);
  },
  'bootstrap-2-3-2-data-table-cell': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/data-table');
    registerExactPrototype('bootstrap-2-3-2-data-table-cell', module.dataTableCell);
  },
  'bootstrap-2-3-2-data-table-header': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/data-table');
    registerExactPrototype('bootstrap-2-3-2-data-table-header', module.dataTableHeader);
  },
  'bootstrap-2-3-2-data-table-caption': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/data-table');
    registerExactPrototype('bootstrap-2-3-2-data-table-caption', module.dataTableCaption);
  },
  'bootstrap-2-3-2-data-table-previous': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/data-table');
    registerExactPrototype('bootstrap-2-3-2-data-table-previous', module.dataTablePrevious);
  },
  'bootstrap-2-3-2-data-table-next': async () => {
    const module = await import('@proto.ui/prototypes-bootstrap-2-3-2/data-table');
    registerExactPrototype('bootstrap-2-3-2-data-table-next', module.dataTableNext);
  },
  'liquid-glass-resizable-root': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/resizable');
    registerExactPrototype('liquid-glass-resizable-root', module.resizableRoot);
  },
  'liquid-glass-resizable-panel': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/resizable');
    registerExactPrototype('liquid-glass-resizable-panel', module.resizablePanel);
  },
  'liquid-glass-resizable-handle': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/resizable');
    registerExactPrototype('liquid-glass-resizable-handle', module.resizableHandle);
  },
  'liquid-glass-carousel-root': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/carousel');
    registerExactPrototype('liquid-glass-carousel-root', module.carouselRoot);
  },
  'liquid-glass-carousel-viewport': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/carousel');
    registerExactPrototype('liquid-glass-carousel-viewport', module.carouselViewport);
  },
  'liquid-glass-carousel-slide': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/carousel');
    registerExactPrototype('liquid-glass-carousel-slide', module.carouselSlide);
  },
  'liquid-glass-carousel-previous': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/carousel');
    registerExactPrototype('liquid-glass-carousel-previous', module.carouselPrevious);
  },
  'liquid-glass-carousel-next': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/carousel');
    registerExactPrototype('liquid-glass-carousel-next', module.carouselNext);
  },
  'liquid-glass-virtual-list-root': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/virtual-list');
    registerExactPrototype('liquid-glass-virtual-list-root', module.virtualListRoot);
  },
  'liquid-glass-virtual-list-viewport': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/virtual-list');
    registerExactPrototype('liquid-glass-virtual-list-viewport', module.virtualListViewport);
  },
  'liquid-glass-virtual-list-content': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/virtual-list');
    registerExactPrototype('liquid-glass-virtual-list-content', module.virtualListContent);
  },
  'liquid-glass-date-picker-root': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/date-picker');
    registerExactPrototype('liquid-glass-date-picker-root', module.datePickerRoot);
  },
  'liquid-glass-date-picker-trigger': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/date-picker');
    registerExactPrototype('liquid-glass-date-picker-trigger', module.datePickerTrigger);
  },
  'liquid-glass-date-picker-content': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/date-picker');
    registerExactPrototype('liquid-glass-date-picker-content', module.datePickerContent);
  },
  'liquid-glass-date-picker-day': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/date-picker');
    registerExactPrototype('liquid-glass-date-picker-day', module.datePickerDay);
  },
  'liquid-glass-date-picker-value': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/date-picker');
    registerExactPrototype('liquid-glass-date-picker-value', module.datePickerValue);
  },
  'liquid-glass-data-table-root': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/data-table');
    registerExactPrototype('liquid-glass-data-table-root', module.dataTableRoot);
  },
  'liquid-glass-data-table-row': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/data-table');
    registerExactPrototype('liquid-glass-data-table-row', module.dataTableRow);
  },
  'liquid-glass-data-table-cell': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/data-table');
    registerExactPrototype('liquid-glass-data-table-cell', module.dataTableCell);
  },
  'liquid-glass-data-table-header': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/data-table');
    registerExactPrototype('liquid-glass-data-table-header', module.dataTableHeader);
  },
  'liquid-glass-data-table-caption': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/data-table');
    registerExactPrototype('liquid-glass-data-table-caption', module.dataTableCaption);
  },
  'liquid-glass-data-table-previous': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/data-table');
    registerExactPrototype('liquid-glass-data-table-previous', module.dataTablePrevious);
  },
  'liquid-glass-data-table-next': async () => {
    const module = await import('@proto.ui/prototypes-liquid-glass/data-table');
    registerExactPrototype('liquid-glass-data-table-next', module.dataTableNext);
  },
};

function registerExactPrototype(id: string, prototype: Prototype<any, any>): void {
  if (prototype.name !== id) throw new Error(`[Finf] source identity mismatch for ${id}`);
  registerPrototype(id, prototype);
}
