---
title: '如何参与贡献'
description: '按贡献就绪度选择工作，并从本地开发走到可审阅的 Proto UI PR。'
---

Proto UI 不会通过降低协议和工程标准来制造大量简单任务。我们更希望把已经确定的边界说清楚，让第一次参与、熟练实现和核心设计三种贡献都能找到合适入口。

完整的环境、DCO、来源披露、验证和 PR 流程以仓库 [CONTRIBUTING.md](https://github.com/Proto-UI/Proto-UI/blob/main/CONTRIBUTING.md) 为准。本页帮助你选择路径。

## 先看贡献是否已经就绪

贡献难度和贡献就绪度是两件事：一个改动的语义可以已经确定，但交付面仍然很大；一个代码改动也可能很小，却仍依赖尚未完成的架构决定。

### Starter

F1–F2、预期结果固定、几乎不需要 Proto UI 领域判断的任务，例如：

- 修复现有文档、Demo、窄屏或暗色模式问题；
- 为已有行为补一个明确的回归测试；
- 修复缺失的可访问性名称或预览入口；
- 补充已有页面的中文或英文表达。

真正适合第一次 PR 的工作会标记为 [`good first issue`](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22)。这个列表暂时为空时，不代表项目不接受贡献。

### Contributor-ready

语义边界已经决定，但实现可能仍是 F3–F5。熟悉组件库、设计系统或框架的贡献者可以查看 [`help wanted`](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22help+wanted%22)，并确认 Issue 正文明确写出了：

- 已经决定的内容；
- 贡献者可以决定的内容；
- 不得在实现中改变的边界；
- 是否已经允许开始实现；
- 需要运行的验证。

`help wanted` 不会覆盖 `needs maintainer design`。如果两者同时出现，应先等待 maintainer checkpoint。

### Maintainer-guided

新的 Base subject、Prototype admission、协议所有权和跨层架构工作需要先做 assessment 或 proposal。没有记录 maintainer checkpoint 时，不应直接提交实现 PR。

## Spec 实体优先

开始改动前，先找到适用的 `P-*` 实体，并阅读它的 lifecycle、criteria、relations、sources 和 `T-*` evidence。

权威顺序是：

```text
applicable spec entity
→ internal contract for an uncataloged gap or explanation
→ relevant dated record for current context
→ implementation and tests as evidence
→ README and website as reader projections
```

如果实现、测试或文档与适用实体不一致，应把它当成 drift 调查，不要把当前代码默认为新的真相源。实体编写规则见 [spec catalog guide](https://github.com/Proto-UI/Proto-UI/blob/main/spec/README.md)。

## 当前开放的 Prototype 路径

Proto UI 的 `P-*` 编目已经可以支撑完整的 Prototype 贡献路径。

### 维护已有 Prototype

适合修复已有行为、补回归测试、完善文档与 Demo，或解决 P/T、实现、导出和公开页面之间的 drift。

[阅读维护已有 Prototype 指南](/zh-cn/build/prototypes/maintaining-an-existing-prototype/)

### 从 Base 投射风格化 Prototype

适合在已有 Base 协议上增加设计语言 props、token、rule 和视觉 anatomy。贡献者不得重新定义 Base 已经拥有的 value、event、focus、accessibility 或 host-capability 语义。新增公开 Prototype 必须同时进入官网可访问页面，供维护者通过真实 package export 交互预览。

[阅读风格化投射指南](/zh-cn/build/prototypes/projecting-base-into-a-design-language/)

### 实现已批准的 Base semantic slice

适合高级贡献者。独立主体、信息通路、负向边界、公共 API、P/T 图和验证范围必须先经过 maintainer checkpoint。完整 slice 包括官网页面与适用的 Web Component、React、Vue 预览，不能只交付源码和测试。

[阅读已批准 Base slice 实现指南](/zh-cn/build/prototypes/implementing-an-approved-base-slice/)

### 提出新的 Base subject

熟悉的组件名、目录名或风格库需求都不能单独证明一个 Base Prototype。Proposal 必须证明它是独立、跨宿主、可测试的协议主体，并拥有从 input fact 到 observable output 的信息通路。

[使用 Prototype Proposal 模板](https://github.com/Proto-UI/Proto-UI/issues/new?template=prototype-proposal.md)

## 官网预览是 Prototype 交付的一部分

每个新增公开 Prototype identity 或 anatomy family 都必须在同一 PR 中进入官网可访问页面，并使用真实 public package export 提供适用的 Web Component、React、Vue 预览。PR 需要附上维护者可以直接打开的本地路由；内部 Demo Matrix 不能替代这个页面。

Demo 应尽量拟合 package 安装后的直接使用方式。自治 Prototype 应通过自己的 anatomy、trigger、state、event 和默认行为工作，不应依赖页面层为了让演示成立而额外增加的 owner 或 callback。只有没有自然 trigger，或公开 controls 本身就是演示对象时，才允许最小外部控制；例外必须只使用 public API，并说明哪些 orchestration 不会随 package 安装、需要消费者自行实现。

## Adapter 路径暂不发布

Module、Host Capability 和官方 Adapter profile 的编目仍在推进，相关架构和已知 drift 也还没有全部收口。因此当前不发布通用 Adapter 贡献指南，也不建议通过模仿现有实现来新增 Adapter。

边界已经确认的 Adapter parity bug 仍可能开放给有经验的贡献者，但 Issue 必须明确适用实体、所有权层、预期行为和验证范围。新的 Adapter 仍属于 maintainer-guided research。

## 从本地到 PR

当前 CI 基线是 Node.js 22，并使用 pnpm 10.32.1：

```sh
corepack enable
corepack pnpm@10.32.1 install --frozen-lockfile
corepack pnpm@10.32.1 docs:dev
```

基本流程：

1. 在 Issue 下说明准备参与，并确认 readiness。
2. 从最新 `main` 创建短期分支。
3. 先追踪 P/T 实体和实现证据，再开始修改。
4. 保持 source of truth、实现、测试和受影响的公开投影一致。
5. 先运行 focused test，再按改动运行 catalog、types、docs 或完整测试。
6. 使用 `git commit --signoff` 提交。
7. 在 PR 中写明精确验证命令、来源和 AI 辅助范围。

详细命令、DCO 修复方式、第三方来源要求和验证矩阵见 [CONTRIBUTING.md](https://github.com/Proto-UI/Proto-UI/blob/main/CONTRIBUTING.md)。

## 沟通

- [GitHub Issues](https://github.com/Proto-UI/Proto-UI/issues) 用于已经可以追踪的工作。
- [GitHub Discussions](https://github.com/Proto-UI/Proto-UI/discussions) 用于尚未形成明确 Issue 的问题和想法。
- [Discord](https://discord.gg/MrWQd7h34R) 可用于快速同步，但不是参与贡献的前提。影响实现边界的结论应回写到 Issue、Discussion、Spec 或 PR。
