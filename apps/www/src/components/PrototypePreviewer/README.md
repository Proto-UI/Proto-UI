# PrototypePreviewer 使用指南

## 🎯 解决的问题

PrototypePreviewer 是一个用于在文档中展示原型组件的预览器，支持多运行时（Web Components、React、Vue）切换。

**核心特性：**

- ✅ **按需加载**：只加载当前页面需要的原型，支持代码分割
- ✅ **SSR 友好**：完美兼容 Astro 的 SSR 渲染
- ✅ **自动管理**：无需手动导入，声明式使用

## 🚀 快速开始（推荐方式）

### 1. 创建原型定义文件

在你的内容目录下创建原型定义，例如 `demo-inline.demo.proto.ts`：

```typescript
import { definePrototype } from '@proto.ui/core';

const DemoInline = definePrototype({
  name: 'demo-inline',
  setup(p) {
    return (h) => {
      const r = (h as any).createElement ? (h as any).createElement : h;
      return r('div', { class: 'text-red-500' }, 'Hello World');
    };
  },
});

export default DemoInline;
```

### 2. 在 MDX 中使用

```mdx
---
title: 你的页面
---

import { PrototypePreviewer } from '../../../components/PrototypePreviewer';
// 或使用 DemoPreviewer（PrototypePreviewer 的别名）

{/* 原型会自动按需加载！ */}

<PrototypePreviewer prototypeId="demo-inline" initialRuntime="wc" runtimes={['wc', 'react']} />
```

就这么简单！🎉 原型模块会在需要时自动加载。

## 🧩 Demo 组合（多原型）

当一个 demo 需要多个原型组合时，可以使用 `*.demo.ts`：

```typescript
// src/content/docs/zh-cn/my-combo.demo.ts
export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'p-4 border rounded',
    children: [
      {
        kind: 'proto',
        prototypeId: 'demo-inline',
        className: 'mb-2',
        props: { title: 'A' },
      },
      {
        kind: 'proto',
        prototypeId: 'another-demo',
        className: 'mt-2',
      },
    ],
  },
};
```

在 MDX 中使用：

```mdx
<PrototypePreviewer demoId="my-combo" />
{/* 或 <DemoPreviewer demoId="my-combo" /> */}
```

**规则：**

- `demoId` 对应 `*.demo.ts` 文件名
- `box` 节点只接受 `className`
- `proto` 节点可带 `props` 和 `children`
- `children` 只有在原型模板包含 `slot` 时才会显示
- `text` 节点用于纯文本内容（或直接写字符串作为 child）

### 手动注册（可选）

`PrototypePreviewer` 不接受逐实例 `loader` prop。若原型不在 `*.demo.proto.ts` 自动扫描范围内，或需要额外加载步骤，应在 [`prototype-modules.ts`](./prototype-modules.ts) 的 `manualPrototypeModules` 中注册，并用对应的 `prototypeId` 调用预览器。现有 `base-button` 映射展示了实际模式：从 `@proto.ui/prototypes-base` 进行显式动态导入，再注册该 ID。

## 🔧 技术细节

### 按需加载架构

```
MDX 页面
  └─> <PrototypePreviewer prototypeId="demo-inline" />
        └─> previewer-client.ts
              └─> loadPrototype("demo-inline")
                    └─> prototype-modules.ts（自动扫描 *.demo.proto.ts）
                          └─> 动态 import('.../demo-inline.demo.proto.ts')
                                └─> default export 注册
                                      └─> getPrototype() 获取原型 ✅
```

**关键优势：**

- 📦 **代码分割**：每个原型都是独立的 chunk，按需加载
- 🚀 **首屏优化**：页面初始 bundle 不包含未使用的原型
- 🔄 **并行加载**：多个原型可以并行加载
- 🎯 **就近维护**：原型文件可放在文档附近，无需集中注册

### Registry 环境感知

`registry.ts` 会自动检测运行环境：

- **SSR 环境**：`registerPrototype()` 静默跳过，不会报错
- **客户端环境**：正常注册到 Map 中
- 提供友好的中文错误提示和调试信息

### 加载流程

1. `PrototypePreviewer` 初始化
2. `ensurePrototypeLoaded()` 检查是否需要加载
3. `loadPrototype(id)` 查找并执行动态导入
4. 原型模块默认导出 `Prototype`，由加载器自动注册
5. `getPrototype(id)` 获取已注册的原型
6. 挂载到对应的运行时

## 🐛 调试工具

在浏览器控制台中：

```javascript
import { listPrototypes } from './registry';

// 查看已注册的原型
console.log('已注册原型:', listPrototypes());
```

## ⚠️ 常见问题

### Q: 为什么不能直接在 MDX 中 import 原型？

A: Astro 会在 SSR 阶段执行顶层 import，此时注册到的是服务端的 Map 实例。客户端会创建新的 Map 实例，导致找不到原型。因此我们使用动态加载机制。

### Q: 如何添加新原型？

A:

1. 创建原型定义文件（如 `my-demo.demo.proto.ts`）
2. 在 MDX 中使用：`<PrototypePreviewer prototypeId="my-demo" />`

### Q: 原型会重复加载吗？

A: 不会。每个原型模块只会加载一次，后续使用同一原型会复用已加载的实例。

### Q: 可以预加载多个原型吗？

A: 可以使用 `loadPrototypes(['id1', 'id2'])` 批量预加载。

### Q: 如何调试加载问题？

A:

```javascript
import { getAvailablePrototypes } from './prototype-modules';
console.log('可用原型:', getAvailablePrototypes());
```

## 📝 Props 说明

### PrototypePreviewer

| Prop             | 类型                       | 默认值            | 说明                     |
| ---------------- | -------------------------- | ----------------- | ------------------------ |
| `prototypeId`    | `string`                   | _可选_            | 原型 ID，需要提前注册    |
| `demoId`         | `string`                   | -                 | demo ID（`*.demo.ts`）   |
| `initialRuntime` | `'wc' \| 'react' \| 'vue'` | `'wc'`            | 初始运行时               |
| `props`          | `Record<string, unknown>`  | `{}`              | 传递给原型的 props       |
| `toolbar`        | `boolean`                  | `true`            | 是否显示运行时切换工具栏 |
| `runtimes`       | `RuntimeId[]`              | `['wc', 'react']` | 可用的运行时列表         |
| `class`          | `string`                   | `''`              | 自定义 CSS 类            |

> `props` 仅支持 JSON-like 数据（不允许函数、`undefined`、`symbol`、`bigint`）。 `prototypeId` 与 `demoId` 不能同时使用；demo 模式下 `props` 不生效。

## 🎨 样式定制

预览器使用 CSS 变量进行样式控制：

```css
.proto-previewer {
  --border-color: var(--sl-color-gray-5);
  --border-radius: 12px;
  --padding: 12px;
}
```

### Proto UI Style Token 同步

`PrototypePreviewer` 里的 prototype style token 来自运行时原型，并通过 `data-pui-style` 挂到宿主节点上。

官网现在通过生成流程解决这个问题：

1. `pnpm run generate:proto-ui-style` 调用 CLI 扫描 `packages/prototypes/**` 中的静态 `tw(...)` 调用
2. 同时提取可静态识别的 `rule.when(...)` 条件，并为 web 变体生成对应 token（例如 `hover:*`、`focus-visible:*`、`dark:*`、`aria-invalid:*`）
3. 输出到 `src/styles/proto-ui-tokens.generated.css`
4. `src/styles/proto-ui-style.css` 导入主题变量与 generated token CSS，官网入口再导入这份 Proto UI 样式

因此：

- 不要再手写 prototype safelist
- 新增 prototypes 样式时，优先保持 `tw(...)` 参数是静态可解析的字符串或静态映射
- `pnpm --filter apps-www dev/build` 会自动在前置脚本里刷新 generated Proto UI style

## 🚀 最佳实践

1. **就近维护**：使用 `*.demo.proto.ts` 后缀，原型文件放在文档附近
2. **命名规范**：原型 ID 使用 kebab-case，如 `demo-inline`
3. **按功能分组**：可以按章节/功能组织原型文件
4. **懒加载优先**：让系统自动按需加载，避免手动管理
5. **错误处理**：预览器会自动显示错误信息，便于调试

**文件组织示例：**

```
content/docs/zh-cn/
├── components/
│   ├── button-demo.demo.proto.ts
│   └── input-demo.demo.proto.ts
├── examples/
│   ├── form-demo.demo.proto.ts
│   └── dashboard-demo.demo.proto.ts
└── getting-started/
    └── hello-world.demo.proto.ts
```

## 📊 性能对比

| 方案               | Bundle 大小 | 首屏加载 | 扩展性 |
| ------------------ | ----------- | -------- | ------ |
| 全量导入           | ❌ 大       | ❌ 慢    | ❌ 差  |
| 按需加载（新方案） | ✅ 小       | ✅ 快    | ✅ 优  |

## 🔄 更新日志

- **v3.0**: 🎉 按需动态加载，支持代码分割和并行加载
- **v2.0**: 添加环境感知和自动重试机制
- **v1.0**: 初始版本，支持基本的原型预览功能

---

## 🔧 高级用法

### 预加载多个原型

如果你知道页面会用到多个原型，可以提前批量加载：

```astro
---
// 在 Astro 组件的 script 标签中
---

<script>
  import { loadPrototypes } from './prototype-modules';

  // 页面加载时预加载
  loadPrototypes(['demo1', 'demo2', 'demo3']);
</script>
```

### 条件加载

```typescript
// 根据用户偏好动态加载不同原型
const prototypeId = userPrefersDarkMode ? 'dark-theme-demo' : 'light-theme-demo';
```

```mdx
<PrototypePreviewer prototypeId={prototypeId} />
```

### 在注册表中自定义加载逻辑

自定义加载步骤属于 [`prototype-modules.ts`](./prototype-modules.ts) 中某个 `prototypeId` 映射；它不会恢复已移除的逐实例 `loader` prop。可在注册表 loader 中执行额外工作，并返回默认导出原型或自行注册原型：

```typescript
// prototype-modules.ts
const manualPrototypeModules = {
  'advanced-demo': async () => {
    // 可以添加额外的逻辑
    const [module, config] = await Promise.all([
      import('./advanced-demo'),
      fetch('/api/demo-config').then((r) => r.json()),
    ]);

    // 动态配置
    module.configure(config);
    return module;
  },
};
```
