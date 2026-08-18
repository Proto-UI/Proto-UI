---
title: 'Compiler 指南'
desp: '当前 Compiler 边界：0.2 已交付什么、catalog 已约束什么、哪些仍属未来工作'
description: '当前 Compiler 边界：0.2 已交付什么、catalog 已约束什么、哪些仍属未来工作'
---

Proto UI 0.2 **没有**交付 Compiler 实现或 Compiler authoring workflow。0.2 release 中不存在 `@proto.ui/compiler` package、compiler entity type、official compiler profile、CLI compile command 或受支持的 compiler input/output artifact。

本文的作用是避免把未来方向误解成已交付行为。它整理未来 Compiler 已经需要服从的边界，并把贡献者带回今天实际可用的 Runtime Adapter 路径。

## 前置阅读

先读[翻译层：Adapter / Compiler](/zh-cn/whitepaper/translation-layer/)理解概念差异，读[核心规范](/zh-cn/specifications/core/)理解 portable syntax，再读 [Runtime 架构](/zh-cn/build/runtime-architecture/)理解当前执行路径。

## 0.2 实际交付的内容

| 层 | 当前职责 |
| --- | --- |
| `@proto.ui/core` | Prototype definition、setup/render syntax、template structure、module declaration、Rule authoring type |
| `@proto.ui/runtime` | 物化 Prototype、运行 Module、拥有 lifecycle/update flow、把 commit 交给 host |
| 官方 Adapter | 为 Web Component、React 与 Vue profile 翻译 Runtime output 和 semantic host capability |
| `@proto.ui/cli` | 初始化项目并生成 theme、token、style 与 component preset material；它不是 Prototype compiler |

当前 production route 是：

```text
Prototype TypeScript → Runtime execution → official Adapter → Web host
```

可能的未来路径目前只是一项设计方向：

```text
portable analyzable input → [future Compiler] → host artifacts
```

0.2 不承诺第二条路径接受什么 source language、如何优化、生成哪些文件、是否包含 runtime 或采用什么 compatibility policy。

## 已经适用的约束

即使没有 Compiler package，已经编目的协议边界仍会约束任何未来 official translation：

- `K-PROTOTYPE-COMPOSITION-0001`：template 描述一个 Root Node，不嵌入另一个 Prototype definition。
- `C-TEMPLATE-0005`：v0 slot 是 anonymous、singular、parameterless。
- `C-TEMPLATE-0006`：official Adapter 或 Compiler 遇到 `PrototypeRef` template node 时必须拒绝，不能私自发明 composition。
- `C-RULE-0003`：Rule declaration 生成 serializable `RuleIR`，其中不保留 function、host reference、closure 或 live handle。
- `C-MODULE-DECLARATION-0001`：static typed Module declaration 在 Module construction 和潜在 host selection 之前可见。

这些是协议约束，不是 Compiler SPI；它们没有定义 parser、AST format、incremental build graph、code generator 或 deployment artifact。

## Static intent 与任意 function

有些作者形式比 callback 更能保留可分析 intent。Rule 是当前最清楚的例子：它把 condition 与 semantic intent 分开，并在内部编译为 `RuleIR` 供 Runtime evaluation。这不代表仓库已经有通用 Prototype compiler，也不意味着任意 callback body 都可以无损翻译。

当 declarative form 能准确表达行为时应优先使用，但不要围绕想象中的 Compiler 改写已经成立的 0.2 semantics。`internal/contracts/integration/portability-and-integration.md` 对长期方向有更多解释，但它属于 non-normative material。

## 当前没有受支持的 Compiler input/output

| 问题 | 0.2 回答 |
| --- | --- |
| `.proto.ts` 能否脱离 Runtime 编译？ | 没有受支持流程 |
| `TemplateChildren` 是稳定 compiler IR 吗？ | 不是；它是当前 Core/Runtime template data |
| `RuleIR` 是完整 Prototype IR 吗？ | 不是；它只覆盖 Rule |
| CLI 能否从 Prototype 生成 React/Vue/Custom Element component？ | 不能 |
| 是否支持 zero-runtime delivery？ | 不支持，仍属未来方向 |
| 是否有 Compiler conformance matrix？ | 没有 Compiler entity/profile |

如果未来 proposal 要改变这些回答，必须显式新增 catalog 与 API 工作，不能从文档推断。

## 贡献边界

Compiler proposal 应先作为 maintainer-guided research，并至少说明：

1. portable source subset，以及 unsupported construct 如何失败；
2. output host 与 generated artifact ownership；
3. 如何与现有 Contract criteria 保持 semantic parity；
4. lifecycle、capability 与 component composition 如何处理；
5. versioned identity 与 executable conformance model；
6. 如何迁移并与 Runtime/Adapter path 共存。

不要把 `packages/modules/rule/src/compile.ts`、CLI style generation 或 bundler transform 当成缺失的 Compiler architecture 并直接发起实现 PR；它们是由其他层拥有的局部实现。

## 验证当前边界

以下检查覆盖今天已经存在的 portable template 与 analyzable Rule 约束：

```sh
corepack pnpm@10.32.1 vitest run packages/core/test/contract/template.normalize.contract.test.ts
corepack pnpm@10.32.1 vitest run packages/adapters/web-component/test/contract/template.no-prototype-composition.v0.contract.test.ts
corepack pnpm@10.32.1 vitest run packages/runtime/test/contract/rule.props-style.smoke.v0.contract.test.ts
corepack pnpm@10.32.1 check:types
```

希望现在就能交付的工作，请继续阅读 [Runtime 架构](/zh-cn/build/runtime-architecture/)、[模块与扩展架构](/zh-cn/build/module-extension-architecture/)或边界明确的 [Adapter 指南](/zh-cn/build/adapter-guide/)；未来顺序见[里程碑](/zh-cn/project/roadmap/)。
