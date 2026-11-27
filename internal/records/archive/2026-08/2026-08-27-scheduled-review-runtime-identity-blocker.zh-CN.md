# 定时 PR review 的 runtime identity 阻塞

日期：2026-08-27

本文更新同日《本地定时 PR review 提交授权》的当前执行状态，不改写维护者当时授予授权以及随后尝试用 `executionTaskId` 绑定任务的历史。本文不是 Proto UI 产品语义，也不修改 `spec/**`。

## 观察

维护者希望 Codex desktop 的本地巡检任务在证据充分时自行提交 `REQUEST_CHANGES`，并且仅在 PR 没有修改 `spec/**` YAML 实体时自行提交 `APPROVE`。这一授权意图继续由 `proto-ui-scheduled-review-v1` 表达。

当前 Codex 定时任务能力没有向仓库提交边界提供可验证的 task/run identity。任务名称、公开 authorization ID、`executionModeSource: schedule` 或调用方传入的 `executionTaskId` 都可被另一调用方复用，不能证明当前调用确实来自获授权任务。因此同日记录所述的 v2 handoff task-ID 绑定不能激活 GitHub review 写入权限。

## 当前执行状态

`proto-ui-scheduled-review-v1` 改为 `pending-runtime-identity`，并由 `repository-and-task-bound-runtime-identity` 阻塞。在阻塞解除前：

- 定时任务可以只读巡检 PR、Issue 和 Discussion，完成分析并生成维护者决策包；
- 建议为 `REQUEST_CHANGES` 时不得向 GitHub 提交 review，应通知维护者；
- 建议为 `APPROVE` 时，无论 changed files 是否包含 spec 实体，都不得向 GitHub 提交 review，应通知维护者；
- `explicit-current-user` 的 human-assisted 提交流程保持不变；
- `COMMENT`、merge、ready-for-review、close、label、assignment、publication、release、access、secret 和 ruleset 操作仍不在授权范围内。

Runtime 对命中这一 pending authorization 的定时 review 写入返回稳定的 fail-closed 结果：`allowed: false`、`humanReviewRequired: true`，理由为 `scheduled review submission awaits trusted runtime identity`。

## 恢复条件

只有在提交边界能够验证由 Codex runtime 提供的 repository-and-task-bound identity，或者项目引入等价的签名执行信封、proof-of-possession 与防重放约束后，才能另行评审并激活该 standing authorization。激活仍不得绕过 live GitHub permission、canonical input digest、review evidence、CI、spec 实体人工门禁、self-review 禁止或其他 always-human gates。
