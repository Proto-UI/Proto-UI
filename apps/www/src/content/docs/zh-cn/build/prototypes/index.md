---
title: '原型专题'
description: '面向 Proto UI 原型作者的专题入口。'
---

这一组文档面向准备维护、扩展或评审 Proto UI Prototype 的贡献者。

它不是快速开始，也不是完整 API 手册。  
它更像一套工作文档，用来回答下面这些更具体的问题：

- 如何维护一个已经编目的 `P-*` 实体？
- 如何在已有 Base 协议上增加设计语言表面？
- 如何实现受治理或仍处于 candidate 阶段的 Base semantic slice？
- 我到底需不需要新写一个原型？
- 如果要写，一个单体原型的最小结构是什么？
- 如果要做复合组件，原型边界应当怎么拆？
- 如果我要的不是新交互，而是新的风格库，应该复用哪些东西？

## 先按贡献路径选择

### 维护已有 Prototype

从适用 P/T、实现和公开投影开始，适合行为修复、回归测试、文档、Demo 和 drift reconciliation。

[阅读维护已有 Prototype](/zh-cn/build/prototypes/maintaining-an-existing-prototype/)

### 从 Base 投射风格化 Prototype

Base 已经拥有协议，derived P 只增加设计语言 props、tokens、rules、visual anatomy 和明确的兼容边界。这是当前最适合开放给 Prototype 作者的完整路径。

[阅读从 Base 投射风格化 Prototype](/zh-cn/build/prototypes/projecting-base-into-a-design-language/)

### 实现受治理的 Base semantic slice

适合高级贡献者。已有受治理 Base subject 从当前 P/T 图直接继续。对于真正全新的 Base identity，可以先推进 research、candidate graph、draft entity、实现探针与测试；唯一未决语义决定是是否把这个独立 subject 准入 Base。

[阅读实现受治理的 Base Semantic Slice](/zh-cn/build/prototypes/implementing-an-approved-base-slice/)

所有新增公开 Prototype 都必须在同一 PR 中进入官网可访问页面。Demo 应消费真实 public package export，并优先通过 Prototype 自身 anatomy 和 trigger 工作；只有没有自然 trigger 或必须展示公开 controls 时，才使用最小且明确披露的外部 orchestration。具体交付检查见[原型作者检查清单](/zh-cn/build/prototypes/checklist/)。

## 概念阅读顺序

如果你还没有明确自己是否真的需要新原型：

1. 先读 [为什么你通常不需要新写一个原型？](/zh-cn/build/prototypes/when-not-to-write-a-new-prototype/)
2. 再用 [编写一个定制的单体原型](/zh-cn/build/prototypes/writing-a-custom-primitive-prototype/) 理解受治理或候选边界内的 leaf authoring entry
3. 如果受治理或候选 subject 是 family，进入 [编写一个定制的复合原型](/zh-cn/build/prototypes/writing-a-compound-prototype/)
4. 如果你主要想做新的组件风格或 UI 库，再读 [基于 Base 长出一个带风格的原型库](/zh-cn/build/prototypes/building-a-styled-library-on-top-of-base/)
5. 最后沿 [参考实现应该怎么看](/zh-cn/build/prototypes/reference-patterns/) 从 P/T 实体进入源码与公开投影

## 当前边界

- 不试图在一处讲完全部 `Prototype API`
- 不替代白皮书中的边界论证
- 不把内部 runtime 结构当作原型作者的前置知识
- 不从尚未完成的 Module、Host Capability 与 Adapter profile catalog 推导通用 Adapter 贡献指南

## 你应该先带着什么心态来读？

Proto UI 的原型语法并不是为了让所有人都频繁发明新原型。更常见、也更推荐的路径是：

- 维护和验证已有 P 实体
- 在已存在的 Base 协议上投射新的设计语言
- 先使用现有原型库
- 如果只是想重组一部分现有交互，优先考虑 `asHook`
- 只有现有协议无法表达一个已证明独立的信息通路主体时，才提出新的 Base Prototype

新的 Base subject 先用 proposal、candidate graph、draft entity 与测试证据证明独立信息通路；唯一需要单独解决的是 Base identity admission。熟悉的组件名或风格库需求本身都不是 admission 证据。
