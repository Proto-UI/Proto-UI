---
title: '模块与扩展架构'
desp: '语义 Module 所有权、依赖边界、Runtime registration 与受治理的扩展工作'
description: '语义 Module 所有权、依赖边界、Runtime registration 与受治理的扩展工作'
---

Module 在 Prototype authoring 与 host translation 之间承载可复用协议语义。一个 Module 可以暴露 setup/runtime author handle、保留 instance state、依赖其他 Module，并在不导入 React、Vue 或 Custom Elements 的情况下消费 Host Capability。

实现中的 Module package 数量多于 catalog 当前的 `M-*` 实体数量。Entity count 不等于 package count；尚未编目的 Module 是实现证据，不是 active public guarantee。

## 前置阅读

先读[核心规范](/zh-cn/specifications/core/)理解 authoring phase，读 [Runtime 架构](/zh-cn/build/runtime-architecture/)理解 orchestration，再读 [Host Caps](/zh-cn/build/host-caps/)理解宿主边界。

## Static declaration 不等于 Runtime implementation

两组名称相近的 API 解决不同问题：

| 表面 | Owner | 目的 |
| --- | --- | --- |
| `@proto.ui/core` 的 `moduleDeclaration` / `declareModule` | Prototype definition | 在 Runtime Module construction 与 Adapter selection 前绑定 immutable typed configuration |
| `@proto.ui/module-base` 的 `defineModule` / `createModule` | Runtime implementation | 定义 Module dependency、resource ownership、facade、port 与 lifecycle hook |

`C-MODULE-DECLARATION-0001` 治理第一组表面。Setup-time `asHook` 调用不能事后改变 static requirement；authored asHook 必须发布 frozen requirement，caller 则在 Prototype definition 上显式复用。

## Runtime Module anatomy

```text
ModuleDef
  ├─ name + resourceOwnership
  ├─ deps / optionalDeps
  └─ create(ctx)
       ├─ facade ── Kernel 或 dependent Module 使用的安全语义表面
       ├─ port ──── privileged Runtime/Module integration surface
       └─ hooks ─── instance、mount、proto phase、post-commit、dispose
```

当前 implementation pattern 使用 `defineModule` 与 `createModule`：

```ts
import { createModule, defineModule, type ModuleFactoryArgs } from '@proto.ui/module-base';

type IdentityFacade = { prototypeName(): string };

function createIdentityModule(ctx: ModuleFactoryArgs) {
  return createModule<'identity', 'instance', IdentityFacade>({
    name: 'identity',
    scope: 'instance',
    init: ctx.init,
    caps: ctx.caps,
    deps: ctx.deps,
    build: () => ({
      facade: { prototypeName: () => ctx.init.prototypeName },
      hooks: {},
    }),
  });
}

export const IdentityModuleDef = defineModule({
  name: 'identity',
  resourceOwnership: 'instance',
  deps: [],
  create: createIdentityModule,
});
```

这段代码展示真实 implementation type，但**不**承诺第三方 package 可以把 `IdentityModuleDef` 动态安装进 stock Runtime：`createRuntimeInstance` 当前注册的是固定、已评审的 Module list。除非未来编目出 public registration surface，新增 Runtime Module 仍是仓库架构工作。

## Dependency graph 与 access

`RuntimeModuleOrchestrator` 对 hard dependency 和实际存在的 optional dependency 做 topological sort，并拒绝重复 name、缺失 hard dependency 和 cycle。之后由 `ctx.deps` 强制声明式 access：

- `requireFacade` / `requirePort` 在已声明 dependency 缺失时失败；
- `tryFacade` / `tryPort` 只在 optional dependency 缺失时返回 `undefined`；
- 所有 accessor 都拒绝未声明 dependency。

不要通过直接 import 另一个 Module 的 implementation object 绕过这套边界。Package dependency 是 build mechanics；`deps` 才表达 runtime semantic ordering 与 access。

## Facade、port 与 capability

始终使用最窄表面：

- **Facade：**其他 author-facing layer 或 Module 可以消费的稳定语义操作。
- **Port：**Runtime 或已声明 dependent Module 所需的 privileged integration，不会自动成为 public API。
- **Host Capability：**由 Adapter 提供的平台服务或 projection，不能被当作 Module-to-Module back door。
- **System Capability：**`SYS_CAP` 等 Runtime-owned phase/lifecycle guard，Adapter wiring 不得覆盖。

Kernel 只能看到 facade；Runtime 可以为 lifecycle integration 读取 port；Adapter 通过 `ModuleWiring` 挂接 capability entry，不应取得或修改内部 Module instance。

## Resource ownership

每个 `ModuleDef` 都声明 `resourceOwnership`：

| 值         | 含义                                                           |
| ---------- | -------------------------------------------------------------- |
| `instance` | Logical resource 在 detach 后保留，不拥有 host-view activation |
| `view`     | Resource 只属于一个 mount epoch，detach 时必须释放             |
| `mixed`    | Logical state 保留，host binding 则暂停、rebind 或 replay      |

这个字段记录 intent，真正 cleanup 仍由 lifecycle hook 与测试执行。`C-LIFECYCLE-0006` 要求 instance phase 与 mount phase 正交；`packages/runtime/test/contract/lifecycle.module-resources.v1.contract.test.ts` 会跨 remount 验证 mixed ownership。

## 受治理的扩展流程

新增行为前先追踪一条 vertical slice：

```text
knowledge/decision → C-* criteria → M-* owner → HC-* requirement
                   → A-* support/provision → T-* cases → implementation
```

然后：

1. 确认 semantic channel 是否已经由现有 Module 拥有。
2. Dated record 只保存 alternative 或 unresolved direction；稳定行为应进入实体。
3. 新增或修订一个完整 `M-*` identity，并连接 satisfied Contract 与 required Host Cap。
4. 定义 facade/port/dependency boundary 与明确 resource ownership。
5. 只有 Issue 授权架构变更时，才把实现注册进 Runtime。
6. 添加 Module-level test、Runtime integration，以及涉及 host translation 时的 Adapter evidence。
7. 只为 reviewed slice 更新 official `A-*` profile relation；缺席仍表示 uncataloged。

## 常见边界错误

- 为每个 package 或 token 创建空 `M-*` 实体，无法形成 semantic ownership。
- 因为 port 使用方便就把它暴露为 public API，会泄漏 Runtime privilege。
- Import 未声明 dependency，会隐藏 ordering 与 disposal assumption。
- 把 `scope: 'instance'` 当作 cleanup 正确的证据，会忽略 `resourceOwnership` 和 lifecycle behavior。
- 让 Module 在每次 mutation 后间接调用 `run.update()`，违反显式 Runtime update ownership。
- 把 Runtime 固定列表当作 plugin registry，会承诺一个不存在的 extension surface。

## 验证

```sh
corepack pnpm@10.32.1 vitest run packages/core/test/contract/prototype.module-declarations.v0.contract.test.ts
corepack pnpm@10.32.1 vitest run packages/runtime/test/contract/module-declarations.v0.contract.test.ts
corepack pnpm@10.32.1 vitest run packages/runtime/test/contract/lifecycle.module-resources.v1.contract.test.ts
corepack pnpm@10.32.1 check:prototype-catalog
corepack pnpm@10.32.1 check:types
```

接下来阅读[契约与测试](/zh-cn/build/contracts-and-tests/)理解 evidence mapping，阅读 [Host Caps](/zh-cn/build/host-caps/)理解 host service，或在修改 translation code 前阅读 [Adapter 指南](/zh-cn/build/adapter-guide/)。
