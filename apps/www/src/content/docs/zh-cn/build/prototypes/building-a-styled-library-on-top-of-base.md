---
title: '基于 Base 长出一个带风格的原型库'
description: '理解基于 Base 的风格化组件、styled-only 身份、Rule 样式规则与负向补丁边界。'
---

本文介绍在 Proto UI 中构建风格化组件库的核心设计思路。如果你准备提交完整的风格组件 PR，请同时配合[从 Base 投射风格化 Prototype](/zh-cn/build/prototypes/projecting-base-into-a-design-language/)中的规范、测试、导出与 Demo 交付流程。

## 先区分继承 Base 还是 styled-only

### 基于 Base 继承

当组件需要复用 Base 已有的状态、事件、焦点、无障碍、Context 或定位协议时，风格层在规范中通过 `inherits.prototypes` 声明继承关系，并在源码中调用对应的 Base `asHook`。风格层只负责叠加视觉与设计语言增量，交互状态仍由 Base 统一管理。

### Styled-only

当组件只包含设计语言属性、样式规则、内容布局或视觉结构（Visual Anatomy），本身没有独立的跨宿主交互协议时，直接声明为 `styled-only` 即可，不需要为了“有地方可继承”而在 Base 中造一个空壳协议。

## 示例：Shadcn Button 的结构

`P-SHADCN-BUTTON` 展示了一个紧凑的风格化原型结构：

- 在规范中通过 `inherits.prototypes` 继承 `P-BASE-BUTTON`；
- 在 [button.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/shadcn/src/button/button.proto.ts) 中调用 `asButton()` 复用底层按钮交互；
- 新增 6 种 `variant`、4 种 `size` 与对应的视觉 Token；
- 基于继承来的 `hovered`、`focusVisible`、`pressed`、`disabled` 状态与 `colorScheme` 元信息编写样式 `Rule`；
- 明确说明暂不支持上游 `asChild` 属性，保持兼容边界透明；
- 只导出直接原型入口，无需额外提供 `asHook`。

> 注：`P-BASE-BUTTON` 与 `P-SHADCN-BUTTON` 当前均处于 `draft` 阶段，具体属性和规则请以对应规范文件为准。

## 风格层 `P-*` 实体应记录什么

一份清晰易评审的风格层 `P-*` 规范只需聚焦**增量与差异**：

- 上游设计系统的来源仓库、路径、版本与许可证信息；
- `inherits.prototypes` 继承关系或 `styled-only` 分类；
- 新增的 `variant`、`size`、样式 Token、视觉 Anatomy 与兼容范围；
- 明确的 setup 期负向补丁（negative patch）及其替代行为；
- 明确不支持的上游 API；
- 关联的 `T-*` 测试用例与实际源码路径。

无需在风格层重复抄写 Base 的基础准则，也只记录已经实现的兼容能力。

## 源码如何复用 Base

实现风格组件时，通常先调用所属 Base 的 `asHook`，再按需叠加：

- 设计语言专属 props；
- `feedback.style` 样式 Token；
- 基于 Base 状态或元信息的样式 `Rule`；
- 规范中声明的视觉 Anatomy；
- 风格库自己的类型定义与包导出入口。

让 Base 继续管理值、事件请求、焦点、无障碍、关闭策略与定位；如果发现风格层开始自己维护一份重复的状态，应回到规范检查归属边界，保持单一数据源。

## 负向补丁与兼容边界

如果风格组件需要在 `setup` 阶段放弃或替换某项继承自 Base 的能力，请在对应的 `P-*` 准则中写明：

- 放弃或替换了哪项 Base 能力；
- 替代后的公开行为是什么；
- 对下游使用者的兼容影响；
- 用来验证旧能力确实关闭的断言测试。

这类能力裁剪必须在 `setup` 阶段静态声明，避免用运行时开关替代。

## 宿主与 Adapter 预览说明

目前官网提供 Web Component、React 与 Vue 预览，方便在 Web 环境下对比三套 Adapter 的渲染与交互表现；涉及其他非 Web 宿主时，请按对应宿主文档核对具体支持范围。

## 下一步

- 完整交付流程：[从 Base 投射风格化 Prototype](/zh-cn/build/prototypes/projecting-base-into-a-design-language/)
- 从规范进入源码与测试：[参考实现应该怎么看](/zh-cn/build/prototypes/reference-patterns/)
- 提交前逐项核对：[原型作者检查清单](/zh-cn/build/prototypes/checklist/)
