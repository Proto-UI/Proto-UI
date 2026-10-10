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
