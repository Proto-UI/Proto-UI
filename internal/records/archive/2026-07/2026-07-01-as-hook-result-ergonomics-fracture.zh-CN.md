# asHook result ergonomics fracture

Date: 2026-07-01

## Context

Base Button 契约跟进到 `shadcn-button` 时暴露出一个 asHook 易用性问题：`shadcn-button` 理应直接消费 `asButton().stateHandles.focusVisible`，但实际失败点不是 Button 语义，而是 asHook result projection 的命名与消费方式不够直观。

具体表现是：

- `asButton` 通过 `def.expose.state('focusVisible', focusable.focusVisible)` 暴露 Button protocol 的公开 state name。
- focus module 内部 state semantic 是 `@focus/focusVisible`。
- asHook runtime 早期按 state 内部 semantic 收集 named state handles，导致调用者拿不到预期的 `stateHandles.focusVisible`。
- 消费侧如果不知道 expose key、internal semantic、`stateHandles`、`getState(...)` 与 rule state dependency 的关系，很容易写出看似合理但无法被规则驱动的代码。

本轮已经修复明确 bug：`def.expose.state(key, handle)` 进入 asHook result projection 时，应以 expose key 作为公开 projected state name。

## Fracture Status

- id: `F-AS-HOOK-RESULT-ERGONOMICS`
- status: `open`
- affectedNextStage: `as-hook`
- action: `carry-to-next-asHook-pass`
- blocksButtonPilot: `false`
- blocksAsHookGovernance: `true`

当前断口不阻塞 Base Button pilot，因为 `stateHandles` 的 expose-key projection 已经有 runtime 合约测试覆盖。但它暴露出 asHook result API 仍然不够好用，后续 asHook 契约压实时应继续处理。

## Current Facts

- `C-AS-HOOK-0006` 已经记录 `AsHookResult` 可以暴露 handles、artifacts、render fragment 与 disposers。
- `C-AS-HOOK-0007` 已经记录 asHook state handles 必须投影为 borrowed views。
- `T-AS-HOOK-0002` 已经覆盖 borrowed state projection，并新增了 expose key 命名的 runtime contract case。
- `asButton().stateHandles` 对 Button 这类 protocol asHook 是有价值的消费面，因为外层视觉原型需要复用 Button 的 interaction facts。
- 当前 `stateHandles` 是可选字段；调用者仍需要防御式判断，或者通过更强类型/辅助 API 确认某个 asHook 必定提供某些 handles。
- 当前 `stateHandles`、`getState(...)`、`artifacts.stateHandles` 存在多个等价入口，缺少面向原型作者的推荐消费路径。

## Open Questions

1. `AsHookResult` 对于已声明 contract 的 asHook，是否应在类型上把必需 `stateHandles` 从 optional 收紧为 required？
2. `getState(key)` 与 `stateHandles[key]` 是否需要同时保留；若保留，哪个应作为推荐 authoring 入口？
3. asHook 是否需要一个内部 helper/assertion，例如 `expectStateHandles(asButton(), ['focusVisible'])`，用于把缺失 projection 转化为更早、更清楚的诊断？
4. `def.expose.state(key, handle)` 的 expose key 是否应明确成为 asHook projected state name 的首选公开名称，并写入 `C-AS-HOOK-0007` 或 `C-AS-HOOK-0006`？
5. 对于 focus 这类内部 semantic 带命名空间的 privileged state，是否需要 tooling 在 asHook result 中展示“公开 name / internal semantic”的映射，避免调试时混淆？

## Next Checkpoints

1. 在下一轮 asHook 契约整理中，决定 `AsHookResult` 的推荐 authoring surface。
2. 评估是否把 expose-key projection 从 runtime test 反哺进 `C-AS-HOOK-0007` criteria。
3. 评估类型层是否能让已声明 state contract 的 `stateHandles` 变成 required，至少对普通 authored asHook 生效。
4. 检查 `shadcn-dialog-trigger`、`shadcn-dialog-close` 等其它消费 `asButton` 或 button-like asHook 的视觉原型，是否也应改为直接消费 projected handles。

## Related Artifacts

- `C-AS-HOOK-0006`
- `C-AS-HOOK-0007`
- `T-AS-HOOK-0002`
- `P-BASE-BUTTON`
- `packages/runtime/src/kernel/as-hook.ts`
- `packages/runtime/src/kernel/handles/def.ts`
- `packages/runtime/test/contract/as-hook.v0.contract.test.ts`
- `packages/prototypes/shadcn/src/button/button.proto.ts`

## Notes

这条 record 不是规范源。它记录的是从 Base Button pilot 中暴露出的 API ergonomics 断口：runtime bug 已修复，但 asHook result 的推荐形状、类型收紧、诊断与 tooling 展示仍未完成。
