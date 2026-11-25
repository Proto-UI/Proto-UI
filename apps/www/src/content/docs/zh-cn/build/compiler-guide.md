---
title: 'Compiler 指南'
desp: '当前私有原生 AST 编译器与独立的 0.2 release 边界'
description: '当前私有原生 AST 编译器与独立的 0.2 release 边界'
---

Proto UI 0.2 **没有**交付 Compiler 实现或 Compiler authoring workflow。0.2 release 中不存在 `@proto.ui/compiler` package、compiler entity type、official compiler profile、CLI compile command 或受支持的 compiler input/output artifact。

Release support 与仓库实验分开。下文的私有实验不改变 0.2 package、catalog、CLI 或 official-support 边界。

## 前置阅读

先读[第五章：翻译层](/zh-cn/whitepaper/5-translation-layer/)理解概念差异，读[核心规范](/zh-cn/specifications/core/)理解 portable syntax，再读 [Runtime 架构](/zh-cn/build/runtime-architecture/)理解当前执行路径。

## 0.2 实际交付的内容

| 层 | 当前职责 |
| --- | --- |
| `@proto.ui/core` | Prototype definition、setup/render syntax、template structure、module declaration、Rule authoring type |
| `@proto.ui/runtime` | 物化 Prototype、运行 Module、拥有 lifecycle/update flow、把 commit 交给 host |
| 官方 Adapter | 为 Web Component、React 与 Vue profile 翻译 Runtime output 和 semantic host capability |
| `@proto.ui/cli` | 初始化项目并生成 theme、token、style 与 component preset material；它不是 Prototype compiler |

0.2 实际交付的 production route 是：

```text
Prototype TypeScript → Runtime execution → official Adapter → Web host
```

0.2 没有交付 Compiler 路径：

```text
portable analyzable input → [future Compiler] → host artifacts
```

0.2 不承诺第二条路径接受什么 source language、如何优化、生成哪些文件、是否包含 runtime 或采用什么 compatibility policy。

## 已经适用的约束

虽然 0.2 没有交付 Compiler package，已经编目的协议边界仍约束编译器实现：

- `K-PROTOTYPE-COMPOSITION-0001`：template 描述一个 Root Node，不嵌入另一个 Prototype definition。
- `C-TEMPLATE-0005`：v0 slot 是 anonymous、singular、parameterless。
- `C-TEMPLATE-0006`：official Adapter 或 Compiler 遇到 `PrototypeRef` template node 时必须拒绝，不能私自发明 composition。
- `C-RULE-0003`：Rule declaration 生成 serializable `RuleIR`，其中不保留 function、host reference、closure 或 live handle。
- `C-MODULE-DECLARATION-0001`：static typed Module declaration 在 Module construction 和潜在 host selection 之前可见。

这些是协议约束，不是 Compiler SPI；它们没有定义 parser、AST format、incremental build graph、code generator 或 deployment artifact。

## Static intent 与任意 function

有些作者形式比 callback 更能保留可分析 intent。Rule 把 condition 与 semantic intent 分开，并在内部编译为 `RuleIR` 供 Runtime evaluation。这一表示本身不是完整的 Prototype 编译器。下文的私有 AST 编译器显式分析 callback 控制流，对不能保真的作者形式给出诊断。

当 declarative form 能准确表达行为时应优先使用，但不要围绕想象中的 Compiler 改写已经成立的 0.2 semantics。`internal/contracts/integration/portability-and-integration.md` 对长期方向有更多解释，但它属于 non-normative material。

## 0.2 没有受支持的 Compiler input/output

| 问题 | 0.2 回答 |
| --- | --- |
| `.proto.ts` 能否脱离 Runtime 编译？ | 没有受支持流程 |
| `TemplateChildren` 是稳定 compiler IR 吗？ | 不是；它是当前 Core/Runtime template data |
| `RuleIR` 是完整 Prototype IR 吗？ | 不是；它只覆盖 Rule |
| CLI 能否从 Prototype 生成 React/Vue/Custom Element component？ | 不能 |
| 是否支持 zero-runtime delivery？ | 不支持，仍属未来方向 |
| 是否有 Compiler conformance matrix？ | 没有 Compiler entity/profile |

如果未来 proposal 要改变这些回答，必须显式新增 catalog 与 API 工作，不能从文档推断。

## 仓库内的私有 AST 编译器

私有仓库包采用 TypeScript binding/type 前端、语义 HIR、显式目标准入和原生目标构建器。React 产物由 TypeScript AST 节点构造；GPUI 产物由 Rust syntax 节点构造；LLVM 内核使用原生 LLVM IRBuilder。无法降低的操作必须给出诊断，不会回退到导入原始 Prototype、调用 Proto Runtime 或 Adapter 的包装路径。

这些是 draft 实现工作，不是 0.2 release 保证。方向及验收义务见 `D-COMPILER-ARCH-0001`、`C-COMPILER-PIPELINE-0001`、`T-COMPILER-PIPELINE-0001`。`packages/compiler/README.md` 与 `internal/compiler/v2-compilation-spec.md` 记录源码和证据边界。

### 目标与实际覆盖

| 目标 | 产物和边界 |
| --- | --- |
| `react` | 通过 TypeScript factory/printer 生成普通 React component source，只发射已准入的 authored 操作。 |
| `gpui` | 通过 `syn`、`prettyplease` 生成包含原生 GPUI component 的 Rust crate。生成需要 Cargo，执行需要兼容的 GPUI host。 |
| `kernel` | 使用 LLVM 原生对象 API 构造的 scalar kernel；它不是完整 UI component 或 GPUI backend。 |
| `ir` | 包含未降低操作的语义分析结果；分析不计为原生发射。 |
| Vue3、Vue2、Web Components、Qt、Flutter、SSR | 保留原有实现及消费者验收义务。旧 profile 名称不能调用隐藏的旧 backend。 |

首个绑定源码的 AST 交付 `59c18246275c9a5ed0ad313c6da2627956930597` 分析了 184 个 Base 文件，其中有 212 个 prototype declaration、214 个 authored Hook。该快照的 React 与 GPUI 原生发射均为 **0/212**；各自另有 212 个 unsupported declaration、5 个 hook-only 文件、0 个已执行 prototype。历史报告保留在 `packages/compiler/evidence/ast-pipeline-20261125/`，后续能力必须由新报告证明。

当前继续实现后的两条目标均为 **2/212**，通过通用语义降低编译未改写的 `base-text-root` 与 `base-surface-root`。184 个文件仍全部分析：210 个 prototype declaration 尚不支持，文件结果是 177 个 unsupported、5 个 Hook-only、2 个 emitted，source error 为 0。库存中的 `executionVerifiedPrototypes` 仍为 0；独立的 React 与 GPUI 测试实际执行这些 Base 源码，但不代表完整 Base/family 或整应用迁移已完成。当前摘要保留在 `packages/compiler/evidence/legacy-cleanup-20261125/base-inventory-summary.json`。

存在 emitter、孤立 fixture 成功、完整 authored 库库存和真实应用迁移，是不同结论。库存保留 unsupported、source-error、hook-analysis 行，不把 wrapper、IR dump 或声明数量算成已执行的原生组件。

### 浏览器与网站边界

网站库存保留 authored registration/source graph 及每一个历史拒绝的 demo。当前 React 源码准入与尚未完成的历史 Web Components 验收分别记录。Node 编译不证明 Worker 执行、iframe preview、物理输入、清理、像素或 accessibility 验收。

浏览器交付有独立的源码绑定回执。React AST Worker 不能复用旧 QuickJS/WASM 回执；GPUI、LLVM 的原生工具链需求必须明确报告。既有 demo 和 frame 的所有权约定继续适用。

### 本地编译和检查

使用仓库声明的 Node 24、pnpm 工具链，从仓库根目录运行：

```sh
node --import tsx scripts/compiler/pinned-cli-entry.ts info
node --import tsx scripts/compiler/pinned-cli-entry.ts check packages/prototypes/base/src/button/button.proto.ts --target react --json
node --import tsx scripts/compiler/pinned-cli-entry.ts inventory packages/prototypes/base/src --target react --json
node --import tsx scripts/compiler/pinned-cli-entry.ts compile path/to/entry.proto.ts --target react --out .cache/generated --json
```

合法 Prototype 如果包含尚未降低的操作，`check` 可以返回拒绝诊断。应保留 authored 行为，不能为获得成功而修改原型、遗漏操作或选择 Runtime wrapper。

Rust component 选择 `--target gpui`；内核选择 `--target kernel`；查看 HIR 使用 `ir`。生成文件默认不能被意外覆盖，`--overwrite` 才表示明确替换；compiler input 和 symlink destination 仍受保护。历史 `--profile`、`diff`、`watch` 接口不可用，其未完成的所有权及消费者验收保留在清理清单中。

### 构建和消费精确源码 pin

固定产物要求干净工作树和完整 commit SHA：

```sh
node --import tsx scripts/compiler/build-pinned.ts --revision "$(git rev-parse HEAD)" --output /absolute/fresh-compiler-package
npm --prefix /absolute/fresh-compiler-package ci --ignore-scripts
node /absolute/fresh-compiler-package/cli.js --build-info
node scripts/compiler/pinned-ast-smoke.mjs --compiler /absolute/fresh-compiler-package/index.js --llvm --gpui
NATIVE_CONSUMER_COMPILER=/absolute/fresh-compiler-package/index.js node scripts/compiler/pinned-cli-smoke.mjs
```

包内包含当前 API/CLI 和绑定源码的 native builder assets。Metadata 使用 `proto-ui.compiler-package.v3`，身份读取 `compiler-build.json` 或 `--build-info`。已移除的 `compilerBuildIdentity`、`TARGET_PROFILES`、`compilationArtifacts` 和 runtime-profile API 不会作为兼容 shim 重新出现。

当前 React consumer 检查生成代码的 strict TypeScript、props/state/update 行为、实例隔离、样式、listener 清理及产物可编辑性：

```sh
node --import tsx scripts/compiler/native-consumer-smoke.mjs
```

针对实际应用，可用固定产物检查未修改的 authored 输入：

```sh
node scripts/compiler/consumer-project-inventory.mjs --compiler /absolute/fresh-compiler-package/index.js --consumer-root /absolute/shenko --name Shenko --target react --out /absolute/fresh-shenko-inventory.json
```

该命令不重写应用。报告明确保留 `applicationMigrationVerified: false` 和 0 个执行声明。Shenko 的 Web 消费与 Verdant 的 GPUI 消费分别需要实际应用验收；使用 Verdant GPUI fork 运行 harness，不等于迁移了 Verdant 应用。

### 旧实现清理与保留义务

旧 Runtime/source-template 生成器及失效执行 harness 已从维护入口移除，完整源码保留在 Git 历史。`internal/compiler/legacy-cleanup.md` 将独立断言映射到当前测试，并保留完整 family 行为、context/expose 所有权、缺失 backend、浏览器/原生验收、watch/diff、生产成本证据等尚未完成的义务。

Frozen-foundation 工具只核对哈希、比较定义身份，或将认证过的源码字节恢复到新目录。它们不会安装或调用旧编译器，也不是当前构建的依赖。

## 贡献与验证边界

编译器和 Prototype 必须独立实现共享定义，保留 lifecycle、state、props、event、template、slot、host 所有权规则。TypeScript 类型检查不承担 Proto effect/phase 分析，LLVM 不能取代 UI 所有权或目标准入。

运行编译器 strict 类型检查、相关目标/消费者测试及仓库文档检查。报告精确源码、生成产物、实际执行目标和剩余义务。文档或库存计数门禁通过，不证明应用完成验收。
