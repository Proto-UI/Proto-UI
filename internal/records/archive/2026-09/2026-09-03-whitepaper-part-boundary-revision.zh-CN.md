# 白皮书三部边界修订：原型、翻译与演进

日期：2026-09-03

本文记录 [Issue #473](https://github.com/Proto-UI/Proto-UI/issues/473) 白皮书重写企划在前六章协作初稿完成后的结构调整：七章的顺序、主张、案例和篇幅权重保持不变，但三部的章节归属由 `1–3 / 4–6 / 7` 调整为 `1–4 / 5–6 / 7`。

这是 `internal/records/**` 下的写作决策记录，不是 canonical 白皮书正文、Spec 实体或公共发布候选。它只更新后续手稿使用的 Part 分组、标题和跨章 bridge；既有记录继续保留当时的写作状态，不通过回写历史来掩盖本次调整。

## 为什么调整边界

原分组把第四章《通路之外的语义》放在“使近似可执行”一部，理由是 State、Anatomy 与 Lifecycle 让 Prototype 从外部关系描述进一步接近可执行。这个判断仍然成立，但它不足以构成最清楚的 Part 边界。

第四章实际完成的是 Prototype 本身：

- State 补充交互主体在前后交互之间保留的内部事实；
- Anatomy 补充多个独立 part 在复合结构中的稳定身份与关系；
- Lifecycle 补充这些语义成立的时间秩序；
- Switch 伪代码把前四章的外部关系、组件边界、内部事实、结构与时间汇成一份接近可执行的 Prototype。

直到第五章，论证对象才从“Prototype 如何完整表达一个 Component”转为“如何把 Prototype 翻译成具体 Host 中的 artifact”。因此第四章结尾与第五章开头之间，是比第三章与第四章之间更准确的职责边界。

第六章比较两个 translation realization 在不同共享条件下应当一致到什么程度。它依赖第五章已经建立的 Host artifact、能力边界、翻译结果与证据范围，因此继续属于“翻译”，而不是 Prototype 的内部定义。

第七章则改变问题的层次：它不再添加 Prototype 或翻译层概念，而是说明当前近似怎样保持边界、怎样接受失败与实践证据的修正。将它单独成部，可以避免把演进写成翻译工程的附录，也能让全文以明确的认识论姿态收束。

## 修订后的三部

| 部分 | 章节 | 叙事职责 |
| --- | --- | --- |
| 第一部 · 原型：从交互主体到可执行近似 | 第 1–4 章 | 从跨技术仍可辨认的 Component 出发，经 information channel 与组件边界，补齐 State、Anatomy 和 Lifecycle，最终得到接近可执行的 Prototype。 |
| 第二部 · 翻译：让原型进入具体技术 | 第 5–6 章 | 说明翻译层怎样产生 Host artifact、表达能力与损失，并在明确的 realization context 之间判断一致性。 |
| 第三部 · 演进：让近似接受实践修正 | 第 7 章 | 说明 Proto UI 在哪里停止，以及 theory-and-kernel、prototype-library、translation-layer-and-ecosystem 的证据怎样推动当前近似被显式修正。 |

新的 Part 标题直接说明每一部处理的对象与动作。它们替代原先“寻找不变量 / 使近似可执行 / 在实践中逼近”的 Part 标题，但不否定旧标题表达的总论证：前三种动作仍然存在，只是不再作为章节归属的最佳标签。

序章继续负责建立跨技术生命周期重复劳动这一真实问题，并提出有边界的经验假设；结语继续回到“为过去与未来保留交互知识”的长期愿景。二者不计入七章编号。

## 章节编号映射

| 章节           | 原编号 | 修订后编号 | 内容变化         |
| -------------- | ------ | ---------- | ---------------- |
| 代码之前的组件 | I-1    | I-1        | 无               |
| 从交互关系出发 | I-2    | I-2        | 无               |
| 组件的边界     | I-3    | I-3        | 无               |
| 通路之外的语义 | II-4   | I-4        | 仅改变 Part 归属 |
| 翻译层         | II-5   | II-5       | 无               |
| 一致性的边界   | II-6   | II-6       | 无               |
| 在边界中逼近   | III-7  | III-7      | 无               |

完整编号序列因此是：

`I-1 / I-2 / I-3 / I-4 / II-5 / II-6 / III-7`

本次不调整章节顺序，不重新分配 Switch、Select、Scroll Area 的案例职责，也不修改蓝图已经接受的 reader question、核心主张、证据边界、negative boundary 或相对篇幅权重。

## 后续正文需要修订的 bridge

既有蓝图与协作初稿是已合入的时点记录，不在本次改写。未来汇编和人工打磨 canonical 手稿时，应按新分组调整以下自指：

1. 第四章开头不再以“第一部已经……”回指前三章，改用“前三章已经……”或同义表达，避免把当前章排除在第一部之外。
2. 第四章结尾承担第一部的收束：Prototype 至此已经能够表达外部关系、独立边界、内部事实、复合结构和时间秩序；尚未回答的是这些义务如何进入具体技术。
3. 第五章开头明确开启第二部，把问题切换为 Prototype、Host 与 Host artifact 之间的翻译，而不是继续补充 Prototype 定义。
4. 第六章结尾继续把“可比较但并非永恒的边界”交给第七章；第七章开头则从第二部已经暴露的翻译限制与证据缺口出发，进入演进问题。

这些 bridge 调整只服务于阅读节奏。它们不得暗示第四章已经穷尽 Prototype 的所有可能能力，也不得把第五、六章写成所有 Host 都已获得实现与验证的现状陈述。

## 历史记录怎样保留

以下已合入记录继续保持原文件名、原章节编号和原叙述：

- `2026-08-28-whitepaper-rewrite-maintainer-decisions.zh-CN.md` 保存 WPD-01 至 WPD-10 形成时的总体方向；
- `2026-09-01-whitepaper-chapter-blueprint-revision.zh-CN.md` 保存七章蓝图被接受时的 `1–3 / 4–6 / 7` 分组；
- `2026-09-02-whitepaper-parts-one-two-initial-draft-checkpoint.zh-CN.md` 与六份章节记录保存初稿协作完成时使用的编号和 Part 归属。

本记录是后续写作采用的新时点方向。保留旧记录中的历史表述并不会形成两套当前蓝图；读者应按日期与记录目的理解它们。最终白皮书手稿和未来导航使用本记录中的新分组。

## 接下来的起稿顺序

Part 边界确定后，后续协作按以下顺序推进：

1. 先起草 III-7《在边界中逼近》，完成七章主论证；
2. 再起草序章，用真实问题、局部成功与有边界的经验假设建立入口；
3. 最后起草结语，让长期愿景准确回扣已经写成的七章，而不在结尾引入新概念；
4. 全部中文初稿完成后，由维护者集中重新输入、改写、去重、统一语气并配置插图。

序章和结语后写，是为了让它们忠实包围已经成立的正文，而不是提前向正文施加一个尚未验证的承诺。它不表示序章或结语次要。

## 来源与语义边界

本次分组复审依赖：

- `2026-08-28-whitepaper-rewrite-maintainer-decisions.zh-CN.md` 中 WPD-01、WPD-09 与 WPD-09C；
- `2026-09-01-whitepaper-chapter-blueprint-revision.zh-CN.md` 中第四至第七章的职责、继承前提与 bridge；
- `2026-09-02-whitepaper-parts-one-two-initial-draft-checkpoint.zh-CN.md` 记录的前六章协作初稿现状；
- draft 实体 `K-COMPONENT-INTERACTION-0001`、`K-INFORMATION-CHANNEL-0001`、`C-STATE-0001`、`C-ANATOMY-0001`、`C-LIFECYCLE-0001`、`K-PROTOTYPE-COMPOSITION-0001` 与 `K-DESIGN-TRADEOFF-0001`；
- active 决策 `D-ADAPTER-PROFILE-0001` 对当前 official runtime Adapter profile 的治理边界。

这些来源帮助核对章节职责，不会因为被本记录引用而改变 lifecycle 或升级为新的保证。特别是，第五、六章涉及的非 Web Host、Compiler、完整 comparison profile 等内容仍按蓝图中的 future、hypothetical 或 governance gap 表述。

## 明确不改变的事项

本文不修改：

- 任何 `spec/**` entity、Contract、Prototype、Module、Host Capability、Adapter profile、实现或测试；
- 已合入记录保存的历史事实；
- 旧白皮书页面、公共导航、英文页面或发布状态；
- Issue #473 的 open 状态；
- 后续 accessibility authoring capability 治理事项。

本记录也不授权把协作初稿直接发布为 canonical 白皮书，不替代维护者对最终中文措辞、插图与理论主张的人工仲裁。
