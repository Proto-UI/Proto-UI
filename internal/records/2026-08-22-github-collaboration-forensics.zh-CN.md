# 2026-08-22 GitHub 协作取证

## 记录性质

本文记录 2026-08-22 对 Proto-UI 组织及 `D:\\dcbot` 的只读取证。它说明调查时真实存在的协作习惯、保护条件和缺口，不是产品规范，也不会替代 GitHub 的实时状态。

调查在 Asia/Shanghai 时区的 2026-08-22 进行。主仓和 `dcbot` 的基准提交分别为 `45d19a8b23e195cf76a92f52c86ccbeb5e6486f3` 与 `2628b140e533891e8933574ae0087d933043b3ff`。统计使用 `gh` CLI、GitHub REST/GraphQL 的全量分页结果、仓库历史、workflow 日志和本地代码；open/closed 状态以查询时实时值为准。

`projectsV2.totalCount` 返回 `0`，但当前 token 只有 `gist`、`read:org`、`repo` 和 `workflow` scopes。读取 Project ID、字段、视图和 automation 时，GraphQL 返回 `INSUFFICIENT_SCOPES` 并要求 `read:project`。因此本文只能记录“当前凭据观测到总量为零”，不能声称 Project 配置已被完整核验，也不能用这个零排除当前凭据不可见的配置。

## 仓库全景

组织共有四个仓库：

| 仓库 | 可见性 | 主要用途 | 协作成熟度 |
| --- | --- | --- | --- |
| `Proto-UI/Proto-UI` | public | 主代码、规范、文档与发布 | Issue、PR、CI、评审和发布均在使用 |
| `Proto-UI/dcbot` | private | Discord Bot 与 Poppy 信任实现 | 内部权限设计成熟，仓库治理仍是单人直推原型 |
| `Proto-UI/Labs` | public | 实验仓 | 调查时没有活跃协作实体 |
| `Proto-UI/demo-repository` | private | GitHub 功能演示 | 只有示例级 PR 和 workflow |

主仓调查时有 159 个 Issue、325 个 PR、31 个 label、6 个 milestone、2 个 Discussion、8 个 GitHub Release、56 个远端分支、729 次 Actions run 和 1,159 个 deployment。`dcbot` 没有 Issue、PR、Discussion、milestone、Release、tag、deployment 或正式 CI。

| 仓库 | Issue | PR | Discussion | label | milestone | workflow / run | Release | deployment | branch |
| --- | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| `Proto-UI` | 159 | 325 | 2 | 31 | 6 | 5 个主要 workflow / 729 | 8 | 1,159 | 56 |
| `dcbot` | 0 | 0 | 0 | 9 | 0 | 无正式 workflow / 2 次 Dependency Graph 动态 run | 0 | 0 | 1 |
| `Labs` | 0 | 0 | 0 | 9 | 0 | 0 | 0 | 0 | 1 |
| `demo-repository` | 0 | 1 个已合并 | 0 | 9 | 0 | 2 个 workflow | 0 | 0 | 2 |

Discussion category 是 Discussion 的类型配置，Action conclusion 是运行结果，environment 是部署边界；三者都不是 GitHub label，也不应混入 label taxonomy。

## 权力和贡献集中度

主仓直接协作者权限分别覆盖 Admin、Maintain 和 Write。`dcbot` 有两名 Admin 和一名 Read。

主仓 Issue、PR 与 commit 历史集中在少数维护者。匿名或分裂的 Git identity 也占据较多 contributor 记录，这会削弱贡献统计、DCO 追踪和基于历史的晋级判断。权限授予不能只看提交数量。

`dcbot` 的历史由单一高权限作者直接推送到 `main`。小提交、快速修复和 revert 带来了速度，但没有独立评审、PR 验收或 CI 回归信号。

## Issue 与 label

主仓 Issue 主要承担长期规划、提案、Bug 和跟踪工作。当前开放队列中，高级贡献和需维护者设计的工作占比较高，调查时没有开放的 `good first issue`。因此 Agent 的自动领取入口必须允许返回“没有合格任务”。

Issue 快照：

| 指标                           |     数量 |
| ------------------------------ | -------: |
| 全部                           |      159 |
| open / closed                  | 26 / 133 |
| 当前未指派                     |       17 |
| 当前无 milestone               |       17 |
| 当前 `help wanted`             |        5 |
| 当前 `advanced contribution`   |       13 |
| 当前 `needs maintainer design` |        8 |
| 历史从未指派                   |       94 |
| 历史无 milestone               |      109 |
| 历史无 label                   |       22 |

关闭耗时中位数约 504.7 小时。Issue 通常承载长期塑形，PR 才是快速交付单元。

实际 label 已经形成四个维度：

- 工作类型；
- 所属区域；
- Fibonacci effort；
- 参与就绪度。

存在的漂移包括：

- `docs` 与 `documentation` 重复；
- 两个只在破折号字符上不同的 `F2`；
- 单数、复数或历史 area 名称重叠；
- workflow 引用但仓库不存在的 `release-cadence`。

缺乏可操作的统一 readiness、risk 和 blocked 表达。未来应让 Project 字段承担 Kanban 状态、claim、优先级和 evidence state，labels 只保留稳定搜索属性。

历史领取通常通过 Issue 评论提出，再由维护者确认范围和是否可实施。Assignee 不是唯一占用信号。自动领取需要同时检查评论、关联 PR 和实时 Project 状态。

### 完整 label 账本

下表按同一快照列出全部主仓 labels。`Issue open/closed` 与 `PR open/closed` 分开计算；closed PR 包含 merged 和 closed-unmerged。同一对象可以有多个 label，各行不能相加为对象总量。

| Label | Issue open/closed | PR open/closed | 观测到的协作含义 |
| --- | --: | --: | --- |
| `advanced contribution` | 13 / 3 | 0 / 3 | 能力与评审强度提示，不是批准或权限 |
| `area: adapters` | 4 / 6 | 4 / 3 | Adapter 与宿主集成范围路由 |
| `area: prototypes` | 18 / 34 | 4 / 40 | Prototype 范围路由 |
| `area: spec` | 4 / 5 | 0 / 8 | spec 与 knowledge 范围路由 |
| `area: website` | 2 / 16 | 0 / 17 | 网站与文档站范围路由 |
| `bug` | 4 / 29 | 3 / 39 | 行为故障类型 |
| `C++` | 0 / 1 | 0 / 0 | 历史技术标签，未形成活跃分类 |
| `community` | 1 / 3 | 0 / 2 | 社区、教育与传播工作流 |
| `docs` | 9 / 27 | 0 / 4 | 文档工作类型；与 `documentation` 重叠 |
| `documentation` | 3 / 7 | 3 / 110 | 默认文档类型；历史 PR 使用远多于 `docs` |
| `duplicate` | 0 / 0 | 0 / 0 | 处置结果；当前未使用 |
| `enhancement` | 7 / 39 | 4 / 165 | 功能或改进类型 |
| `F? - Requires assessment` | 1 / 2 | 0 / 0 | 估算前调查状态 |
| `F∞ – Needs Split` | 1 / 1 | 0 / 0 | 开工前必须拆分的规模闸门 |
| `F1 – Trivial` | 0 / 2 | 1 / 19 | 最小工作量档 |
| `F2 - Small` | 0 / 1 | 0 / 1 | 旧拼写；与规范 F2 重复 |
| `F2 – Small` | 0 / 19 | 0 / 50 | 小型工作量档 |
| `F3 – Moderate` | 7 / 31 | 3 / 58 | 中型工作量档 |
| `F5 - Large` | 8 / 30 | 0 / 49 | 大型工作量档 |
| `F8 – Very Large` | 0 / 3 | 1 / 9 | 超大型工作量档 |
| `good first issue` | 0 / 41 | 0 / 11 | 新贡献者就绪信号；当前无开放入口 |
| `help wanted` | 5 / 36 | 0 / 6 | 外部协作邀请，不等于 claim |
| `invalid` | 0 / 0 | 0 / 0 | 处置结果；当前未使用 |
| `needs maintainer design` | 8 / 2 | 0 / 0 | 语义未决的停工闸门 |
| `prototype` | 0 / 0 | 0 / 0 | 旧或空范围标签；当前未使用 |
| `question` | 0 / 0 | 0 / 0 | 问题类型；当前未使用 |
| `spike` | 0 / 4 | 0 / 0 | 研究或可行性调查模式 |
| `v0 launch` | 0 / 24 | 0 / 3 | 历史发布时段或 program 标签 |
| `whitepaper` | 7 / 1 | 0 / 0 | 概念文档工作流 |
| `wontfix` | 0 / 1 | 0 / 0 | 不实施处置结果 |
| `workspace` | 0 / 0 | 0 / 6 | 内部 workspace 表面；仅历史 PR |

`dcbot`、`Labs` 和 `demo-repository` 都保留九个默认 labels，且每一项的 Issue open/closed、PR open/closed 都是 `0 / 0 / 0 / 0`：

| Label              |       `dcbot` |        `Labs` | `demo-repository` |
| ------------------ | ------------: | ------------: | ----------------: |
| `bug`              | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |     0 / 0 / 0 / 0 |
| `documentation`    | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |     0 / 0 / 0 / 0 |
| `duplicate`        | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |     0 / 0 / 0 / 0 |
| `enhancement`      | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |     0 / 0 / 0 / 0 |
| `good first issue` | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |     0 / 0 / 0 / 0 |
| `help wanted`      | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |     0 / 0 / 0 / 0 |
| `invalid`          | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |     0 / 0 / 0 / 0 |
| `question`         | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |     0 / 0 / 0 / 0 |
| `wontfix`          | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |     0 / 0 / 0 / 0 |

这说明四维 label 模型只在主仓形成实际用法。默认 label 存在不等于流程已经采用它。`advanced contribution`、`good first issue` 与 `help wanted` 只描述候选协作条件，不能授予权限。`needs maintainer design`、`F∞` 和 `F?` 分别表达语义停工、必须拆分和需要估算，不能合并成一个模糊的 blocked 标签。`docs`/`documentation` 与两种 F2 是确定的 taxonomy 漂移。

## Pull request 与评审

主仓 325 个 PR 中有 289 个合并。历史合并速度很快，近期流程比早期更严格，但仍有大量历史 PR 没有独立 review。

| 指标                            |          数量 |
| ------------------------------- | ------------: |
| open / merged / closed-unmerged | 10 / 289 / 26 |
| 当前 draft                      |             5 |
| 至少一次 review                 |           139 |
| 无 review                       |           186 |
| merged 且有 review              |           124 |
| merged 且无 review              |           165 |

全部历史 PR 从创建到合并的中位数约 0.98 小时。2026-08 中旬后的中位数约 17.5 小时，说明近期已经留出更多审阅时间，但吞吐仍然很高。289 个 merge commit 中有 269 个双 parent，仓库同时允许 merge、squash 和 rebase，尚未统一历史策略。

当前有效 ruleset 要求：

- `main` 只能通过 PR；
- 一次 approval；
- 新 push 撤销旧 approval；
- review threads 必须解决；
- DCO check；
- 禁止删除和 non-fast-forward。

完整 CI 目前不是 required status check。绿色 CI 是实际维护纪律，不是 GitHub ruleset 已经强制的合并条件。文档必须区分“我们要求”与“平台已经阻止”。

PR template 已要求实体生命周期、criteria、scope boundary、来源、AI 辅助、DCO、网站 preview 和精确验证。模板质量仍需 reviewer 执行，勾选框本身不能证明完成。

## Actions 与部署

主仓 CI 已覆盖：

- lockstep 与 package graph；
- public package build、manifest 和预算；
- types 与 repository tests；
- release scan 和 publish dry-run；
- React consumer；
- CLI 多宿主 smoke。

这是一套 release-oriented CI，但当前只在 Ubuntu 和 Node 22 运行，浏览器验收没有独立可见 lane，且 CI 尚未进入 required checks。

Actions 快照：

| Workflow                           | runs | success | failure | cancelled |
| ---------------------------------- | ---: | ------: | ------: | --------: |
| CI                                 |  677 |     494 |     147 |        36 |
| Release Packages                   |   23 |      11 |      12 |         0 |
| Release Cadence                    |   15 |       2 |      13 |         0 |
| Agent Operations Shadow            |    1 |       1 |       0 |         0 |
| RepoSteward Portfolio Shadow Trial |    2 |       0 |       2 |         0 |

两项 GitHub/Copilot dynamic workflow 共 11 次且全部成功。调查时总 run 结果为 519 success、174 failure、36 cancelled。

调查时两个自动化存在确定故障：

- Release Cadence 因缺失 `release-cadence` label 无法创建 Issue；
- RepoSteward trial 在 job 创建前发生 workflow-file 级失败。

提交状态的绿色结果没有暴露 RepoSteward 的启动失败。监控 workflow 健康不能只读 commit checks。

主仓 1,159 个 deployment 中，Vercel Bot 创建 1,139 个；可辨认的 Preview 有 716 个、Production 有 313 个，npm environment 有 20 个。环境命名存在历史分裂。npm 发布走手工 `Release Packages` workflow 和 OIDC。workflow 注释描述了受保护 environment，API 取证时该 environment 没有 required reviewers 或 main-only protection rule，且允许管理员绕过。

`dcbot` 没有 Go test、build、vet、lint、secret scan、artifact 或 deployment workflow。真实部署状态无法从仓库复原。

## Milestone 与 Project

主仓 milestone 同时用于版本和独立 program。版本 milestone 的实际哲学是固定日期、浮动范围；program milestone 可以不阻塞 release。

调查时存在关闭 milestone 仍有 open item，以及 open milestone 没有剩余 open item 的漂移。Milestone 关闭前需要完整审计。它不适合作为日常 Kanban 状态。

| Milestone                             | 状态   | open / closed items | 用途                     |
| ------------------------------------- | ------ | ------------------: | ------------------------ |
| v0.1 — First Launch Path              | closed |             0 / 139 | 发布结果                 |
| v0.2 — Executable Protocol Baseline   | closed |             1 / 116 | 发布结果，存在关闭漂移   |
| v0.3 — November 2026 Release Baseline | open   |              2 / 35 | 固定日期、浮动范围       |
| Website Self-Hosting                  | open   |               1 / 0 | 独立 program             |
| AI-Native Autonomous Maintenance      | open   |               0 / 2 | 独立 program，需状态审计 |
| Research & Publication                | open   |               7 / 0 | 独立 program             |

当前凭据观测到组织 Project 总量为零，但字段级读取缺少 `read:project`，所以 Project 的实时状态仍有权限边界。规划中的 Project 应是多仓库操作视图，字段承担 readiness、status、claim、evidence、required comprehension 和 permission ceiling。它不能成为第二份 spec，也不能因为 Agent 分数而自动批准工作。可实施设计位于 `internal/governance/project-v2-design.md`。

## Discussion

主仓只保留两个接近默认状态的 Discussion，尚未形成稳定的日常决策习惯。可用 categories 是 Announcements、General、Ideas、Polls、Q&A 与 Show and tell；其中 Q&A 支持 accepted answer。Discussion 适合承接问题、想法和未成形讨论。可实施范围仍需落到 Issue、spec、record 或 PR。

## dcbot 信任与权限

`dcbot` 有分层但彼此相关的授权表示。

Discord 信任分为 Community、Contributor 和 Trusted。Contributor 需要通过当前 Challenge 并绑定 GitHub OAuth；Trusted 还需要实时 GitHub 关系。

Agent 运行时另有 Public、Contributor、Member、Collaborator 和 Maintainer 档位。GitHub `triage` 映射到 Contributor，组织成员与外部 write collaborator 的语义不同，maintain 与 admin 当前合并为 Maintainer。

代码锚点位于 `D:\dcbot`：`internal/discordbot/bot.go:847` 组合 Discord trust 显示，`internal/discordbot/agent_queue.go:172` 先应用 Contributor gate 再取更高实时权限，`internal/agent/permission.go:38` 将 GitHub relationship 映射为 Agent tier。由此可见 runtime tier 不是与 Discord trust 毫无关系的独立分数，而是 Contributor 准入与实时 GitHub relationship 共同派生的执行表示。

Discord 信任不能替代 GitHub 权限。Agent 理解测评也不能替代任一权限。有效能力只能取多轴交集。

Agent 或 GUI 准备的写操作使用短期、发起人绑定、单次消费的 draft 和 confirm；普通消息镜像、reaction 等直接用户动作不是同一流程。文档不得概括成“所有写入都有二次确认”。

主要待处理风险包括：

- 私有频道跨线程回复缺少发起者可见性复查；
- draft 到 confirm 之间并非每类动作都重查实时 GitHub 关系；
- Agent 与 GUI 的 approve/merge 准入不一致；
- 高风险写入审计不完整；
- GitHub App 安装范围曾超过单仓库需要；
- 身份和 capability 混在序数 enum 中。

现有 Discord Challenge 是人类贡献引导，答案和解释位于代码中。它不能复用为 Agent 智力或权限认证。

## 安全与仓库健康

主仓有 README、CONTRIBUTING、license、PR template 和可生成 SBOM 的 Dependency Graph，但缺少 CODEOWNERS，Dependabot alerts 与 code scanning 没有形成有效门禁，Actions 依赖 pinning 策略也不统一。

`dcbot` 缺少 license、CONTRIBUTING、PR template、Issue template、CODEOWNERS 和仓库级 CI。

`dcbot` 调查时只有 `main` 一个分支和 76 个 commit，全部来自同一作者。GitHub 显示 commit signature 已验证，但只有少量 commit 带 DCO `Signed-off-by`。仓库 labels 只有未使用的默认集合。

## 调查结论

主仓已经形成“Issue 塑形、spec-first、PR 交付、CI 证据、独立 review、单独发布”的真实路径。速度来自高吞吐和短反馈，但关键门禁仍有一部分依赖维护者纪律。

`dcbot` 的信任系统比它自己的仓库治理成熟得多。两者需要共享权限交集和人类闸门哲学，但不能在文档里假装已经拥有相同的 CI、分支保护和发布证据。

近期治理优先级应是：

1. 将完整 CI 或汇总检查加入主仓 required checks。
2. 修复 Release Cadence 和 RepoSteward workflow 启动故障。
3. 为 npm environment 增加当前人类审批和分支限制。
4. 为 `dcbot` 增加基础 CI 与 PR 验收路径。
5. 归并重复 labels。
6. 建立组织 Project 与可领取的 ready queue。
7. 增加路径所有者或等价的独立 reviewer 路由。
8. 补齐依赖、secret 和 code scanning。
