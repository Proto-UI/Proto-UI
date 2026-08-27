# 定时 PR review 与 integration standing authorization 激活

日期：2026-08-27

本文记录维护者在同日继续审查自动化边界后给出的最新方向。它更新《本地定时 PR review 提交授权》和《定时 PR review 的 runtime identity 阻塞》的当前执行状态，不改写两份记录当时描述的历史。本文不是 Proto UI 产品语义，也不修改 `spec/**`。

## 重新分类 runtime identity 门

仓库脚本无法把公开 task 名称、调用方传入 ID 或 `modeSource=schedule` 变成强 runtime authentication；但本地进程已经持有可直接调用 GitHub 的 credential，绕过仓库脚本并不需要伪造 task ID。因此，把 repository-verifiable task identity 设为单一持证本地 runner 的 review 写入前置条件，并没有形成真实安全边界，只形成了重复人工授权。

当前边界改为诚实表达其能力：standing policy 是本地维护者对一个受控 runner 的持续授权；真正独立生效的约束来自 fresh C4 ceiling、live GitHub permission、canonical input digest、exact-head API 参数、self-review 禁止、可信 CI、review evidence、GitHub rules 和单 runner 假设。扩展到多个或并发 runner 前，仍必须增加服务侧 lease、可验证 runtime attribution 和全局原子 replay prevention。

## Active review scope

`proto-ui-scheduled-review-v1` 改为 `active`：

- 完整且带稳定 finding 的 clean packet 可以自动提交 `REQUEST_CHANGES`；
- 无 finding、limitation、unknown 或未解决 gate 的 clean packet，可以在可信仓库 CI 成功且 changed-file 当前/旧路径均不属于九类 `spec/**` YAML 实体时自动提交 `APPROVE`；
- `COMMENT`、`ABSTAIN`、self-review、draft/closed PR、spec 实体自动批准、漂移 input、未知权限、重复 disposition 和未知写入结果继续 fail closed；
- review 写入继续通过唯一 `submit-review` primitive，并把 `commit_id` 固定为 packet head。

Canonical `review-input` 升级为 v3，把 check provider、repository、workflow name 与 workflow path provenance 一并纳入 digest。可信 CI 不能由任意外部 success 代替。`SKIPPED` 与 `NEUTRAL` 可以作为中性终态，但至少一个 policy 列出的 `Proto-UI/Proto-UI` GitHub Actions `CI` / `.github/workflows/ci.yml` check 必须真实 `SUCCESS`；external app success、status context 或其他 repository workflow success 不计作仓库验证证据。

## Active integration scope

新增 `proto-ui-scheduled-merge-v1` 与 `pui-integrate`。它只负责执行已经解决的 integration，不制造批准：

- canonical input 与 clean `APPROVE` packet 必须在 merge 边界保持一致；
- exact head 必须有至少一名非 PR author reviewer 的有效批准；任一 reviewer 在整个 PR 上最新的非 dismissed review 若仍为 `CHANGES_REQUESTED`，都继续阻止合入，直到该 reviewer 以新 review supersede 或该 review 被 dismiss；
- 所有 review thread 必须 resolved，可信 CI 必须成功，目标 base 固定为 `main`；
- GitHub 必须实时返回 `MERGEABLE` 与 `CLEAN`，credential 必须具有写权限；
- merge method 固定为 `squash`，唯一写入 primitive 把 `sha` 固定为已审 head，不允许 force、admin bypass 或后续未绑定的 `gh pr merge`；
- 写入结果未知时只允许一次 live reconciliation，不得盲目重试；即便 reconciliation 发现相同 head 已被合入，只要无法证明该 mutation 与固定的 squash method 来自本次调用，就必须保持 unattributed/unknown，不能制造成功 receipt。

spec 实体改动仍不能由 scheduled Agent 自动提交 `APPROVE`。如果 exact head 已由独立维护者批准，`pui-integrate` 可以机械执行 merge；这消除的是批准之后重复点击 merge 的门，不是语义 admission 门。

## 明确排除

两项 standing authorization 都不授权 ready-for-review、close-without-merge、label、assignment、代码修复、branch/ruleset、publication、release、access、secret 或 security disclosure。`.github/workflows/agent-operations-shadow.yml` 的 Phase A token 与只读边界保持不变。
