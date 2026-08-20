---
title: '编写一个定制的单体原型'
description: '在已批准边界内理解 direct Prototype 与 authored asHook 的最小结构。'
---

单体 Prototype 对应一个边界明确、可以独立承担信息通路责任的 protocol subject。Button 与 Toggle 是当前较清楚的例子。

> 本文解释 authoring 结构，不负责批准新的 Base identity。实现新 Base subject 前，必须先完成 maintainer checkpoint，并使用[实现已批准的 Base Semantic Slice](/zh-cn/build/prototypes/implementing-an-approved-base-slice/)所定义的完整交付流程。

## 从实体和证据开始

不要先复制源码。以 Button 为例，阅读顺序应是：

1. `P-BASE-BUTTON` 的 lifecycle、criteria、relations 与 sources；
2. `T-BASE-BUTTON-0001` 的 cases 与 executable mappings；
3. [packages/prototypes/base/src/button/button.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/button/button.proto.ts)；
4. `packages/prototypes/base/test/as-button.test.ts` 及相关 Adapter evidence；
5. package exports、CLI、文档和 Demo。

当前 `P-BASE-BUTTON` 是 `draft`。源码是当前实现证据，不高于适用实体。

## `base-button` 展示了什么

Button 的两个官方 authoring entries 是：

- `base-button` direct prototype；
- `asButton` authored asHook。

它们共享 `setupButton(def)`，所以不会各自维护一套 Button 语义。这是 `P-BASE-BUTTON-AUTHORING-ENTRIES` 的具体投影，不是每个 Prototype 都必须复制的固定模板。

当前实现的关键结构包括：

- `def.props.define()` 声明 `disabled`；
- `def.state.bool()` 建立 `disabled`、`hovered` 与 `pressed` 等状态；
- `asFocusable()` 提供 `focused`、`focusVisible` 与 focus method；
- `def.event.on()` 承接 pointer 与 `press.commit`；
- `def.expose.state()`、`def.expose.method()` 和 `def.expose.event()` 提供 outward surface；
- `def.a11y.*` 声明 Button 的 role、name、state 与 action。

旧的 `def.state.fromInteraction()` 例子已经不代表当前 Button 实现，不应继续作为这篇指南的示例。

## `def` 与 `run` 的边界

`def` 用于声明 setup-time 计划：props、state、events、exposes、a11y、rules 与 lifecycle hooks。`run` 只在具体 runtime callback 中提供当前 props、context、lifecycle 与 outward effect 入口。

例如：

```ts
def.event.on('press.commit', (run) => {
  if (disabled.get()) return;
  run.expose.emit('click');
});
```

这里 event route 在 setup 期注册；真正的 outward signal 在事件发生时通过 `run` 发出。

## 什么时候提供 authored asHook

不要把“只导出 prototype，不导出 asHook”当成通用错误。先问：

- applicable P 是否把 direct form 与 authored asHook 记录为同一 protocol 的两个 entries？
- 两者是否应共享完整协议面与实现？
- 这个 hook 是否只服务其 owning protocol，而不是被误用为跨 Prototype substrate？
- 新增 entry 是否会引入未经治理的 options、merge 或 configure 语义？

`D-PROTOTYPE-ENTITY-NAMING-0001` 要求同一协议已有的多个 entries 编目在同一个 P 实体；它不要求每个 direct Prototype 自动生成 asHook。`D-AS-HOOK-CONFIGURABLE-AUTHORED-0001` 还将普通 configurable authored asHook 保留为待治理设计空间。

## 一个完整单体 slice 还需要什么

源码文件只是交付面的一部分。获批的新单体 Prototype 通常还需要：

```text
approved checkpoint
→ P criteria and relations
→ T cases and executable tests
→ implementation and public exports
→ CLI facade generation
→ bilingual docs and real public-package demo
→ applicable WC / React / Vue evidence
```

三套当前 Adapter 预览验证的是一个 Web host profile，不能自动推导为多宿主 conformance。

## 何时暂停

如果实现中需要新增公共 prop/event/state、改变 owner、引入 raw host object，或发现 P/T 与实现互相矛盾，应回到 Issue 请求 checkpoint，而不是在源码里扩张边界。

## 下一步

- 复合 family：读[编写一个定制的复合原型](/zh-cn/build/prototypes/writing-a-compound-prototype/)
- 设计语言投射：读[基于 Base 长出一个带风格的原型库](/zh-cn/build/prototypes/building-a-styled-library-on-top-of-base/)
- 提交前：使用[原型作者检查清单](/zh-cn/build/prototypes/checklist/)
