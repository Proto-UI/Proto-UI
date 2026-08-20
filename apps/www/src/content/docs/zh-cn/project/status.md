---
title: '当前状态'
description: 'Proto UI 当前阶段的能力边界、适用范围与预期管理'
---

# 当前状态

Proto UI 仍处于 **v0** 阶段，但 **0.2** release line 已经完成发布。[Proto UI 0.2.0](https://github.com/Proto-UI/Proto-UI/releases/tag/v0.2.0) 是当前通过 npm `latest` 提供的稳定生态发行；同一应用内的全部公开 `@proto.ui/*` dependency 必须精确对齐到 `0.2.0`。当前安装说明请使用[快速开始](/zh-cn/start-here/quick-start/)。

npm 稳定版可用性与项目成熟度描述的是不同边界。0.2 package release 已稳定发布，但 Proto UI 仍是 v0 协议项目；单项语义保证仍以 spec entity 的 active、draft、deprecated 或 removed 生命周期状态为准。一个 package 随 0.2.0 发布，不会让其中全部 draft prototype 或 capability 自动转为 active。

已评审的发行事实保存在 [0.2.0 发行说明](https://github.com/Proto-UI/Proto-UI/blob/main/internal/releases/0.2.0/release-notes.zh-CN.md)、[tag 中的 package BOM](https://github.com/Proto-UI/Proto-UI/blob/v0.2.0/internal/releases/0.2.0/package-bom.json) 以及 GitHub Release 所附的不可变资产中。

在这个阶段，Proto UI 的重点不是尽快扩张功能表面，而是先把原型、适配器与运行时之间的基础语义收敛清楚，并验证这套体系能否稳定地落地到不同宿主中。

## 目前正在建设什么？

Proto UI 当前主要围绕以下几个方向推进：

- 收敛组件原型的基础表达方式
- 建立原型、适配器与宿主之间清晰的翻译关系
- 通过契约测试验证不同实现之间的语义一致性
- 补充基础原型库、适配器参考实现与文档体系

## 目前已经到了什么程度？

Proto UI 已经具备一套成型中的原型表达方式，并且正在多个 Web Runtime 中持续验证其翻译与实现路径。

在当前阶段，Proto UI 更适合被理解为：

- 一套正在收敛中的组件交互协议
- 一个围绕原型与适配器展开的早期开源项目
- 一套强调语义一致性与可验证性的基础体系

## 目前还不应该把它当成什么？

在 v0 阶段，Proto UI 还不应被理解为：

- 一个已经完备的生产级 UI 框架
- 一个已经拥有成熟生态与丰富组件储备的现成方案
- 一个已经对所有宿主都准备充分的通用平台

如果你的目标是立即获得一套成熟、稳定、开箱即用的完整解决方案，那么 Proto UI 当前大概率还不适合直接承担这个角色。

## 哪些内容仍在变化中？

在当前阶段，Proto UI 仍有不少部分会继续调整，包括但不限于：

- 部分 API 的命名、组织方式与细节形态
- 适配器生态的覆盖范围与最佳实践
- 原型库的储备情况与示例完整度
- 面向使用者与贡献者的文档结构

这并不意味着 Proto UI 缺乏方向，而是意味着它仍处于基础能力的收敛阶段。

## 现在适合谁关注 Proto UI？

当前阶段的 Proto UI 更适合以下读者与参与者关注：

- 对组件抽象、交互协议或适配层设计感兴趣的开发者
- 希望参与早期原型库、适配器或文档建设的贡献者
- 愿意在语义、约束与实现边界仍在收敛时参与验证与讨论的人
