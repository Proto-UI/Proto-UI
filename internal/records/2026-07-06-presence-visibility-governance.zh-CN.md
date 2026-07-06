# Presence / Visibility 治理方向记录

日期：2026-07-06

## 背景

Tabs P 实体第一轮编目后，`P-BASE-TABS` 与 `P-BASE-TABS-CONTENT` 已经明确：非 current content 必须隐藏，但不得因此由 Tabs core protocol 自动 unmount。与此同时，现有实现中已经存在几条相关但尚未统一的能力：

- `@proto.ui/module-presence` 提供 `absent / mounting / present / unmounting` phase 与 `PresenceHostBridge`，用于软 mount / unmount。
- `asTransition` 已经消费 presence module，提供 `closed / entering / entered / leaving` 状态机。
- `asOverlay` 已经管理 open state、content/anchor/trigger 注册、portal/global mount、layer、modal lock 与 boundary close。
- Tabs Content 当前把 hidden 投射到 a11y state，并通过样式 fallback 维持 Web demo 表现；源码中已经标记 hidden 应收敛为独立 host capability，而不是长期混在 a11y 投射中。

这些能力说明 Presence / Visibility 治理不是新建一套完全独立系统，而是要给现有分散实现建立统一词汇、边界和后续编目路线。

## 术语边界

### Visibility

Visibility 表示一个已经存在的组件实例或宿主节点在用户感知、命中测试、焦点顺序与 accessibility semantic tree 中是否应被视为可见。

初步边界：

- hidden 不等于 unmounted。
- hidden 的投射可以影响视觉、可访问性、命中测试与焦点参与，但不应改变原型逻辑树。
- Web 上的 `display: none`、`hidden` attribute、`aria-hidden`、`inert`、CSS visibility、style token 都只是宿主投射方式，契约不应绑定其中任何一个具体方案。
- a11y hidden 是 visibility 投射的一部分，但 a11y module 不应成为 visibility 事实的唯一所有者。

Tabs Content 的默认策略应继续保持：inactive content hidden but mounted。

### Presence

Presence 表示组件实例或宿主结构是否参与宿主/runtime 结构与生命周期，重点是 mount、keep、soft unmount、最终 unmount/dispose 的治理。

初步边界：

- presence 可以允许一个语义上正在离开的元素继续保留结构，以等待 transition、animation 或宿主清理完成。
- presence 关注结构存在与生命周期等待点，不直接定义视觉动画效果。
- `@proto.ui/module-presence` 当前已经提供基础 phase 与 runtime 等待点，可作为后续 C/M/HC 实体编目的实现样本。
- presence 的 host bridge 应保持 adapter-facing；原型作者不应直接操纵 host mount/unmount 细节。

### Mount Policy

Mount policy 是把业务状态映射到 presence 行为的策略，例如：

- always mounted
- lazy mounted
- keep mounted
- unmount on exit
- force mounted
- soft unmount until transition complete

这些策略不应混写在每个组件自己的 hidden 规则中。Tabs、Overlay、Select、Dropdown、Dialog 等组件可以选择不同默认策略，但应复用同一套 presence/visibility 概念。

### Transition

Transition 是围绕 visibility/presence 变化的时间状态机。

初步边界：

- `asTransition` 应治理 `entering / entered / leaving / closed` 等离散阶段。
- visual animation driver 仍由宿主或样式层完成。
- transition 可以消费 presence，使 leaving 阶段保持结构存在，直到完成后才允许 absence/unmount。
- `asTransition(options)` 仍属于 privileged asHook no-arg migration 的历史断口，后续应迁移为无参调用加返回 handle 配置。

### Overlay

Overlay 是 open/close、dismiss、layer、portal、focus entry/restore 与 anchor/content 关系的组合能力。

初步边界：

- overlay 的 `open=false` 不应直接等价于“立即 unmount”。
- overlay 应成为 presence/visibility 的消费者，而不是重新发明 hidden、soft unmount 或 transition 语义。
- portal/global mount、layer、modal lock 是 overlay 相关的宿主能力，但它们不替代 presence 的结构生命周期定义。
- future `asOverlay` 编目时需要明确：open state、visibility state、presence phase 与 host layer side effects 的关系。

## 决策

1. Presence 与 Visibility 分开治理。Visibility 表示“还在但不可见/不可参与某些用户通道”；Presence 表示“是否参与结构与生命周期”。
2. hidden 默认不得隐式触发 unmount。需要 unmount 时必须由 presence policy 或组件自身明确策略驱动。
3. CSS/display 只能作为宿主投射，不进入跨宿主契约措辞。契约可要求 hidden 行为，但不得要求某个具体 CSS 实现。
4. a11y hidden 是必要投射，但 visibility 不能长期寄生在 a11y API 上；需要为 visibility/hidden host capability 或 module port 留出编目入口。
5. `asTransition` 应定位为 transition state machine 与 presence consumer；它不拥有 overlay dismiss、focus、portal 或 layer 语义。
6. `asOverlay` 应定位为 overlay 结构治理与 side-effect 协调者；它消费 presence/visibility/transition，而不是直接定义它们的全部底层语义。
7. Tabs Content 的 inactive panel 第一阶段继续采用 hidden-but-mounted；inactive unmount、presence transition、keepMounted/lazyMount/forceMount 进入通用治理后再回填。

## 近期工作路线

1. 编目 Presence / Visibility 的决策实体，明确二者边界以及 hidden 不隐式 unmount 的原则。
2. 编目 visibility 相关契约实体，覆盖 hidden 事实、宿主投射、焦点参与、a11y semantic tree 与 hit participation 的关系。
3. 编目 presence 相关契约实体，覆盖 structural presence phase、soft unmount、runtime wait point 与 host bridge。
4. 审计 `@proto.ui/module-presence`、runtime `PresencePort`、Web/React/Vue adapter presence bridge，并补齐测试实体与实现测试。
5. 重新审视 `asTransition` 契约与实现，使它清楚消费 presence，并处理 privileged asHook no-arg migration。
6. 在 presence/visibility 基线稳定后，再推进 `asOverlay`、transition、Select/Dropdown content 等 P 实体或 asHook 实体编目。

## 保留断口

- Web descendant focus 查询、`inert`、Shadow DOM、portal、CSS visibility/layout、disabled fieldset 等细节仍属于后续宿主能力增强，不在本记录内直接解决。
- Overlay modal、top layer、scroll lock、outside tree inert、focus trap 等更强 modal 语义不由 presence/visibility record 直接定义。
- Indicator measurement 属于渲染测量/布局读取能力，和 presence/visibility 相关但不是同一问题。
- `useFocusRoving` 已进入 deprecated 方向，待依赖它的原型编目和迁移完成后移除；它不阻塞 Presence / Visibility 治理。
