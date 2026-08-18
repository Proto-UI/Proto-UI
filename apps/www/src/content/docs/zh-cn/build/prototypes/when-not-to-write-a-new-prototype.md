---
title: '为什么你通常不需要新写一个原型？'
description: '先区分维护、组合、设计语言投射与新的 Base semantic subject。'
---

Proto UI 提供 Prototype authoring API，不代表贡献者应该频繁增加新的协议身份。更稳妥的起点是：

> 先找到适用的 `P-*` / `T-*` 实体，再判断问题属于维护、组合、设计语言投射，还是一个尚待批准的新 Base semantic subject。

这是一篇边界判断指南，不是新 Prototype 的实施授权。新的 Base subject 必须先经过 proposal 和 maintainer checkpoint；只有边界、公共 API、P/T 图与证据范围获批后，才进入[实现已批准的 Base Semantic Slice](/zh-cn/build/prototypes/implementing-an-approved-base-slice/)。

## 先确认你面对的是哪类工作

### 维护已有 Prototype

如果适用的 `P-*` 已经存在，而问题是行为、测试、导出、CLI、文档或 Demo 与实体不一致，应走[维护已有 Prototype](/zh-cn/build/prototypes/maintaining-an-existing-prototype/)。

### 组合已有能力

如果目标只是把现有组件或 Prototype 组合成更高层体验，组合通常属于宿主、框架或编译层。`K-PROTOTYPE-COMPOSITION-0001` 明确指出，core template language 不提供 prototype-to-prototype composition。

不要为了获得一个方便的目录名或组合入口而制造新的 Base identity。

### 投射设计语言

如果 Base 已经拥有 state、event、focus、a11y 或 context 语义，而变化主要是：

- variant、size 或视觉 anatomy；
- style token 与 rule；
- 上游设计系统兼容边界；
- 明确的视觉或 API 增量；

那么它更可能是 Base projection 或 styled-only Prototype。完整流程见[从 Base 投射风格化 Prototype](/zh-cn/build/prototypes/projecting-base-into-a-design-language/)。

### 提议新的 Base semantic subject

只有在对象拥有独立、可测试、跨宿主稳定的信息通路时，才值得进入 proposal：

- 输入事实与 owner 明确；
- observable output 与同步规则明确；
- 现有 Base protocol 或 composition 无法无损表达；
- 不拥有的视觉、业务、布局、Form 或 announcement 责任有清楚的负向边界；
- 每项保留的准则都能映射到 substantive executable evidence。

熟悉的组件名、某个设计系统已有同名目录，或 styled library 想要继承点，都不是 Base admission 证据。

## `asHook` 能解决什么，不能证明什么

`asHook` 是某个 protocol 的 authoring entry，而不是“需要复用时就自动抽一个”的通用要求。

`P-BASE-BUTTON` 把 `base-button` 与 `asButton` 编目为同一 Button protocol 的两个 authoring entries；[Button 源码](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/button/button.proto.ts)让两者共享 `setupButton`。与此同时，`P-SHADCN-BUTTON` 明确只有 direct entry，不额外提供 authored asHook。

因此：

- 使用现有 protocol-specific asHook 时，先确认它确实属于适用 P 实体；
- 不要把 `asButton` 之类的协议钩子当成其他 Base protocol 的通用行为 substrate；
- 不要仅为了文件或 API 对称增加空 asHook；
- direct prototype 与 authored asHook 是否同时存在，由实体边界和真实 authoring surface 决定。

## 一条可执行的判断线

在写代码前依次回答：

1. 是否已有适用的 P/T，可以按 maintenance 处理？
2. 是否只是宿主或框架层的 composition？
3. 是否只是已有 Base 语义上的 design-language delta？
4. 如果真是新 Base subject，Issue 是否已经记录 maintainer checkpoint？
5. lifecycle、criteria、relations、sources 与 evidence 是否都已经明确？

前四步没有走完，就不应从“先建一个原型文件”开始。

## Lifecycle 提醒

本文引用的 `P-BASE-BUTTON` 与 `P-SHADCN-BUTTON` 当前均为 `draft`。它们描述当前编目方向，不应仅因相关包已经发布 0.2.0 就被写成稳定协议保证。

## 下一步

- 想理解单体 authoring entry 的结构，读[编写一个定制的单体原型](/zh-cn/build/prototypes/writing-a-custom-primitive-prototype/)
- 已有获批的复合边界，读[编写一个定制的复合原型](/zh-cn/build/prototypes/writing-a-compound-prototype/)
- 主要目标是新的设计语言，读[基于 Base 长出一个带风格的原型库](/zh-cn/build/prototypes/building-a-styled-library-on-top-of-base/)
