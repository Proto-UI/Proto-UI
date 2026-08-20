# 2026-08-14 State Module 与 official Adapter 审查

> Internal record. Not normative. 本记录保存 State 首轮编目对 facade、port、Lifecycle、official Adapter support 与当前实现债务的审查。稳定语义由对应 `C-STATE-*`、`M-STATE-0001`、`A-*` 与 `T-STATE-*` 实体拥有。

## Module 边界

State 是 host-neutral 的 Component 内部维度，不是信息通路。`M-STATE-0001` 的 prototype-author facade 是 runtime 投影到 setup-time `def.state` 的五类 core definition：

- `bool`；
- `enum`；
- `string`；
- `numberRange`；
- `numberDiscrete`。

它们返回 owned view，只暴露 `get`、setup-only `setDefault` 与 runtime-callback-only `set`，刻意不提供 `watch`。

State port 面向 runtime、其它 Module 与特权 asHook，当前包括：

- internal `watch` 与显式 `disconnect`；
- module-owned `set` / `setDefault`；
- observed 与 borrowed view creation。

asHook projector 递归把捕获的 State handle 投影为 borrowed view，使调用方可以共享 control 与 watch，但不能获得裸 slot 或把 view 升级为 owned authority。

## Semantic bridge 边界

`def.state.fromInteraction` 与 `fromAccessibility` 虽然物理上出现在 `StateDefAPI` 与 runtime `def.state`，却不属于 core `StateFacade`。它们分别调用 `state-interaction` 与 `state-accessibility` Module facade，且已被决策标记为 deprecated compatibility accessors。

本轮把这两条入口记录为外围语义 Module 的 compatibility bridge，不把 Event-backed interaction input、accessibility semantic ownership 或它们未来的替代组合方式并入 `M-STATE-0001`。State core 只提供可复用的 slot、view 与 privileged port。

## Host capability 与 Adapter 结论

State kernel 与 Module 只使用 instance memory、SystemCaps phase guard 和 Module dependency port，不读取 DOM、framework object 或其它 host fact，也不投射 host effect。因此 State 没有 host-cap：

- official Adapter profile 必须通过 standard Runtime 支持 required `M-STATE-0001`；
- profile 的 `supports.modules` 增加 State，但 `provides.hostCaps` 不增加任何 State capability；
- State mutation 只更新 value 与 StateEvent record，React、Vue 与 Web Component 都必须等显式 Adapter update 后才把新值反映到 view。

当前 Runtime 固定安装 `StateModuleDef`，因此三个 official Adapter 没有正常的缺失路径。未来可配置 module set 仍需决定由 schema、runtime graph 或 adapt-time conformance 对缺失 State 及 dependent Modules fail fast。

## Lifecycle 偏移与修正

State resource ownership 明确属于 instance lifetime：value、view identity 与 watcher registration 必须跨 repeatable view detach/remount 保留，terminal disposal 才清理并使残留 view 失效。

审查发现 `C-STATE-0011` 与 `StatePort.disconnect` 注释仍使用旧式 “unmount/dispose” 表述，容易把 repeatable unmount 错解为 State disconnect。这与 `C-LIFECYCLE-0006` 冲突，也与当前 State Module 仅在 terminal module dispose 统一断开的行为不一致。本轮已：

- 将 `C-STATE-0011-D` 收敛为 terminal disposal 或显式 semantic-source disconnection；
- 在 `C-STATE-0012` 明确 detached epoch 保留 value、view identity 与 watcher；
- 更新 port 注释，不再把 repeatable view detachment 写成 disconnect trigger；
- 增加 runtime contract test，验证 epoch 1 detach 后仍能读取/写入并接收 watcher event，epoch 2 remount 复用同一状态，terminal dispose 才收到 disconnect 并使 handle 失效。

`StateEvent` 的 disconnect reason 目前仍使用历史字面量 `'unmount'`。本轮只修正触发边界，不在没有迁移决策时改变公共 event shape。

## 保留债务

`packages/modules/state/src/validate.ts` 已有 value validator helper，但 State kernel 尚未把它完整接入 definition、`setDefault` 与 `set`。当前可确认的是有限 state kind 与 spec metadata 被保存，不能宣称 enum/options、range 或 discrete step 在每次 mutation 时都已强制验证。

因此 `M-STATE-0001` 保持 draft，并保留 `C-STATE-0006-Q-VALIDATION` / `M-STATE-0001-Q-VALUE-VALIDATION`。这项偏移适合在独立兼容性决策后处理，不应借首轮编目静默改变现有 mutation 行为。

## 首轮完成标准

- `M-STATE-0001` 明确 facade、privileged port、capability views、semantic bridge 与 no-host-cap 边界；
- 三个 official Adapter profile 显式 `supports` required State Module，但不伪造 capability provision；
- `T-STATE-0005` 将 Module、Runtime、asHook、React、Vue、Web Component 与 profile schema evidence 映射到相应 criteria；
- State resource ownership 对齐 repeatable Lifecycle，并有 executable terminal-disconnect 证据；
- value-domain validation 与未来 required-module enforcement 继续作为可见债务。
