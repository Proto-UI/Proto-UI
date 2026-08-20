# 2026-08-14 Props official Adapter profile 审查

> Internal record. Not normative. 本记录审查 React、Vue 与 Web Component official Adapter 如何接入 Props Module 与 `HC-PROPS-SOURCE-0001`。跨宿主稳定规则仍由 `M-PROPS-0001`、`HC-PROPS-SOURCE-0001` 和 Props contracts 拥有；本记录只保存当前实现映射、差异与待决问题。

## 审查范围与治理边界

本轮只审查 Props ingress，不提前引入 `adapter` 或 `adapter profile` schema 类型。当前 catalog 明确没有这两类实体；历史记录也把 profile schema 留到 Adapter 编目阶段。因此当前采用以下表达：

- Module 与 host capability 记录跨宿主 baseline；
- `T-PROPS-0012` 把 official Adapter tests 作为 translation evidence；
- 本记录提供当前支持矩阵与宿主特定解释；
- 等 profile schema 单独定案后，再将这些实现身份、版本范围和 `supports modules` / `provides hostCaps` 关系提升为正式实体。

## 共同结论

React、Vue 与 Web Component 的 owner wiring 和 view wiring 都通过 `.use('props', [[RAW_PROPS_SOURCE_CAP, rawPropsSource]])` 接入 Props。它们均可提供同步 `get()`、失效 `subscribe()` 与 disposer，因此满足当前 `HC-PROPS-SOURCE-0001` 的 capability shape。

三类 Adapter 的正常产物都依赖 Runtime 固定安装的 Props Module；当前没有 official Adapter 的无 Props 降级路径。缺少 Props wiring 的实现不能声称支持标准 Maker configuration channel。

Host-cap 只统一 snapshot 与 invalidation，不统一宿主输入分类，也不规定 invalidation 后是否自动请求 render update。Watcher 只能在 runtime callback-safe sync point 派发；该 sync point 可以由显式 update、Adapter 自动 update 或其它合法 runtime callback 形成。

## 当前支持矩阵

| Profile | 当前 snapshot 来源 | Adapter-owned normalization | Invalidation 与 sync | Render policy | 其它 ingress |
| --- | --- | --- | --- | --- | --- |
| React | 稳定的 `propsRef`，经 `getProps` 读取 | 默认剥离 `children`、class/style presentation fields 与函数型 `onXxx` listener；允许 Adapter option 覆盖 `getProps` | `useEffect` 对规范化 snapshot 做浅比较并通知；下一次 runtime sync 重新读取 | `autoUpdateOnPropsChange` 默认开启；关闭时 invalidation 本身不 render | 无公开的第二条 Adapter props ingress；runtime controller 仍保留 direct apply port |
| Vue | 合并当前 component props 与 `ctx.attrs` 后经 `getProps` 读取 | 默认剥离 class/style presentation fields 与函数型 `onXxx` listener；允许 Adapter option 覆盖 `getProps` | deep watch、attrs reconciliation 与 component-updated hook 共同检测变化；component-updated 内的其它 callback-safe 工作可能在同一 host update 中同步并派发 watcher | `autoUpdateOnPropsChange` 默认开启；关闭时 watcher 仍可能在合法 callback-safe point 派发，但不得因此产生 Proto render commit | 无公开的第二条 Adapter props ingress |
| Web Component | `getElementProps(el)` 优先，否则使用 profile 的 `getProps(el)`；attribute source 由 `MutationObserver` 失效 | `setElementProps` 剥离 class/surface presentation fields；attribute/property 分类由 `getProps(el)` 明确提供 | attribute mutation 只标记 source 失效，显式 `update()` 等 runtime sync point 才重新读取 | attribute source 不自行请求 update；实例 `setProps()` 会 direct apply 后再 update | `setElementProps` 直接调用 `controller.applyRawProps`，属于 direct-push port path，不是 source notification |

## 发现并解决的 drift

Vue 会把 fallthrough `style` 投射到宿主 root，但此前 `defaultGetProps` 没有像 React 与 Web Component 一样剥离 `style`，导致同一个宿主 presentation input 同时进入 Proto raw props。本轮已把 `style` 加入 Vue Adapter normalization exclusion，并增加回归测试。

`packages/adapters/web-component/test/props-reprovide.test.ts` 过去可证明 `setElementProps` 的 direct apply 行为，但不能证明 `RawPropsSource.subscribe` 的 invalidation 行为。本轮新增 attribute-backed source test，并在 `T-PROPS-0012` 中把两类证据拆开映射。

## 当前限制与待决问题

### Web Component 双 ingress 的组合规则

一旦 `setElementProps` 写入 element-local snapshot，`getElementProps(el)` 会优先于 profile `getProps(el)`。因此 imperative snapshot 与 attribute-derived snapshot 当前不是自动 merge 的两个并行来源，而更接近前者接管后者。

后续 profile contract 需要决定：

- 明确两种模式互斥，并为接管行为提供诊断；
- 定义稳定的 merge precedence；
- 或把 attribute source 与 direct-push Maker path 拆为更明确的 Adapter API。

本轮不改变既有 precedence，以免在没有 profile entity 与兼容性决策时重写 Web Component 输入模型。

### Adapter profile schema

Props 已经证明 profile entity 至少需要表达：

- official Adapter identity 与宿主/framework version range；
- required/optional Module support；
- provided host capability；
- host-specific input normalization；
- automatic update policy；
- test evidence 与已知 limitation。

但 Props 不单独决定 schema。Event、Lifecycle 和基础 Module 审查还会提供额外字段需求；在这些证据形成前，继续用 `T-*` 与 record 收集，不创建临时 profile 真相源。

### Pull、subscribe 与 direct push

当前三类 Adapter 都能构造 `get + subscribe` source，因此没有理由立即扩张 `HC-PROPS-SOURCE-0001`。Web Component 的 `setElementProps` 已证明 direct push 有现实用途，但它仍可与 source capability 共存，尚不足以证明需要 push-only profile。

## Props 阶段结论

Props 的首个纵向切片现在能够回答：

- Module 对原型作者暴露什么 facade；
- Runtime 消费什么 port；
- Adapter 必须提供什么 host capability；
- 三类 official Adapter 如何提供该 capability；
- 宿主差异在哪里结束，portable Props semantics 从哪里开始；
- 哪些行为有 executable evidence，哪些 profile 问题仍未定案。

下一阶段可以进入 Event，同时沿用同一方法：先建立 Module/port/host-cap baseline，再记录 React、Vue 与 Web Component 的真实 translation evidence，不提前假设它们具有完全相同的宿主节奏。
