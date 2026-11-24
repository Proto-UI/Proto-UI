---
title: '原型专题'
description: '面向 Proto UI 原型作者的实用指南：维护现有原型、构建风格化组件与实现 Base 协议。'
---

本专题面向维护、扩展或评审 Proto UI 原型的开发者与贡献者。

在这里你可以按实际任务找到对应的工作流，从 `P-*` 与 `T-*` 规范实体出发，理清原型边界并完成完整交付：

- 如何维护已有的 `P-*` 原型实体与公开文档？
- 如何基于 Base 协议构建新的设计语言组件？
- 如何设计并实现一个新的 Base 协议切片？
- 什么时候其实不需要新写原型？
- 单体原型和复合原型（Compound）的边界应当如何划分？

## 选择你的贡献路径

### 维护已有原型

从对应的 `P-*` / `T-*` 实体、源码实现与文档入手，适合修复交互偏差、补充回归测试、更新文档与 Demo，或对齐导出与规范。

[阅读：维护已有 Prototype](/zh-cn/build/prototypes/maintaining-an-existing-prototype/)

### 基于 Base 构建风格化组件

当 Base 已经提供完整的交互协议时，风格层只需叠加设计语言属性、Token、样式规则（Rule）与视觉结构，并声明清晰的兼容边界。这是原型作者最常用的完整交付路径。

[阅读：从 Base 投射风格化 Prototype](/zh-cn/build/prototypes/projecting-base-into-a-design-language/)

### 实现 Base 协议切片

适合深入参与底层交互协议的贡献者。已有 Base 主题可直接沿当前 `P-*` / `T-*` 规范推进；全新的 Base 身份可以先通过调研、候选规范草案、原型实验与测试沉淀完整模型，再决定是否纳入 Base 体系。

[阅读：实现受治理的 Base Semantic Slice](/zh-cn/build/prototypes/implementing-an-approved-base-slice/)

每个新增公开原型都应在同一 PR 中提供官网可访问页面与真实包导出 Demo，并优先使用原型自身的 Anatomy 与 Trigger 驱动交互；仅在组件天然没有触发器或专门演示外部控制 API 时，才使用最小化的外部胶水代码。提交前可对照[原型作者检查清单](/zh-cn/build/prototypes/checklist/)逐项核验。

## 概念阅读顺序

如果你正在构思新功能，还不确定该如何切入，可以按以下顺序阅读：

1. [为什么你通常不需要新写一个原型？](/zh-cn/build/prototypes/when-not-to-write-a-new-prototype/) — 先判断任务属于维护、组合、风格化还是新协议
2. [编写一个定制的单体原型](/zh-cn/build/prototypes/writing-a-custom-primitive-prototype/) — 理解单体原型与 `asHook` 的最小结构
3. [编写一个定制的复合原型](/zh-cn/build/prototypes/writing-a-compound-prototype/) — 理解 `Anatomy`、`Context` 与多部件职责拆分
4. [基于 Base 长出一个带风格的原型库](/zh-cn/build/prototypes/building-a-styled-library-on-top-of-base/) — 理解继承 Base、styled-only 与样式规则组织
5. [参考实现应该怎么看](/zh-cn/build/prototypes/reference-patterns/) — 学习如何从 `P-*` / `T-*` 实体切入阅读源码与测试

## 设计理念速览

Proto UI 的原型体系鼓励复用成熟的交互协议，而不是为每个 UI 变体重复造轮子：

- 优先维护与完善已有 `P-*` 实体；
- 优先在现有 Base 协议之上叠加新的设计语言风格；
- 需要局部复用现有协议能力时，优先使用对应的 `asHook`；
- 只有当交互模式具备独立、跨宿主、可测试的信息通路，且现有协议与组合无法表达时，才提出新的 Base 原型。

查看当前已实现组件家族的文档映射：[原型文档覆盖索引](/zh-cn/build/prototypes/documentation-coverage/)。
