# 2026-07-30 Tooltip domain boundary 与贡献承接记录

> Internal record. Not normative. 本文记录 Tooltip 第一轮审计、PR #342 的承接方式、当前实现范围与创作归属。稳定协议以 `spec/**` 为准。

## 1）背景与审计材料

本轮以以下材料交叉审计 Tooltip，而不把任一组件库的公开 API 直接当作 Proto UI 原型边界：

- Proto UI 白皮书《原型边界》，尤其是 feedback 与 non-feedback channel 的拆分判断；
- Radix UI Tooltip 的 Provider、Root、Trigger、Portal、Content、Arrow 公开结构；
- Base UI Tooltip 的 Provider、Root、Trigger、Portal、Positioner、Popup、Arrow 结构与 group delay；
- shadcn/ui 对 Radix Tooltip 的带设计语言投影；
- WAI-ARIA APG Tooltip pattern、ARIA `tooltip` role 与 `aria-describedby` 关系；
- 贡献者 `cyjin-yl` 的 [Proto-UI/Proto-UI#342](https://github.com/Proto-UI/Proto-UI/pull/342)，特别是 Base Tooltip shell、open delay/Overlay 行为和 Escape owner bridge。

审计结论进入 `D-TOOLTIP-PROTOTYPE-BOUNDARY-0001`：Base 第一轮编目 Root、Trigger、Content，并把 Group 作为同族相邻协议一同编目；不增加空壳 Portal，也不在 Positioning 缺少 arrow geometry channel 时承诺 Base Arrow。

## 2）为什么使用继承分支而不继续堆叠 #342

本轮从最新 `origin/main` 创建 `codex/tooltip-domain`，名义与证据上继承 #342，但不直接在其 head 上继续提交。原因是 #342 的 21 个 commits 同时包含 Base Tooltip、Brutalist 原型库基础设施、styled projection、文档、release evidence 与生成文件；当前 main 已继续演进，PR head 也处于冲突状态。直接合并或在旧 head 上修补会把 Base 语义审计与 Brutalist 创作治理重新耦合。

采用继承分支不表示否认原贡献：

- 保留 #342 和原 commits 作为可追溯的先行实现；
- 当前实现明确承接 `feb990b8` 的 delayed open/Overlay 方向与 `6ba79e5b` 的 Escape-to-owner bridge；
- 完成后保留 `cyjin-yl` 为 Tooltip assignee 之一，并邀请其 review；
- PR 描述与最终提交信息应引用 #342，并在适用提交中记录共同创作或贡献说明；
- 不通过 squash、复制后抹除来源或重写旧记录来制造“从未发生过”的历史。

## 3）协议边界

### Tooltip Root / Trigger / Content

- Root 持有 open fact、controlled owner、disabled、delay、interaction 与 request sequencing。
- Trigger 持有 focus/hover facts，保留宿主 role、name 与 activation；open 时使用 additive `describedBy` 关联 Content。
- Content 持有 `tooltip` role、stable id、Overlay、Transition、Portal projection 与 anchored positioning；Escape 必须回到 Root request channel。
- Content 可以因 WCAG hoverable 要求参与 pointer close bridge，但不得承载 focusable 或完成任务所需的交互；后者应选 Popover 或 non-modal Dialog。

### Tooltip Group

Group 不属于单 Tooltip Anatomy。它以独立 Context 向多个 Root 提供 delay defaults、warm/cold window 与 active Tooltip coordination。当前语义完全由既有 Context 与 Delay 抽象表达，不新增 Tooltip 专用 core/module。

### 本轮明确不做

- 不增加 Base Tooltip Portal prototype：Portal 是 Content 的 Overlay/renderer projection，没有独立通道。
- 不增加 Base Tooltip Arrow prototype：当前 Positioning 未表达 arrow target、arrow size、offset 与 collision feedback。
- 不引入 touch long-press 或 input-modality suppression；这些需要独立讨论 pointer 模态与移动端 Tooltip 可用性。
- 不在本分支增加 Shadcn 或 Brutalist Tooltip projection。

## 4）审计暴露的通用能力缺口

Tooltip Trigger 不能覆盖宿主已有 `aria-describedby`。因此本轮扩展 A11y relation IR，允许声明 additive projection；Web adapter 保留非该 semantic object 所拥有的 IDREF token，只更新和清理自身 token。该能力进入 `C-A11Y-0001-K` 并具有独立 runtime/Web contract coverage，不作为 Tooltip 私有例外。

除 additive A11y relation 外，第一轮 Tooltip 与 Group 不要求扩张 core/module 能力边界。Arrow 与输入模态仍是明确 deferred gap。

## 5）创作归属与后续治理

- Base 原型库中的 Tooltip family，以及为其成立而变更的 core、module、runtime、adapter 等内部 package，由 Proto UI 团队继续持有与治理；贡献者记录与具体贡献说明永久保留。
- 对 #342 中 `cyjin-yl` 的先行实现、测试与问题发现予以明确承认；实现完成后邀请其 review，不以保护贡献热情为由降低理论、协议或实现门槛。
- 若后续增加 Shadcn Tooltip，设计语言与对应原型库创作归属仍默认遵循 shadcn/ui 官方治理，不能因 Base 实现者而迁移所有权。
- `cyjin-yl` 自研的 Brutalist 原型库及其设计语言仍归贡献者创作治理；本轮不复制、改写或收编其 styled projection。
- 任何其它 styled prototype library 均按其自身来源和治理主体分别记录，不从 Base family 自动推导创作归属。

## 6）完成条件与 GitHub 动作

在 catalog、focused tests、type checks、prototype catalog check 与 agent projection 全部通过前，不发送 review 邀请。完成后建立 successor PR，引用并说明继承 #342，保留 `cyjin-yl` 为 assignee 之一并请求其 review；这些属于完成阶段的显式 GitHub 写操作。
