# 2026-08-14 Expose State Module、record sink 与 official Adapter 审查

> Internal record. Not normative. 本记录保存 Expose State 首轮编目对 composition ownership、external handle、host-cap、Lifecycle 与 official Adapter support 的审查。稳定语义由 `C-EXPOSE-STATE-0001`、`M-EXPOSE-STATE-0001`、`HC-EXPOSES-RECORD-SINK-0001`、`A-*` 与 `T-EXPOSE-STATE-*` 实体拥有。

## Composition ownership

Expose State 没有 prototype-author facade。`def.expose.state(key, handle)` 在物理上仍由 runtime 调用 Expose core facade 完成 shared-key registration；Expose State 则依赖 Expose port 与 State port，在发布前识别 internal State handle，并将其降权为 App-Maker-facing external handle。

当前 Module 同时让非 State entry 按原 identity 通过。因此它不只是 state-handle helper，而是 standard Runtime 的 finalized outward-record compositor：只有经过这一层后，整份 exposes record 才可以安全交给 Adapter，避免 raw owned State authority 泄漏。

## Facade、port 与 external handle

- facade 为空，不创建普通 author syntax；
- privileged port 提供 `get`、`getAll` 与 diagnostics，供 Runtime、dependent Module 与内部检查读取 finalized record；
- external handle 提供 `get`、`subscribe`/unsubscribe 与 readonly `spec`；
- external handle 不提供 `set`、`setDefault`、raw slot、owned/borrowed/observed author view；
- subscription 丢弃 State watch context，只把不含 author `run handle` 的 StateEvent 交给 App Maker。

审查发现 Module 每次 `get/getAll/publish` 都会重建 external handle，导致同一 instance、同一 internal slot 的 outward identity 在 commit 与 capability epoch 后漂移。本轮增加 per-internal-handle cache，并让 Adapter-base 对 branded external handle 保持 host projection identity。重复读取、repeatable detach/remount 与 record republish 现在复用同一 external handle；terminal disposal 仍使残留 handle fail。

## Host capability 与命名修正

旧 token `EXPOSE_STATE_SET_EXPOSES_CAP` 的 payload 实际是完整 finalized exposes record，而不是 state-only patch。继续按旧名字理解会让 Adapter 作者误判 capability 粒度与 owner。

本轮引入 canonical `EXPOSES_RECORD_SINK_CAP`，保留原 token id，并让旧常量成为同一 token 的 deprecated source-compatible alias。对应 `HC-EXPOSES-RECORD-SINK-0001` 定义：

- sink 接收 complete replacement snapshot，不是逐 key patch 或 event；
- State entry 必须已降权，普通 value/method 保持原语义；
- Adapter 负责把 snapshot 挂到 ref、public instance、Custom Element 或其它宿主 surface，并单独处理 callable callback scope；
- capability 不包含 DOM、framework object、attribute 或 CSS policy。

## Sink rebind 与 Lifecycle 偏移

此前 capability replacement/removal 只停止向旧 sink 发布，却不会清空旧 record；旧 Adapter surface 可能继续持有看似有效的 outward capability。本轮让 Module 追踪最后一次已发布 sink：

- 新 sink attach/replacement 时先向旧 sink 发布空 record，再向新 sink 发布当前完整 record；
- capability removal 清空旧 sink；
- terminal disposal 清空 sink 并取消所有 external subscription；
- repeatable view detach 不清空 owner-level record，remount 后继续同一 handle identity。

`ExposeStateWebModule` 仍保留旧 `onProtoPhase('unmounted') -> dispose()` wiring，虽然当前 Runtime 不会在 repeatable detach 发出该 proto phase，但它继续表达了错误的 lifetime ownership。本轮移除该 hook；Web projection 在 mount-phase detach 时只释放 view binding，在 terminal module dispose 时才终止 instance resource。

## Adapter support

React、Vue 与 Web Component official profiles 都通过 standard Runtime 安装 required Expose State，并以 translated capability 提供 finalized record sink：

- React forwarded ref `getExposes()`；
- Vue component public instance `getExposes()`；
- Custom Element `getExposes()`。

三个 profile 都验证 external `get`、subscription、readonly spec/no-write、same-source update、callback scope 与 stable identity。Web adapters 还实际接入 `@proto.ui/module-expose-state-web` 及 rule optimization，但这些是 DOM/CSS peripheral Modules；本轮不提前创建其 `M-*` support relation，留给独立 Web extension pass 审查 optionality、host-cap 与非 DOM omission。

## 保留债务

- `Expose State` package 名称不能完整表达它对 complete finalized record 的 compositor ownership；在出现更多 specialized projector 后可能需要通用 pipeline 或重命名；
- external subscription 暂不承诺额外 scheduling、batching 与 ordering；
- future configurable runtime 尚不能自动拒绝缺失 required Module 或 sink、却宣称 standard Expose support 的 Adapter；
- Expose State Web 与 Rule Expose State Web 的 profile support/omission 需要外围 Module pass 独立编目。
