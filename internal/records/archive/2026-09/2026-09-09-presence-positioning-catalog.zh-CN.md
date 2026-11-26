# Presence 兼容盘点与 Positioning 编目

日期：2026-09-09。基线：`61f29b79`，分支 `codex/module-host-adapter-catalog-batch`。本文更新 2026-09-08 roadmap 的短期推进状态，不替代 spec，也不提升 draft lifecycle。

## Presence 的实际位置

在 `packages/modules/presence/src/**` 之外，未发现生产代码调用旧 `PresenceFacade.createHandle` 或注入 `PRESENCE_HOST_BRIDGE_CAP`；四个官方 Adapter 没有接入该旧 bridge。但 standard Runtime 仍安装 Presence，`packages/runtime/src/instance/session.ts` 保留 `awaitMount`、`awaitUnmount`、`forceUnmount` 以及 `RuntimeHost.presenceLifecycle: 'session'` 兼容路径；公开 package、导出和测试也仍存在。仓库内没有生产消费者不能推导外部无人使用。

当前 `C-AS-TRANSITION-0001`（draft）明确使用 ViewIntent / `run.lifecycle.setPresent()`，禁止 Presence bridge 成为第二套生命周期真相；`C-LIFECYCLE-0008`（active）区分 ViewIntent、实际 mount 与感知轴。因此本轮将旧 Presence 作为遗留兼容面盘点，不为 dormant bridge 新建 M/HC 或四 Adapter support 声明，也不移除、废弃或改写现有导出。后续若清理此路径，需另行决定兼容策略和 Runtime 生命周期迁移。

证据位置：`packages/modules/presence/src/{create,impl,types,caps}.ts`、`packages/runtime/src/instance/{instance,session,host}.ts`、`packages/prototypes/base/test/as-transition.test.ts`、`packages/runtime/test/with-host-presence.test.ts`。

## Positioning 有界闭环

补充既有 `M-POSITIONING-0001`、`HC-ANCHORED-POSITION-0001`、四个 A profile 与 `T-ANCHORED-POSITIONING-0001`，保留 draft。Module 管理 connection、host lease 与冻结的分类 snapshot；Overlay 判断 view active，并负责 connect/disconnect。Host 测量、碰撞、坐标、尺寸与 observation；Portal、open state、focus、Transition 不转移到 Positioning。

修复 shared Web host 的异步失效漂移：旧计算不能覆盖新 placement；替换目标（包括无效目标）或 dispose 后不再写入尺寸变量、坐标与 callback；disposed lease 的 update 不重新获取监听。修复前 5 个回归用例均失败，修复后通过。保留已投射的 style，不引入 dispose 时回滚 CSS 的新协议。

证据分层：

- `packages/modules/positioning/test/module-lifetime.test.ts`：缺失/恢复 host、同目标更新、目标与 capability 替换、冻结 snapshot、terminal cleanup。
- `packages/modules/positioning/test/lease-generation.test.ts`：可控异步完成顺序与失效，使用 Floating UI mock，不作为几何算法证据。
- `packages/modules/positioning/test/floating-ui-host.test.ts`：真实 Floating UI + 模拟 DOM rect 的 offsets、collision、translation opt-in。
- 四个 `packages/adapters/*/test/positioning.integration.test.ts`：真实 Adapter 与共享 host，验证 active Overlay 位置、resize 更新、保留 transform、close/unmount 后停止更新。
- 既有 Runtime Overlay 与 Hover Card tests 继续负责相应 consumer / Portal 证据。

这些测试不替代真实浏览器 clipping、visual viewport、复杂 transform 与 observer 时序的验收；也没有把 Host contract 违约后任意 late callback 的容错提升为 Module 保证。

## 下一步

完成此 slice 后继续 Overlay，再处理 Text Control、Image View、Scroll。Presence 从普通编目候选转为兼容架构盘点后，本批普通工作剩余四个领域；A11y、Rule Meta、deprecated State compatibility 和 Presence 兼容清理保持独立边界。
