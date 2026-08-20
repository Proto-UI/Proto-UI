---
title: '参考实现应该怎么看'
description: '从 P/T 实体进入源码、测试、导出与公开投影，而不是把实现当规范。'
---

现有 Prototype 实现是重要证据，但不是最高权威。一个更稳的阅读顺序是：

```text
applicable P lifecycle and criteria
→ related decisions / contracts / inheritance
→ mapped T cases and executable paths
→ implementation and focused tests
→ exports, CLI, docs, demo
```

如果实现与适用实体冲突，先把它标记为 drift；不要用“仓库现在这样写”静默修改协议含义。

## 1. 找到适用 P/T

可以从名称、ID 或 criterion 搜索：

```sh
rg -n "<prototype name|entity id|criterion id>" spec packages/prototypes apps/www internal/records
```

先确认：

- P entity 是 `draft`、`active`、deprecated 还是 removed；
- 哪些 criteria 真正适用于当前问题；
- direct Prototype、authored asHook 与 parts 如何被编目；
- `inherits.prototypes`、dependsOn 与 related decisions；
- T cases 映射到了哪些可执行测试。

旧 contract 与 record 可以解释背景；在已有实体的主题上，它们不能覆盖 spec。

## 2. 阅读单体 Prototype

Button 是较小的垂直切片：

- `P-BASE-BUTTON`；
- `T-BASE-BUTTON-0001`；
- [button.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/button/button.proto.ts)；
- `packages/prototypes/base/test/as-button.test.ts`。

重点看 criterion 如何落到 props、state、a11y、event、expose 与 absence guarantees，而不是只记录 API 调用顺序。

Toggle 可用于比较另一个独立 Base protocol：

- `P-BASE-TOGGLE` 与 `T-BASE-TOGGLE-0001`；
- [toggle.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/toggle/toggle.proto.ts)。

不要因为 Button 与 Toggle 都有 authored asHook，就让一个 protocol 消费另一个 protocol-specific hook。

## 3. 阅读复合 family

Tabs 需要同时阅读 Root 与 Parts：

- `P-BASE-TABS` 及 List、Trigger、Content、Indicator P entities；
- 对应的 `T-BASE-TABS-*` entities；
- [shared.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/tabs/shared.ts)；
- [root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/tabs/root.proto.ts)；
- [list.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/tabs/list.proto.ts)；
- [trigger.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/tabs/trigger.proto.ts)；
- [content.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/tabs/content.proto.ts)；
- [indicator.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/tabs/indicator.proto.ts)。

阅读时追踪 owner、context facts、anatomy claims、collection/focus responsibility 与 mapped tests。文件数量本身不能证明边界正确。

## 4. 阅读设计语言投射

Shadcn Button 是 Base projection 的紧凑例子：

- `P-SHADCN-BUTTON` 与 `T-SHADCN-BUTTON-0001`；
- inherited `P-BASE-BUTTON` criteria；
- [Shadcn Button source](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/shadcn/src/button/button.proto.ts)；
- `packages/prototypes/shadcn/test/button.test.ts`。

重点确认：

- derived P 只声明 delta；
- 实现确实调用 owning Base asHook；
- rules 依赖 inherited protocol states，而不是宿主 selector 成为第二真相；
- unsupported upstream API 与 absence assertions 有记录；
- package export、CLI facade、官网 Demo 与 P/T surface 一致。

还可以用 Shadcn Switch 和 Tabs 比较不同大小的投射，但每次都应从各自 P/T 开始，而不是机械复制目录结构。

## 5. 最后检查公开交付面

源码和测试通过后，继续检查：

- package subpath 与 root exports；
- CLI registry 和 generated facades；
- component preset / style token closure（如适用）；
- 双语文档与真实 public-package demo；
- WC、React、Vue 的 Web evidence；
- generated workspace 与 Agent projection。

这一步能区分“实现存在”和“贡献已经形成可消费闭环”。

## Lifecycle 提醒

本文列出的 Base Button、Toggle、Tabs 与 Shadcn Button 实体当前均为 `draft`。学习它们的 owner/evidence 结构，不要把当前实现细节扩张为未编目的稳定保证。

## 延伸阅读

- [维护已有 Prototype](/zh-cn/build/prototypes/maintaining-an-existing-prototype/)
- [从 Base 投射风格化 Prototype](/zh-cn/build/prototypes/projecting-base-into-a-design-language/)
- [实现已批准的 Base Semantic Slice](/zh-cn/build/prototypes/implementing-an-approved-base-slice/)
