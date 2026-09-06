# PrototypePreviewer 架构文档

## 📐 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                         MDX 页面层                           │
│  <PrototypePreviewer prototypeId="demo" />                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  PrototypePreviewer.astro                   │
│  - 渲染 UI 容器                                              │
│  - 传递 data-* 属性到 DOM                                    │
│  - 包含客户端初始化脚本                                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    previewer-client.ts                      │
│  - initPreviewer() 初始化预览器                              │
│  - ensurePrototypeLoaded() 确保原型已加载                    │
│  - switchTo() 切换运行时                                     │
└──────────┬──────────────────────┬───────────────────────────┘
           │                      │
           ▼                      ▼
┌─────────────────────┐  ┌─────────────────────────────────┐
│ prototype-modules.ts│  │      registry.ts                │
│                     │  │                                 │
│ - prototypeModules  │  │ - registerPrototype()           │
│ - loadPrototype()   │  │ - getPrototype()                │
│ - loadPrototypes()  │  │ - listPrototypes()              │
└──────────┬──────────┘  └─────────────────────────────────┘
           │                      ▲
           │                      │
           │                      │ 注册
           │                      │
           ▼                      │
┌─────────────────────────────────┴───────────────────────────┐
│                    原型定义文件                              │
│  demo-inline.demo.proto.ts, button-demo.demo.proto.ts, etc. │
│  - definePrototype() 定义原型                               │
│  - default export Prototype                                │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 加载流程详解

### 阶段 1: SSR 渲染

```
Astro SSR
  └─> PrototypePreviewer.astro
        └─> 渲染 HTML 容器 + data-* 属性
              └─> <script> 标签会被打包到客户端 bundle
```

**关键点**: 此时不会执行任何原型加载，registry 是空的（SSR 环境）

---

### 阶段 2: 客户端 Hydration

```
浏览器加载页面
  └─> 执行 <script> 中的 init()
        └─> 查找所有 .proto-previewer
              └─> 调用 initPreviewer(options)
```

---

### 阶段 3: 原型加载

```
initPreviewer()
  └─> switchTo(initialRuntime)
        └─> ensurePrototypeLoaded()
              └─> loadPrototype(prototypeId)
                    └─> prototype-modules.ts（自动扫描 *.demo.proto.ts）
                          └─> 动态 import('./demo-inline.demo.proto.ts')
                                └─> default export 注册
```

---

### 阶段 4: 运行时挂载

```
ensurePrototypeLoaded() 完成
  └─> getPrototype(prototypeId) 从 registry 获取
        └─> runtimeLoaders[runtime]() 加载运行时适配器
              └─> api.mount(host, proto, options)
                    └─> 原型被渲染到 DOM 🎉
```

## 📁 文件职责

### 核心文件

| 文件                       | 职责                     | 关键 API                                |
| -------------------------- | ------------------------ | --------------------------------------- |
| `PrototypePreviewer.astro` | UI 容器和初始化脚本      | Props 定义                              |
| `previewer-client.ts`      | 客户端逻辑协调器         | `initPreviewer()`, `switchTo()`         |
| `registry.ts`              | 原型注册表（运行时）     | `registerPrototype()`, `getPrototype()` |
| `prototype-modules.ts`     | 原型模块映射表（构建时） | `prototypeModules`, `loadPrototype()`   |

### 辅助文件

| 文件                        | 职责                             |
| --------------------------- | -------------------------------- |
| `runtimes/ids.ts`           | 静态运行时标识；不引入适配器代码 |
| `runtimes/registry.ts`      | 仅供预览器使用的懒加载运行时注册 |
| `runtimes/wc-runtime.ts`    | Web Components 适配器            |
| `runtimes/react-runtime.ts` | React 适配器                     |
| `runtimes/vue-runtime.ts`   | Vue 适配器                       |

### 文档文件

| 文件              | 内容         |
| ----------------- | ------------ |
| `README.md`       | 完整使用指南 |
| `QUICK_START.md`  | 快速参考     |
| `MIGRATION.md`    | 迁移指南     |
| `ARCHITECTURE.md` | 本文档       |

## 🎯 设计原则

### 1. 按需加载优先

- 每个原型是独立的模块
- Vite 自动进行代码分割
- 只加载用户访问的页面所需的原型

### 2. SSR 友好

- 注册表在 SSR 环境静默跳过
- 原型定义可以安全地在服务端执行
- 客户端重新加载并注册原型

### 3. 类型安全

- TypeScript 全覆盖
- 运行时类型检查
- 编译时错误检测

### 4. 扩展性

- `*.demo.proto.ts` 自动发现与按需加载
- 支持自定义加载逻辑（手动注册）
- 运行时适配器可插拔

## 🔌 扩展点

### 1. 添加新运行时

```typescript
// runtimes/svelte-runtime.ts
export async function loadSvelteRuntime() {
  return {
    async mount(host, proto, options) {
      // Svelte 挂载逻辑
    },
    async unmount(host) {
      // Svelte 卸载逻辑
    },
  };
}

// runtimes/registry.ts
export const runtimeLoaders = {
  wc: loadWcRuntime,
  react: loadReactRuntime,
  vue: loadVueRuntime,
  svelte: loadSvelteRuntime, // 新增
};
```

### 2. 自定义加载逻辑

```typescript
// prototype-modules.ts
const manualPrototypeModules = {
  'advanced-demo': async () => {
    // 加载额外依赖
    const [protoModule, dataModule] = await Promise.all([
      import('./advanced-demo'),
      import('./demo-data.json'),
    ]);

    // 自定义初始化
    protoModule.initialize(dataModule);

    return protoModule;
  },
};
```

### 3. 条件加载

```typescript
// prototype-modules.ts
const manualPrototypeModules = {
  'conditional-demo': async () => {
    if (process.env.NODE_ENV === 'development') {
      return import('./demo-dev');
    } else {
      return import('./demo-prod');
    }
  },
};
```

## 🛡️ 错误处理

### 错误传播链

```
loadPrototype() 失败
  └─> ensurePrototypeLoaded() 捕获
        └─> switchTo() 捕获
              └─> 显示错误 UI
                    └─> 派发 'error' 事件
```

### 错误类型

| 错误 | 原因 | 解决方案 |
| --- | --- | --- |
| "未找到原型" | 没有对应的 `*.demo.proto.ts` 文件或未手动注册 | 检查文件命名或手动注册 |
| "无法加载原型模块" | 模块路径错误或文件不存在 | 检查导入路径 |
| "registerPrototype: invalid id" | `prototypeId` 为空或非字符串 | 传递有效 ID |
| "尝试在 SSR 环境获取原型" | 在服务端调用 `getPrototype()` | 确保只在客户端调用 |

## 📊 性能优化

### 1. 代码分割

```
页面 A: demo1.chunk.js (10KB)
页面 B: demo2.chunk.js (15KB)
页面 C: demo3.chunk.js (12KB)
```

### 2. 并行加载

```javascript
// 多个原型并行加载
await Promise.all([loadPrototype('demo1'), loadPrototype('demo2'), loadPrototype('demo3')]);
```

### 3. 缓存机制

- 模块加载：浏览器自动缓存（HTTP 缓存）
- 注册状态：内存缓存（Map）
- loaderPromise：防止重复加载

### 4. Bundle 分析

**之前（全量加载）：**

```
main.js: 200KB (包含所有原型)
```

**现在（按需加载）：**

```
main.js: 20KB (框架代码)
demo-inline.chunk.js: 10KB (按需)
button-demo.chunk.js: 15KB (按需)
form-demo.chunk.js: 18KB (按需)
```

## 🔍 调试技巧

### 开启详细日志

```typescript
// previewer-client.ts
const DEBUG = true;

if (DEBUG) {
  console.log('[PrototypePreviewer] 初始化', options);
  console.log('[PrototypePreviewer] 加载原型', prototypeId);
  console.log('[PrototypePreviewer] 切换运行时', runtime);
}
```

### 查看加载状态

```javascript
// 浏览器控制台
import { listPrototypes } from './registry';
import { getAvailablePrototypes } from './prototype-modules';

console.log('已注册:', listPrototypes());
console.log('可用:', getAvailablePrototypes());
```

### 性能监控

```javascript
// 使用 Performance API
performance.mark('prototype-load-start');
await loadPrototype('demo-inline');
performance.mark('prototype-load-end');
performance.measure('prototype-load', 'prototype-load-start', 'prototype-load-end');
```

## 🚀 未来规划

- [ ] 支持原型热重载（HMR）
- [ ] 添加原型预加载提示（`<link rel="prefetch">`）
- [ ] 支持原型版本管理
- [ ] 添加原型 playground 模式
- [ ] 支持原型性能分析
- [ ] 集成 Storybook 风格的交互式文档

---

## 📞 贡献与支持

遇到问题或有改进建议？

1. 查看 [README.md](./README.md)
2. 查看 [QUICK_START.md](./QUICK_START.md)
3. 提交 Issue 或 PR

**维护者**: Proto UI Team **最后更新**: 2025-10-23
