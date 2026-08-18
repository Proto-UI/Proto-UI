---
title: 'Runtime 架构'
desp: 'Proto UI 如何物化 instance、运行 Module 并把工作交给 Adapter host'
description: 'Proto UI 如何物化 instance、运行 Module 并把工作交给 Adapter host'
---

0.2 的执行路径以 Runtime 为基础：Prototype definition 被物化为 `RuntimeSession`，语义 Module 通过受控 facade 与 port 运行，Adapter 则提供 `RuntimeHost` 和 host capability。本文依据当前实现与 catalog 描述这条已交付路径。

本文点名的大部分 lifecycle entity 仍是 `draft`；view intent 的 `C-LIFECYCLE-0008` 已是 `active`。实现已经通过测试，只能作为 draft rule 的证据，不会自动提升其生命周期。

## 前置阅读

先读[核心规范](/zh-cn/specifications/core/)理解 setup/render/callback 表面，读[生命周期](/zh-cn/specifications/lifecycle/)理解作者可见顺序，再读 [Prototype API](/zh-cn/reference/prototype-api/)理解 definition syntax。

## 所有权地图

```text
Prototype definition
  │ setup(def) / renderer
  ▼
RuntimeSession ── 拥有 instance 与可重复 mount epoch
  ├─ Kernel ──── author handle、callback scope、render syntax
  ├─ Module orchestrator ── 依赖顺序、facade、port、lifecycle hook
  └─ RuntimeHost boundary ── raw Props、调度、commit completion、cap wiring
                              │
                              ▼
                         Adapter + host platform
```

`@proto.ui/runtime` 中的 `createRuntimeSession(proto, host)` 是主要 session 边界。`createRuntimeInstance` 构造更底层的 Kernel 与 Module graph；正常情况下由官方 Adapter 拥有这层集成，而不是让应用代码自行组装。

## 两条生命周期轴

`C-LIFECYCLE-0002` 与 `C-LIFECYCLE-0006` 把 terminal instance lifetime 和 repeatable host-view lifetime 分开：

| 轴 | 状态 | 所有权 |
| --- | --- | --- |
| Instance | `setup → alive → disposing → disposed` | 一个逻辑 Proto instance；setup 与 created 只运行一次 |
| Mount | `detached → mounting → mounted → unmounting → detached` | 一个 host-view epoch；instance alive 期间可以重复 |

Canonical flow 是：

```text
setup → created → (mount → render → commit.done → mounted
                    → update → render → commit.done → updated
                    → unmount → unmounted) × n
      → beforeDispose → disposed
```

Unmount 不等于 dispose。Instance-owned State、resolved Props、callback registry 与 logical identity 在 detached 区间继续保留。每次新 mount 都递增 `mountEpoch`，旧 epoch 的异步完成不得推进新 view。

## 显式 update 与 commit

Render 与 commit 是 Runtime-owned effect（`C-LIFECYCLE-0003`）。`run.update()` 与 `session.controller.update()` 表达 update intent；Props、State、Context、Event 或 Feedback mutation 不会隐式 render。

Host 通过调用 `signal.done()` 报告 commit 已完成。只有之后，Runtime 才能派发 `mounted`/`updated`、为当前 epoch 启用 event delivery，并运行 post-commit Module hook。Detached 时的 update intent 只标记 dirty，下一次 mount 从最新 runtime state 渲染。

## Module orchestration

`RuntimeModuleOrchestrator` 按 dependency order 构造当前固定 Module set。它拒绝重复 name、缺失 hard dependency、依赖环和未声明的 dependency access。Kernel 只能访问 facade；Runtime internal 可以使用 privileged port；Adapter 通过扁平的 `ModuleWiring` 注入 host capability。

每个 Module 会分别收到 instance、mount 与 legacy proto-phase hook。Logical State 可以由 instance 持有，而 DOM listener、observer、positioning session 等 host resource 则按 mount epoch 释放或重绑。作者边界见[模块与扩展架构](/zh-cn/build/module-extension-architecture/)。

## Adapter handoff

`RuntimeHost` 的职责有意保持很小：

- 提供当前 raw Props snapshot；
- commit `TemplateChildren` 并报告完成；
- 调度 lifecycle work，以及需要时的 delayed callback；
- 接收结构化 lifecycle diagnostics；
- 在 `onRuntimeReady` 中挂接 Module host capability；
- epoch unmount 时让 event/observer system 失效。

Runtime 测试使用的最小 deterministic host 如下：

```ts
import type { RuntimeHost } from '@proto.ui/runtime';

export function createTestHost(prototypeName: string): RuntimeHost<Record<string, unknown>> {
  return {
    prototypeName,
    getRawProps: () => ({}),
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
  };
}
```

这个 fake host 可以证明 Runtime ordering 与 phase guard，但不能证明 DOM event routing、framework lifecycle integration、target projection 或 host-capability 正确性；后者必须由 Adapter 与 host test 覆盖。

## 常见边界错误

- 每次 unmount 都 dispose Module hub，会破坏 repeatable instance semantics。
- 调用 `commit()` 却不最终调用 `done()`，会让 epoch 永远无法完成。
- 从 Module mutation 触发 render，会绕过显式 update ownership。
- Kernel 直接进入 Module port，或 Module 访问未声明依赖，会绕过 orchestrator 边界。
- 把 deprecated CP0–CP10 string 当作 lifecycle source of truth，会丢失 epoch 与 revision identity；当前 trace 以 structured lifecycle event 为准。
- 把某个 Web Adapter 的 scheduling choice 写入 Core，会把宿主机械细节伪装成跨宿主保证。

## 验证

先运行 focused evidence，再扩大范围：

```sh
corepack pnpm@10.32.1 vitest run packages/runtime/test/contract/lifecycle.session.v1.contract.test.ts
corepack pnpm@10.32.1 vitest run packages/runtime/test/contract/lifecycle.module-resources.v1.contract.test.ts
corepack pnpm@10.32.1 vitest run packages/runtime/test/contract/lifecycle.update-order.strict.v0.contract.test.ts
corepack pnpm@10.32.1 check:types
```

`T-LIFECYCLE-0003`、`T-LIFECYCLE-0005` 与 `T-LIFECYCLE-0006` 把共享 lifecycle criteria 连接到 Runtime 和官方 Adapter evidence。

接下来阅读 [Host Caps](/zh-cn/build/host-caps/)理解 capability wiring，阅读 [Adapter 指南](/zh-cn/build/adapter-guide/)理解当前贡献边界，或阅读[契约与测试](/zh-cn/build/contracts-and-tests/)理解证据追踪。
