# Context 编目与 Vue 2 Adapter 跟进审计

日期：2026-09-07。基线：`main` 的 `f8f98d22`；工作分支：`codex/context-module-host-adapter-catalog`。这是本轮工程观察与验证记录，不替代 spec。

## Context 语义切片

新增 draft `M-CONTEXT-0001`、`HC-CONTEXT-IDENTITY-0001`、`HC-CONTEXT-ANCESTRY-0001`，并在四个既有 Adapter profile 中增加 Context 支持关系。共享 Context coordinator 不意味着应用全局资源；provider、subscription 和 callback 归 instance 所有，跨 repeatable view epoch 保留。

当前用户明确确认：provider 可以不订阅而 `update` 自己提供的值；consumer 仍须先订阅。`read`、`tryRead`、`tryUpdate` 不获得此例外。`C-CONTEXT-0008-C` 已与该决定及现有实现对齐。`C-CONTEXT-0012` 的旧 unmount 文案与既有 `C-LIFECYCLE-0006/0007` 对齐，区分 view detach 与 terminal disposal，没有引入新的销毁行为。

`T-CONTEXT-0003` 连接以下证据：

- `packages/modules/context/test/catalog-boundary.test.ts`：facade/port 分离、provider 写权限例外、opaque identity、当前 ancestry、缺失 capability 诊断。
- `packages/runtime/test/contract/context-lifecycle.v1.contract.test.ts`：真实 Runtime callback scope、重复 mount epoch、terminal 清理。
- `packages/adapters/{react,vue,vue2,web-component}/test/context.integration.test.ts`：共用真实 owner 场景，覆盖嵌套 scope、同名 Key 隔离、consumer 更新、缺失 optional provider、销毁后重建。

## Vue 2 既有编目的实际跟进

Vue 2 admission 已为 Props、Event、State、Expose、Expose State、Expose Event 建立 M/HC/A 关系，并有基础 executable evidence；但部分宽泛 case 映射只有基础场景支撑。本轮增加直接证据，并校准 T 映射：

| 领域 | 原有证据的局限 | 本轮补充 |
| --- | --- | --- |
| Props | `props-update.test.ts` 主要证明值更新 | `contract/props-host-source.v0.contract.test.ts` 验证 source invalidation、callback-safe sync 与显式 render；`props-normalization.v0.contract.test.ts` 验证分类排除与自定义 getProps 替换 |
| Event / Default Action | root commit gate 与 terminal root cleanup | `catalog-conformance.test.ts` 验证 default-action cancellation、global key delivery 与 destroy 后停止 |
| State / Expose State | 基础 readonly handle 与显式 render | keep-alive 中 State 和 handle identity 保留；subscription 可用；terminal outward record 清空 |
| Expose | 既有测试未直接证明 Vue 2 keep-alive 的顶层方法 identity | 新增可复现失败并修复 shared Adapter reader；保留 callback scope 与 terminal invalidation |
| Expose Event | 初始 listener route 可用 | typed listener 更换、Vue listener、无 replay、raw Props 和 public record 中不泄漏 listener/declaration |

对应 T：`T-PROPS-0012`、`T-EVENT-0003`、`T-STATE-0005`、`T-EXPOSE-0002`、`T-EXPOSE-STATE-0002`、`T-EXPOSE-EVENT-0002`。

## 已修复的共用 reader 漂移

Vue 2 keep-alive detach 前后顶层 expose method 引用不同，违反 `C-EXPOSE-0008-B`。根因是 `packages/adapters/base/src/host/exposes.ts` 按 replacement record 的 receiver 身份缓存 wrapper。修复将同一 instance 的顶层 callable 缓存与 record replacement 解耦；调用时使用当前原始 record 作为 receiver。嵌套 callable 仍按自身对象区分 receiver，保留对象方法语义。

`packages/adapters/base/test/contract/expose-record.v0.contract.test.ts` 新增 replacement snapshot、当前 root receiver、不同 nested receiver 与 terminal invalidation 回归证据。Vue 2 原始失败场景修复后通过。

## 边界与后续

本轮没有 lifecycle promotion，也没有宣称所有 HC 条件在每个 Adapter 上都有完整独立测试。Opaque ancestry 的模块证据不等于所有框架 portal、跨 root relocation 或真实浏览器布局路径都通过 conformance；这些可作为后续有边界的补充场景。可配置 Runtime module selection 的 required Context 诊断仍是 `M-CONTEXT-0001` 的 open question。没有承诺非 Web Adapter 支持。

后续可沿相同方法选择下一块已有稳定 C 和 executable evidence 的 Module/HC 切片；不要按包数量补空实体。
