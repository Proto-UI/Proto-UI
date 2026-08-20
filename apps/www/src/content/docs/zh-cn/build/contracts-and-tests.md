---
title: '契约与测试'
desp: 'Proto UI 如何跨层把规范 criteria 连接到可执行证据'
description: 'Proto UI 如何跨层把规范 criteria 连接到可执行证据'
---

Proto UI 的测试不是一个没有分层的单一 gate。有效贡献需要在拥有该 claim 的层证明它，并记录证据如何连接到 catalog。通过的 Adapter test 不能暗中修改 Contract，Runtime fake host 也不能证明 browser behavior。

## 前置阅读与权威顺序

修改规范行为前先读[规范导读](/zh-cn/specifications/introduction/)和仓库 `spec/README.md`。权威顺序是：

```text
applicable spec entity
→ internal contract only for an uncataloged gap or explanation
→ relevant dated record for short-term context
→ implementation and tests as evidence
→ website/README as reader projection
```

原有 `internal/contracts/**` 仍可以补充信息，但只有在没有实体编目的空白中才能作为 transitional fallback，并必须明确标注；它不能覆盖适用 entity。

## Evidence graph

`T-*` entity 让 acceptance criteria 可执行且可追踪：

```text
C-* criterion / D-* choice / P-* protocol
                 │ covers + verifies
                 ▼
              T-* case
                 │ consumesCases
                 ▼
fixture / type test / module test / runtime test / adapter test / journey
```

`T-*` 记录 case、expected outcome、implementation path、required status 与 typed relation。Path 是证据，relation 则说明证据证明什么。测试也可以 `exercise` 一个表面，而不声称完整 normative verification。

例如 `T-LIFECYCLE-0003` 把 epoch-aware lifecycle criteria 映射到 Runtime session/checkpoint test，以及 Web Component、React、Vue 的 lifecycle-event test。Runtime fixture 证明 ordering 与 stale-epoch rejection；Adapter fixture 证明各 framework 会投射 structured trace。

## 测试层级

| 层 | 典型位置 | 能证明什么 |
| --- | --- | --- |
| Shared spec fixture | `packages/spec/fixtures/**` | 可复用 case data 与 criterion mapping |
| Schema/graph | `packages/spec/{schema,engine,graph}/test/**` | Entity validity、relation type、graph projection |
| Type contract | `internal/contracts/types/**` | Public TypeScript shape 与 inference |
| Core contract | `packages/core/test/contract/**` | Portable definition/template/token syntax |
| Module contract | `packages/modules/*/test/**` | 受控 dependency/cap 下的 semantic Module behavior |
| Runtime contract | `packages/runtime/test/contract/**` | Phase guard、lifecycle、orchestration、fake-host handoff |
| Adapter contract | `packages/adapters/*/test/**` | Framework/DOM translation、lifecycle ownership、target wiring |
| Prototype test | `packages/prototypes/*/test/**` | Official Prototype protocol 与 integration behavior |
| Web journey | `packages/web-conformance/test/**` | 同一 scenario 在全部 official Web Adapter 上的表现 |
| Public docs/build | `apps/www` check 与 browser audit | Reachability、rendering、example、reader projection |

应先使用能直接观察规则的最低层，再只为跨边界 claim 增加 integration evidence。在所有 Adapter 中复制相同 assertion，不能替代 shared Contract fixture 与 focused translation check。

## 为改动选择 coverage

### Contract 或 Core syntax

更新适用 `C-*` criteria、`T-*` mapping、需要时的 shared fixture、Core/Runtime implementation 与 executable test。Semantic revision 还可能需要带 version 的 `revisions` entry。

### Module 或 Host Capability

追踪 `C-* → M-* → HC-* → T-*`。先在 Module/Runtime 中用 fake capability 证明 host-neutral semantics，再在每个适用 Adapter profile 中证明真实 host realization。不能只因 package dependency 存在就增加 `A-* provides` relation。

### Adapter translation

从准确的 `A-*` profile 与 reviewed `supports`、`omits`、`provides` relation 出发，保持 portable Contract，再增加 profile-specific evidence。如果 Module 同时不在 support 与 omission 中，应记录 uncataloged，不能在 test name 中发明 matrix status。

### Prototype behavior

从 `P-*` criteria 追踪到 `T-*`、implementation、public export 与 website preview。Compound protocol 通常需要 Base test，再加适用 Adapter 或 browser journey。

### 仅文档

验证每个 entity/path，运行 website check/build，并检查两种语言。文档可能揭示 drift，但不应为了匹配 prose 而修改 entity。

## 贡献流程

1. 按 entity ID、criterion ID、relation 与 source path 搜索，不要只按 filename。
2. 在把声明当作稳定保证前，先读 lifecycle status 与 version bound。
3. 用 owning layer 的最小测试重现 gap。
4. 在 scope 允许时，同时更新 source of truth、implementation、executable evidence 与 public projection。
5. 先跑 focused test，检查 failure text 是否清楚指出 criterion 与 owner。
6. 再运行成比例的 catalog、type、docs 与 full check。
7. PR 中列出精确命令，并区分本次真正执行的 evidence 与从 `T-*` entity 读取的 status。

生成的 Agent project understanding 会明确提醒：entity 中的 `passing` 是记录的 metadata，并不表示生成文档时重新执行了测试。

## Focused 与 full command

```sh
# 单个 implementation 或 contract slice
corepack pnpm@10.32.1 vitest run packages/runtime/test/contract/lifecycle.session.v1.contract.test.ts

# 全部 official Web Adapter 的 shared journey
corepack pnpm@10.32.1 test:web-conformance

# Catalog 与生成的项目理解
corepack pnpm@10.32.1 check:prototype-catalog
corepack pnpm@10.32.1 spec:docs:agent
corepack pnpm@10.32.1 check:agent-doc

# Public type/docs，再到完整仓库 gate
corepack pnpm@10.32.1 check:types
corepack pnpm@10.32.1 test
```

使用 Node.js 22，并通过 Corepack 使用仓库固定的 pnpm 10.32.1。`test` 还会运行 release-version/assets、generated style/preset、type contract 与 Vitest suite，范围大于单个 semantic slice。

## 常见证据错误

- Current output snapshot 只证明捕获层的行为，不会定义 semantics。
- Filename 中出现 “contract”，不代表它已经连接到 `C-*`；必须检查 `T-*` relation。
- Fake host 不能证明真实 Adapter timing 或 browser API。
- 只有一个 Web framework 通过，不等于 cross-Adapter parity。
- 为匹配新行为而删除旧失败 case 会改写历史；应显式修订 entity 与 migration。
- 手工修改 generated projection 会制造 drift；应修改 entity 或 generator。
- 只运行 full suite 会让 ownership failure 更难诊断；PR 中应保留 focused command。

接下来阅读 [Runtime 架构](/zh-cn/build/runtime-architecture/)、[模块与扩展架构](/zh-cn/build/module-extension-architecture/)，或前往[参与贡献](/zh-cn/build/contribute/)查看交付流程。
