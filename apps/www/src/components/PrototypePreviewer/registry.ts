// src/core/preview/registry.ts
import type { Prototype } from '@proto.ui/core';

// 检测是否在浏览器环境
const isBrowser = typeof window !== 'undefined';

// 只在浏览器环境创建真实的 Map，SSR 时使用占位
const map = isBrowser ? new Map<string, Prototype<any, any>>() : null;

export function registerPrototype(id: string, proto: Prototype<any, any>) {
  if (!id || typeof id !== 'string') {
    throw new Error('registerPrototype: invalid id');
  }

  // SSR 环境下静默跳过
  if (!isBrowser || !map) {
    return;
  }

  map.set(id, proto);
}

export function findRegisteredPrototype(id: string): Prototype<any, any> | undefined {
  return map?.get(id);
}

export function getPrototype(id: string): Prototype<any, any> {
  // SSR 环境下的友好提示
  if (!isBrowser || !map) {
    throw new Error(
      `[PrototypePreviewer] 尝试在 SSR 环境获取原型 "${id}"。` + `原型注册表仅在客户端可用。`
    );
  }

  const p = findRegisteredPrototype(id);
  if (!p) {
    // 提供更详细的错误信息
    const available = Array.from(map.keys());
    throw new Error(
      `[PrototypePreviewer] 未找到原型 "${id}"。\n` +
        `已注册的原型: ${available.length > 0 ? available.join(', ') : '(无)'}\n` +
        `提示: 请确保在客户端调用 registerPrototype() 之后再使用。`
    );
  }
  return p;
}

// 调试辅助函数
export function listPrototypes(): string[] {
  if (!isBrowser || !map) return [];
  return Array.from(map.keys());
}
