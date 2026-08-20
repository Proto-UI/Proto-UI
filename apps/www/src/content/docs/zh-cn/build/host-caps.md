---
title: 'Host Caps'
desp: '语义 Module 如何在不拥有 framework 的前提下取得有界宿主能力'
description: '语义 Module 如何在不拥有 framework 的前提下取得有界宿主能力'
---

Host Capability 是语义 Module 向环境请求的窄服务，或向宿主投射结果的 sink。它让 DOM、framework、scheduler、geometry 与 native-control 机制留在 portable Prototype syntax 之外。

Catalog 当前只包含已经审计的一部分 host-capability identity。实现中还有更多 capability token；没有 `HC-*` 实体的 package 或 token 属于尚未编目，不能据此判断稳定或不支持。

## 前置阅读

先读[核心规范](/zh-cn/specifications/core/)理解 portable/host 分层，读 [Runtime 架构](/zh-cn/build/runtime-architecture/)理解 `ModuleWiring`，再读[兼容性](/zh-cn/reference/compatibility/)查看当前 Adapter profile slice。

## 四层与四种 owner

```text
Contract criterion ── 定义 portable behavior
       │
Module (`M-*`) ────── 拥有 semantic state 并请求 capability
       │ CapToken
Host Cap (`HC-*`) ─── 定义有界 host responsibility
       │ provides.hostCaps
Adapter (`A-*`) ───── 提供 native / translated / emulated realization
```

行为始终由 `C-*` 拥有，capability entity 不会成为第二份 contract。`D-ADAPTER-PROFILE-0001` 要求 official profile 说明 capability 是以 native、translated 还是 emulated 方式兑现；不能忠实满足时不得声称已经提供。

## Token、vault 与 wiring

Core 的 `cap<T>(id)` 创建具有全局 namespace string ID 的 typed token。每个 Runtime Module 收到只读 `CapsVaultView`：

- `SYS_CAP` 等 Runtime-owned base capability 在 host reset 后继续存在；
- Adapter-attached capability 位于可替换的 attached layer；
- `has` 与 `get` 解析当前值；
- `onChange` 与 `epoch` 让 Module 在 capability identity 改变时 rebind；
- 对 unavailable capability 调用 `get` 会给出稳定诊断。

Adapter 不直接修改 Module。`onRuntimeReady` 收到扁平的 `ModuleWiring`，再按 owning Module name 挂接 capability entry。Unmount/reset 只清除 attached host layer；terminal Module disposal 是另一项 Runtime action。

## Capability shape 由领域决定

不是每个 capability 都是 lease。当前形态包括：

| 形态 | 示例 | 生命周期行为 |
| --- | --- | --- |
| Source | Props source | 读取或 invalidate 当前 host input |
| Sink / bridge | Expose record/event sink、accessibility projection | 接收 semantic projection |
| Scoped binding | Event binding/default action | 挂接 host input route，并随 view 撤销 |
| Lease | Anchored Positioning、Scroll Surface、Text Control、Move Gesture | `attach`，可选 `update`/`request`，最终 `dispose` |

例如，已编目的 Positioning boundary 使用有界 host lease：

```ts
import { cap, type AnchoredPositionConnection } from '@proto.ui/core';

export interface AnchoredPositionHostLease {
  update(connection: AnchoredPositionConnection): void;
  requestUpdate(): void;
  dispose(): void;
}

export interface AnchoredPositionHost {
  attach(connection: AnchoredPositionConnection): AnchoredPositionHostLease;
}

export const ANCHORED_POSITION_HOST_CAP = cap<AnchoredPositionHost>(
  '@proto.ui/positioning/anchoredHost'
);
```

`M-POSITIONING-0001` 拥有何时 attach、update 与 dispose lease；`HC-ANCHORED-POSITION-0001` 拥有 host 要做什么；`T-ANCHORED-POSITIONING-0001` 映射 Module、host、Runtime 与 Prototype evidence。

## Lifetime 与 rebinding

Capability value 已经可用，不代表 host resource 永久存活。Module 通过 `resourceOwnership` 声明 `instance`、`view` 或 `mixed`：

- instance resource 在 repeatable detach 后保留；
- view resource 只属于一个 mount epoch；
- mixed Module 保留 semantic state，同时暂停或替换 host resource。

Lease-shaped capability 应在替换 target 前 dispose 旧 lease，并通过 epoch 或 connection identity 拒绝 stale async completion。Adapter wiring 应在 unmount 时撤销 DOM listener、observer 与 host reference，但不能销毁 instance-owned state。

## Target 与 surface projection

Host capability 不等于“原始 root element”。`C-HOST-SURFACE-PROJECTION-0001` 区分 logical `boundaryTarget` 和 visual `surfaceTarget`。Focus、accessibility、event、hit testing、native property、geometry 与 presentation 都可以有自己的 domain-specific target rule。仅仅因为 Adapter 同时能访问 wrapper 和可见 native control，并不意味着二者都成为 owner。

Portable author 获得 semantic handle，而不是 raw target access。Host-specific escape hatch 保持在 profile local，不能被提升为 cross-Adapter Props 或 State guarantee。

## Fake host 能证明什么

Runtime fake host 与 in-memory capability double 很适合证明 Module ordering、missing-cap behavior、lease cleanup 与 phase guard，但不能证明 browser layout、native focus、DOM event propagation、framework commit timing 或具体 Adapter 的 target choice。应在能观察该 claim 的最低层验证，再为跨 translation claim 增加 official Adapter evidence。

## 新增或修改 capability slice

1. 找到适用 `C-*` criteria 与 semantic Module owner。
2. 新增或更新一个完整 `M-*` / `HC-*` relation slice，不要按 token 数量批量建实体。
3. 在最近的 Module package 中定义 capability shape 与 resource lifetime。
4. 为每个适用 Adapter wiring，不能让 Adapter code 重解释 semantics。
5. 只有在 reviewed evidence 存在后，才记录 profile `provides.hostCaps`。
6. 新增 `T-*`，把 criteria 映射到 Module、fake-host、Adapter 与 integration implementation。
7. 运行 graph/schema validation 与 focused executable tests。

## 常见边界错误

- 把 missing capability 当作“静默支持”，会掩盖 Adapter omission decision。
- 把 profile 中未列出的 relation 解释为 unsupported，违反 uncataloged 状态。
- 把 host target 存进 portable State，会让某个平台泄漏进协议。
- 在 root 已替换后继续复用旧 view lease，会让 stale observer/callback 命中错误 surface。
- 创建没有 criteria、owner 与 evidence 的 `HC-*` placeholder，只会膨胀 inventory。

## 验证

```sh
corepack pnpm@10.32.1 vitest run packages/modules/positioning/test/floating-ui-host.test.ts
corepack pnpm@10.32.1 vitest run packages/runtime/test/contract/overlay.v0.contract.test.ts
corepack pnpm@10.32.1 vitest run packages/spec/graph/test/adapter-profile.test.ts
corepack pnpm@10.32.1 check:types
```

接下来阅读[模块与扩展架构](/zh-cn/build/module-extension-architecture/)理解 Module ownership，阅读 [Adapter 指南](/zh-cn/build/adapter-guide/)判断贡献是否就绪，或阅读[契约与测试](/zh-cn/build/contracts-and-tests/)理解证据层级。
