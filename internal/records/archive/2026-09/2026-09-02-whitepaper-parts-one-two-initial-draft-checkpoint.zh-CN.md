# 白皮书第一、二部初稿协作检查点

日期：2026-09-02

本文记录 Issue #473 白皮书重写企划的中文初稿进展：第一部 I-1 至 I-3 与第二部 II-4 至 II-6 已经各形成一份可供维护者继续修改的协作初稿。

这些稿件不是 canonical 白皮书正文、Spec 实体、稳定保证或公共发布候选。它们保存的是本轮讨论已经走通的论证、例子和编辑选择，接下来仍会由维护者集中重写、重新打字、调整措辞并补充插图。

## 蓝图依赖与已整合状态

本检查点最初以 PR #572 的 blueprint-only 分支为前置依赖。创建本检查点时引用的 base head 是 `345eaa5d6052f91466bf9f3d0ef2c4d63d0534d0`；该历史事实保持不变。

PR #572 后续已完成独立审查并于 2026-09-02 合入 `main`，整合提交为 `837677e857edb5e457ca9fa6915e066782d7eef6`。本检查点中的六章初稿按该已整合蓝图组织，具体采用了：

- “序章 + 三部七章 + 结语”的当前结构；
- 第一部的交互主体、information channel 与 Component/Prototype 边界主线；
- 第二部第四至第六章的职责和篇幅关系；
- 第七章与结语的后续收束方式；
- Switch 贯穿、Select 与 Scroll Area 定点扩展的例子权重；
- 证据成熟度、negative boundary、章节 bridge 与非 Web 证据边界。

此处引用的 [PR #572 authoring decision](https://github.com/Proto-UI/Proto-UI/pull/572#issuecomment-5506059799) 仍只是作者在起草阶段记录的写作约束，不是 maintainer acceptance；蓝图已经整合这一事实以 PR 的独立审查与合并记录为准。

因此本 PR 只归档与已整合蓝图对照的协作初稿，不改变蓝图，也不把初稿中的表达自动升级成新的项目语义。当前 PR 已 retarget 到 `main`，整合前置条件已满足；后续审查应针对 main-based 精确差异和当前 head。

## 当前初稿

| 章节 | 当前推进 | 文件 |
| --- | --- | --- |
| I-1 代码之前的组件 | 从跨技术“还原同一组件”的经验进入交互主体与可执行近似 | `2026-08-30-whitepaper-part-one-chapter-1-initial-draft.zh-CN.md` |
| I-2 从交互关系出发 | 从 User、Maker、Other Component 与方向性关系推导 information channel | `2026-08-30-whitepaper-part-one-chapter-2-initial-draft.zh-CN.md` |
| I-3 组件的边界 | 用独立参与者关系和 feedback-only 例外判断 Prototype 边界 | `2026-08-30-whitepaper-part-one-chapter-3-initial-draft.zh-CN.md` |
| II-4 通路之外的语义 | 用 State、Anatomy、Lifecycle 与 Switch 伪代码使 Prototype 接近可执行 | `2026-09-02-whitepaper-part-two-chapter-4-initial-draft.zh-CN.md` |
| II-5 翻译层 | 解释 Host artifact、Module / Host Capability、翻译形式、结果与证据 | `2026-09-02-whitepaper-part-two-chapter-5-initial-draft.zh-CN.md` |
| II-6 一致性的边界 | 说明 Prototype 先决定不变量，realization context 再决定比较强度 | `2026-09-02-whitepaper-part-two-chapter-6-initial-draft.zh-CN.md` |

第二部三章当前按照 #572 的待审职责边界组织：

- II-4 只把 information channel 补成接近可执行的 Prototype，不展开 Rule、`asHook`、Focus、Accessibility 或具体句柄 API；
- II-5 同时承担 Host artifact、Module / Host Capability、Adapter / Compiler / hybrid、faithful / degradation / unsupported 和 evidence state，避免把翻译工程简化成语法转换；
- II-6 不重复第五章，而把一致性写成 Prototype/profile 决定不变量、共享 realization conditions 决定比较严格程度的两层判断。

## 写作来源与 AI 协助

维护者提供了核心经验、理论仲裁、原始草稿、例子修正、章节节奏判断和最终写作责任。Codex 在本轮工作中提供了独立对照稿、来源与生命周期核对、反驳、结构复盘、伪代码补全、融合编辑和措辞备选。

这些文件中的“融合初稿”不是最终人类署名正文。维护者计划在整份中文初稿完成后集中打磨：以人工草稿和旧白皮书为材料，参考 AI 编辑建议，再亲自重新输入和改写文字，并为论证配置插图。最终文本是否保留任何当前句子，仍由维护者逐项决定。

PR #550 中 `cyjin-yl` 完成的旧页面 claim inventory、阅读顺序、术语与 locale 漂移、source mapping 等中性审计成果继续作为有归属的研究来源；其旧稿和已经被 WPD-01 至 WPD-10 取代的编辑方向没有成为这些初稿的自动写作基线。

## 证据与语义边界

初稿沿用蓝图中的成熟度区分：

- `spec/**` 中的 applicable entity 仍按各自 `active`、`draft`、`deprecated` 或 `removed` lifecycle 解释；
- `D-ADAPTER-PROFILE-0001` 与当前官方 `A-*` profile 只能证明已编目的 Web-family 局部范围；
- Qt、Flutter、TUI、完整跨媒介 Select、Compiler 产品和像素级跨 Host 比较仍是 thought experiment、未来方向或治理缺口；
- 初稿中的伪代码用于论证已经接近可执行，不是稳定 Core API、完整官方 Switch source 或新的兼容承诺；
- 发现白皮书、Spec 与实践不一致时，必须另行对账，不能让任一份初稿静默覆盖另一层。

本检查点也不处理起草期间发现的后续治理事项，例如 accessibility authoring capability 是否应从当前 `def` 顶层边界重构。此类工作需要独立 Issue、authority trace、语义决定和可执行证据。

## 尚未完成

当前还没有形成：

- 序章；
- 第三部 III-7《在边界中逼近》；
- 结语；
- 全文集中人工重写、去重和统一语气；
- 最终插图、版式和公共页面划分；
- 英文 conceptual-parity 版本；
- 公共白皮书替换、迁移、发布或独立出版安排。

后续写作协作可以继续参考 #572 的待审蓝图起草 III-7，再回写序章与结语，但不能把这种写作使用表述成仓库接受。完整中文初稿形成后，维护者才进入集中人工打磨；公共投影、英文版本、插图和 publication 仍分别接受后续审阅。

## 明确不授权

本文与六份初稿不授权修改或覆盖 `spec/**`、实现、测试、旧白皮书页面、导航、英文页面、Issue 状态、发布状态或路线图；也不授权把 AI 协作初稿直接作为最终白皮书发布。
