---
title: '编写一个定制的单体原型'
description: '掌握单体原型与 asHook 的最小代码结构、def/run 分工以及完整交付路径。'
---

单体原型（Primitive Prototype）对应一个边界清晰、能够独立承担交互职责的协议主题，例如 `Button` 和 `Toggle`。

本文聚焦单体原型的代码结构与设计原则。对于已有 Base 主题，可以直接从现有 `P-*` / `T-*` 规范推进；对于全新主题，可以先以 `draft` 候选形态编写规范与实现探针，并按[实现受治理的 Base Semantic Slice](/zh-cn/build/prototypes/implementing-an-approved-base-slice/)完成整体交付。

## 从规范和测试切入

动手写代码前，先通过规范建立完整心智模型。以 Button 为例，推荐按以下顺序阅读：

1. `P-BASE-BUTTON` 的生命周期、核心准则（criteria）、关联关系与来源；
2. `T-BASE-BUTTON-0001` 的测试用例与可执行文件映射；
3. [packages/prototypes/base/src/button/button.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/button/button.proto.ts)；
4. `packages/prototypes/base/test/as-button.test.ts` 与对应的 Adapter 测试；
5. 包导出、CLI 注册、文档与 Demo。

`P-BASE-BUTTON` 当前处于 `draft` 阶段，以规范实体作为核心依据，源码实现用来验证和对齐规范。

## `base-button` 的典型结构

Button 为同一套交互协议提供了两个入口：

- `base-button`：直接使用的单体原型；
- `asButton`：供风格化原型复用的 `asHook`。

两者共同调用 `setupButton(def)`，确保协议行为只有一份实现（对应 `P-BASE-BUTTON-AUTHORING-ENTRIES`）。具体做法按需决定，并非每个原型都需要同时提供两个入口。

`setupButton(def)` 展示了单体原型的常见组成：

- `def.props.define()`：声明输入属性（如 `disabled`）；
- `def.state.bool()`：声明交互状态（如 `disabled`、`hovered`、`pressed`）；
- `asFocusable()`：复用焦点能力，获得 `focused`、`focusVisible` 状态与聚焦方法；
- `def.event.on()`：订阅指针事件与 `press.commit`；
- `def.expose.state()` / `def.expose.method()` / `def.expose.event()`：暴露对外接口；
- `asAccessible()`：声明无障碍角色（role）、名称、状态与动作。

## 厘清 `def` 与 `run` 的分工

在 Proto UI 中，`def` 和 `run` 分别对应**声明期**与**运行期**：

- `def` 在 `setup` 阶段声明静态结构：props、state、events、exposes、a11y、style rules 与生命周期钩子。
- `run` 在具体回调触发时传入，用来读取当前 props/context、访问运行时状态以及触发对外副作用。

```ts
def.event.on('press.commit', (run) => {
  if (disabled.get()) return;
  run.expose.emit('click');
});
```

上面的代码在 `setup` 阶段注册了 `press.commit` 路由；当事件真正发生时，再通过 `run.expose.emit('click')` 向外发出信号。

## 什么时候需要提供 `asHook`

只导出直接原型而不导出 `asHook` 是完全合理的。决定是否提供 `asHook` 时，可以检查：

- 对应的 `P-*` 实体是否将直接原型与 `asHook` 共同列为同一协议的入口；
- 两者是否共享同一份协议面与核心实现；
- 该钩子是否只服务于所属协议（而不是被当成其他 Base 协议的通用底层能力）；
- 是否会引入未经规范化的配置项（options/merge/configure）。

根据 `D-PROTOTYPE-ENTITY-NAMING-0001`，同一协议的多个入口记录在同一个 `P-*` 实体中；根据 `D-AS-HOOK-CONFIGURABLE-AUTHORED-0001`，可配置的用户侧 `asHook` 需在明确的规范边界内设计。

## 一个完整单体切片的交付面

源码只是交付的一部分，完整的单体原型通常按以下链路闭环：

```text
规范实体（已准入或 draft 候选）
→ P-* 准则与关系
→ T-* 用例与可执行测试
→ 源码实现与公开导出
→ CLI facade 生成
→ 中英文文档与真实包导出 Demo
→ Web Component / React / Vue 预览验证
```

## 遇到边界变化时如何处理

如果在实现中发现需要新增公开 prop/event/state、调整状态归属、接触宿主原生对象，或发现代码与规范存在分歧，请同步更新规范实体、测试与文档，让改动在评审中保持一致；如果涉及引入新的 Base 身份，在准入前保持其 `draft` 状态即可。

## 下一步

- 构建多部件复合组件：[编写一个定制的复合原型](/zh-cn/build/prototypes/writing-a-compound-prototype/)
- 基于 Base 构建设计语言风格库：[基于 Base 长出一个带风格的原型库](/zh-cn/build/prototypes/building-a-styled-library-on-top-of-base/)
- 提交 PR 前逐项核对：[原型作者检查清单](/zh-cn/build/prototypes/checklist/)
