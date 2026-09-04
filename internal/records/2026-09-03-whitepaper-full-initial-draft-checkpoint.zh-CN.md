# 白皮书完整协作初稿检查点

日期：2026-09-03

本文记录 [Issue #473](https://github.com/Proto-UI/Proto-UI/issues/473) 白皮书重写企划的一个阶段性结果：序章、七章主论证与结语都已经形成可供维护者继续修改的中文协作初稿。至此，本轮“从空白重新起稿并走通完整论证”的协作初稿阶段已经完成。

这些稿件不是 canonical 白皮书正文、Spec 实体、稳定保证或公共发布候选。它们保存的是维护者与 AI 协作期间已经走通的论证、例子、边界和编辑选择；维护者仍将集中重新输入、改写、去重、统一口吻，并亲自完成插图和最终仲裁。

## 完整初稿索引

当前采用 `1–4 / 5–6 / 7` 的三部结构：第一部讨论“原型”，第二部讨论“翻译”，第三部讨论“演进”；序章与结语不计入七章编号。

| 部分 | 章节 | 当前推进 | 初稿记录 |
| --- | --- | --- | --- |
| 序章 | 我们还要发明多少遍 Button？ | 从跨技术反复建设相似交互责任进入有边界、可检验的经验假设 | [`2026-09-03-whitepaper-prologue-initial-draft.zh-CN.md`](./2026-09-03-whitepaper-prologue-initial-draft.zh-CN.md) |
| 第一部 · 原型 | I-1 代码之前的组件 | 从跨技术“还原同一组件”的经验进入交互主体与可执行近似 | [`2026-08-30-whitepaper-part-one-chapter-1-initial-draft.zh-CN.md`](./2026-08-30-whitepaper-part-one-chapter-1-initial-draft.zh-CN.md) |
| 第一部 · 原型 | I-2 从交互关系出发 | 从 User、Maker、Other Component 与方向性关系推导 information channel | [`2026-08-30-whitepaper-part-one-chapter-2-initial-draft.zh-CN.md`](./2026-08-30-whitepaper-part-one-chapter-2-initial-draft.zh-CN.md) |
| 第一部 · 原型 | I-3 组件的边界 | 用独立参与者关系和 feedback-only 例外判断 Prototype 边界 | [`2026-08-30-whitepaper-part-one-chapter-3-initial-draft.zh-CN.md`](./2026-08-30-whitepaper-part-one-chapter-3-initial-draft.zh-CN.md) |
| 第一部 · 原型 | I-4 通路之外的语义 | 用 State、Anatomy、Lifecycle 与 Switch 伪代码使 Prototype 接近可执行 | [`2026-09-02-whitepaper-part-two-chapter-4-initial-draft.zh-CN.md`](./2026-09-02-whitepaper-part-two-chapter-4-initial-draft.zh-CN.md) |
| 第二部 · 翻译 | II-5 翻译层 | 解释 Host artifact、Module / Host Capability、翻译形式、结果与证据 | [`2026-09-02-whitepaper-part-two-chapter-5-initial-draft.zh-CN.md`](./2026-09-02-whitepaper-part-two-chapter-5-initial-draft.zh-CN.md) |
| 第二部 · 翻译 | II-6 一致性的边界 | 说明 Prototype 先决定不变量，realization context 再决定比较强度 | [`2026-09-02-whitepaper-part-two-chapter-6-initial-draft.zh-CN.md`](./2026-09-02-whitepaper-part-two-chapter-6-initial-draft.zh-CN.md) |
| 第三部 · 演进 | III-7 在边界中演进 | 用三条主线、开放路线与失败归因说明当前近似怎样接受实践修正 | [`2026-09-03-whitepaper-part-three-chapter-7-initial-draft.zh-CN.md`](./2026-09-03-whitepaper-part-three-chapter-7-initial-draft.zh-CN.md) |
| 结语 | 为过去与未来保留交互知识 | 回到长期公共基础设施愿景，同时拒绝历史必然性和答案垄断 | [`2026-09-03-whitepaper-conclusion-initial-draft.zh-CN.md`](./2026-09-03-whitepaper-conclusion-initial-draft.zh-CN.md) |

## 结构演进与历史快照

前三章形成时，第一部仍使用“寻找不变量”的工作标题；第四至第六章形成时，章节按 `1–3 / 4–6 / 7` 分组，第四章因此仍保留 `part-two` 文件名和 `II-4` 正文标题。后续的 `2026-09-03-whitepaper-part-boundary-revision.zh-CN.md` 才把结构调整为当前的 `1–4 / 5–6 / 7`，并把三部命名为“原型 / 翻译 / 演进”。

这些旧文件名、章节自指和标题是当时写作状态的事实记录，不在本检查点中回写。最终汇编和人工打磨时，应采用当前分组，修正第四、五章的 Part bridge，并统一目录中的编号。

第七章在较早蓝图中的工作标题是《在边界中逼近》，本轮接受的融合初稿使用《在边界中演进》。两者都指向“当前近似接受实践修正”的章节职责，但最终标题尚未由 canonical 手稿确定；维护者将在集中打磨时统一。

## 写作来源与责任

维护者提供了经验前提、核心理论仲裁、个人草稿、案例修正、章节节奏与最终写作责任。AI 在本轮协作中提供独立对照稿、来源与 lifecycle 核对、反驳、结构复盘、伪代码补全、融合编辑和措辞备选。

这些文件中的协作初稿不等于最终人类署名正文。后续人工阶段会从这些记录、维护者原始草稿和旧白皮书中重新组织文字；维护者计划亲自重新输入并修改全文，而不是直接发布当前模型生成或融合的表述。任何句子、结构和例子是否进入最终稿，仍由维护者逐项决定。

PR #550 中 `cyjin-yl` 完成的旧页面 claim inventory、阅读顺序、术语与 locale 漂移、source mapping 等中性审计成果，继续作为有归属的研究来源；其旧稿和已经被 WPD-01 至 WPD-10 取代的编辑方向没有成为本轮初稿的自动写作基线。

## 证据与语义边界

完整初稿继续服从已经记录的证据边界：

- `spec/**` 中的 applicable entity 仍按各自 `active`、`draft`、`deprecated` 或 `removed` lifecycle 解释；初稿引用不会改变它们的状态。
- `K-COMPONENT-INTERACTION-0001`、`K-INFORMATION-CHANNEL-0001`、`C-STATE-0001`、`C-ANATOMY-0001`、`C-LIFECYCLE-0001`、`K-PROTOTYPE-COMPOSITION-0001`、`K-DESIGN-TRADEOFF-0001` 与 `P-BASE-SWITCH` 仍是 `draft`，不能被初稿写成已经稳定的公共保证。
- `D-ADAPTER-PROFILE-0001` 是 `active`，但它只治理当前 official runtime Adapter profile；当前 official Adapter 与 executable evidence 仍主要集中在 Web family。
- Qt、Flutter、TUI、一般非 Web Host、完整 Compiler 产品、完整跨媒介替代和严格跨 Host 图像比较，仍是 thought experiment、未来检验方向或治理缺口，不能由本文外推为已经实现和验证。
- 白皮书负责哲学与方向，Spec 负责可机器治理的工程细化，实现和测试提供当前行为证据。任何冲突都需要另行仲裁，不能让初稿、Spec 或偶然实现静默覆盖其他层。

## 接下来的人工阶段

协作初稿完成不等于白皮书完成。下一阶段至少仍包括：

1. 由维护者集中重新输入、改写、删减重复论证，并统一全文口吻、术语、章节 bridge 与标题；
2. 补齐并人工验收 Switch 时间轴、information channel、Prototype boundary、lifecycle、translation、conditional consistency 与演进反馈环等插图；
3. 决定最终版式、公共页面拆分、旧页面迁移与 canonical 白皮书替换方案；
4. 在中文稿接受后制作英文 conceptual-parity 版本，并进行人工语义审阅；
5. 独立决定外部文章、publication 和其他传播形式；
6. 另行发起 accessibility authoring capability 的治理 Issue，处理其语义所有权与 authoring API 边界，不把这项工程决定夹带进白皮书初稿 PR。

其中任何一项都需要自己的审阅和授权。本检查点不宣布最终稿、发布候选或迁移计划已经完成。

## 明确不改变的事项

本文与三份新增初稿不修改或授权修改：

- 任何 `spec/**` entity、Contract、Prototype、Module、Host Capability、Adapter profile、实现或测试；
- 已合入记录保存的历史事实；
- 旧白皮书页面、公共导航、英文页面或发布状态；
- Issue #473 或 Issue #478 的状态与元数据；
- accessibility authoring capability 的当前实现与治理结论；
- pull request 的合并或 canonical 白皮书的发布。

本检查点只确认一件事：从序章到结语，供后续人工打磨使用的中文协作初稿已经齐备。
