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
  'shadcn-button': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/button/index');
    registerPrototype('shadcn-button', mod.default);
  },
  'shadcn-toggle': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/toggle/index');
    registerPrototype('shadcn-toggle', mod.default);
  },
  'shadcn-switch-root': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/switch/root');
    registerPrototype('shadcn-switch-root', mod.default);
  },
  'shadcn-switch-thumb': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/switch/thumb');
    registerPrototype('shadcn-switch-thumb', mod.default);
  },
  'shadcn-tabs-root': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/tabs/root');
    registerPrototype('shadcn-tabs-root', mod.default);
  },
  'shadcn-tabs-list': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/tabs/list');
    registerPrototype('shadcn-tabs-list', mod.default);
  },
  'shadcn-tabs-trigger': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/tabs/trigger');
    registerPrototype('shadcn-tabs-trigger', mod.default);
  },
  'shadcn-tabs-content': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/tabs/content');
    registerPrototype('shadcn-tabs-content', mod.default);
  },
  'base-hover-card-root': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/hover-card/root');
    registerPrototype('base-hover-card-root', mod.default);
  },
  'base-hover-card-trigger': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/hover-card/trigger');
    registerPrototype('base-hover-card-trigger', mod.default);
  },
  'base-hover-card-content': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/hover-card/content');
    registerPrototype('base-hover-card-content', mod.default);
  },
  'base-radio-group-root': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/radio/root');
    registerPrototype('base-radio-group-root', mod.default);
  },
  'base-radio-item': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/radio/item');
    registerPrototype('base-radio-item', mod.default);
  },
  'base-transition': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/transition/transition');
    registerPrototype('base-transition', mod.default);
  },
  'base-select-root': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/select/root');
    registerPrototype('base-select-root', mod.default);
  },
  'base-select-trigger': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/select/trigger');
    registerPrototype('base-select-trigger', mod.default);
  },
  'base-select-value': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/select/value');
    registerPrototype('base-select-value', mod.default);
  },
  'base-select-content': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/select/content');
    registerPrototype('base-select-content', mod.default);
  },
  'base-select-item': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/select/item');
    registerPrototype('base-select-item', mod.default);
  },
  'shadcn-hover-card-root': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/hover-card/root');
    registerPrototype('shadcn-hover-card-root', mod.default);
  },
  'shadcn-hover-card-trigger': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/hover-card/trigger');
    registerPrototype('shadcn-hover-card-trigger', mod.default);
  },
  'shadcn-hover-card-content': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/hover-card/content');
    registerPrototype('shadcn-hover-card-content', mod.default);
  },
  'shadcn-dropdown-root': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/dropdown/root');
    registerPrototype('shadcn-dropdown-root', mod.default);
  },
  'shadcn-dropdown-trigger': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/dropdown/trigger');
    registerPrototype('shadcn-dropdown-trigger', mod.default);
  },
  'shadcn-dropdown-content': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/dropdown/content');
    registerPrototype('shadcn-dropdown-content', mod.default);
  },
  'shadcn-dropdown-item': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/dropdown/item');
    registerPrototype('shadcn-dropdown-item', mod.default);
  },
  'base-dialog-root': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/dialog/root');
    registerPrototype('base-dialog-root', mod.default);
  },
  'base-dialog-trigger': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/dialog/trigger');
    registerPrototype('base-dialog-trigger', mod.default);
  },
  'base-dialog-mask': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/dialog/overlay');
    registerPrototype('base-dialog-mask', mod.default);
  },
  'base-dialog-content': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/dialog/content');
    registerPrototype('base-dialog-content', mod.default);
  },
  'base-dialog-title': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/dialog/title');
    registerPrototype('base-dialog-title', mod.default);
  },
  'base-dialog-description': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/dialog/description');
    registerPrototype('base-dialog-description', mod.default);
  },
  'base-dialog-close': async () => {
    const mod = await import('../../../../../packages/prototypes/base/src/dialog/close');
    registerPrototype('base-dialog-close', mod.default);
  },
  'shadcn-dialog-root': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/dialog/root');
    registerPrototype('shadcn-dialog-root', mod.default);
  },
  'shadcn-dialog-trigger': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/dialog/trigger');
    registerPrototype('shadcn-dialog-trigger', mod.default);
  },
  'shadcn-dialog-mask': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/dialog/overlay');
    registerPrototype('shadcn-dialog-mask', mod.default);
  },
  'shadcn-dialog-content': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/dialog/content');
    registerPrototype('shadcn-dialog-content', mod.default);
  },
  'shadcn-dialog-title': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/dialog/title');
    registerPrototype('shadcn-dialog-title', mod.default);
  },
  'shadcn-dialog-description': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/dialog/description');
    registerPrototype('shadcn-dialog-description', mod.default);
  },
  'shadcn-dialog-close': async () => {
    const mod = await import('../../../../../packages/prototypes/shadcn/src/dialog/close');
    registerPrototype('shadcn-dialog-close', mod.default);
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
