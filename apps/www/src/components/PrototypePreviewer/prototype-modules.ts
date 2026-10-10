// src/components/PrototypePreviewer/prototype-modules.ts
// 原型模块映射表 - 按需动态导入

import { registerPrototype } from './registry';
import { finfPrototypeModules } from './finf-prototype-modules';

export type PrototypeModuleLoader = () => Promise<any>;

type ImportMetaWithGlob = ImportMeta & {
  glob?: (pattern: string) => Record<string, PrototypeModuleLoader>;
};

const DEMO_SUFFIX = '.demo.proto.ts';

function getPrototypeIdFromPath(path: string): string | null {
  const file = path.split('/').pop();
  if (!file || !file.endsWith(DEMO_SUFFIX)) return null;
  return file.slice(0, -DEMO_SUFFIX.length);
}

/**
 * 手动注册（可选）
 * key: prototypeId
 * value: 动态导入函数
 */
const manualPrototypeModules: Record<string, PrototypeModuleLoader> = {
  ...finfPrototypeModules,
  'liquid-glass-text-root': async () => {
    const mod = await import('@proto.ui/prototypes-liquid-glass/text');
    registerPrototype('liquid-glass-text-root', mod.textRoot);
  },
  'bootstrap-2-3-2-text-root': async () => {
    const mod = await import('@proto.ui/prototypes-bootstrap-2-3-2/text');
    registerPrototype('bootstrap-2-3-2-text-root', mod.textRoot);
  },
  'bootstrap-2-3-2-select-root': async () => {
    const mod = await import('@proto.ui/prototypes-bootstrap-2-3-2/select');
    registerPrototype('bootstrap-2-3-2-select-root', mod.selectRoot);
  },
  'bootstrap-2-3-2-select-trigger': async () => {
    const mod = await import('@proto.ui/prototypes-bootstrap-2-3-2/select');
    registerPrototype('bootstrap-2-3-2-select-trigger', mod.selectTrigger);
  },
  'bootstrap-2-3-2-select-value': async () => {
    const mod = await import('@proto.ui/prototypes-bootstrap-2-3-2/select');
    registerPrototype('bootstrap-2-3-2-select-value', mod.selectValue);
  },
  'bootstrap-2-3-2-select-content': async () => {
    const mod = await import('@proto.ui/prototypes-bootstrap-2-3-2/select');
    registerPrototype('bootstrap-2-3-2-select-content', mod.selectContent);
  },
  'bootstrap-2-3-2-select-item': async () => {
    const mod = await import('@proto.ui/prototypes-bootstrap-2-3-2/select');
    registerPrototype('bootstrap-2-3-2-select-item', mod.selectItem);
  },
  'liquid-glass-select-root': async () => {
    const mod = await import('@proto.ui/prototypes-liquid-glass/select');
    registerPrototype('liquid-glass-select-root', mod.selectRoot);
  },
  'liquid-glass-select-trigger': async () => {
    const mod = await import('@proto.ui/prototypes-liquid-glass/select');
    registerPrototype('liquid-glass-select-trigger', mod.selectTrigger);
  },
  'liquid-glass-select-value': async () => {
    const mod = await import('@proto.ui/prototypes-liquid-glass/select');
    registerPrototype('liquid-glass-select-value', mod.selectValue);
  },
  'liquid-glass-select-content': async () => {
    const mod = await import('@proto.ui/prototypes-liquid-glass/select');
    registerPrototype('liquid-glass-select-content', mod.selectContent);
  },
  'liquid-glass-select-item': async () => {
    const mod = await import('@proto.ui/prototypes-liquid-glass/select');
    registerPrototype('liquid-glass-select-item', mod.selectItem);
  },
  'base-field-root': async () => {
    const mod = await import('@proto.ui/prototypes-base/field');
    registerPrototype('base-field-root', mod.fieldRoot);
  },
  'base-field-label': async () => {
    const mod = await import('@proto.ui/prototypes-base/field');
    registerPrototype('base-field-label', mod.fieldLabel);
  },
  'base-field-control': async () => {
    const mod = await import('@proto.ui/prototypes-base/field');
    registerPrototype('base-field-control', mod.fieldControl);
  },
  'base-field-description': async () => {
    const mod = await import('@proto.ui/prototypes-base/field');
    registerPrototype('base-field-description', mod.fieldDescription);
  },
  'base-field-error': async () => {
    const mod = await import('@proto.ui/prototypes-base/field');
    registerPrototype('base-field-error', mod.fieldError);
  },
  'base-field-validity': async () => {
    const mod = await import('@proto.ui/prototypes-base/field');
    registerPrototype('base-field-validity', mod.fieldValidity);
  },
  'shadcn-field-root': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/field');
    registerPrototype('shadcn-field-root', mod.fieldRoot);
  },
  'shadcn-field-label': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/field');
    registerPrototype('shadcn-field-label', mod.fieldLabel);
  },
  'shadcn-field-control': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/field');
    registerPrototype('shadcn-field-control', mod.fieldControl);
  },
  'shadcn-field-description': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/field');
    registerPrototype('shadcn-field-description', mod.fieldDescription);
  },
  'shadcn-field-error': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/field');
    registerPrototype('shadcn-field-error', mod.fieldError);
  },
  'shadcn-field-validity': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/field');
    registerPrototype('shadcn-field-validity', mod.fieldValidity);
  },
  'brutalist-field-root': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/field');
    registerPrototype('brutalist-field-root', mod.fieldRoot);
  },
  'brutalist-field-label': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/field');
    registerPrototype('brutalist-field-label', mod.fieldLabel);
  },
  'brutalist-field-control': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/field');
    registerPrototype('brutalist-field-control', mod.fieldControl);
  },
  'brutalist-field-description': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/field');
    registerPrototype('brutalist-field-description', mod.fieldDescription);
  },
  'brutalist-field-error': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/field');
    registerPrototype('brutalist-field-error', mod.fieldError);
  },
  'brutalist-field-validity': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/field');
    registerPrototype('brutalist-field-validity', mod.fieldValidity);
  },
  'bootstrap-2-3-2-field-root': async () => {
    const mod = await import('@proto.ui/prototypes-bootstrap-2-3-2/field');
    registerPrototype('bootstrap-2-3-2-field-root', mod.fieldRoot);
  },
  'bootstrap-2-3-2-field-label': async () => {
    const mod = await import('@proto.ui/prototypes-bootstrap-2-3-2/field');
    registerPrototype('bootstrap-2-3-2-field-label', mod.fieldLabel);
  },
  'bootstrap-2-3-2-field-control': async () => {
    const mod = await import('@proto.ui/prototypes-bootstrap-2-3-2/field');
    registerPrototype('bootstrap-2-3-2-field-control', mod.fieldControl);
  },
  'bootstrap-2-3-2-field-description': async () => {
    const mod = await import('@proto.ui/prototypes-bootstrap-2-3-2/field');
    registerPrototype('bootstrap-2-3-2-field-description', mod.fieldDescription);
  },
  'bootstrap-2-3-2-field-error': async () => {
    const mod = await import('@proto.ui/prototypes-bootstrap-2-3-2/field');
    registerPrototype('bootstrap-2-3-2-field-error', mod.fieldError);
  },
  'bootstrap-2-3-2-field-validity': async () => {
    const mod = await import('@proto.ui/prototypes-bootstrap-2-3-2/field');
    registerPrototype('bootstrap-2-3-2-field-validity', mod.fieldValidity);
  },
  'liquid-glass-field-root': async () => {
    const mod = await import('@proto.ui/prototypes-liquid-glass/field');
    registerPrototype('liquid-glass-field-root', mod.fieldRoot);
  },
  'liquid-glass-field-label': async () => {
    const mod = await import('@proto.ui/prototypes-liquid-glass/field');
    registerPrototype('liquid-glass-field-label', mod.fieldLabel);
  },
  'liquid-glass-field-control': async () => {
    const mod = await import('@proto.ui/prototypes-liquid-glass/field');
    registerPrototype('liquid-glass-field-control', mod.fieldControl);
  },
  'liquid-glass-field-description': async () => {
    const mod = await import('@proto.ui/prototypes-liquid-glass/field');
    registerPrototype('liquid-glass-field-description', mod.fieldDescription);
  },
  'liquid-glass-field-error': async () => {
    const mod = await import('@proto.ui/prototypes-liquid-glass/field');
    registerPrototype('liquid-glass-field-error', mod.fieldError);
  },
  'liquid-glass-field-validity': async () => {
    const mod = await import('@proto.ui/prototypes-liquid-glass/field');
    registerPrototype('liquid-glass-field-validity', mod.fieldValidity);
  },
  'base-accordion-root': async () => {
    const mod = await import('@proto.ui/prototypes-base/accordion');
    registerPrototype('base-accordion-root', mod.accordionRoot);
  },
  'base-accordion-item': async () => {
    const mod = await import('@proto.ui/prototypes-base/accordion');
    registerPrototype('base-accordion-item', mod.accordionItem);
  },
  'base-accordion-heading': async () => {
    const mod = await import('@proto.ui/prototypes-base/accordion');
    registerPrototype('base-accordion-heading', mod.accordionHeading);
  },
  'base-accordion-trigger': async () => {
    const mod = await import('@proto.ui/prototypes-base/accordion');
    registerPrototype('base-accordion-trigger', mod.accordionTrigger);
  },
  'base-accordion-content': async () => {
    const mod = await import('@proto.ui/prototypes-base/accordion');
    registerPrototype('base-accordion-content', mod.accordionContent);
  },
  'shadcn-accordion-root': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/accordion');
    registerPrototype('shadcn-accordion-root', mod.accordionRoot);
  },
  'shadcn-accordion-item': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/accordion');
    registerPrototype('shadcn-accordion-item', mod.accordionItem);
  },
  'shadcn-accordion-heading': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/accordion');
    registerPrototype('shadcn-accordion-heading', mod.accordionHeading);
  },
  'shadcn-accordion-trigger': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/accordion');
    registerPrototype('shadcn-accordion-trigger', mod.accordionTrigger);
  },
  'shadcn-accordion-content': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/accordion');
    registerPrototype('shadcn-accordion-content', mod.accordionContent);
  },
  'brutalist-accordion-root': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/accordion');
    registerPrototype('brutalist-accordion-root', mod.accordionRoot);
  },
  'brutalist-accordion-item': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/accordion');
    registerPrototype('brutalist-accordion-item', mod.accordionItem);
  },
  'brutalist-accordion-heading': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/accordion');
    registerPrototype('brutalist-accordion-heading', mod.accordionHeading);
  },
  'brutalist-accordion-trigger': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/accordion');
    registerPrototype('brutalist-accordion-trigger', mod.accordionTrigger);
  },
  'brutalist-accordion-content': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/accordion');
    registerPrototype('brutalist-accordion-content', mod.accordionContent);
  },
  'bootstrap-2-3-2-accordion-root': async () => {
    const mod = await import('@proto.ui/prototypes-bootstrap-2-3-2/accordion');
    registerPrototype('bootstrap-2-3-2-accordion-root', mod.accordionRoot);
  },
  'bootstrap-2-3-2-accordion-item': async () => {
    const mod = await import('@proto.ui/prototypes-bootstrap-2-3-2/accordion');
    registerPrototype('bootstrap-2-3-2-accordion-item', mod.accordionItem);
  },
  'bootstrap-2-3-2-accordion-heading': async () => {
    const mod = await import('@proto.ui/prototypes-bootstrap-2-3-2/accordion');
    registerPrototype('bootstrap-2-3-2-accordion-heading', mod.accordionHeading);
  },
  'bootstrap-2-3-2-accordion-trigger': async () => {
    const mod = await import('@proto.ui/prototypes-bootstrap-2-3-2/accordion');
    registerPrototype('bootstrap-2-3-2-accordion-trigger', mod.accordionTrigger);
  },
  'bootstrap-2-3-2-accordion-content': async () => {
    const mod = await import('@proto.ui/prototypes-bootstrap-2-3-2/accordion');
    registerPrototype('bootstrap-2-3-2-accordion-content', mod.accordionContent);
  },
  'liquid-glass-accordion-root': async () => {
    const mod = await import('@proto.ui/prototypes-liquid-glass/accordion');
    registerPrototype('liquid-glass-accordion-root', mod.accordionRoot);
  },
  'liquid-glass-accordion-item': async () => {
    const mod = await import('@proto.ui/prototypes-liquid-glass/accordion');
    registerPrototype('liquid-glass-accordion-item', mod.accordionItem);
  },
  'liquid-glass-accordion-heading': async () => {
    const mod = await import('@proto.ui/prototypes-liquid-glass/accordion');
    registerPrototype('liquid-glass-accordion-heading', mod.accordionHeading);
  },
  'liquid-glass-accordion-trigger': async () => {
    const mod = await import('@proto.ui/prototypes-liquid-glass/accordion');
    registerPrototype('liquid-glass-accordion-trigger', mod.accordionTrigger);
  },
  'liquid-glass-accordion-content': async () => {
    const mod = await import('@proto.ui/prototypes-liquid-glass/accordion');
    registerPrototype('liquid-glass-accordion-content', mod.accordionContent);
  },
  'shadcn-collapsible-root': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/collapsible');
    registerPrototype('shadcn-collapsible-root', mod.collapsibleRoot);
  },
  'shadcn-collapsible-trigger': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/collapsible');
    registerPrototype('shadcn-collapsible-trigger', mod.collapsibleTrigger);
  },
  'shadcn-collapsible-content': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/collapsible');
    registerPrototype('shadcn-collapsible-content', mod.collapsibleContent);
  },
  'brutalist-collapsible-root': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/collapsible');
    registerPrototype('brutalist-collapsible-root', mod.collapsibleRoot);
  },
  'brutalist-collapsible-trigger': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/collapsible');
    registerPrototype('brutalist-collapsible-trigger', mod.collapsibleTrigger);
  },
  'brutalist-collapsible-content': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/collapsible');
    registerPrototype('brutalist-collapsible-content', mod.collapsibleContent);
  },
  'bootstrap-2-3-2-collapsible-root': async () => {
    const mod = await import('@proto.ui/prototypes-bootstrap-2-3-2/collapsible');
    registerPrototype('bootstrap-2-3-2-collapsible-root', mod.collapsibleRoot);
  },
  'bootstrap-2-3-2-collapsible-trigger': async () => {
    const mod = await import('@proto.ui/prototypes-bootstrap-2-3-2/collapsible');
    registerPrototype('bootstrap-2-3-2-collapsible-trigger', mod.collapsibleTrigger);
  },
  'bootstrap-2-3-2-collapsible-content': async () => {
    const mod = await import('@proto.ui/prototypes-bootstrap-2-3-2/collapsible');
    registerPrototype('bootstrap-2-3-2-collapsible-content', mod.collapsibleContent);
  },
  'liquid-glass-collapsible-root': async () => {
    const mod = await import('@proto.ui/prototypes-liquid-glass/collapsible');
    registerPrototype('liquid-glass-collapsible-root', mod.collapsibleRoot);
  },
  'liquid-glass-collapsible-trigger': async () => {
    const mod = await import('@proto.ui/prototypes-liquid-glass/collapsible');
    registerPrototype('liquid-glass-collapsible-trigger', mod.collapsibleTrigger);
  },
  'liquid-glass-collapsible-content': async () => {
    const mod = await import('@proto.ui/prototypes-liquid-glass/collapsible');
    registerPrototype('liquid-glass-collapsible-content', mod.collapsibleContent);
  },
  'base-label-root': async () => {
    const mod = await import('@proto.ui/prototypes-base/label');
    registerPrototype('base-label-root', mod.default);
  },
  'shadcn-label-root': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/label');
    registerPrototype('shadcn-label-root', mod.default);
  },
  'brutalist-label-root': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/label');
    registerPrototype('brutalist-label-root', mod.default);
  },
  'bootstrap-2-3-2-label-root': async () => {
    const mod = await import('@proto.ui/prototypes-bootstrap-2-3-2/label');
    registerPrototype('bootstrap-2-3-2-label-root', mod.default);
  },
  'liquid-glass-label-root': async () => {
    const mod = await import('@proto.ui/prototypes-liquid-glass/label');
    registerPrototype('liquid-glass-label-root', mod.default);
  },
  'base-surface-root': async () => {
    const mod = await import('@proto.ui/prototypes-base/surface');
    registerPrototype('base-surface-root', mod.default);
  },
  'base-text-root': async () => {
    const mod = await import('@proto.ui/prototypes-base/text');
    registerPrototype('base-text-root', mod.default);
  },
  'shadcn-text-root': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/text');
    registerPrototype('shadcn-text-root', mod.default);
  },
  'shadcn-surface-root': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/surface');
    registerPrototype('shadcn-surface-root', mod.default);
  },
  'brutalist-text-root': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/text');
    registerPrototype('brutalist-text-root', mod.default);
  },
  'brutalist-surface-root': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/surface');
    registerPrototype('brutalist-surface-root', mod.default);
  },
  'liquid-glass-surface-root': async () => {
    const mod = await import('@proto.ui/prototypes-liquid-glass/surface');
    registerPrototype('liquid-glass-surface-root', mod.default);
  },
  'bootstrap-2-3-2-surface-root': async () => {
    const mod = await import('@proto.ui/prototypes-bootstrap-2-3-2/surface');
    registerPrototype('bootstrap-2-3-2-surface-root', mod.default);
  },
  'bootstrap-2-3-2-button': async () => {
    const mod = await import('@proto.ui/prototypes-bootstrap-2-3-2/button');
    registerPrototype('bootstrap-2-3-2-button', mod.default);
  },
  'bootstrap-2-3-2-checkbox-root': async () => {
    const mod = await import('@proto.ui/prototypes-bootstrap-2-3-2/checkbox');
    registerPrototype('bootstrap-2-3-2-checkbox-root', mod.checkboxRoot);
  },
  'bootstrap-2-3-2-checkbox-indicator': async () => {
    const mod = await import('@proto.ui/prototypes-bootstrap-2-3-2/checkbox');
    registerPrototype('bootstrap-2-3-2-checkbox-indicator', mod.checkboxIndicator);
  },
  'bootstrap-2-3-2-switch-root': async () => {
    const mod = await import('@proto.ui/prototypes-bootstrap-2-3-2/switch');
    registerPrototype('bootstrap-2-3-2-switch-root', mod.switchRoot);
  },
  'bootstrap-2-3-2-switch-thumb': async () => {
    const mod = await import('@proto.ui/prototypes-bootstrap-2-3-2/switch');
    registerPrototype('bootstrap-2-3-2-switch-thumb', mod.switchThumb);
  },
  'bootstrap-2-3-2-toggle': async () => {
    const mod = await import('@proto.ui/prototypes-bootstrap-2-3-2/toggle');
    registerPrototype('bootstrap-2-3-2-toggle', mod.toggle);
  },
  'bootstrap-2-3-2-input-root': async () => {
    const mod = await import('@proto.ui/prototypes-bootstrap-2-3-2/input');
    registerPrototype('bootstrap-2-3-2-input-root', mod.inputRoot);
  },
  'bootstrap-2-3-2-textarea-root': async () => {
    const mod = await import('@proto.ui/prototypes-bootstrap-2-3-2/textarea');
    registerPrototype('bootstrap-2-3-2-textarea-root', mod.textareaRoot);
  },
  'bootstrap-2-3-2-separator-root': async () => {
    const mod = await import('@proto.ui/prototypes-bootstrap-2-3-2/separator');
    registerPrototype('bootstrap-2-3-2-separator-root', mod.separatorRoot);
  },
  'liquid-glass-button': async () => {
    const mod = await import('@proto.ui/prototypes-liquid-glass/button');
    registerPrototype('liquid-glass-button', mod.default);
  },
  'base-button': async () => {
    const mod = await import('@proto.ui/prototypes-base');
    registerPrototype('base-button', mod.button);
  },
  'base-toggle': async () => {
    const mod = await import('@proto.ui/prototypes-base/toggle');
    registerPrototype('base-toggle', mod.toggle);
  },
  // Runtime registry loaders keep each preview family out of the initial bundle.
  'base-collapsible-root': async () => {
    const mod = await import('@proto.ui/prototypes-base/collapsible');
    registerPrototype('base-collapsible-root', mod.collapsibleRoot);
  },
  'base-collapsible-trigger': async () => {
    const mod = await import('@proto.ui/prototypes-base/collapsible');
    registerPrototype('base-collapsible-trigger', mod.collapsibleTrigger);
  },
  'base-collapsible-content': async () => {
    const mod = await import('@proto.ui/prototypes-base/collapsible');
    registerPrototype('base-collapsible-content', mod.collapsibleContent);
  },
  'base-switch-root': async () => {
    const mod = await import('@proto.ui/prototypes-base/switch');
    registerPrototype('base-switch-root', mod.switchRoot);
  },
  'base-switch-thumb': async () => {
    const mod = await import('@proto.ui/prototypes-base/switch');
    registerPrototype('base-switch-thumb', mod.switchThumb);
  },
  'base-tabs-root': async () => {
    const mod = await import('@proto.ui/prototypes-base/tabs');
    registerPrototype('base-tabs-root', mod.tabsRoot);
  },
  'base-tabs-list': async () => {
    const mod = await import('@proto.ui/prototypes-base/tabs');
    registerPrototype('base-tabs-list', mod.tabsList);
  },
  'base-tabs-trigger': async () => {
    const mod = await import('@proto.ui/prototypes-base/tabs');
    registerPrototype('base-tabs-trigger', mod.tabsTrigger);
  },
  'base-tabs-content': async () => {
    const mod = await import('@proto.ui/prototypes-base/tabs');
    registerPrototype('base-tabs-content', mod.tabsContent);
  },
  'base-tabs-indicator': async () => {
    const mod = await import('@proto.ui/prototypes-base/tabs');
    registerPrototype('base-tabs-indicator', mod.tabsIndicator);
  },
  'shadcn-button': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/button/index');
    registerPrototype('shadcn-button', mod.default);
  },
  'brutalist-button': async () => {
    const mod = await import('../../../../../packages/prototypes/brutalist/src/button/index');
    registerPrototype('brutalist-button', mod.default);
  },
  'brutalist-badge-root': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/badge');
    registerPrototype('brutalist-badge-root', mod.BrutalistBadgeRoot);
  },
  'shadcn-card-root': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/card');
    registerPrototype('shadcn-card-root', mod.ShadcnCardRoot);
  },
  'shadcn-card-header': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/card');
    registerPrototype('shadcn-card-header', mod.ShadcnCardHeader);
  },
  'shadcn-card-content': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/card');
    registerPrototype('shadcn-card-content', mod.ShadcnCardContent);
  },
  'shadcn-card-footer': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/card');
    registerPrototype('shadcn-card-footer', mod.ShadcnCardFooter);
  },
  'brutalist-card-root': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/card');
    registerPrototype('brutalist-card-root', mod.BrutalistCardRoot);
  },
  'brutalist-card-header': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/card');
    registerPrototype('brutalist-card-header', mod.BrutalistCardHeader);
  },
  'brutalist-card-content': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/card');
    registerPrototype('brutalist-card-content', mod.BrutalistCardContent);
  },
  'brutalist-card-footer': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/card');
    registerPrototype('brutalist-card-footer', mod.BrutalistCardFooter);
  },
  'brutalist-separator-root': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/separator');
    registerPrototype('brutalist-separator-root', mod.BrutalistSeparatorRoot);
  },
  'brutalist-skeleton-root': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/skeleton');
    registerPrototype('brutalist-skeleton-root', mod.BrutalistSkeletonRoot);
  },
  'brutalist-spinner-root': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/spinner');
    registerPrototype('brutalist-spinner-root', mod.BrutalistSpinnerRoot);
  },
  'base-separator-root': async () => {
    const mod = await import('@proto.ui/prototypes-base/separator');
    registerPrototype('base-separator-root', mod.default);
  },
  'base-scroll-area-root': async () => {
    const mod = await import('@proto.ui/prototypes-base/scroll-area');
    registerPrototype('base-scroll-area-root', mod.scrollAreaRoot);
  },
  'base-scroll-area-viewport': async () => {
    const mod = await import('@proto.ui/prototypes-base/scroll-area');
    registerPrototype('base-scroll-area-viewport', mod.scrollAreaViewport);
  },
  'base-scroll-area-scrollbar': async () => {
    const mod = await import('@proto.ui/prototypes-base/scroll-area');
    registerPrototype('base-scroll-area-scrollbar', mod.scrollAreaScrollbar);
  },
  'base-scroll-area-thumb': async () => {
    const mod = await import('@proto.ui/prototypes-base/scroll-area');
    registerPrototype('base-scroll-area-thumb', mod.scrollAreaThumb);
  },
  'base-textarea-root': async () => {
    const mod = await import('@proto.ui/prototypes-base/textarea');
    registerPrototype('base-textarea-root', mod.textareaRoot);
  },
  'base-input-root': async () => {
    const mod = await import('@proto.ui/prototypes-base/input');
    registerPrototype('base-input-root', mod.inputRoot);
  },
  'base-image-root': async () => {
    const mod = await import('@proto.ui/prototypes-base/image');
    registerPrototype('base-image-root', mod.imageRoot);
  },
  'base-table-root': async () => {
    const mod = await import('@proto.ui/prototypes-base/table');
    registerPrototype('base-table-root', mod.tableRoot);
  },
  'base-table-caption': async () => {
    const mod = await import('@proto.ui/prototypes-base/table');
    registerPrototype('base-table-caption', mod.tableCaption);
  },
  'base-table-row': async () => {
    const mod = await import('@proto.ui/prototypes-base/table');
    registerPrototype('base-table-row', mod.tableRow);
  },
  'base-table-header-cell': async () => {
    const mod = await import('@proto.ui/prototypes-base/table');
    registerPrototype('base-table-header-cell', mod.tableHeaderCell);
  },
  'base-table-cell': async () => {
    const mod = await import('@proto.ui/prototypes-base/table');
    registerPrototype('base-table-cell', mod.tableCell);
  },
  'brutalist-textarea-root': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/textarea');
    registerPrototype('brutalist-textarea-root', mod.brutalistTextareaRoot);
  },
  'base-live-region-root': async () => {
    const mod = await import('@proto.ui/prototypes-base/live-region');
    registerPrototype('base-live-region-root', mod.default);
  },
  'base-async-region-root': async () => {
    const mod = await import('@proto.ui/prototypes-base/async-region');
    registerPrototype('base-async-region-root', mod.default);
  },
  'brutalist-toggle': async () => {
    const mod = await import('../../../../../packages/prototypes/brutalist/src/toggle/index');
    registerPrototype('brutalist-toggle', mod.default);
  },
  'brutalist-switch-root': async () => {
    const mod = await import('../../../../../packages/prototypes/brutalist/src/switch/root.proto');
    registerPrototype('brutalist-switch-root', mod.default);
  },
  'brutalist-switch-thumb': async () => {
    const mod = await import('../../../../../packages/prototypes/brutalist/src/switch/thumb.proto');
    registerPrototype('brutalist-switch-thumb', mod.default);
  },
  'brutalist-tabs-root': async () => {
    const mod = await import('../../../../../packages/prototypes/brutalist/src/tabs/root.proto');
    registerPrototype('brutalist-tabs-root', mod.default);
  },
  'brutalist-tabs-list': async () => {
    const mod = await import('../../../../../packages/prototypes/brutalist/src/tabs/list.proto');
    registerPrototype('brutalist-tabs-list', mod.default);
  },
  'brutalist-tabs-trigger': async () => {
    const mod = await import('../../../../../packages/prototypes/brutalist/src/tabs/trigger.proto');
    registerPrototype('brutalist-tabs-trigger', mod.default);
  },
  'brutalist-tabs-content': async () => {
    const mod = await import('../../../../../packages/prototypes/brutalist/src/tabs/content.proto');
    registerPrototype('brutalist-tabs-content', mod.default);
  },
  'brutalist-hover-card-root': async () => {
    const mod =
      await import('../../../../../packages/prototypes/brutalist/src/hover-card/root.proto');
    registerPrototype('brutalist-hover-card-root', mod.default);
  },
  'brutalist-hover-card-trigger': async () => {
    const mod =
      await import('../../../../../packages/prototypes/brutalist/src/hover-card/trigger.proto');
    registerPrototype('brutalist-hover-card-trigger', mod.default);
  },
  'brutalist-hover-card-content': async () => {
    const mod =
      await import('../../../../../packages/prototypes/brutalist/src/hover-card/content.proto');
    registerPrototype('brutalist-hover-card-content', mod.default);
  },
  'brutalist-dropdown-root': async () => {
    const mod =
      await import('../../../../../packages/prototypes/brutalist/src/dropdown/root.proto');
    registerPrototype('brutalist-dropdown-root', mod.default);
  },
  'brutalist-dropdown-trigger': async () => {
    const mod =
      await import('../../../../../packages/prototypes/brutalist/src/dropdown/trigger.proto');
    registerPrototype('brutalist-dropdown-trigger', mod.default);
  },
  'brutalist-dropdown-content': async () => {
    const mod =
      await import('../../../../../packages/prototypes/brutalist/src/dropdown/content.proto');
    registerPrototype('brutalist-dropdown-content', mod.default);
  },
  'brutalist-dropdown-item': async () => {
    const mod =
      await import('../../../../../packages/prototypes/brutalist/src/dropdown/item.proto');
    registerPrototype('brutalist-dropdown-item', mod.default);
  },
  'brutalist-select-root': async () => {
    const mod = await import('../../../../../packages/prototypes/brutalist/src/select/root.proto');
    registerPrototype('brutalist-select-root', mod.default);
  },
  'brutalist-select-trigger': async () => {
    const mod =
      await import('../../../../../packages/prototypes/brutalist/src/select/trigger.proto');
    registerPrototype('brutalist-select-trigger', mod.default);
  },
  'brutalist-select-value': async () => {
    const mod = await import('../../../../../packages/prototypes/brutalist/src/select/value.proto');
    registerPrototype('brutalist-select-value', mod.default);
  },
  'brutalist-select-content': async () => {
    const mod =
      await import('../../../../../packages/prototypes/brutalist/src/select/content.proto');
    registerPrototype('brutalist-select-content', mod.default);
  },
  'brutalist-select-item': async () => {
    const mod = await import('../../../../../packages/prototypes/brutalist/src/select/item.proto');
    registerPrototype('brutalist-select-item', mod.default);
  },
  'brutalist-dialog-root': async () => {
    const mod = await import('../../../../../packages/prototypes/brutalist/src/dialog/root.proto');
    registerPrototype('brutalist-dialog-root', mod.default);
  },
  'brutalist-dialog-trigger': async () => {
    const mod =
      await import('../../../../../packages/prototypes/brutalist/src/dialog/trigger.proto');
    registerPrototype('brutalist-dialog-trigger', mod.default);
  },
  'brutalist-dialog-mask': async () => {
    const mod =
      await import('../../../../../packages/prototypes/brutalist/src/dialog/overlay.proto');
    registerPrototype('brutalist-dialog-mask', mod.default);
  },
  'brutalist-dialog-content': async () => {
    const mod =
      await import('../../../../../packages/prototypes/brutalist/src/dialog/content.proto');
    registerPrototype('brutalist-dialog-content', mod.default);
  },
  'brutalist-dialog-title': async () => {
    const mod = await import('../../../../../packages/prototypes/brutalist/src/dialog/title.proto');
    registerPrototype('brutalist-dialog-title', mod.default);
  },
  'brutalist-dialog-description': async () => {
    const mod =
      await import('../../../../../packages/prototypes/brutalist/src/dialog/description.proto');
    registerPrototype('brutalist-dialog-description', mod.default);
  },
  'brutalist-dialog-close': async () => {
    const mod = await import('../../../../../packages/prototypes/brutalist/src/dialog/close.proto');
    registerPrototype('brutalist-dialog-close', mod.default);
  },
  'brutalist-dialog-close-icon': async () => {
    const mod =
      await import('../../../../../packages/prototypes/brutalist/src/dialog/close-icon.proto');
    registerPrototype('brutalist-dialog-close-icon', mod.default);
  },
  'brutalist-dialog-header': async () => {
    const mod =
      await import('../../../../../packages/prototypes/brutalist/src/dialog/header.proto');
    registerPrototype('brutalist-dialog-header', mod.default);
  },
  'brutalist-dialog-footer': async () => {
    const mod =
      await import('../../../../../packages/prototypes/brutalist/src/dialog/footer.proto');
    registerPrototype('brutalist-dialog-footer', mod.default);
  },
  'brutalist-scroll-area-root': async () => {
    const mod = await import('../../../../../packages/prototypes/brutalist/src/scroll-area/index');
    registerPrototype('brutalist-scroll-area-root', mod.BrutalistScrollAreaRoot);
  },
  'brutalist-scroll-area-viewport': async () => {
    const mod = await import('../../../../../packages/prototypes/brutalist/src/scroll-area/index');
    registerPrototype('brutalist-scroll-area-viewport', mod.BrutalistScrollAreaViewport);
  },
  'brutalist-scroll-area-scrollbar': async () => {
    const mod = await import('../../../../../packages/prototypes/brutalist/src/scroll-area/index');
    registerPrototype('brutalist-scroll-area-scrollbar', mod.BrutalistScrollAreaScrollbar);
  },
  'brutalist-scroll-area-thumb': async () => {
    const mod = await import('../../../../../packages/prototypes/brutalist/src/scroll-area/index');
    registerPrototype('brutalist-scroll-area-thumb', mod.BrutalistScrollAreaThumb);
  },
  'brutalist-tooltip-group': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/tooltip');
    registerPrototype('brutalist-tooltip-group', mod.BrutalistTooltipGroup);
  },
  'brutalist-tooltip-root': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/tooltip');
    registerPrototype('brutalist-tooltip-root', mod.BrutalistTooltipRoot);
  },
  'brutalist-tooltip-trigger': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/tooltip');
    registerPrototype('brutalist-tooltip-trigger', mod.BrutalistTooltipTrigger);
  },
  'brutalist-tooltip-content': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/tooltip');
    registerPrototype('brutalist-tooltip-content', mod.BrutalistTooltipContent);
  },
  'shadcn-toggle': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/toggle/index');
    registerPrototype('shadcn-toggle', mod.default);
  },
  'lucide-circle-alert-icon': async () => {
    const mod = await import('../../../../../packages/prototypes/lucide/src/icons/circle-alert');
    registerPrototype('lucide-circle-alert-icon', mod.default);
  },
  'lucide-check-icon': async () => {
    const mod = await import('../../../../../packages/prototypes/lucide/src/icons/check');
    registerPrototype('lucide-check-icon', mod.default);
  },
  'lucide-loader-circle-icon': async () => {
    const mod = await import('../../../../../packages/prototypes/lucide/src/icons/loader-circle');
    registerPrototype('lucide-loader-circle-icon', mod.default);
  },
  'lucide-copy-icon': async () => {
    const mod = await import('../../../../../packages/prototypes/lucide/src/icons/copy');
    registerPrototype('lucide-copy-icon', mod.default);
  },
  'lucide-icon': async () => {
    const mod = await import('../../../../../packages/prototypes/lucide/src/icon/index');
    registerPrototype('lucide-icon', mod.default);
  },
  'lucide-search-icon': async () => {
    const mod = await import('../../../../../packages/prototypes/lucide/src/icons/search');
    registerPrototype('lucide-search-icon', mod.default);
  },
  'lucide-list-icon': async () => {
    const mod = await import('@proto.ui/prototypes-lucide/icons/list');
    registerPrototype('lucide-list-icon', mod.default);
  },
  'lucide-chevron-down-icon': async () => {
    const mod = await import('../../../../../packages/prototypes/lucide/src/icons/chevron-down');
    registerPrototype('lucide-chevron-down-icon', mod.default);
  },
  'lucide-x-icon': async () => {
    const mod = await import('../../../../../packages/prototypes/lucide/src/icons/x');
    registerPrototype('lucide-x-icon', mod.default);
  },
  'shadcn-separator-root': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/separator');
    registerPrototype('shadcn-separator-root', mod.default);
  },
  'shadcn-switch-root': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/switch/root.proto');
    registerPrototype('shadcn-switch-root', mod.default);
  },
  'shadcn-switch-thumb': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/switch/thumb.proto');
    registerPrototype('shadcn-switch-thumb', mod.default);
  },
  'shadcn-tabs-root': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/tabs/root.proto');
    registerPrototype('shadcn-tabs-root', mod.default);
  },
  'shadcn-tabs-list': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/tabs/list.proto');
    registerPrototype('shadcn-tabs-list', mod.default);
  },
  'shadcn-tabs-trigger': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/tabs/trigger.proto');
    registerPrototype('shadcn-tabs-trigger', mod.default);
  },
  'shadcn-tabs-content': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/tabs/content.proto');
    registerPrototype('shadcn-tabs-content', mod.default);
  },
  'base-hover-card-root': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/hover-card/root.proto');
    registerPrototype('base-hover-card-root', mod.default);
  },
  'base-hover-card-trigger': async () => {
    const mod =
      await import('../../../../../packages/prototypes/base/src/hover-card/trigger.proto');
    registerPrototype('base-hover-card-trigger', mod.default);
  },
  'base-hover-card-content': async () => {
    const mod =
      await import('../../../../../packages/prototypes/base/src/hover-card/content.proto');
    registerPrototype('base-hover-card-content', mod.default);
  },
  'base-tooltip-group': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/tooltip/group.proto');
    registerPrototype('base-tooltip-group', mod.default);
  },
  'base-tooltip-root': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/tooltip/root.proto');
    registerPrototype('base-tooltip-root', mod.default);
  },
  'base-tooltip-trigger': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/tooltip/trigger.proto');
    registerPrototype('base-tooltip-trigger', mod.default);
  },
  'base-tooltip-content': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/tooltip/content.proto');
    registerPrototype('base-tooltip-content', mod.default);
  },
  'base-dropdown-root': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/dropdown/root.proto');
    registerPrototype('base-dropdown-root', mod.default);
  },
  'base-dropdown-trigger': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/dropdown/trigger.proto');
    registerPrototype('base-dropdown-trigger', mod.default);
  },
  'base-dropdown-content': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/dropdown/content.proto');
    registerPrototype('base-dropdown-content', mod.default);
  },
  'base-dropdown-item': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/dropdown/item.proto');
    registerPrototype('base-dropdown-item', mod.default);
  },
  'base-checkbox-root': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/checkbox/root.proto');
    registerPrototype('base-checkbox-root', mod.default);
  },
  'base-checkbox-indicator': async () => {
    const mod =
      await import('../../../../../packages/prototypes/base/src/checkbox/indicator.proto');
    registerPrototype('base-checkbox-indicator', mod.default);
  },
  'base-radio-group-root': async () => {
    const mod = await import('@proto.ui/prototypes-base/radio-group');
    registerPrototype('base-radio-group-root', mod.radioGroupRoot);
  },
  'base-radio-group-item': async () => {
    const mod = await import('@proto.ui/prototypes-base/radio-group');
    registerPrototype('base-radio-group-item', mod.radioGroupItem);
  },
  'base-radio-group-indicator': async () => {
    const mod = await import('@proto.ui/prototypes-base/radio-group');
    registerPrototype('base-radio-group-indicator', mod.radioGroupIndicator);
  },
  'base-transition': async () => {
    const mod =
      await import('../../../../../packages/prototypes/base/src/transition/transition.proto');
    registerPrototype('base-transition', mod.default);
  },
  'base-select-root': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/select/root.proto');
    registerPrototype('base-select-root', mod.default);
  },
  'base-select-trigger': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/select/trigger.proto');
    registerPrototype('base-select-trigger', mod.default);
  },
  'base-select-value': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/select/value.proto');
    registerPrototype('base-select-value', mod.default);
  },
  'base-select-content': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/select/content.proto');
    registerPrototype('base-select-content', mod.default);
  },
  'base-select-item': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/select/item.proto');
    registerPrototype('base-select-item', mod.default);
  },
  'shadcn-hover-card-root': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/hover-card/root.proto');
    registerPrototype('shadcn-hover-card-root', mod.default);
  },
  'shadcn-hover-card-trigger': async () => {
    const mod =
      await import('../../../../../packages/prototypes/shadcn/src/hover-card/trigger.proto');
    registerPrototype('shadcn-hover-card-trigger', mod.default);
  },
  'shadcn-hover-card-content': async () => {
    const mod =
      await import('../../../../../packages/prototypes/shadcn/src/hover-card/content.proto');
    registerPrototype('shadcn-hover-card-content', mod.default);
  },
  'shadcn-dropdown-root': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/dropdown/root.proto');
    registerPrototype('shadcn-dropdown-root', mod.default);
  },
  'shadcn-dropdown-trigger': async () => {
    const mod =
      await import('../../../../../packages/prototypes/shadcn/src/dropdown/trigger.proto');
    registerPrototype('shadcn-dropdown-trigger', mod.default);
  },
  'shadcn-dropdown-content': async () => {
    const mod =
      await import('../../../../../packages/prototypes/shadcn/src/dropdown/content.proto');
    registerPrototype('shadcn-dropdown-content', mod.default);
  },
  'shadcn-dropdown-item': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/dropdown/item.proto');
    registerPrototype('shadcn-dropdown-item', mod.default);
  },
  'shadcn-select-root': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/select/root.proto');
    registerPrototype('shadcn-select-root', mod.default);
  },
  'shadcn-select-trigger': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/select/trigger.proto');
    registerPrototype('shadcn-select-trigger', mod.default);
  },
  'shadcn-select-value': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/select/value.proto');
    registerPrototype('shadcn-select-value', mod.default);
  },
  'shadcn-select-content': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/select/content.proto');
    registerPrototype('shadcn-select-content', mod.default);
  },
  'shadcn-select-item': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/select/item.proto');
    registerPrototype('shadcn-select-item', mod.default);
  },
  'base-dialog-root': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/dialog/root.proto');
    registerPrototype('base-dialog-root', mod.default);
  },
  'base-dialog-trigger': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/dialog/trigger.proto');
    registerPrototype('base-dialog-trigger', mod.default);
  },
  'base-dialog-mask': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/dialog/overlay.proto');
    registerPrototype('base-dialog-mask', mod.default);
  },
  'base-dialog-content': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/dialog/content.proto');
    registerPrototype('base-dialog-content', mod.default);
  },
  'base-dialog-title': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/dialog/title.proto');
    registerPrototype('base-dialog-title', mod.default);
  },
  'base-dialog-description': async () => {
    const mod =
      await import('../../../../../packages/prototypes/base/src/dialog/description.proto');
    registerPrototype('base-dialog-description', mod.default);
  },
  'base-dialog-close': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/dialog/close.proto');
    registerPrototype('base-dialog-close', mod.default);
  },
  'shadcn-dialog-root': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/dialog/root.proto');
    registerPrototype('shadcn-dialog-root', mod.default);
  },
  'shadcn-dialog-trigger': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/dialog/trigger.proto');
    registerPrototype('shadcn-dialog-trigger', mod.default);
  },
  'shadcn-dialog-mask': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/dialog/overlay.proto');
    registerPrototype('shadcn-dialog-mask', mod.default);
  },
  'shadcn-dialog-content': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/dialog/content.proto');
    registerPrototype('shadcn-dialog-content', mod.default);
  },
  'shadcn-dialog-title': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/dialog/title.proto');
    registerPrototype('shadcn-dialog-title', mod.default);
  },
  'shadcn-dialog-description': async () => {
    const mod =
      await import('../../../../../packages/prototypes/shadcn/src/dialog/description.proto');
    registerPrototype('shadcn-dialog-description', mod.default);
  },
  'shadcn-dialog-close': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/dialog/close.proto');
    registerPrototype('shadcn-dialog-close', mod.default);
  },
  'shadcn-dialog-close-icon': async () => {
    const mod =
      await import('../../../../../packages/prototypes/shadcn/src/dialog/close-icon.proto');
    registerPrototype('shadcn-dialog-close-icon', mod.default);
  },
  'shadcn-dialog-header': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/dialog/header.proto');
    registerPrototype('shadcn-dialog-header', mod.default);
  },
  'shadcn-checkbox-root': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/checkbox');
    registerPrototype('shadcn-checkbox-root', mod.shadcnCheckboxRoot);
  },
  'shadcn-checkbox-indicator': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/checkbox');
    registerPrototype('shadcn-checkbox-indicator', mod.shadcnCheckboxIndicator);
  },
  'shadcn-radio-group-root': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/radio-group');
    registerPrototype('shadcn-radio-group-root', mod.shadcnRadioGroupRoot);
  },
  'shadcn-radio-group-item': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/radio-group');
    registerPrototype('shadcn-radio-group-item', mod.shadcnRadioGroupItem);
  },
  'shadcn-radio-group-indicator': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/radio-group');
    registerPrototype('shadcn-radio-group-indicator', mod.shadcnRadioGroupIndicator);
  },
  // Runtime-selected preview registry keeps the public Scroll Area package import lazy.
  'shadcn-scroll-area-root': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/scroll-area');
    registerPrototype('shadcn-scroll-area-root', mod.shadcnScrollAreaRoot);
  },
  'shadcn-scroll-area-viewport': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/scroll-area');
    registerPrototype('shadcn-scroll-area-viewport', mod.shadcnScrollAreaViewport);
  },
  'shadcn-scroll-area-scrollbar': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/scroll-area');
    registerPrototype('shadcn-scroll-area-scrollbar', mod.shadcnScrollAreaScrollbar);
  },
  'shadcn-scroll-area-thumb': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/scroll-area');
    registerPrototype('shadcn-scroll-area-thumb', mod.shadcnScrollAreaThumb);
  },
  // Runtime-selected preview registry keeps the real public family import lazy.
  'brutalist-checkbox-root': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/checkbox');
    registerPrototype('brutalist-checkbox-root', mod.brutalistCheckboxRoot);
  },
  'brutalist-checkbox-indicator': async () => {
    const mod = await import('@proto.ui/prototypes-brutalist/checkbox');
    registerPrototype('brutalist-checkbox-indicator', mod.brutalistCheckboxIndicator);
  },
  // Runtime-selected preview registry keeps the public Tooltip package import lazy.
  'shadcn-tooltip-group': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/tooltip');
    registerPrototype('shadcn-tooltip-group', mod.shadcnTooltipGroup);
  },
  'shadcn-tooltip-root': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/tooltip');
    registerPrototype('shadcn-tooltip-root', mod.shadcnTooltipRoot);
  },
  'shadcn-tooltip-trigger': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/tooltip');
    registerPrototype('shadcn-tooltip-trigger', mod.shadcnTooltipTrigger);
  },
  'shadcn-tooltip-content': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/tooltip');
    registerPrototype('shadcn-tooltip-content', mod.shadcnTooltipContent);
  },
  'shadcn-textarea-root': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/textarea');
    registerPrototype('shadcn-textarea-root', mod.default);
  },
  'shadcn-input-root': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/input');
    registerPrototype('shadcn-input-root', mod.default);
  },
  'shadcn-dialog-footer': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/dialog/footer.proto');
    registerPrototype('shadcn-dialog-footer', mod.default);
  },
};

/**
 * 自动注册：扫描所有 *.demo.proto.ts
 */
const autoModuleLoaders =
  (import.meta as ImportMetaWithGlob).glob?.('../../content/**/*.demo.proto.ts') ?? {};
const autoPrototypeModules: Record<string, PrototypeModuleLoader> = {};

for (const [path, loader] of Object.entries(autoModuleLoaders)) {
  const id = getPrototypeIdFromPath(path);
  if (!id) continue;
  if (manualPrototypeModules[id] || autoPrototypeModules[id]) {
    throw new Error(
      `[PrototypePreviewer] 原型 ID 冲突: "${id}"。\n` +
        `请确保 *.demo.proto.ts 文件名唯一，且不与手动注册重复。\n` +
        `冲突文件: ${path}`
    );
  }

  autoPrototypeModules[id] = async () => {
    const mod = await (loader as PrototypeModuleLoader)();
    if (!mod?.default) {
      throw new Error(
        `[PrototypePreviewer] 原型模块 "${path}" 缺少默认导出。\n` +
          `请使用 default export 导出一个 Prototype。`
      );
    }
    registerPrototype(id, mod.default);
  };
}

/**
 * 原型模块注册表（自动 + 手动）
 * key: prototypeId
 * value: 动态导入函数
 */
export const prototypeModules: Record<string, PrototypeModuleLoader> = {
  ...autoPrototypeModules,
  ...manualPrototypeModules,
};

/**
 * 动态加载并注册原型
 * @param prototypeId 原型 ID
 * @returns 加载成功返回 true，失败抛出错误
 */
export async function loadPrototype(prototypeId: string): Promise<boolean> {
  const loader = prototypeModules[prototypeId];

  if (!loader) {
    throw new Error(
      `[PrototypePreviewer] 未找到原型 "${prototypeId}" 的加载器。\n` +
        `可用的原型: ${Object.keys(prototypeModules).join(', ')}\n` +
        `请创建对应的 *.demo.proto.ts 文件，或在 prototype-modules.ts 中手动注册。`
    );
  }

  try {
    // 动态导入模块（模块内部可能会自动调用 registerPrototype）
    const mod = await loader();
    // 若模块提供 default export，则作为 Prototype 自动注册
    if (mod?.default) {
      registerPrototype(prototypeId, mod.default);
    }
    return true;
  } catch (err) {
    throw new Error(
      `[PrototypePreviewer] 加载原型模块 "${prototypeId}" 失败: ${(err as any)?.message || err}`
    );
  }
}

/**
 * 批量加载原型
 * @param prototypeIds 原型 ID 列表
 */
export async function loadPrototypes(prototypeIds: string[]): Promise<void> {
  await Promise.all(prototypeIds.map((id) => loadPrototype(id)));
}

/**
 * 获取所有可用的原型 ID
 */
export function getAvailablePrototypes(): string[] {
  return Object.keys(prototypeModules);
}
