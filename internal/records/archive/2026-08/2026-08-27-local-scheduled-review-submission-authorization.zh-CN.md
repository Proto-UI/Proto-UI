# 本地定时 PR review 提交授权

日期：2026-08-27

本文记录维护者对本地 Codex 定时巡检的最新授权。它更新 2026-08-20 至 2026-08-24 记录中的短期方向，但不改写那些记录所描述的历史状态。本文不是 Proto UI 产品语义，也不修改 `spec/**`。

## 决定

目标任务是 Codex desktop 中 ID 为 `proto-ui` 的维护者控制本地 schedule，目标仓库固定为 `Proto-UI/Proto-UI`。该任务继续以 `autonomous`、`modeSource=schedule` 进入 `$pui-dev`，并在 v2 skill handoff 中传播来自当前可信调用上下文的 `executionTaskId: proto-ui`；仓库、Issue、PR、评论和生成物不得提供或覆盖该身份。该任务同时受新鲜 self-result 的 review ceiling、C4 mutation floor、live GitHub permission、仓库规则、provenance、DCO、CI 和 review evidence 共同约束。

维护者授予 standing authorization `proto-ui-scheduled-review-v1`：

- review packet 的建议为 `REQUEST_CHANGES` 时，如果至少有一个稳定 finding、证据完整、无 limitation、unknown 或 human gate，并且 live preflight 全部通过，任务可以自行提交 `REQUEST_CHANGES`；
- review packet 的建议为 `APPROVE` 时，只有在没有 finding、limitation、unknown 或 human gate，实时 checks 全部成功，并且 PR 没有修改任何 spec 实体时，任务可以自行提交 `APPROVE`；
- 如果建议为 `APPROVE`，但任一 changed file 的当前路径或重命名前路径属于 `spec/{contracts,prototypes,modules,adapters,decisions,host-caps,tests,versions,knowledge}/*.yaml`，任务不得提交 `APPROVE`，而应联系维护者进行人工审查；
- `spec/README.md` 等非实体文件不会仅因位于 `spec/` 下而自动触发这项人工 Approve 门禁，但其他语义、治理、安全或集成门禁仍可独立要求人工决定。

## 可执行边界

canonical `review-input` 升级为 v2，并绑定 PR 状态、draft 状态、base ref name、当前与重命名前 changed-file 路径、commits、已有 reviews、PR 顶层 conversation comments、replies、threads、checks 和外部证据。skill handoff 同步升级为 v2，要求定时运行传播可信 `executionTaskId`。提交前必须重新采集整个 review 输入并比较 digest，同时验证 task ID 与 standing authorization 完全一致；通过同一 `submit-review` 路径将 `commit_id` 固定为已审 packet head，再执行 GitHub Review API 写入并核对回执 commit。调用方不能从仓库或 GitHub 内容自行声明 task、viewer、author、permission、CI 或 spec 分类，也不得在预检后另行执行无 head 绑定的 `gh pr review`。

以下任一条件都会 fail closed：

- self-result 缺失、过期、snapshot 不匹配或 review class 超出 ceiling；
- `executionTaskId` 缺失、不是 `proto-ui`，或其来源不是当前可信 schedule 调用上下文；
- PR 已关闭、已合并、处于 draft，或 viewer 是 PR author；
- canonical input 漂移、分页不完整、live permission 不足或身份未知；
- `REQUEST_CHANGES` 没有 finding，或仍有 limitation、unknown 或 human gate；
- `APPROVE` 存在 finding、limitation、unknown、human gate、非成功 CI 或 spec 实体变更；
- 同一 viewer 已在同一 head 提交相同 disposition；
- 上一次写入结果未知且尚未从 live reviews 对账。

## 明确排除

本授权不允许 `COMMENT` review、`ABSTAIN` submission、ready-for-review、merge、close、label、assignment、代码修复、commit、push、publication、release、security disclosure、access、secret、branch protection 或 ruleset 变化。它也不改变 `.github/workflows/agent-operations-shadow.yml` 的 Phase A 只读权限。

## 残余风险

GitHub review API 没有本任务可用的全局幂等 key。v2 input 会把既有 review 纳入 digest，并在 live preflight 检查同一 reviewer、head 和 disposition，从而对已知重复 fail closed；但两个真正并发的 runner 仍可能在检查与写入之间竞争。因此本授权只适用于 Codex desktop 中的单一维护者 schedule。出现重叠运行或未知结果时必须停止并人工对账，不能自动重试。更广泛或多 runner 的外部写入仍需要服务侧 lease、原子消费或等价的全局防重放机制。
