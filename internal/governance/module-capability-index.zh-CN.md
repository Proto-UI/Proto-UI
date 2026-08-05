# Proto UI Module 能力索引

> 内部治理参考文档。本文是一份面向 `Adapter Author` 的实用索引，用于汇总每个 module package 提供什么能力、它是必选还是可选、需要什么 host-cap、依赖谁，以及 adapter 不接它会带来什么影响。

---

## 1. 本文目的

Proto UI 的 module 是主要由 adapter 消费的能力单元。

这份文档用于帮助 Adapter 作者快速回答：

- 这个 module 提供什么能力
- 它是必选、强烈推荐还是可选
- adapter 需要提供哪些 host-cap
- 它依赖哪些其他 module
- 如果 adapter 不接它，会损失什么能力

这是一份偏 adapter 设计的参考文档。

它不是完整的架构说明书。

---

## 2. 阅读方式

本文使用以下状态定义：

- `必选`：正常情况下 adapter 应支持，否则 Proto UI 在该宿主中很难保持成立
- `强烈推荐`：不一定在所有宿主里都绝对必需，但通常对 fidelity 或 Web 体验很重要
- `可选`：如果宿主无法忠实表达，可选择不支持
- `结构性`：它更像 module 体系的根基，而不是直接面向用户的能力包

判断一个 module 是否该接，标准应当是“宿主是否能忠实支持”，而不是“能接的越多越好”。

一个 adapter 诚实地不支持某个 module，通常比勉强支持但语义失真更好。

---

## 3. 典型接入方式

在正常的 adapter 工作流里，对接 module 并不是直接去碰 module 内部实现。

更典型的路径是：

1. 基于 `@proto.ui/adapter-base` 构建 adapter
2. 决定这个 adapter 打算支持哪些 module
3. 通过通用 wiring，例如 `createCapsWiring().use(moduleName, entries)` 或等价的 `wiring.attach(moduleName, entries)` 方式接入选定 module
4. 直接从对应 module package 导入所需的 caps 或宿主 helper
5. 为对应 module 提供它所需的 host-cap

最重要的实践规则是：

- adapter 负责决定“接哪些 module”
- adapter 负责提供这些 module 所需的 host-cap
- module 通过 runtime wiring 消费这些 host-cap

还需要额外遵守几条边界规则：

- `@proto.ui/adapter-base` 只提供通用 adapter 骨架，不再拥有面向每个 module 的具体 `useXxx()` helper
- 如果某个 helper 是宿主相关且只服务于某个 module，它通常应回到该 module package 内
- 对于不同依赖链路、但宿主语义本质相同的能力，可以复用同一个 host-cap 实现
- 但在同一条依赖链路内，下游 module 应优先复用上游 module 的输出或 facade，而不是再次索取同一个原始 host-cap

例如，`@proto.ui/module-expose` 负责内部 expose 注册表，而 `@proto.ui/module-expose-state` 负责对外发布最终 expose 结果的宿主 sink。

因此，这份文档既是一份能力索引，也是一份 host-cap 检查表。

---

## 4. 结构性 Module

| Package | 状态 | 作用 | Host-cap | 依赖 | 不接的影响 | 接入提示 |
| --- | --- | --- | --- | --- | --- | --- |
| `@proto.ui/module-base` | 结构性 | 所有 module package 的共同根基，定义 module 体系共享的结构契约 | 无直接 host-cap | 无 | 其他 module 将无法以 Proto UI 预期的 module 形态成立 | 它是结构根基，不是通常需要单独 wiring 的能力 module |

---

## 5. 能力索引

| Package | 状态 | 能力 | Host-cap | 依赖 | 不接的影响 | 接入提示 |
| --- | --- | --- | --- | --- | --- | --- |
| `@proto.ui/module-anatomy` | 必选 | 为 prototype 提供 anatomy 能力，使其在更大的 family 结构中查询其他部分并订阅暴露出的状态或方法 | `ANATOMY_INSTANCE_TOKEN_CAP`、`ANATOMY_PARENT_CAP`、`ANATOMY_GET_PROTO_CAP`、`ANATOMY_ROOT_TARGET_CAP`，可选 `ANATOMY_ORDER_OBSERVER_CAP` | 无 | prototype 将失去跨部分结构感知与 family 级协同能力 | 通过通用 wiring 显式接入；Web adapter 可直接使用本包提供的 `createDomOrderObserver` |
| `@proto.ui/module-as-trigger` | 必选 | 为特权 `asTrigger` 提供支持，使连续嵌套的 trigger 结构可以合并事件通路 | `AS_TRIGGER_INSTANCE_CAP`、`AS_TRIGGER_PARENT_CAP`、`AS_TRIGGER_GET_PROTO_CAP`、`AS_TRIGGER_SET_ROUTE_OWNER_CAP`、`AS_TRIGGER_GET_EVENT_TARGET_CAP` | `@proto.ui/module-event` | 嵌套 trigger 的组合与统一触发通路将无法正确工作 | 通过通用 wiring 显式接入，保持逻辑 instance 与物理 EventTarget 分离，并确保 `@proto.ui/module-event` 已一并接入 |
| `@proto.ui/module-boundary` | 必选 | 提供交互边界相关能力，例如 click outside、focus outside 等判定 | `BOUNDARY_HOST_BRIDGE_CAP`，并且在“当前宿主节点自动视为 region”的场景中通常还会配合 `HOST_ELEMENT_CAP` | 无 | 跨平台交互边界判断将缺失或变得不可靠 | 通过通用 wiring 显式接入；Web adapter 可直接使用本包提供的 `createWebBoundaryHostBridge` |
| `@proto.ui/module-context` | 必选 | 提供 context 这条 prototype 之间的信息通路 | `CONTEXT_INSTANCE_TOKEN_CAP`、`CONTEXT_PARENT_CAP` | 无 | prototype 之间无法通过 Proto UI context 机制通信 | 通过通用 wiring 显式接入 |
| `@proto.ui/module-event` | 必选 | 提供 event 这条用户交互信息通路 | `EVENT_ROOT_TARGET_CAP`、`EVENT_GLOBAL_TARGET_CAP`，可选 `EVENT_EMIT_CAP` | 无 | prototype 无法沿标准 Proto UI event 通路产生交互响应 | 通过通用 wiring 显式接入 |
| `@proto.ui/module-expose` | 必选 | 允许 prototype 注册对外暴露的行为与值 | 无直接 host-cap | 无 | expose 声明仍可在内部成立，但 adapter 将没有对外发布最终 expose 句柄的通路 | 这里不应再挂接对外 host sink；若 adapter 需要真正向外发布 expose，应与 `@proto.ui/module-expose-state` 配套接入 |
| `@proto.ui/module-expose-state` | 必选 | 统一 prototype 暴露 state 时的 DX 与宿主协同方式 | `EXPOSE_STATE_SET_EXPOSES_CAP` | `@proto.ui/module-expose`、`@proto.ui/module-state` | expose 出去的 state 会失去统一订阅与宿主协同模型 | 该 module 拥有 adapter-facing expose sink；它应消费 expose 与 state 的产物，而不是再次索取同一上游宿主语义 |
| `@proto.ui/module-expose-state-web` | Web 强烈推荐 | 在 Web 宿主中把 expose state 同步到 DOM Attribute 与 CSS 变量 | `HOST_ELEMENT_CAP`、`EXPOSE_STATE_WEB_MAP_CAP`，可选 `EXPOSE_STATE_WEB_MODE_CAP` | `@proto.ui/module-expose-state` | Web 产物会失去这套方便的 DOM 或 CSS 映射能力 | 通过通用 wiring 显式接入；如需 Web 专用映射 helper，应直接从本包导入 |
| `@proto.ui/module-feedback` | 必选 | 提供 feedback 这条用户可感知的信息通路，当前尤其是视觉反馈 | `EFFECTS_CAP` | 无 | prototype 将失去标准的可感知反馈路径 | 通过通用 wiring 显式接入 |
| `@proto.ui/module-focus` | 必选 | 为 `asFocusable`、`asFocusScope`、`asFocusRoving` 等特权 asHook 提供焦点体系支持 | `FOCUS_INSTANCE_TOKEN_CAP`、`FOCUS_PARENT_CAP`、`FOCUS_ROOT_TARGET_CAP`、`FOCUS_IS_NATIVELY_FOCUSABLE_CAP`、`FOCUS_SET_FOCUSABLE_CAP`、`FOCUS_REQUEST_FOCUS_CAP`、`FOCUS_BLUR_CAP`、`FOCUS_RUN_IN_CALLBACK_CAP` | 无 | 焦点体系相关能力将无法被正确表达 | 通过通用 wiring 显式接入 |
| `@proto.ui/module-hit-participation` | 必选 | 提供可靠的 hit testing 语义以及对齐宿主点击参与解释方式的能力 | `HIT_PARTICIPATION_HOST_BRIDGE_CAP`，通常还会配合 `HOST_ELEMENT_CAP` | 无 | 依赖 hit testing 的交互判断会变得不可靠 | 通过通用 wiring 显式接入；Web adapter 可直接使用本包提供的 `createWebHitParticipationHostBridge` |
| `@proto.ui/module-overlay` | 必选 | 为特权 `asOverlay` 提供支持，让浮层以更符合宿主习惯的方式渲染 | 可选 `HOST_ELEMENT_CAP`、`OVERLAY_GLOBAL_MOUNT_CAP`、`OVERLAY_MODAL_CAP`、`OVERLAY_LAYER_SCHEDULER_CAP` | 无 | 浮层类 prototype 将无法按预期渲染或协同 | 通过通用 wiring 显式接入；Web adapter 可直接使用本包提供的 `createZIndexOverlayLayerScheduler` |
| `@proto.ui/module-presence` | 可选 | 提供 runtime host bridge，把 lifecycle ViewIntent 投射为 view materialize 与 detach；`asTransition` 等普通策略只消费公开 lifecycle API，不直接访问该 module port | `PRESENCE_HOST_BRIDGE_CAP` | 无 | 结构 view intent 无法投射为宿主 view 的创建或释放，但保留 view 上的交互仍可工作 | 作为 runtime 基础设施通过通用 wiring 显式接入，而不是作为 authored asHook 的直接依赖 |
| `@proto.ui/module-props` | 必选 | 提供 props 这条信息通路，让 Maker 可以配置 prototype | `RAW_PROPS_SOURCE_CAP` | 无 | prototype 将无法接受标准 Proto UI 配置输入 | 通过通用 wiring 显式接入 |
| `@proto.ui/module-rule` | 必选 | 提供 rule 语法，以更语义化的方式描述 prototype 的逻辑与状态或样式反应 | 无直接 host-cap | 无 | 基于 rule 编写的 prototype 逻辑将无法沿预期路径运行 | 它更依赖 props、state、context、feedback 等模块协同，而不是单独的 host-cap 注入 |
| `@proto.ui/module-rule-expose-state-web` | Web 强烈推荐 | 将一部分动态样式 rule 预编译为静态 CSS，减少 Web 运行时样式替换开销 | `RULE_EXPOSE_STATE_WEB_NATIVE_VARIANT_POLICY_CAP` | `@proto.ui/module-rule`、`@proto.ui/module-expose-state-web` | Web adapter 将失去这项优化，只能更多依赖运行时样式路径 | 通过通用 wiring 显式接入 |
| `@proto.ui/module-rule-meta` | 可选 | 为 rule 的 `when` 表达式补充系统级元信息，例如系统明暗主题偏好 | `RULE_META_GET_CAP` | 无 | rule 表达式无法依赖这些额外系统状态 | 通过通用 wiring 显式接入 |
| `@proto.ui/module-scroll` | 可选 | 为特权 `asScrollSurface` 提供跨宿主滚动面、归一化 facts、requests、projection negotiation 与 session lifetime | `SCROLL_SURFACE_HOST_CAP` | `@proto.ui/module-state` | 使用 Scroll domain 的 prototype 无法接入宿主 scrolling engine，也无法观察或请求滚动 | 仅在使用 Scroll domain 时接入；Web adapter 可使用 `createWebScrollSurfaceHost`，其他宿主必须提供等价 capability，不能暴露宿主原始 geometry object |
| `@proto.ui/module-text-control` | 可选 | 为 declared host-owned multiline plain-text editor 提供稳定的 controlled/uncontrolled ownership、归一化 input/change/IME event、实时 property 投影与 physical focus access | `TEXT_CONTROL_HOST_CAP`、`TEXT_CONTROL_RUN_IN_CALLBACK_CAP` | `@proto.ui/module-base` | 使用 Text Control domain 的 prototype 无法 materialize 或同步宿主 editor | 仅在 prototype 声明 semantic text-control requirement 时接入；当前 Web adapter 将其解析为 textarea 并可使用 `createWebTextControlHost`，wrapper host 必须先阻止 physical native event 外泄，再发布归一化 prototype event；其它宿主必须提供等价 capability，不能要求 prototype 命名宿主 widget |
| `@proto.ui/module-state` | 必选 | 提供统一的 Proto UI state 模型 | 无直接 host-cap | 无 | prototype 将失去标准 state 语法与类状态机的行为模型 | 当前设计里它更像纯能力层，不依赖单独的 module host-cap |
| `@proto.ui/module-state-accessibility` | 必选 | 为 state 增加 `fromAccessibility` 一类 accessibility 派生能力 | 无直接 host-cap | `@proto.ui/module-state` | state 将无法表达标准 accessibility 派生子 API | 当前更依赖 state 语义本身，而不是额外 host-cap |
| `@proto.ui/module-state-interaction` | 必选 | 为 state 增加 hover、focus 等 interaction 派生能力 | 无直接 host-cap | `@proto.ui/module-state`、`@proto.ui/module-event` | state 将无法表达官方维护的 interaction 派生状态 | 当前更依赖 event 与 state 流，而不是独立 host-cap |
| `@proto.ui/module-test-sys` | 必选 | 以 module 形式融入 core -> runtime -> adapter 生命周期，提供自动自检能力 | 可选 `HOST_PROBE_CAP` | 无 | adapter 集成层将失去官方的模块化自检通路 | 基础自检不依赖 host probe；若提供 probe，可额外验证 host-cap wiring |

---

## 6. Adapter 设计建议

设计一个 adapter 时，建议按以下顺序使用这份索引：

1. 先确认所有必选 module
2. 再评估宿主能否忠实支持强烈推荐 module
3. 每一个可选 module 都应给出显式理由
4. 不要为了“支持数量更多”而对宿主表达能力不足的 module 进行失真接入

最核心的问题不是：

“这个 adapter 一共接了多少个 module？”

而是：

“这个宿主到底能忠实支持哪些能力契约？”

---

## 7. 说明

- 本文中的 module 状态，讨论的是 adapter 能力设计，不是首发 package 治理。
- 某些 module 被标为 Web 强烈推荐，是因为 Web 宿主能表达 DOM 映射、CSS 编译等特殊能力。
- 即使某个 module 不属于 first-user story，它也可能对 adapter 质量非常关键；本文关注的是 adapter 构建质量，而不是首发营销范围。
