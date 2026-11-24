---
title: '编写一个定制的复合原型'
description: '掌握复合组件的 Anatomy 角色划分、状态归属、Context 协作与多部件实现。'
---

设计复合原型（Compound Prototype）的关键不是按视觉区域把大组件拆成多个文件，而是先厘清各个协议主体的职责归属与结构关系，再落到具体的模块划分。

对于已有的复合家族，可以直接沿用当前 `P-*` / `T-*` 规范继续开发；如果是全新的 Base 家族，可以先用 `draft` 形态建立候选 Anatomy、实体规范与测试探针，再按[实现受治理的 Base Semantic Slice](/zh-cn/build/prototypes/implementing-an-approved-base-slice/)推进交付。

## 先读规范图谱，再看源码结构

`Tabs` 是仓库中结构清晰的多部件参考案例。开始前建议先查看：

- `P-BASE-TABS` 中由 Root 管理的选中态准则；
- `P-BASE-TABS-LIST`、`P-BASE-TABS-TRIGGER`、`P-BASE-TABS-CONTENT` 与 `P-BASE-TABS-INDICATOR`；
- 对应的 `T-BASE-TABS-*` 测试实体与映射路径；
- [shared.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/tabs/shared.ts) 及各部件的 `*.proto.ts`；
- `packages/prototypes/base/test/tabs.test.ts`。

> 注：上述 Tabs 规范实体目前处于 `draft` 阶段，请以最新规范文件作为设计参考。

## Tabs 的五角色 Anatomy

`P-BASE-TABS` 定义了五个协作角色：

| 角色（Role） | 数量约束（Cardinality） | 核心职责 |
| --- | --- | --- |
| `root` | `1..1` | 统一管理选中值（selected value）、提供 Context 并作为 Anatomy 域锚点 |
| `list` | `0..1` | 管理 Trigger 集合顺序与漫游焦点（roving focus） |
| `trigger` | `0..*` | 携带自身 `value`，向 Root 发起切换选中态的请求 |
| `content` | `0..*` | 根据匹配 `value` 控制面板的激活状态、隐藏与挂载 |
| `indicator` | `0..*` | 读取共享 Context 渲染指示器，不介入选中态、焦点或事件管理 |

`Anatomy` 负责声明角色、数量约束与包含关系（`contains`），不会自动创建子节点或注入交互逻辑。每个部件原型在 `setup` 中调用 `def.anatomy.claim()` 声明自己承担的角色。

## 按职责划分状态归属

合理的复合组件拆分以**信息通路归属**为依据，而不是单纯按 DOM 结构切片：

- **Root**：管理选中值、受控/非受控模式切换与共享 Context 发布。
- **List**：管理子项集合顺序与键盘漫游焦点。
- **Trigger**：消费共享 Context，并在点击或键盘激活时发起选中请求。
- **Content**：根据当前选中值同步 `current`、`hidden` 与显隐挂载。
- **Indicator**：只读取共享状态进行视觉联动，保持单一数据源。

如果某个部件没有独立职责、只是带名字的样式容器，或者所有状态都堆在 Root 内部而部件间没有明确协议边界，通常需要重新审视拆分方案。

## Context 只承载共享协议事实

以 `TABS_CONTEXT` 为例，其中只存放部件协作所需的协议事实：Root 标识、当前选中/激活值、排列方向、激活模式、受控标记，以及选中请求与校验协调字段。

保持 Context 轻量且跨宿主中立，避免在其中塞入：

- 宿主 DOM 节点或框架私有对象；
- 仅用于某套皮肤的视觉 Token；
- 页面级业务数据；
- 不属于当前组件协议的表单、布局或播报状态。

Context 的字段结构与读写权限应由对应的 `P-*` 准则与测试约束。

## 区分 Anatomy 家族与组件组合

根据 `K-PROTOTYPE-COMPOSITION-0001`，核心模板只描述单个 Root 节点内部的结构，不直接嵌套另一个原型。组件之间的组合由宿主框架或编译层完成。

因此，`Anatomy` 家族（角色与包含约束）、`Context`（跨部件状态协作）与**应用层组件组合**各自解决不同问题，在建模时保持职责清晰即可。

## 形成实现与验证闭环

新增或调整复合角色与准则时，按以下链路同步推进：

```text
P-* 准则
→ 锚定该准则的 T-* 测试用例
→ Root / Part 实现
→ 聚焦的家族单元测试
→ Adapter 与无障碍行为验证
→ 包导出、CLI、文档与 Demo
```

测试时重点覆盖常见边界场景：受控模式请求拦截、禁用项、空值与重复值、子节点动态增删、显隐与卸载（teardown）、键盘焦点以及无障碍属性关联。

## 下一步

- 基于已有 Base 家族叠加设计语言：[基于 Base 长出一个带风格的原型库](/zh-cn/build/prototypes/building-a-styled-library-on-top-of-base/)
- 按规范与测试切入阅读源码：[参考实现应该怎么看](/zh-cn/build/prototypes/reference-patterns/)
- 提交前逐项核对：[原型作者检查清单](/zh-cn/build/prototypes/checklist/)
