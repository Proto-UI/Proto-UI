---
title: '你的第一个适配器'
description: '一份分步指南，带你完成第一个 Proto UI 适配器的编写。'
---

这份指南会带你走完一个最小 Proto UI 适配器的创建过程——适配器是让原型在特定宿主框架中运行的桥梁。如果你从未写过 Proto UI 适配器，从这里开始。

## 开始之前

你应该能熟练使用 TypeScript 和你目标宿主框架（React、Vue、Web Components 等）。不需要理解 Proto UI 的全部架构——这份指南只覆盖最小必要知识。

适配器的核心工作是回答三个问题：

- 原型如何在这个宿主中**挂载**？
- **props** 如何从宿主流向原型？
- **事件**如何从原型流向宿主？

开始编码前，先阅读[适配器提案模板](https://github.com/Proto-UI/Proto-UI/issues/new?template=adapter-proposal.md)并创建 issue。适配器涉及大量原型，提前沟通能大幅节省时间。

## 文件结构

Proto UI 适配器放在 `packages/adapters/<host>/` 下。最小适配器需要：

```
packages/adapters/<host>/
  src/
    adapt.ts          # 核心映射逻辑
    types.ts          # 宿主特定类型
    index.ts          # 重导出
    runtime/
      session.ts      # 运行时会话接线
      effects-port.ts # effects 桥接
```

最简单的完整参考是 [`packages/adapters/react/`](https://github.com/Proto-UI/Proto-UI/tree/main/packages/adapters/react) ——继续之前先读一遍。

## 第 1 步：认领 issue

在 [issue tracker](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3Aadapter) 中找到标记为 `adapter` 的 issue。在开始之前评论认领。如果没有合适的 issue，使用[适配器提案模板](https://github.com/Proto-UI/Proto-UI/issues/new?template=adapter-proposal.md)新建一个。

## 第 2 步：创建包

创建 `packages/adapters/<host>/` 并添加 `package.json`：

```json
{
  "name": "@proto.ui/<host>-adapter",
  "private": true,
  "main": "./src/index.ts",
  "dependencies": {
    "@proto.ui/core": "workspace:*",
    "@proto.ui/runtime": "workspace:*"
  }
}
```

## 第 3 步：接线宿主输入

创建 `src/adapt.ts`。适配器宿主需要每个宿主提供三样东西：

```ts
import type { Prototype, PropsBaseType } from '@proto.ui/core';
import {
  createAdapterHost,
  type AdapterHostInput,
  type AdapterHostHooks,
} from '@proto.ui/adapters-base';

function adaptPrototype<P extends PropsBaseType>(
  proto: Prototype<P>,
  hostInput: AdapterHostInput<P>,
  hooks?: AdapterHostHooks<P>
) {
  return createAdapterHost(proto, hostInput, hooks);
}
```

| 输入          | 用途                                   |
| ------------- | -------------------------------------- |
| `commit`      | 将原型输出应用到宿主 DOM / VDOM        |
| `schedule`    | 调度宿主端更新（如 microtask / frame） |
| `getRawProps` | 从宿主层读取原始 props                 |

## 第 4 步：实现 commit

`commit` 接收原型输出并转换为宿主原生更新：

```ts
const hostInput: AdapterHostInput<MyProps> = {
  commit(dom, ops) {
    for (const op of ops) {
      if (op.kind === 'attribute') {
        dom.setAttribute(op.name, String(op.value));
      } else if (op.kind === 'property') {
        (dom as any)[op.name] = op.value;
      } else if (op.kind === 'event') {
        dom.addEventListener(op.name, op.handler);
      }
    }
  },
  schedule(fn) {
    queueMicrotask(fn);
  },
  getRawProps() {
    return rawProps;
  },
};
```

完整的 `AdapterHostInput` 合约见 [adapter-host.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/adapters/base/src/host/adapter-host.ts)。

## 第 5 步：接线宿主生命周期

用 `AdapterHostHooks` 连接挂载/卸载：

```ts
const hooks: AdapterHostHooks<MyProps> = {
  onRuntimeReady(runtime) {
    // 原型运行时已就绪——接线事件，启动交互
  },
  onUnmountBegin(runtime) {
    // 卸载前的清理
  },
  afterUnmount() {
    // 宿主层级的销毁
  },
};
```

## 第 6 步：注册适配器

将适配器添加到 `packages/adapters/<host>/src/index.ts`：

```ts
export { adaptPrototype } from './adapt';
export type { HostSpecificTypes } from './types';
```

## 第 7 步：用合约测试

创建 `packages/adapters/<host>/test/` 并编写合约驱动的测试。适配器通过把已有原型测试跑在新宿主上来验证：

```ts
import { adaptPrototype } from '../src/adapt';
import button from '@proto.ui/base/button';

test('button renders via host', () => {
  const session = adaptPrototype(button, mockHostInput);
  expect(session.controller).toBeDefined();
  session.dispose();
});
```

至少测试：Button（最简单的原型）、一个复合原型、以及事件路由。

## 第 8 步：接入文档站

适配器通过文档站 demo 系统被消费。在文档站适配器注册表中注册你的适配器，使原型能通过你的宿主预览。

## 提交 PR 之前

- [ ] 所有已有原型测试在新适配器下通过
- [ ] 至少 3 个原型正确渲染（Button + 2 个以上）
- [ ] 事件路由双向正常（host → proto、proto → host）
- [ ] 无泄漏（mount → unmount → remount 正常）
- [ ] PR 描述链接了提案 issue 并说明了能力映射

## 常见错误

1. **过度抽象宿主层** ——把原型映射到宿主即可，不要造第二个框架。适配器应保持薄。
2. **隐藏能力缺口** ——如果宿主无法支持某个合约，显式记录缺口，不要静默跳过。
3. **忘记 teardown** ——卸载时务必调用 `session.dispose()`。泄漏的 session 会导致难以排查的问题。
4. **把宿主关注点混入原型** ——适配器做翻译，原型做定义。绝对不要在原型中放宿主逻辑。
5. **跳过合约测试** ——合约定义了"正确适配"的含义。没有合约测试就靠猜。

## 下一步

- [适配器指南](/zh-cn/build/adapter-guide/) ——更深入的参考（完善中）
- [合约与测试](/zh-cn/build/contracts-and-tests/) ——合约验证的工作原理
- 已有适配器：[React](https://github.com/Proto-UI/Proto-UI/tree/main/packages/adapters/react)、[Vue](https://github.com/Proto-UI/Proto-UI/tree/main/packages/adapters/vue)、[Web Component](https://github.com/Proto-UI/Proto-UI/tree/main/packages/adapters/web-component)
