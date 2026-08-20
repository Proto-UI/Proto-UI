# Agent Operations Phase A：Issue / PR Shadow 控制面

日期：2026-08-20

## 背景

PR #451 建立了有边界的 Autonomous Maintenance Phase 0.1：Observer、Verifier、Remediator 与独立 Review Synthesizer 能在明确的人类门禁下推动一项维护 finding。它仍然是人工触发、面向维护发现的 domain workflow，不是通用的 GitHub 协作控制器。

当前 GitHub 快照有 34 个开放 Issue，其中 25 个未分配；20 个开放 PR 中，7 个处于 changes requested、8 个尚待 review、4 个为 draft。维护者已决定开始建设一条独立的 Agent Operations 工作流，用于自动理解这些协作对象、路由下一步并在需要时集中请求人类决策。

这份记录保存 2026-08-20 的实施方向，不是 Proto UI 语义来源。

## Phase A 决定

Phase A 采用 GitHub Actions 与 Codex GitHub Action 作为执行面，但保持完全 shadow：

- 只通过定时任务或 `workflow_dispatch` 运行，不响应不受信任的 PR workflow 代码；
- GitHub token 仅有 `contents`、`issues` 和 `pull-requests` 读取权限；
- collector 对 body 做长度限制、HTML comment 移除与控制字符清理；
- Codex 使用 `:read-only` permission profile、无网络，并把快照内容视为不受信任的数据；
- 模型只输出符合 JSON Schema 的 proposal；
- checker 再校验 policy version、snapshot digest、对象 identity、route 汇总、人类门禁和零写入；
- 输入与报告只作为短期 Actions artifact 保存，不写回 Issue、PR 或仓库运行账本。

没有 `OPENAI_API_KEY` 时，workflow 仍可采集并保存有边界的输入快照，但跳过 Agent 分析。

## 控制面与 domain workflow

`internal/agent-operations/**` 保存通用权限梯度、workflow registry、结构化输出和晋级门槛。Phase A 注册三条 workflow family：

- `issue-steward`：Issue 分类与路由，目前为 shadow；
- `pr-steward`：PR 状态与下一审查/决策路由，目前为 shadow；
- `autonomous-maintenance`：委托给 `internal/autonomous-maintenance/**` 的既有独立协议。

不会把 #451 的 finding/remediation 模型强加到普通 Issue 和 PR，也不会把 `internal/autonomous-maintenance/phase-0/runs.yaml` 扩张为 GitHub 事件数据库。

## 权限与人类门禁

Phase A 可以读取、分析和提出未来动作，但执行动作一律标记为 `blocked-by-shadow-policy`。以下事项持续需要独立的人类决定：

- finding 是否值得追踪；
- 产品语义、draft/active guarantee 或重大 scope 选择；
- DCO、来源权利、版权与安全处理；
- 代码 mutation 授权；
- commit grouping、ready-for-review、approve、merge、publication 与 release。

一个决策包必须集中说明观察事实、建议、批准范围、排除项、残余风险、下一自动阶段以及仍然需要单独授权的动作。

## 晋级条件

Phase A 至少运行两个观察窗口并由维护者评审不少于 50 个对象。晋级到可写的 Assist 阶段前需要同时满足：

- 未授权 mutation 为 0；
- 重复 mutation 为 0；
- gold fixtures 中应升级的人类门禁 recall 为 100%；
- 推荐 route 与维护者判断一致率至少为 90%；
- 通过单独的评审变更精确定义新增的 GitHub 白名单动作；
- 维护者显式批准权限扩大。

Phase A 成功运行本身不构成扩大权限的证据。

## 后续切片

1. 收集两个观察窗口的报告并记录人工 route 修正与决策时间。
2. 增加 maintainer-reviewed gold replay corpus，包括 no-op、过期 SHA、重复事件、外部贡献者和 prompt-injection control。
3. 只有在晋级条件满足后，设计一个确定性 applier，首批只允许更新 Agent 自己的状态评论、 `agent:*` 状态 label 和滚动 Maintainer Inbox。
4. 经另一次人类授权后，再实验从明确批准的 Issue 创建 draft PR；不自动 ready、approve、merge 或 release。
