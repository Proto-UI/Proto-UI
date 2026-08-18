---
title: '基于 Base 长出一个带风格的原型库'
description: '理解 Base projection、styled-only identity 与设计语言 delta。'
---

这篇是设计思路导论。准备提交完整投射时，请直接使用[从 Base 投射风格化 Prototype](/zh-cn/build/prototypes/projecting-base-into-a-design-language/)中的 P/T、provenance、测试、导出、CLI、Demo 和验证流程。

## 先判断是 projection 还是 styled-only

### Base projection

当 Base 已拥有 state、events、focus、a11y、context 或 positioning protocol 时，derived P 通过 `inherits.prototypes` 连接 Base，并在实现中消费对应 asHook。derived layer 只增加已编目的设计语言 delta，不建立第二个语义 owner。

### Styled-only

如果对象只拥有设计语言 props、视觉规则、内容模型或 visual anatomy，又没有独立 Base 信息通路，它可以成为 formal styled-only P。不要为了获得继承入口而创建空 Base identity。

Base admission 需要独立、跨宿主、可测试的 input-fact-to-observable-output path；组件目录名或流行设计系统中的同名对象并不是证据。

## Shadcn Button 的当前形状

`P-SHADCN-BUTTON` 当前声明一个 direct Prototype：

- 通过 `inherits.prototypes` 指向 `P-BASE-BUTTON`；
- 在 [button.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/shadcn/src/button/button.proto.ts) 中调用 `asButton()`；
- 增加六种 `variant`、四种 `size` 与 visual tokens；
- 根据 inherited `hovered`、`focusVisible`、`pressed`、`disabled` 和 `colorScheme` meta 投射视觉规则；
- 明确不提供上游 `asChild`，并把其他 parity 差异留在 compatibility open question；
- 本层不额外提供 authored asHook。

旧指南曾把 `invalid` 与 `expanded` 写成当前 Shadcn Button rule 输入；当前实现和 passing P criteria 并没有这项保证，不能继续这样描述。

`P-BASE-BUTTON` 与 `P-SHADCN-BUTTON` 目前均为 `draft`。npm 0.2.0 的发布状态不会自动把这些实体提升为 active。

## Derived P 应该写什么

一个可审查的设计语言 P 应聚焦 delta：

- 精确 upstream repository、path、revision 与 provenance；
- `inherits.prototypes` 或 styled-only classification；
- variants、sizes、tokens、visual anatomy 与 compatibility boundary；
- 明确的 setup-time negative patch 及其替代语义；
- 当前不支持的 upstream API；
- substantive `T-*` evidence 与真实 source paths。

不要复制所有 Base criteria，也不要承诺尚未实现的 upstream parity。

## 实现应怎样复用 Base

通常先调用 owning Base asHook，再增加：

- design-language props；
- `feedback.style` tokens；
- 基于 Base state 或 meta 的 rules；
- 必要且已编目的 visual anatomy；
- derived types 与 public entries。

如果实现重新持有 Base value、event request、focus、a11y、dismissal 或 positioning，就应暂停并返回 Issue，而不是让 style layer 成为第二套语义真相。

## 负向补丁与兼容边界

Derived Prototype 可以在 setup 期放弃或替换某项 inherited guarantee，但必须在自己的 P criterion 中明确：

- 放弃了哪项 Base capability；
- 用什么语义替代；
- 对外兼容影响是什么；
- 哪些 absence assertions 防止能力悄悄回来。

Runtime flag 不能伪装成 setup-time negative patch。

## Host 与 Adapter 表述

当前 Web Component、React 与 Vue 预览共同提供的是一个 Web host profile 的跨 Adapter evidence。设计语言页面可以比较三套 Adapter 的 Web 行为，但不能据此宣称非 Web host conformance 或“所有宿主 API 完全一致”。

## 下一步

- 完整交付流程：读[从 Base 投射风格化 Prototype](/zh-cn/build/prototypes/projecting-base-into-a-design-language/)
- 选择源码与证据：读[参考实现应该怎么看](/zh-cn/build/prototypes/reference-patterns/)
- 提交前检查：使用[原型作者检查清单](/zh-cn/build/prototypes/checklist/)
