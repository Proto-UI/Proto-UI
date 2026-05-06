---
title: '你的第一个原型'
description: '一份分步指南，带你完成第一个 Proto UI 原型的编写。'
---

这份指南会带你走完一个完整 Proto UI 原型的创建过程——从搭建到提交 PR。如果你从未写过 Proto UI 原型，从这里开始。

## 开始之前

你应该能熟练阅读 TypeScript，不需要理解 Proto UI 的全部架构——这份指南只覆盖最小必要知识。

第一次尝试时，选一个小而独立的组件。推荐：`badge`、`avatar`、`divider`、`label`。避免复合组件（dropdown、dialog、tabs），先写好单个 part 的原型之后再说。

## 一个原型的文件结构

Proto UI 原型放在 `packages/prototypes/base/src/<name>/` 下。最小原型只需要一个文件：

```
packages/prototypes/base/src/<name>/
  <name>.ts       # setup + definePrototype + asHook
  types.ts        # （可选）props / exposes 类型
  index.ts        # 重导出
```

仓库中最简单的参考是 [`button.ts`](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/button/button.ts) ——继续之前先读一遍。

## 第 1 步：认领 issue

在 [issue tracker](https://github.com/Proto-UI/Proto-UI/issues) 中找到标记为 `prototype` 的 issue。在开始之前评论认领。如果没有合适的 issue，新建一个描述你计划做什么。

## 第 2 步：创建源文件

创建 `packages/prototypes/base/src/<name>/<name>.ts`。从以下骨架开始：

```ts
import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';

interface MyPrototypeProps {
  disabled?: boolean;
}

type MyPrototypeExposes = {
  disabled: import('@proto.ui/core').ExposeState<boolean>;
};

function setupMyPrototype(def: DefHandle<MyPrototypeProps, MyPrototypeExposes>): void {
  // 第 3–6 步写在这里
}

export const asMyPrototype = defineAsHook({
  name: 'as-my-prototype',
  mode: 'once',
  setup: setupMyPrototype,
});

const myPrototype = definePrototype({
  name: 'base-my-prototype',
  setup: setupMyPrototype,
});

export default myPrototype;
```

## 第 3 步：定义 props

使用 `def.props.define()` 声明 Maker 可以传入什么：

```ts
def.props.define({
  disabled: { type: 'boolean', empty: 'fallback' },
});
def.props.setDefaults({ disabled: false });
```

## 第 4 步：建立交互状态

使用 `def.state.fromInteraction()` 获取基础交互状态：

```ts
const hovered = def.state.fromInteraction('hovered');
const focused = def.state.fromInteraction('focused');
const pressed = def.state.fromInteraction('pressed');
def.expose.state('hovered', hovered);
def.expose.state('focused', focused);
def.expose.state('pressed', pressed);
```

或者使用 `asButton()` 获取完整的按钮交互套件（hover、focus、press、click）：

```ts
import { asButton } from '../button';
// 在 setup 内：
asButton();
```

## 第 5 步：处理事件

用 `def.event.on()` 绑定事件：

```ts
def.event.on('press.commit', (run) => {
  if (run.props.get().disabled) return;
  // 处理 press
});
```

标准事件名：`press.commit`、`pointer.enter`、`pointer.leave`、`native:focus`、`native:blur`。

## 第 6 步：暴露状态和方法

外部需要读取或调用的所有内容都必须显式暴露：

```ts
def.expose.state('disabled', disabled);
def.expose.method('focusSelf', (run) => () => {
  // focus 逻辑
});
```

## 第 7 步：注册原型

将原型添加到 `packages/prototypes/base/src/index.ts`：

```ts
export * from './<name>';
export { default as myPrototype } from './<name>';
```

## 第 8 步：编写测试

创建 `packages/prototypes/base/test/<name>.test.ts`。将原型注册为 web component 以便测试：

```ts
import { AdaptToWebComponent } from '@proto.ui/wc-adapter';
import myPrototype from '../src/<name>/<name>';

AdaptToWebComponent(myPrototype as any, { registerAs: 'wc-base-my-prototype' });
```

至少写：一个渲染测试、一个 prop 默认值测试、一个交互测试。

## 第 9 步：添加 demo

创建 `apps/www/src/content/docs/zh-cn/demo-base-<name>.demo.ts`：

```ts
export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'base-my-prototype',
    className: 'px-3 py-1.5 rounded border',
    children: ['Hello'],
  },
};
```

## 第 10 步：添加文档

创建 `apps/www/src/content/docs/en/ui-libraries/base/<name>.mdx`（以及 `zh-cn/` 对应文件）：

```mdx
---
title: 'My Prototype'
description: '...'
---

import PrototypePreviewer from '@/components/PrototypePreviewer/PrototypePreviewer.astro';

<PrototypePreviewer
  demoId="demo-base-<name>"
  initialRuntime="wc"
  runtimes={['wc', 'react', 'vue']}
  hasCode={true}
/>

关于这个原型提供了什么的描述。
```

## 提交 PR 之前

- [ ] 测试通过：运行你所在 package 的测试套件
- [ ] 类型检查通过
- [ ] Demo 在三种运行时（wc、react、vue）下均正常渲染
- [ ] 中英文文档均已提供（或明确注明跳过）
- [ ] PR 描述链接了 issue 并说明了交互边界

## 常见错误

1. **跳过 `asHook`** ——如果你的 setup 可能被复用，务必同时导出 `asHook` 和 prototype。
2. **把视觉样式放进原型** ——原型定义的是交互语义，不是 CSS。样式属于 demo 和消费方应用。
3. **第一个版本就过度设计** ——从最小的可用接口开始。`expose.method`、`context`、`lifecycle` 可以后续再加。
4. **忘记在 `index.ts` 中注册** ——不重导出的话，消费者无法 import 你的原型。

## 下一步

- [原型作者检查清单](/zh-cn/build/prototypes/checklist/) ——提交前过一遍
- [编写复合原型](/zh-cn/build/prototypes/writing-a-compound-prototype/) ——当你的组件需要多个 part
- [为什么你通常不需要新写一个原型](/zh-cn/build/prototypes/when-not-to-write-a-new-prototype/) ——在你开始写第二个之前
