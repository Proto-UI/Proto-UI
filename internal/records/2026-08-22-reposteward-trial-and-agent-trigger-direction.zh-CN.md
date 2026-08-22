# RepoSteward 轻度集成试用与 Agent 自动触发方向

日期：2026-08-22

## 背景与基线

Proto UI 已有两类相邻但不同的 Agent 工作流：

- `internal/autonomous-maintenance/**` 的 Phase 0.1 负责有边界的自主发现、独立核验、受控修复与复审；它仍由维护者手动触发，并保留 finding、semantic 与 integration 门禁。
- `internal/agent-operations/**` 的 Phase A shadow 已通过每日 schedule 和 `workflow_dispatch` 自动采集 Issue / PR 快照，在有 `OPENAI_API_KEY` 时运行只读 Codex 分析，并把输入和报告保存为 Actions artifacts。

因此，“让能力自动触发”不再需要新建第二套调度控制面。当前问题变成：哪些能力适合注册到 Agent Operations、由什么事件触发、结果写到哪里、失败怎样可见，以及何时仍必须停在人类门禁。

RepoSteward 是一个 0.x、本地优先、策略门禁式的 GitHub 维护控制面。本次评估固定到 `tiammomo/RepoSteward@e5db7d3496ef15072135533c5b9f4da91084b553`，不追踪浮动 `main`。这份 record 是短期试验方向，不是 Proto UI 语义来源，也不授权扩大 GitHub 写权限。

## 已观察事实

### Proto UI 的需求

2026-08-22 的调研快照显示，Proto UI 同时存在多条开放 PR，且 changed paths 有明显交叠。维护者目前需要手动识别：

- 哪些 PR 修改同一文件或同一投影面；
- 哪个 PR 因 CI、review、draft 或事实不完整而不能继续；
- 哪些结果只需要汇总，哪些需要维护者做语义或集成决定；
- Agent 任务结束后如何稳定回传，而不是由维护者复制粘贴结论。

现有原生 Agent Operations collector 能做 Issue / PR 路由，但 PR 输入只覆盖基础 identity、labels、reviewers 与 head/base SHA；它尚不计算 changed-file overlap，也不汇总 RepoSteward 的仓库级 portfolio 事实。

### RepoSteward 试跑

在临时 XDG 目录中用上述固定提交执行：

```sh
uv run reposteward --config /tmp/reposteward-proto-ui-smoke/project.toml \
  portfolio inspect Proto-UI/Proto-UI --format json
```

一次认证后的真实只读试跑在约 28 秒内返回：

- 14 个开放 PR；
- 4 个 draft PR；
- 19 对 changed-file overlap；
- 27 个出现在 overlap 中的文件；
- 1 个事实不完整的 PR；
- 2 条快照错误：一条 checks 不完整，一条采集期间 PR 状态变化。

这些数字只描述当时快照。更重要的行为是：RepoSteward 没有把部分失败隐藏成完整事实，而是返回 `complete: false`、逐 PR completeness 和错误原因。这适合成为维护者收件箱或后续 Agent 分析的证据输入。

## 当前决定

### 1. 把 RepoSteward 作为外部证据引擎，而不是替代 Agent Operations

在 `internal/agent-operations/workflows.yaml` 注册 `reposteward-pr-portfolio`，但保持：

- `status: manual-shadow-trial`；
- 仅 `manual-dispatch`；
- `mutationPolicy: read-only-artifact`；
- 输出原始 JSON 和 Proto UI 自己验证过的 envelope；
- 不把外部工具的本地数据库当作 Proto UI 的 Issue / PR 状态真相。

RepoSteward 负责生成较丰富的 portfolio 事实；Agent Operations 继续负责触发、权限、工件、晋级条件和人类门禁。两者不是互斥方案。

### 2. 本 PR 只落实 Stage R0 / R1

本 PR 新增一个手动 shadow workflow：

1. 使用 GitHub hosted runner，不部署常驻服务；
2. 用完整 commit SHA checkout RepoSteward，核对实际 HEAD，并按其 `uv.lock` frozen 安装运行依赖；
3. 创建位于 `${RUNNER_TEMP}` / XDG 临时目录的配置和状态；
4. 只运行 `portfolio inspect`；
5. 用 `scripts/agent-operations/reposteward-portfolio.mjs` 校验仓库 identity、PR identity、统计一致性、完整性声明和固定引擎提交；
6. 上传原始快照与 envelope，保留 14 天；
7. 在 Actions step summary 中明确显示 complete / incomplete、错误数和零 GitHub 写入。

所需 GitHub 权限只有 `contents: read`、`pull-requests: read`、`checks: read` 与 `statuses: read`。该 workflow 不需要 `OPENAI_API_KEY`、Codex、Docker、RepoSteward runner image 或额外服务。

### 3. 自动触发按风险分层推进

| 能力 | 当前触发 | 本阶段方向 | 理由 |
| --- | --- | --- | --- |
| 原生 Issue / PR shadow 路由 | 每日 schedule + manual | 保持 | 已有只读、结构化、artifact 回传边界 |
| RepoSteward PR portfolio | manual | 先收集试用证据，再决定 schedule | 外部工具仍处 0.x，且需评估 overlap 信噪比与快照成本 |
| RepoSteward CI diagnose | 未接入 | R2 候选，先对 2–3 个真实失败手动试用 | 需要先证明比现有 check 页面更节省注意力 |
| Autonomous Observer | explicit maintainer task | 暂不自动 schedule | `AM-P0-005` no-finding 与后续 repeatability control 尚未完成 |
| Verifier / Review Synthesizer | 手动 fresh task | 以后可由 controller 在合法前置状态后自动创建 | 仍需保证 fresh context、原始 artifact 交接和独立性 |
| 修复、commit、PR、merge、release | 人类授权 | 继续门禁 | 自动触发不等于自动获得 mutation 或集成权限 |

## 试用计划与验收

### R0：供应链与权限冻结（本 PR）

- RepoSteward 以完整 SHA 固定，依赖按该提交的 `uv.lock` frozen 安装；升级必须通过新的 review diff。
- workflow 不含 GitHub write permission，不持久化凭据，checkout 禁用 persisted credentials。
- checker 拒绝浮动引擎提交、错误仓库、重复 PR identity、伪造完整快照和统计不一致。

### R1：PR portfolio shadow（本 PR 开始）

手动运行至少 3 个观察窗口，其中至少一个处于 PR 活跃更新期、一个处于相对静止期。维护者复核：

- 开放 PR identity 是否完整，缺失是否都有明确 error；
- overlap pair 是否准确，是否真的影响 review / rebase / 合并顺序；
- incomplete snapshot 是否阻止下游把它表述为完整事实；
- 单次运行时间、Actions minutes、artifact 大小和维护者审阅时间；
- 是否至少产生一个可执行的 portfolio 决策，或明确证明没有额外价值。

R1 的毕业条件不是“workflow 运行成功”，而是：零写入、零未解释 identity 缺失、抽样 overlap 无误报、维护者确认结果能节省注意力，并通过单独 PR 明确批准新增 schedule。若不能满足，则移除 workflow 和 registry entry，不影响原生 Agent Operations。

### R2：CI diagnosis（延后）

只对 2–3 个真实失败 PR 手动运行 RepoSteward `ci diagnose`，与 GitHub checks 页面和现有 Agent 输出对照。先定义只读 envelope、失败分类和 artifact handoff，再考虑事件触发。不得在本阶段 rerun、comment、repair 或 push。

### R3：Issue 到 Draft PR（延后且需单独授权）

只有在 portfolio / CI 试用有明确收益后，才选择一个范围小、语义已明确、无竞争工作的 Issue：先生成本地 Review Packet，不 submit；再次人工批准后最多创建一个 Draft PR。自动 ready、approve、merge、publication 和 release 不在路线内。

## 成本与风险

### 成本

- 无常驻服务部署；使用 GitHub hosted Actions。
- 每次 R1 需要 Python 3.12、从固定 Git commit 安装 RepoSteward，并消耗 GitHub API 配额与少量 Actions minutes。
- raw snapshot 和 envelope 保存 14 天；没有长期运行数据库。
- 本地试跑本身只用了约 344 KiB 临时配置 / 状态（不含共享 uv cache）；CI 安装缓存和网络时间需从真实 Actions run 记录。
- portfolio 阶段没有模型 token 成本。

### 风险与缓解

- **0.x 接口变化**：固定 commit；升级时同时更新 registry、schema/checker、workflow 和 replay fixture。
- **外部供应链执行**：只执行评审过的固定 commit；token 只读；不暴露其他 secrets。
- **GitHub 状态并发变化**：允许输出 incomplete，但必须保留错误并禁止宣称完整。
- **重复控制面**：RepoSteward 只作为 `pr-steward` 证据源，不接管 trigger policy、人类门禁或 Proto UI 状态真相。
- **噪声自动化**：R1 不 schedule、不 comment、不通知；先验证信噪比。
- **自动维护过早**：Autonomous Maintenance 在 no-finding 和 repeatability controls 完成前维持手动触发。

## 非目标

- 不改变 `spec/**` 或 Proto UI 产品语义。
- 不自动创建或修改 Issue、PR、label、comment、review、branch 或 commit。
- 不自动修复 CI，不自动提交 RepoSteward 生成的变更。
- 不自动 ready、approve、merge、发布或 release。
- 不把 Actions artifacts 建成第二个 Issue tracker。
- 不在本 PR 给 RepoSteward portfolio 增加 schedule。

## 复审触发条件

出现以下任一情况时应新增 record，而不是改写本记录：

- 完成 3 个 R1 观察窗口；
- 计划升级 RepoSteward commit；
- 计划增加 schedule、事件触发或任何 GitHub write permission；
- 计划把 RepoSteward 输出送入 Agent 自动分析；
- 完成 `AM-P0-005` no-finding 与 repeatability control，准备自动触发 Autonomous Observer；
- 发现外部快照与 GitHub 当前事实无法解释的不一致。

## 参考

- RepoSteward：<https://github.com/tiammomo/RepoSteward>
- Codex GitHub Action：<https://learn.chatgpt.com/docs/github-action>
- Codex scheduled tasks：<https://learn.chatgpt.com/docs/automations>
- Workspace Agent trigger runs API：<https://developers.openai.com/workspace-agents/trigger-runs>
