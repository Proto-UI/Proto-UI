# PrototypePreviewer 快速参考

## 添加新原型（2 步完成）

### 1. 创建原型文件

```typescript
// src/content/docs/zh-cn/my-demo.demo.proto.ts
import { definePrototype } from '@proto.ui/core';

const MyDemo = definePrototype({
  name: 'my-demo',
  setup(props) {
    return (h) => {
      return h(
        'div',
        {
          class: 'p-4 bg-muted text-foreground rounded',
        },
        'My demo'
      );
    };
  },
});

export default MyDemo;
```

### 2. 在 MDX 中使用

```mdx
---
title: 我的页面
---

import { PrototypePreviewer } from '../../../components/PrototypePreviewer';
// 或使用 DemoPreviewer（PrototypePreviewer 的别名）

<PrototypePreviewer prototypeId="my-demo" initialRuntime="wc" />
```

完成。

---

## 常用配置

### 基础用法

```mdx
<PrototypePreviewer prototypeId="demo-inline" />
```

### 组合多个原型（demo）

```typescript
// src/content/docs/zh-cn/my-combo.demo.ts
export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'p-4 border rounded',
    children: [{ kind: 'proto', prototypeId: 'demo-inline' }],
  },
};
```

```mdx
<PrototypePreviewer demoId="my-combo" />
{/* 或 <DemoPreviewer demoId="my-combo" /> */}
```

`text` 节点可用于纯文本内容（或直接写字符串）：

```typescript
export default {
  type: 'demo',
  root: {
    kind: 'box',
    children: [{ kind: 'text', text: 'Hello' }, 'World'],
  },
};
```

### 指定初始运行时

```mdx
<PrototypePreviewer prototypeId="demo-inline" initialRuntime="react" />
```

### 限制可用运行时

```mdx
<PrototypePreviewer prototypeId="demo-inline" runtimes={['wc', 'react']} />
```

### 传递 Props

```mdx
<PrototypePreviewer
  prototypeId="demo-inline"
  props={{
    title: 'Hello',
    count: 42,
    enabled: true,
  }}
/>
```

### 隐藏工具栏

```mdx
<PrototypePreviewer prototypeId="demo-inline" toolbar={false} />
```

### 自定义样式

```mdx
<PrototypePreviewer prototypeId="demo-inline" class="my-custom-preview" />
```

---

## 调试命令

### 查看所有可用原型

```javascript
import { getAvailablePrototypes } from '../components/PrototypePreviewer/prototype-modules';
console.log(getAvailablePrototypes());
```

### 查看已注册的原型

```javascript
import { listPrototypes } from '../components/PrototypePreviewer/registry';
console.log(listPrototypes());
```

### 手动加载原型

```javascript
import { loadPrototype } from '../components/PrototypePreviewer/prototype-modules';
await loadPrototype('demo-inline');
```

---

## 性能技巧

### 预加载多个原型

```astro
<script>
  import { loadPrototypes } from '../components/PrototypePreviewer/prototype-modules';
  loadPrototypes(['demo1', 'demo2', 'demo3']);
</script>
```

### 延迟加载

```mdx
{/* 原型默认就是延迟加载的，无需额外配置 */}

<PrototypePreviewer prototypeId="heavy-demo" />
```

---

## 常见错误

### 错误: "未找到原型"

```
Error: [PrototypePreviewer] 未找到原型 "my-demo"
```

**解决**: 确认存在 `*.demo.proto.ts` 文件且文件名与 `prototypeId` 一致

---

### 错误: "无法加载原型模块"

```
Error: 加载原型模块 "my-demo" 失败
```

**解决**: 检查导入路径是否正确

---

### 错误: "registerPrototype: invalid id"

```
Error: registerPrototype: invalid id
```

**解决**: 确保 `prototypeId` 是有效的非空字符串

---

## 完整文档

- [完整使用指南](./README.md)
- [迁移指南](./MIGRATION.md)
- [API 文档](./PrototypePreviewer.astro)

---

## 官网 Demo 的消费拟真要求

新增公开 Prototype identity 或 anatomy family 时，必须在同一 PR 中提供接入官网文档入口的可访问页面，并在 PR 中填写本地预览路由。Demo 应消费真实 public package export，尽量复现开发者安装 package 后的直接使用方式。

- 自治 Prototype 应使用自己的 anatomy、trigger、state、event 和 default behavior；
- Dialog 应通过 Dialog Trigger 打开，不要让无关 Button callback 调用 Dialog expose；
- 不要用页面私有 CSS、脚本或额外 owner 掩盖 Prototype 或 Adapter 问题；
- 只有没有自然 trigger，或公开 controls 本身就是演示对象时，才使用最小外部 orchestration，例如 Toast-style invocation 或直接驱动 Transition；
- 例外逻辑必须位于 Prototype 之外、只调用 public API，并在 Demo source 与 PR 中说明它不会随 package 安装、消费者需要自行实现什么；
- 内部 Demo Matrix 只能补充验证，不能替代官网页面。

## 最佳实践速查

**DO**

- 使用 kebab-case 命名原型 ID
- 使用 `*.demo.proto.ts` 后缀，靠近文档就近维护
- 让系统自动按需加载
- 为原型添加有意义的注释
- 优先让 Demo 依靠 Prototype 自身公开交互完成演示

**DON'T**

- 不要在 MDX 中直接 import 原型文件
- 不要使用 camelCase 或 PascalCase 作为原型 ID
- 不要在原型定义中包含副作用
- 不要使用非 `*.demo.proto.ts` 后缀的文件当作 demo 原型

---

## 快速模板

复制粘贴这个模板快速开始：

```typescript
// your-demo.demo.proto.ts
import { definePrototype } from '@proto.ui/core';

const YourDemo = definePrototype({
  name: 'your-demo',
  setup(props) {
    return (h) => {
      // 你的渲染逻辑
      return h('div', {}, 'Content');
    };
  },
});

export default YourDemo;
```

```mdx
<!-- your-page.mdx -->

import { PrototypePreviewer } from '../../../components/PrototypePreviewer';

<PrototypePreviewer prototypeId="your-demo" />
```

现在可以开始创建了。
