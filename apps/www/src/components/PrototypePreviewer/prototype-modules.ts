// src/components/PrototypePreviewer/prototype-modules.ts
// 原型模块映射表 - 按需动态导入

import { registerPrototype } from './registry';

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
  'base-button': async () => {
    const mod = await import('@proto.ui/prototypes-base');
    registerPrototype('base-button', mod.button);
  },
  'base-toggle': async () => {
    const mod = await import('@proto.ui/prototypes-base/toggle');
    registerPrototype('base-toggle', mod.toggle);
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
  'shadcn-toggle': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/toggle/index');
    registerPrototype('shadcn-toggle', mod.default);
  },
  'lucide-icon': async () => {
    const mod = await import('../../../../../packages/prototypes/lucide/src/icon/index');
    registerPrototype('lucide-icon', mod.default);
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
  'shadcn-textarea-root': async () => {
    const mod = await import('@proto.ui/prototypes-shadcn/textarea');
    registerPrototype('shadcn-textarea-root', mod.default);
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
