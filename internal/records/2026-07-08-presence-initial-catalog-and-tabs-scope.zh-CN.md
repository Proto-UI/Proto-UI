# Presence 初步编目与 Tabs 增强 PR 范围记录

日期：2026-07-08

> Internal record. Not normative. 本文用于归纳 Presence / Visibility 治理方向在当前 PR 内的阶段性边界：本 PR 只承接 Presence 初步编目所需的前置基线、Visibility/asHideable 与 Tabs hidden-but-mounted 增强；Overlay 编目与 asTransition 编目在后续 PR 单独推进。

## 背景

Presence / Visibility 治理的目标不是一次性改写所有结构生命周期能力，而是在逐步编目 P 实体的过程中，把已经混在组件、host 投射、style token、a11y hidden 与 transition 逻辑里的语义拆开。

前一篇记录已经明确：

- Visibility 表示已经存在的组件或宿主节点是否在视觉、焦点、命中测试与 accessibility semantic tree 中参与。
- Presence 表示组件实例或宿主结构是否参与 runtime/host 结构与生命周期。
- Transition 是围绕 Visibility / Presence 变化的时间状态机。
- Overlay 是 open/close、dismiss、portal/layer、focus 与结构生命周期的组合能力，不应重新发明 Presence / Visibility 的底层语义。

本轮讨论后，Presence 的作者侧出口进一步收敛为：Presence module 可以作为完整 module 存在，但普通组件 asHook 不允许直接消费 module 能力。module 能力只有两条合法作者侧出口：

- 通过 facade 暴露给 runtime，再由 runtime 封装成 `def` / `run` 句柄上的语法。
- 通过 port 暴露给特权 asHook，由原型作者消费这些特权 asHook。

因此，Tabs 之类原型不能直接消费 Presence module。需要懒挂载、延迟卸载或结构保留时，应通过特权 asHook 或 runtime 句柄语法提供。

## 本 PR 范围

本 PR 的预期范围收敛为三件事。

### 1. 建立 Visibility/asHideable 基线

`asHideable` 作为特权 asHook 提供当前组件隐藏/显示的中立能力：

- runtime-only `hide()` / `show()` / `setHidden(...)`。
- setup-only 默认 hidden 设置。
- 标准 state handle 形态的 observed `hidden` 视图，避免原型作者直接 set hidden state。
- host/adapter 通过 Visibility bridge 决定具体投射方式，而不是要求原型把隐藏长期写成 style token。

这一步让 Tabs inactive content 可以表达 hidden-but-mounted，而不把 hidden 和 unmount 混为同一件事。

### 2. 保持 Tabs Content hidden-but-mounted

Tabs Content 当前阶段只增强 Visibility，不引入 Presence lazy mount：

- inactive content 仍然保持 mounted。
- inactive content 通过 `asHideable` 进入 hidden。
- shadcn Tabs 不再依赖额外 style token hidden fallback。
- 已修复 tab content 重新切回后无法显示的顺序问题：Visibility 投射必须先拿到前一个 host 状态，再由 a11y hidden 等其他投射更新 host 属性。

Tabs 的 lazy mount、lazy keep、unmount-on-exit 不在本 PR 直接实现。它们进入 Presence 初步编目和后续 `asLazyMountable` 方向。

### 3. 为 Presence 初步编目圈定出口

Presence 本体先作为结构生命周期能力编目，重点记录：

- `absent / mounting / present / unmounting` phase。
- runtime mount / unmount wait point。
- host bridge 的 mount / unmount adapter-facing 边界。
- cancellation / stale completion 语义。
- 普通原型作者不直接消费 Presence module。

作者侧策略出口暂定优先服务三类场景：

- `asTransition`：离场期间保留结构，完成后释放。
- `asOverlay`：浮层 open/close、dismiss、portal/layer 与结构生命周期协调。
- `asLazyMountable`：直白表达 lazy mount / lazy keep 这类挂载策略，作为特权 asHook，而不是让组件 asHook 直接访问 Presence port。

其中 `asLazyMountable` 的第一阶段建议先聚焦 lazy keep：首次需要时请求结构存在，之后保持 mounted；隐藏仍交给 `asHideable` 或上层策略处理。`unmount-on-exit`、force mounted、复杂 nested presence tree 先记录，不进入本 PR 实现范围。

## 本 PR 不做

本 PR 不承诺以下内容：

- 不编目 `asOverlay` 的完整契约。
- 不重构 `asTransition` 或完成其 no-arg privileged asHook 迁移。
- 不把 Presence 暴露为普通组件 asHook 可直接消费的 module 能力。
- 不把 Presence 做成 `def` / `run` 句柄语法。
- 不实现 Tabs lazy mount / lazy keep / unmount-on-exit。
- 不定义动画 driver、RAF、CSS animation、transitionend 或宿主线程模型。
- 不处理 nested presence tree、conditional child structure 或 Suspense/data loading 类异步渲染语义。

## 后续路线

本 PR 合并后，建议按以下顺序继续：

1. 编目 Presence 核心 C 实体，明确 phase、runtime gate、host bridge、取消语义与作者侧出口限制。
2. 编目 `asLazyMountable` C 实体，确认它是否作为特权 asHook 消费 Presence port，并先服务 lazy keep。
3. 以 Tabs lazy mount 为人工验证场景，但保持实现独立于 Tabs 专属逻辑。
4. 单独推进 `asTransition` 编目与实现收口，使它成为 Presence + Visibility + Delay 的策略消费者。
5. 再单独推进 `asOverlay` 编目，处理 open state、presence phase、visibility state、layer/portal/focus side effect 的关系。

## 保留断口

- `asLazyMountable` 的命名可接受偏长和直白，但仍需在 C 实体落地时确认 API 形态。
- `mounted` / `present` 这类状态 handle 名称需要避免误导作者认为可以直接 set 结构生命周期事实。
- Presence 是否需要 facade 暴露给 runtime 暂不决定；当前更稳的是 port + 特权 asHook。
- Overlay 与 Transition 都可能消费 Presence，但它们不应把 Presence 本体变成动画、dismiss、focus 或 portal/layer 的所有者。
