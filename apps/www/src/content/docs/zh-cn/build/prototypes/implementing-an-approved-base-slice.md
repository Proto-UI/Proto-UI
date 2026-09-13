---
title: '实现受治理的 Base Semantic Slice'
description: '把受治理或明确标记为 draft 的 Base P/T 边界实现成最小、完整、可验证的垂直切片。'
---

实现 Base Prototype 通常是高级贡献。已有受治理 subject 从当前协议图直接继续。真正全新的 subject 可以在准入前积累 research、candidate graph、draft entity、实现探针和 executable evidence；唯一未决语义决定是 Proto UI 是否把这个独立 subject 准入为 Base identity。

## Admission 与受治理方向

在把真正全新的 Base identity 表述为已受治理前，应记录“这个独立 protocol subject 是否进入 Base”的 admission 决定。下面这些内容可以也应该随着证据演进，在该决定前后由 candidate 工作持续明确：

- 独立协议主体及 Base admission 结论；
- input facts、owner、observable outputs 和同步规则；
- negative boundary；
- Root/Part/anatomy identity；
- exact props、states、events、methods 和 absence assertions；
- P entity、T entity 和 executable evidence 计划；
- 必要的 Module、Host Capability 与跨 Adapter 验证范围；
- 本 slice 不包含的后续风格化投射和组合能力。

目录名、草稿代码、讨论共识或“参考某个组件库”本身都不是 Base-admission 证据。未决 admission 标记会让 identity 保持 candidate/draft，但不会阻止 research、graph authoring、实现探针或测试。Identity 一旦进入治理，implementation 与 projection 默认继续并接受独立 review。

## Base admission 自检

受治理或候选 slice 应证明：

1. **Independent subject**：不是为了风格库继承或 package 对称而存在。
2. **Explicit information path**：每条核心保证都有 input fact、owner、output 和规则。
3. **Cross-host stability**：协议意义不依赖 React、Vue 或 DOM 技巧。
4. **Distinct responsibility**：现有 Base 或组合不能无损表达。
5. **Negative boundary**：明确不拥有的视觉、业务、focus、layout、form 或 announcement 责任。
6. **Executable evidence**：每个保留 criterion 都能映射到 substantive T case 和真实测试。

如果实现过程中发现其中一项无法成立，应修改 candidate/governed graph 并记录证据，不要用空 `asHook`、host escape hatch 或特殊分支把代码勉强跑通。只有证据改变 Base-identity admission 结论时才升级。

## 实现工作流

### 1. 把 criteria 转成实施清单

为每个 P criterion 列出：

- owner；
- 允许的输入；
- observable output；
- controlled/uncontrolled 或 lifecycle 规则；
- negative assertion；
- T case；
- implementation path；
- 需要验证的 Adapter/host profile。

这张映射是 PR 评审的主线，不要按文件数量组织完成度。

### 2. 先实现最小 owner

- state 只由已声明的 owner 持有；
- Part 通过 context、relationship 或已有共享能力消费 owner；
- 不把风格库 variant、宿主 raw object 或未来组合能力引入 Base；
- direct prototype 和 authored `asHook` 描述同一协议时，应共享实现而不是分叉；
- setup、runtime、view epoch 和 terminal disposal 遵守现有 lifecycle 边界。

### 3. 建立 P/T 和 focused tests

- P criteria 必须可单独引用；
- T cases 通过 anchors 指向具体 criteria；
- executable tests 验证结果和 absence；
- controlled 请求不得静默修改 final state；
- disabled、empty、duplicate、structural churn、teardown 等已声明边界都有覆盖；
- 三个 Web Adapter 的测试只证明一个 Web host profile，不要夸大为多宿主 conformance。

### 4. 完成 package 与消费面

每个新增公开 Base identity 或 anatomy family 都必须在同一 PR 中进入官网可访问页面；governing criteria 与 evidence 决定页面展示哪些状态，预览面始终属于交付范围。PR 必须记录本地预览路由。

完整消费面包括：

- family source、shared types 和 public subpath；
- exact root exports；
- CLI registry 与 facade generation；
- Base docs、API notes 和真实 Demo；
- Web Component、React、Vue preview；
- spec workspace 和 Agent projection。

后续 Shadcn、Brutalist 或其他设计语言投射应作为独立贡献，不要和 Base semantic slice 混在一起。

#### 官网 Demo 应验证真实消费方式

Demo 应从公开 package subpath 消费 Base，并优先通过 Base 自己的 anatomy、trigger、state、event 和 defaults 完成可见交互。它不能依赖不会随 package 安装的页面控制逻辑来伪装自治能力。

例如，Dialog Demo 应使用 `dialog-trigger` 请求 Root open；用无关 Button callback 调用 Dialog expose 会绕开已经编目的 anatomy 信息通路。只有 Base 按设计没有自然 trigger，或公开 controls 本身就是被演示的协议时，才允许最小外部 orchestration，例如 Toast-style invocation 或直接驱动 Transition。

任何例外都必须位于 Prototype 外、只使用公开 API，并在 Demo source 与 PR 中明确说明必要性和消费者需要自行实现的部分。它不得掩盖缺失 anatomy、owner 错位、未编目能力或 Adapter drift。内部 Demo Matrix 只能补充三 Adapter 证据，不能替代官网页面。

### 5. 让设计断口继续进入实现循环

下面情况都作为下一轮 graph、implementation、evidence 与 fresh review 的输入：

- criterion 无法对应唯一 owner；
- 需要当前 graph 尚未列出的公开 API；
- 现有 Module/Host Capability 无法承接必须行为；
- 三 Adapter 暴露出不同协议语义；
- 需要宿主 raw event、target 或对象 escape hatch；
- 负向边界使预期行为无法成立；
- 现有实体之间出现真实矛盾。

同步更新 exact criterion、实现证据和备选方案，不要只在源码或 PR 中静默扩大 scope。唯一需要升级的语义决定是是否准入一个真正全新的独立 Base identity，或新证据已经推翻先前 admission 结论；未决期间让该 identity 保持 draft，其余可逆 remediation 继续接受独立 review。

## PR 组织建议

一个可评审的 Base slice 应让 reviewer 能按下面顺序阅读：

```text
governed identity or candidate draft
→ P criteria and relations
→ T cases and executable paths
→ owner implementation
→ focused Base tests
→ required Adapter evidence
→ exports, CLI, docs, and demo
```

如果整个 slice 太大，可以使用 stacked/draft PR 辅助评审，但不能把会造成已知规范 drift 的半个公共保证单独合并。每个真正合并的部分必须独立一致且有价值。

## 验证

先运行 Issue 指定的 focused tests，然后至少运行：

```sh
corepack pnpm@10.32.1 check:prototype-catalog
corepack pnpm@10.32.1 workspace:generate
corepack pnpm@10.32.1 check:agent-doc
corepack pnpm@10.32.1 check:types
corepack pnpm@10.32.1 test
corepack pnpm@10.32.1 docs:build
```

如果修改 public package graph，还要运行 package manifests、build、budget 和相应 consumer smoke。PR 必须记录哪些命令实际执行、哪些不适用，以及所有剩余不确定性。

## 提交前最后确认

- 公共 API 变化明确进入 governed/candidate graph，而不是通过实现类比暗中引入；
- 没有为风格库需求制造空 Base identity；
- 没有把单一 Web Adapter 事实写成跨宿主语义；
- P criteria、T evidence、实现和公开投影一致；
- 后续 styled projection 和组合能力可以作为独立 coherent contribution 继续；
- DCO、来源和 AI 辅助披露已经完成。
