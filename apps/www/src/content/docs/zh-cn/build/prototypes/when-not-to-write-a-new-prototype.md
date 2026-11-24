---
title: '为什么你通常不需要新写一个原型？'
description: '在动手写代码前，区分维护已有原型、组件组合、风格化定制与新增 Base 协议。'
---

在 Proto UI 中，大多数需求都不需要新增一个全新的交互协议。动手前最好的第一步是：

> 先找到对应的 `P-*` 与 `T-*` 规范实体，判断你的需求属于**维护已有原型**、**应用层组合**、**设计语言风格化**，还是真正需要一个新的 **Base 协议**。

如果目标已经存在于规范目录中，可以直接进入维护、风格化或实现流程；如果确实需要引入全新的 Base 身份，可以先以 `draft` 状态推进调研、候选规范、原型探针与测试，再完成准入后按[实现受治理的 Base Semantic Slice](/zh-cn/build/prototypes/implementing-an-approved-base-slice/)交付。

## 先判断你面对的是哪类工作

### 1. 维护已有原型

如果对应的 `P-*` 实体已经存在，当前问题是交互行为、测试、包导出、CLI、文档或 Demo 与规范不一致，请直接走[维护已有 Prototype](/zh-cn/build/prototypes/maintaining-an-existing-prototype/)。

### 2. 组合已有组件

如果你只是想把多个现有组件拼装成更高层的业务界面（例如带搜索框的弹窗或工具栏），这类组合应当放在宿主、框架或编译层完成。根据 `K-PROTOTYPE-COMPOSITION-0001`，Proto UI 的核心模板语言聚焦于单个原型内部结构，不直接嵌套另一个原型。

保持组合留在应用层，不需要为了“方便引入”而新建一个 Base 身份。

### 3. 构建设计语言风格层

当 Base 已经覆盖了状态、事件、焦点、无障碍或上下文协议，而你需要新增的主要是：

- `variant`、`size` 或视觉结构（Visual Anatomy）；
- 样式 Token 与状态规则（`Rule`）；
- 上游设计系统的 API 适配与兼容范围；
- 明确的视觉或接口增量；

那么你需要的是一层基于 Base 的风格化实现，或者一个纯样式（styled-only）原型。完整交付流程见[从 Base 投射风格化 Prototype](/zh-cn/build/prototypes/projecting-base-into-a-design-language/)。

### 4. 提议全新的 Base 交互协议

只有当一个交互模式拥有独立、可测试且跨宿主稳定的信息通路时，才适合作为新的 Base 原型：

- 输入事实与状态归属（owner）清晰；
- 对外可观察输出与同步规则明确；
- 现有 Base 协议或组件组合无法无损表达；
- 与视觉、业务、布局、表单或播报等外部职责的边界清晰；
- 每条核心规则都可以落到具体的可执行测试（`T-*`）。

## 正确理解 `asHook` 的角色

`asHook` 是某个具体交互协议的复用入口，是否提供取决于该协议的实际复用需求，而不是每个原型都必须成对导出。

- `P-BASE-BUTTON` 将 `base-button` 与 `asButton` 定义为同一 Button 协议的两个入口，并在 [button.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/button/button.proto.ts) 中共享 `setupButton`，避免语义分叉。
- `P-SHADCN-BUTTON` 则只提供直接原型入口，无需额外导出 `asHook`。

使用和编写 `asHook` 时，记住三条原则：

- 优先确认该 `asHook` 属于你要复用的 `P-*` 协议；
- 保持协议专用钩子（如 `asButton`）只服务于自身协议，避免把它当成另一个 Base 协议的底层积木；
- 只在存在真实复用场景时提供 `asHook`，不为文件对称而增加空封装。

## 动手前的快速检查

开始编码前，按顺序问自己五个问题：

1. 是否已有对应的 `P-*` / `T-*` 实体，属于修复或补充？
2. 能否直接在宿主或框架层组合现有组件完成？
3. 是否只是在已有 Base 语义之上叠加设计语言样式？
4. 如果确实是新的 Base 协议，当前是否已明确标记为 `draft` 候选或已确认准入？
5. 状态归属、接口边界、关联规范与测试方案是否已经明确？

前三个问题为“是”时，直接进入对应的现有工作流；只有在确认需要新 Base 协议时，再从候选规范与最小原型探针入手。

> 注：本页提及的 `P-BASE-BUTTON` 与 `P-SHADCN-BUTTON` 目前处于 `draft` 生命周期阶段，具体接口细节请以最新规范文件为准。

## 下一步

- 了解单体原型与 `asHook` 的最小结构：[编写一个定制的单体原型](/zh-cn/build/prototypes/writing-a-custom-primitive-prototype/)
- 了解多部件复合组件的建模方式：[编写一个定制的复合原型](/zh-cn/build/prototypes/writing-a-compound-prototype/)
- 了解如何基于 Base 打造风格化组件库：[基于 Base 长出一个带风格的原型库](/zh-cn/build/prototypes/building-a-styled-library-on-top-of-base/)
