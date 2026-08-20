# 2026-08-16 Expose Event 独立 package 与 0.3 alpha 治理

> Internal record. Not normative. 本记录保存 #390 合入后 Expose Event physical ownership 治理的实施事实、迁移边界与 release follow-up。稳定语义由 `M-EXPOSE-EVENT-0001`、`M-EVENT-0001`、`HC-EXPOSE-EVENT-SINK-0001`、official `A-*` profiles、相关 `T-*` entities 与 release decision/version entities 拥有。

## 结论

Expose Event 从 `@proto.ui/module-event` 拆为新的公开 package `@proto.ui/module-expose-event`，并由独立 `ExposeEventModuleDef` 承载。Standard Runtime 固定安装它，React、Vue 与 Web Component Adapter 把 `EXPOSE_EVENT_SINK_CAP` 接到 `expose-event` wiring target。Event Module 回到 User → Component input channel，不再拥有 outward registry、emit implementation 或 composite facade。

新模块硬依赖 `@proto.ui/module-expose` 的只读 port。`def.expose.event` 仍先在 Expose core 中登记 branded declaration，再由 Expose Event facade 验证分类；`run.expose.emit` 每次直接读取同一 core registry 后调用当前 sink。因此本轮删除了 Event implementation 中的第二份 `exposedEvents` map，避免 shared-key registry 与 outward registry 在 duplicate failure、lifecycle 或后续演进中漂移。该依赖不需要新增 privileged port。

## 兼容与迁移

Canonical token 继续使用既有 id `@proto.ui/event/emit`，`EVENT_EMIT_CAP` 仍与 `EXPOSE_EVENT_SINK_CAP` 是同一 token object。`@proto.ui/module-event` 暂时保留 `ExposeEventFacade`、sink 与 legacy token 的 deprecated source re-export，让 import 迁移可以独立完成；但 `EventFacade` 已只包含 Event channel surface。

旧 Adapter 接线 `.attach('event', [[EXPOSE_EVENT_SINK_CAP, ...]])` 或 `.use('event', ...)` 不会被 Runtime 静默代理到新模块；Event Module 会在 capability attach 时给出要求迁移到 `expose-event` 的诊断。维护者必须把 wiring target 改为 `expose-event`。这是 0.3 alpha 中有意公开的 topology migration：若继续接受旧 target，Runtime 就需要理解特定 Module token 并形成隐藏 alias，或让 Event 再次代理 Expose Event authority，都会削弱这次拆分的 ownership 结论。新模块完全缺失 sink 时，合法声明与 validation 仍成立、emit 仍按现有兼容策略 no-op，但 Adapter 不得宣称支持 standard outward-signal surface。

## Release train

本治理开启 `0.3.0-alpha.0` draft release train。0.3 当前仍允许架构调整、顶层 API 变化与新 feature，因此使用 `alpha`；核心范围与主要 API 收敛后才进入 `beta`；只有维护者认为版本可直接晋升 stable、仅待最终验证或 blocker 修复时才使用 `rc`。此前把 rc 当作内部或实验编号的习惯不继续沿用。

全局 exact-version policy 仍适用：根 `VERSION`、全部 41 个公开 package 与未来 snapshot 必须保持 `0.3.0-alpha.0`。本分支只准备 release identity、物料与代码，不执行 npm publish、创建 tag、切换 `next` 或激活 V entity。

新 npm identity 需要在真实发版前按 package governance 单独 bootstrap：使用明显非发行版本创建 identity，移除可能产生的 dist-tag，并配置受保护 workflow 的 Trusted Publisher。该外部动作不由本实施分支执行；在 `release:registry:check` 能验证 41 个 identity 前，它是发布 blocker，而不是代码或 spec blocker。

## 验证范围

本轮新增独立 module contract tests，并迁移 Runtime lifecycle/outward bridge tests、官方 Adapter wiring 与 prototype host fixtures。需要在 Node.js 22 与 pnpm 10.32.1 下完成 spec workspace、版本治理、package build、types、runtime tests 与 release rehearsal。历史的 2026-08-14 Event/Expose Event audit records 保持原样，继续作为当时共置状态与问题发现过程的事实证据。
