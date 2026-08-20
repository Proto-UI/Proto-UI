# 2026-08-14 Lifecycle 与 official Adapter conformance 审查

> Internal record. Not normative. 本记录保存 Lifecycle 首轮编目对 Runtime、official Adapter profile 与现有 conformance evidence 的审查。稳定语义由对应 `C-LIFECYCLE-*`、`A-*` 与 `T-LIFECYCLE-*` 实体拥有。

## 编目边界

Lifecycle 没有独立 Module package，本轮也不创建 `M-LIFECYCLE-*`。它描述的是 RuntimeSession 与 Adapter lifecycle owner 之间的执行协议：

- RuntimeSession 拥有 instance phase、mount phase、mount epoch 与 update revision；
- Adapter owner 决定何时 materialize、detach、remount 或 terminally dispose host view；
- structured lifecycle event 是 diagnostics 与 conformance 的 source of truth；
- ViewIntent 表达 prototype 对 L1 materialization 的期望，但不拥有实际 phase 或 terminal disposal 权限。

这条边界不要求宿主提供一项可单独索取的原子能力，因此没有对应 host-cap。Adapter profile 通过自身 criteria 和 `T-LIFECYCLE-*` 证据表达接入情况，而不是虚构 Module support 或 capability provision relation。

## Official Adapter 映射

三个 official Adapter 都把一个宿主 component owner 映射为一个 Proto RuntimeSession，但 repeatable view epoch 与 terminal owner teardown 的宿主事实不同：

- React owner 将内部 conditional view 和 StrictMode replay 映射为同一 instance 的 repeatable mount epoch；component terminal teardown 才 dispose instance。
- Vue owner 将 KeepAlive deactivate/reactivate 映射为 repeatable mount epoch；app/component terminal teardown 才 dispose instance。
- Web Component owner 保留 Custom Element identity；内部 view 可以重复 materialize，同步 DOM move 不得终止 instance，确认断开后的 teardown 才 dispose。

三个 profile 都在 created callbacks 后调和最新 ViewIntent，并以 reveal barrier 避免首次 commit 与 view effects 尚未一致的 root 被视觉暴露。

## 本轮发现并处理的偏移

`T-LIFECYCLE-0003` 已把 React、Vue 与 Web Component 的 structured lifecycle event tests 列为 required，但三个实现路径仍是 `planned`。与此同时，Adapter 已经通过 `diagnostics.onLifecycleEvent` 透传 Runtime event stream，现有 executable tests 只断言 deprecated CP0-CP10 compatibility projection。

本轮在三个既定路径补齐 v1 contract tests，直接验证：

- setup、alive、created 的 instance event；
- epoch=1 的 mount render、commit 与 mounted 子序列；
- 同一 epoch/revision 的 update render、commit done 与 updated；
- repeatable unmount 与 terminal disposal 的结构化事件边界。

随后把 `T-LIFECYCLE-0003` 的三个 implementation 状态改为 `passing`，并让 `T-LIFECYCLE-0003`、`T-LIFECYCLE-0005` 与 `T-LIFECYCLE-0006` 分别验证 official profile 的 diagnostics、owner lifetime 与 ViewIntent criteria。

## 保留差异

React host unmount 会先完成 repeatable view detach，再由 component owner 执行 terminal session disposal；Vue 与 Web Component 当前 teardown path 会先宣告 disposing，再强制完成 view detach。两者都满足“unmount 与 dispose 分离、terminal dispose 只发生一次”的契约，本轮不把宿主调度差异错误收敛为一条完全相同的 event sequence。

CP0-CP10 继续保留为 deprecated lossy projection，以兼容已有 diagnostics consumer；它不参与新的 lifecycle state-machine conformance。

## 后续 Module 编目的复用规则

State、Expose、Context 与 Feedback 的 logical resources 应引用 instance lifetime；host binding、view effects 与其它宿主资源应引用 mount epoch。Module 不应各自重新发明 mounted/unmounted/disposed 状态机，Adapter profile 也不应为 Lifecycle 填入并不存在的 Module 或 host-cap relation。
