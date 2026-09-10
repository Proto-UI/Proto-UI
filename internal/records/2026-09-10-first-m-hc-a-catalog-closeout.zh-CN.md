# M / HC / Adapter 首次编目阶段收尾

日期：2026-09-10。基线：main `e15a5adf`；#634 已合入，#636 在本记录撰写时仍开放。本文记录用户确认的阶段收尾与后续工作组织方式，不替代 spec，也不授予实现、实体晋升或合并权限。

## 阶段结论

**M、HC、A 的首次编目工作告一段落。后续以增量编目和维护现有 spec 实体为常态。**

首轮目标是把现有核心语义和已投入使用的能力，按当前边界连接到 Module、必要 Host Capability、Adapter profile、契约与可执行证据，并修复已经治理的实现漂移。此次收尾不意味着全部实体 active、全部能力实现、全宿主认证、全量 Prototype 质量审计完成，或历史兼容面均已删除。

没有独立 M/HC 的遗留实现，不自动构成必须补齐的编目缺口。明确的 deferred/实验能力与范围外演进，也不再作为本轮编目欠账持续滚动。

## 已完成与已有记录

- 核心信息通路及 State、Rule、Anatomy 的第一轮边界与四 Web Adapter 有界关联已形成。
- Collection、Expose State Web、Rule Expose State Web，以及 Trigger、Focus、Boundary、Hit Participation 的语义切片已整理；Positioning 的 host/session 证据与漂移处理已完成。
- #634 完成 Overlay、Text Control、Image View、Scroll 的普通编目收尾。其中 Vue 2 Image View 缺失实现、Overlay 共享资源所有权、迟到 session facts 等问题随切片修复。
- Presence 经盘点转入兼容架构议题，没有为 dormant bridge 创建占位 M/HC。A11y 作者入口迁移已经转为独立架构 PR #636，不阻塞首次编目阶段结束；本记录不把该开放 PR 写成已合入成果。

前序依据：

- [首次余量与推进计划](./2026-09-08-catalog-roadmap.zh-CN.md)
- [Presence 兼容盘点与 Positioning 编目](./2026-09-09-presence-positioning-catalog.zh-CN.md)
- [Overlay 与普通编目收尾批次](./2026-09-09-overlay-and-remaining-catalog.zh-CN.md)
- [普通编目收尾进展及验证限制](./2026-09-09-ordinary-catalog-completion.zh-CN.md)
- [Rule 已确认的边界](./2026-09-08-rule-catalog-boundaries.zh-CN.md)

这些记录保留各自当时的验证结果，不将本次文档收尾误写成一次新的全量技术验证。

## 从编目中分离的独立工作

| 议题 | 当前事实与下一步 | 执行边界 |
| --- | --- | --- |
| A11y 作者入口 | #636 提议在 0.3 以 asAccessible / AccessibleHandle 替换 def.a11y；#625、#549、#621 分别继续关系传输与消费者工作 | 已有独立 PR，不创建重复迁移 Issue；按各自验收跟进 |
| deprecated State 入口退场 | Base Select Item 仍使用 fromAccessibility(selected)，Shadcn Tooltip Trigger 仍使用 fromInteraction(pressed) | 先迁移协议状态所有权；Tooltip pressed 边界需明确，然后处理 accessor、Runtime 安装、包面与兼容测试 |
| Presence legacy compatibility | 旧 Module/bridge、Runtime awaitMount/awaitUnmount/forceUnmount 和 presenceLifecycle=session 仍存在 | 先决定公开兼容面与生命周期迁移；不把 A11y 的直接替换决定推广为全部旧 API 的删除许可 |
| Rule Meta | 明暗主题需求成立，当前抽象仍在演进 | 先研究真实用例与稳定边界；没有新增需求时保留现状，不启动通用环境 API 实现 |
| Overlay 后续策略 | 通用 focus entry/restore、anchor/trigger dismissal、focus-outside、更强层级及完整 modal policy 尚非当前保证 | 先形成消费者驱动的优先级和独立决策切片，不启动一揽子实现 |

上述四个尚无专门工作项的后续议题由本记录对应 Issue 承接；发布链接见下方。研究议题的完成可以是有证据地继续 deferred，不以必须增加 API 作为验收。

### 既有方向不重复建单

Scroll end-follow #519、visual-anchor preservation #520、windowed collection #521 已有各自的问题边界；Text Document #531 与 Composer #518 也有独立需求上下文。它们不是本轮编目剩余项，也不等价于已经批准 portable selection/edit-menu 或完整非 Web 支持。

Image View asset resolution/非 Web readiness、Text Control portable selection/edit-menu 等继续保留在现有 spec/记录边界中。当前没有足够具体的消费者需求，不为每个可能的扩展创建空实现任务。新增需求成立时，再独立提出问题与验收。

## 后续 spec 工作方式

1. 新能力随实现增量编目：追踪已有实体后，只创建真实的新身份或职责，不按 package、cap token 或目录数量补实体。
2. 修改已有能力时，同步维护 criteria、relations、版本与 revisions、T 映射、Adapter 支持/省略范围、实现及读者投影。
3. 首次编目完成与 lifecycle admission 分开。draft 的准入依据按 `spec/README.md` 的机制逐切片审查；有证据缺口或有意实验的实体继续保持相应状态，不批量自动晋升。
4. 新漂移进入有界修复任务；新架构和产品语义进入独立设计决策。Record 记录方向，适用 spec 仍是语义权威。
5. 普通增量编目可以在一个批量 PR 内按语义切片组织 commit；架构变更、兼容退场及未决语义需要独立可审查的 PR。

## 后续 Issue

- [#637：deprecated State 入口退场](https://github.com/Proto-UI/Proto-UI/issues/637)
- [#638：Presence legacy 生命周期路径的退场决策](https://github.com/Proto-UI/Proto-UI/issues/638)
- [#639：Rule Meta 的需求与抽象研究](https://github.com/Proto-UI/Proto-UI/issues/639)
- [#640：Overlay deferred 策略的消费者驱动优先级](https://github.com/Proto-UI/Proto-UI/issues/640)

以上是独立任务，不代表首次编目阶段尚未结束。创建 Issue 不授予未决设计的实现权，也不自动认领或安排执行。
