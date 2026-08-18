---
title: '规范导读'
desp: 'Proto UI 实体目录的权威性、生命周期、关系与阅读路径'
description: 'Proto UI 实体目录的权威性、生命周期、关系与阅读路径'
---

Specifications 是 Proto UI 机器治理实体目录的公开阅读指南。它帮助你判断“项目当前保证什么”、把规则追溯到证据，并区分稳定契约与仅作为当前方向登记的工作。

目录有意保持不完整。一个实体已经存在，不代表它已经稳定；一个实体尚未出现，也不代表实现中不存在相关行为。

## 权威顺序

当不同来源出现冲突时，按以下顺序处理：

1. `spec/**` 中适用的实体是权威来源。
2. 内部 contract prose 可以补充尚未被目录登记的空白，但不能覆盖已有实体。
3. 工程记录保存观察、备选方案与阶段性方向，不具有规范性。
4. 实现与测试是当前行为的证据。它们与实体不一致时，应调查 drift，而不是默认契约已经改变。
5. 本站和 package README 是面向读者的投影；发生漂移时应修正投影。

本章负责解释目录，不建立第二套事实来源。评审或实现需要精确引用时，请使用 entity ID 与 criterion ID。

## 九类实体

| 前缀  | 实体            | 职责                                             |
| ----- | --------------- | ------------------------------------------------ |
| `C-`  | Contract        | 跨领域协议规则与验收条件                         |
| `P-`  | Prototype       | 官方原型或原型部件的身份与行为                   |
| `M-`  | Module          | 语义模块身份及其满足的 contract                  |
| `A-`  | Adapter         | 官方 Adapter profile、目标运行时与已审计支持决策 |
| `D-`  | Decision        | 已稳定的设计或治理选择                           |
| `HC-` | Host capability | 宿主应提供或被投影出的能力                       |
| `T-`  | Test            | 一致性案例与可执行证据映射                       |
| `V-`  | Version         | 发行身份、channel、package policy 与发布证据     |
| `K-`  | Knowledge       | 共享术语与解释模型                               |

实体通过带类型的关系组成图。`satisfies`、`verifies`、`supports`、`provides`、`omits` 等关系把规则、所有权与证据连接起来。尤其对 Adapter profile 而言，一个 Module 同时不在 `supports` 和 `omits` 中，只表示它**尚未被目录审计**，不能据此判断支持或不支持。

## 生命周期不等于发行版本

每个实体同时声明 `since` 与生命周期状态：

| 状态         | 含义                                                           |
| ------------ | -------------------------------------------------------------- |
| `active`     | 当前适用的保证                                                 |
| `draft`      | 已登记的当前方向，但不是稳定公开保证                           |
| `deprecated` | 为兼容或迁移保留；需继续阅读 `deprecatedSince` 与 `replacedBy` |
| `removed`    | 从 `removedSince` 起不再可用，只保留历史                       |

不要把三种不同的“当前版本”混在一起：

- `V-PROTO-UI-0008` 记录已经发布且不可变的 **0.2.0 stable** 生态快照。
- checkout 中的目录是当前工作区投影，可以包含此后的 draft 工作。
- 在本文编写时，`V-PROTO-UI-0009` 描述的是 **draft 0.3.0-alpha.0** release train，并不构成已经发布的证据。

一个 package 已随 0.2.0 发布，不会自动把相关实体都变为 `active`；实体生命周期与发行证据必须分别阅读。

## 建议阅读路径

先读[核心规范](/zh-cn/specifications/core/)，理解可移植边界与作者执行时期，再按问题所属能力继续：

- [生命周期](/zh-cn/specifications/lifecycle/)、[Template](/zh-cn/specifications/template/) 与 [Props](/zh-cn/specifications/props/)
- [Event](/zh-cn/specifications/event/)、[Expose](/zh-cn/specifications/expose/) 与 [State](/zh-cn/specifications/state/)
- [Context](/zh-cn/specifications/context/)、[Anatomy](/zh-cn/specifications/anatomy/) 与 [Feedback](/zh-cn/specifications/feedback/)
- [asHook](/zh-cn/specifications/as-hook/) 与 [Rule](/zh-cn/specifications/rule/)

需要精确裁决时，从页面中点名的实体继续追踪 criteria、relations、sources 与 `T-*` 证据。需要理解设计动机时回到 Whitepaper；需要了解实现机制时前往 Engineering 或 Reference。
