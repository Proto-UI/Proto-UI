# Proto UI CI/CD 使用说明

本文说明仓库内 GitHub Actions 工作流的职责，以及它们与全局精确版本和首发 package 治理的关系。

发布身份来自适用的 `V-*` 实体与不可变发布证据。本指南不硬编码当前版本。

## 工作流总览

| 工作流 | 文件 | 作用 |
| --- | --- | --- |
| CI | `.github/workflows/ci.yml` | PR 的轻量计划与策略检查；定时或显式 dispatch 执行完整回归 |
| Release Packages | `.github/workflows/release-packages.yml` | 手动执行 release scan、stage 彩排或全量发布 |
| Release Cadence | `.github/workflows/release-cadence.yml` | 定期检查距最近 `v*` release 的时间并提醒维护者 |
| Agent Operations Shadow | `.github/workflows/agent-operations-shadow.yml` | 只读的 Issue 与 PR intake/reconciliation lane |
| RepoSteward Portfolio Shadow Trial | `.github/workflows/reposteward-portfolio-shadow.yml` | 手动触发的只读外部 portfolio 实验 |
| Intranet preview build | `.github/workflows/intranet-preview-build.yml` | 无部署 secret 的 exact-PR-head 文档 artifact 构建 |
| Intranet preview checks | `.github/workflows/intranet-preview-checks.yml` | artifact 准入、发布与静态服务的 focused checks |

其余文件的 event inventory 见下文[回归 cadence 与 event inventory](#回归-cadence-与-event-inventory)。

## CI 工作流（`ci.yml`）

CI 在 pull request、手动触发，以及每天三次针对默认分支 head 的定时回归 cycle 中运行。仓库内任何 workflow 都不再使用 `push` 触发；定时 cycle 是主干回归的唯一入口。除常规类型与测试外，它会执行 `check-version-governance`，确保：

- 根 `VERSION` 与全部公开 `@proto.ui/*` package 精确一致
- 当前版本有且只有一个对应的 V 实体
- `0.2.0-rc.0` 起的实体版本引用来自已声明 V 实体
- launch governance 的 release line 与当前版本一致

任何新数字版本都必须先成为受评审的 release train，不能通过局部 package 改版绕过。

仓库政策要求合并前取得相关 CI 证据。GitHub ruleset 与 required check 配置属于外部控制，必须单独审计；约定上的绿色状态不等于平台强制的合并门禁。带日期的协作取证记录保存调查时观察到的配置和已知缺口。

`public_package_plan` 会根据 pull request diff 推导受影响的公开 package 图。package 变化会选中改动 package、它的反向消费者，以及构建该集合所需的全部上游公开依赖；仓库级构建、release、预算、lockfile、manifest 或 workflow 变化则选中全部公开 package。完整 cycle 的 build job 会检查生成式 manifest、产出 JavaScript 与声明文件、执行原生 ESM import smoke，并检查代表性 gzip 预算。定时与手动 cycle 运行全量集合；PR 的计划结果不代表实际执行了这些构建与 consumer 检查。

`release-consumer-react` 会从当前源码构建全部公开 package tarball，并在 monorepo 外的临时 React + Vite 项目中安装当前发布依赖闭包。该门禁禁止 `@proto.ui/*` 回退到 npm registry 或 workspace 源码，验证 staged manifest 的全部非通配 export target，并验证 CLI facade 生成、TypeScript、production build 和基础运行时行为。在扩展完整 fixture 前，它还会先只生成 Shadcn Button，并检查最终 Rollup module graph 不包含其他 Base/Shadcn prototype family；这是一项 family 边界检测，不是固定 bundle 大小预算。

PR 更新只自动运行策略解析、精确版本核对、package 计划和 browser inventory 计划，不自动运行全量构建、类型检查、Rust、浏览器或 package consumer。完整检查仅由定时 cycle 或显式 exact-ref dispatch 运行。跳过不是通过：可信 CI/DCO、独立 exact-head review 与实际平台门禁保持不变，旧 main baseline 不能补齐新 head 缺失的检查；需要时在分支完成并受评审后显式运行一次，而不是每次开发 push 都扇出。

## 回归 cadence 与 event inventory

release 层面的 cadence 策略——红灯规则、repair-only 模式与恢复条件——由 [release-0.3-plan.md](release-0.3-plan.md) 统一给出；本节只记录 workflow 实现与触发事实，不重复该策略正文。

### 定时回归 cycle

`.github/workflows/ci.yml` 是仓库内唯一拥有回归 schedule 的 workflow。它在每天三个固定 slot 对默认分支 head 运行完整 CI lane 集合——lockstep、package plan/build、types、Rust、`runtime-ci.mjs` 完整套件计划（已注册 browser suite 全量清单；plan 对未注册或未分配 suite 一律 fail closed）、release scan/stage、隔离 consumer，以及以 reusable job 形式并入的 coverage-governance 与 agent-operations fixture 检查：

| Cron         | 计划时间（UTC） | 东八区（Asia/Shanghai）等价时间 |
| ------------ | --------------- | ------------------------------- |
| `0 0 * * *`  | 00:00           | 08:00                           |
| `0 8 * * *`  | 08:00           | 16:00                           |
| `0 16 * * *` | 16:00           | 00:00（次日）                   |

GitHub cron 只能尽力调度，可能延迟或被跳过；cycle 不承诺精确墙钟时刻。每个 cycle 都以 `cycle-report` job 收尾，把确切 source revision、完整 lane inventory 及逐 lane 结果、计划 slot、实际开始时间、queue 延迟、错过的 slot、连续非绿 cycle 数和距上次有效 baseline 的小时数写入 `regression-cycle-<sha>-<run>-attempt-<n>` artifact（保留 30 天）。从未开始的 lane 记为 unknown，unknown 不等于通过：只要任一 lane 结果不是 `success`，`cycle-report` 就 fail closed。超过 60 分钟的 queue 延迟和错过的 slot 以 workflow annotation 和 receipt incident 形式呈现，而不是伪造绿色结果。

`workflow_dispatch` 手动触发运行同一组完整 lane，用于定向诊断，并生成 `scheduledSlot: null` 的同类 receipt；它不会代替 schedule 产生 cycle。只有完整成功的 cycle 才构成 baseline；queued、未结束、cancelled 或失败的 cycle 一律计入非绿（包括当前 cycle 自身），slot/遗漏分析自策略生效时刻起算，早期历史不会伪造出遗漏 slot。

`ci-production-suites.yml` 调用 [runtime-test-plan.mjs](../../scripts/test/runtime-test-plan.mjs) 中完整 `PRODUCTION_BROWSER_SUITES` 清单的专属 owner；production Search 由 `homepage-visual-evidence.yml` 实际运行，不因 shared-dev 分片排除而漏跑。0.3 治理审查源 `4db52751` 注册了 **34 个套件**；原先 29 个的口径保留为 cadence 初始清单的历史记录。两条独立依赖链限制重工作流扇出，保留各自 artifact；前项失败不阻止后项，取消整个 cycle 除外。四条原 push-only source-check lane 也每轮调用一次。Experimental 套件保留真实失败，执行它们不代表把其他家族准入 0.3。

策略生效时间从完整源码历史读取：沿 first-parent 找到首次引入 `scripts/ci/cycle-report.mjs` 的实际集成提交时间，不硬编码规划日期。当前完整绿色 cycle 重置连续红灯计数，另行统计连续两轮 scheduled green 供恢复判断；没有绿色 baseline 时，24 小时计时从实际生效开始。手动运行不能伪造定时恢复轮次。

### 并发与取消策略

- Pull-request lane 按 `ci-<ref>-pr` 分组且 `cancel-in-progress: true`：同一 PR 的新提交只取代该 PR 自身的过期运行。
- 定时与手动 cycle 按 `ci-<ref>-cycle` 分组且 `cancel-in-progress: false`：正在进行的证据产出运行永不取消，同一源线上重复的排队 cycle 合并为最新的一条待执行运行。
- 其他 workflow 均不持有回归 schedule，cycle 是唯一协调入口；专用证据 lane 不再随 pull request 自动运行（保留 manual/callable 用于 exact-ref 诊断），也不被复制成定时任务。

### Event inventory 审计

在 no-push 策略下审计了每个 workflow 的 event 触发。保留的触发及理由：

| 文件 | 变更后的触发 | 理由 |
| --- | --- | --- |
| `ci.yml` | `pull_request`、`workflow_dispatch`、`schedule`（3 个 slot） | PR 只自动执行轻量 metadata；全量回归在 schedule 或显式 exact-ref dispatch 执行。可信 check 名与合入要求不变，skipped 不能冒充集成许可 |
| `effect-graph-model.yml`、`shadcn-style-source.yml`、`intranet-preview-checks.yml`、`compiler-isolated-static-smoke.yml`、`compiler-wc-runner-preflight.yml` | `pull_request`（带 paths）、`workflow_dispatch`、`workflow_call` | 轻量平台检查 allowlist：有界 node 运行——无浏览器、无 docs/package 构建、无全量 workspace install；ci.yml 之外仅存的自动 PR 触发 |
| `coverage-governance.yml`、`agent-operations-fixtures.yml`、`ci-production-suites.yml` | `workflow_dispatch`、`workflow_call` | ci.yml 的全量 cycle 调用；cycle-report 保留终态结果 |
| `agent-operations-shadow.yml` | `schedule`（`17 * * * *`）、`workflow_dispatch` | 只读 intake/reconciliation lane 的每小时定时；与回归执行无关 |
| `release-cadence.yml` | `schedule`（`7 10 * * 4`）、`workflow_dispatch` | 仅每周发布提醒 |
| `release-packages.yml`、`reposteward-portfolio-shadow.yml` | `workflow_dispatch` | 手动发布彩排/发布与只读 portfolio 实验；不变 |
| `intranet-preview-build.yml` | `workflow_dispatch`（必填 `pr_number`/`expected_head_sha` inputs）、`workflow_call` | 显式输入把构建绑定到指定开放 PR 与精确 head；30 分钟 builder 不持有自动 PR 触发器 |
| 其余证据/诊断 lane | `workflow_dispatch`、`workflow_call`（带受保护 ref 绑定） | per-change 证据扇出已关闭：共享套件由 ci.yml cycle 覆盖，所有专用 lane 保留 exact-ref 诊断能力；重 lane 不持有任何自动触发 |

上述 `pull_request` allowlist 由 `scripts/ci/check-ci-schedule.mjs`（`pull-request-not-allowed`）强制：给其他任何文件新增自动 PR 触发会使 `ci-config-audit` lane fail。manual/callable lane 中 `github.event.pull_request.*` 仅出现在 `|| github.sha` 一类回退之后，因此永远不会渲染出空 ref。

### Event context 与来源规则

- 能在无 pull_request 事件下运行的 workflow，不得无回退地读取 `github.event.pull_request.*`；`scripts/ci/check-ci-schedule.mjs` 的源码审计强制该规则，并由每条 lane 上的 `ci-config-audit` job 执行。
- 定时与手动 cycle 按 `github.sha` 精确 checkout；`cycle-plan` 将 spec-authoring delta 绑定到同分支最近一次成功定时 cycle 的源码，首轮绿色之前则用策略引入提交的 parent，并验证 ancestor。不能只比较 `HEAD^1`，否则每天两轮之间较早的提交会漏检。
- 可信 CI 证据契约（`workflowNames: [CI]`、`workflowPaths: [.github/workflows/ci.yml]`、check 名 `lockstep-check`、`public_package_plan`、`type-check`、`test`、`release-scan`，见 `internal/agent-operations/capability-policy.yaml`）不变；DCO 归属门禁是 `.github/dco.yml` 配置的外部 probot app，保持不变。

### 受保护的 lane

- 发布与发行不受影响：`release-packages.yml` 仍为手动触发并保留 environment/OIDC 保护；`release-cadence.yml` 仍为每周提醒。回归 cycle 不发布、不部署、不改变 access、secrets、ruleset 或分支保护。
- Queue 恢复只作用于已识别的回归运行；cycle 不取消发布运行或其他所有者的诊断运行。

### 验证计划

配置解析验证（在每条 CI lane 上的 `ci-config-audit` job 中执行）：

- `node scripts/ci/check-ci-schedule.mjs` 审计每个 workflow 文件：无 `push`/`merge_group`/`pull_request_target` 触发、唯一回归 schedule 持有者与三个 slot、无重复 schedule、非 PR 事件下 `pull_request` context 均有回退、声明了 permissions、`ci.yml` 中 trusted job 名齐全、reusable lane 保持可用。
- `ci.yml` 没有 workflow 层级 token grant。读取运行历史的 `cycle-plan` 与 `cycle-report` 显式声明 `contents: read`、`actions: read`；callable coverage-governance 保留已声明的只读 Issue/PR 权限。cycle 不授予写权限。
- `node --test scripts/ci/test/ci-scheduling-policy.test.mjs` 用正反 fixture inventory 与真实仓库状态覆盖同一组规则。

行为验证（由父代理在合入后的首个 cycle 上执行）：

- 首个定时 slot 后，确认 `event=schedule` 的 `ci.yml` 运行产出 `regression-cycle-<sha>` artifact，其 `sourceRevision` 等于触发时的默认分支 head，lane inventory 覆盖 `cycle-report.needs` 全部条目（含 production suites），receipt 记录 cron slot、实际开始与 queue 延迟。
- 确认一次 `workflow_dispatch` 运行产出 `scheduledSlot: null` 的同类 receipt，重复排队的 cycle 合并而不取消活动运行。
- 确认对原 push lane（如 `shadcn-style-source.yml`）的一次 `workflow_dispatch` 在无 pull_request context 错误下完成。
- 确认 PR 更新只运行 metadata lane 与 DCO，完整检查明确 skipped 而非伪造 success；集成前的 exact-ref dispatch 提供真实完整检查结果。PR lane 不运行 `cycle-report`。

## Agent Operations Shadow 工作流（`agent-operations-shadow.yml`）

这条 Phase A intake 与 reconciliation lane 当前在 UTC 每小时第 17 分钟自动运行，也可由维护者手动触发。它会采集有上限的开放 Issue 与 PR 快照；在配置了 `OPENAI_API_KEY` 时执行只读结构化分析、校验结果，并以 14 天保留期上传输入和报告。没有配置密钥时，工作流保留有边界的输入快照。hourly 是当前已部署的自动触发方式；event-driven invocation 是未来目标架构，当前仓库状态没有其部署证据。

该工作流对 `contents`、`issues` 与 `pull-requests` 只有读取权限，禁用 checkout credential 持久化，并让 Codex 使用 `:read-only` permission profile 和 `drop-sudo`。这些控制约束的是本条 ingestion credential：工作流负责观察与 reconciliation，自身不发布评论、不修改 label、不创建分支、不提交 review，也不集成 PR。它们不是 Contributor Agent 或本地 review/integration schedule 的全局能力上限。

普通 Contributor Agent 使用 `internal/agent-operations/skills.yaml` 下的懒加载 skill registry，不属于定时 shadow workflow。`$pui-dev` 负责普通开发，`$pui-maintain` 负责独立的自治维护协议。三个 scheduled scope 都是 `pending-runtime-identity`，在绑定 Poppy broker-verified workload identity 前只能进行只读观察与 reconciliation，不能提交 review 或集成 PR；有人协作时的 review 或 integration 需要 current-user 的明确授权，未来 standing scope 激活后仍必须匹配授权、可信证据、fresh canonical input、实时 credential 权限，并与 review state 和仓库规则一致。人类决策只保留给未决产品方向和特权或不可逆操作；扩大本工作流自身 token、变更访问或 secrets、publication 与 release 均属于这一边界。

## 内网贡献者预览工作流

`intranet-preview-build.yml` 仅通过手动 dispatch 或 reusable call 运行，输入指定 PR number 与精确 expected head SHA。它仅有 `contents: read`，使用一次性的 hosted builder，不接收部署 secrets。执行贡献者 checkout 前先上传 Actions identity marker，随后上传 canonical 文档 ZIP；两份 artifact 都保留三天。

`intranet-preview-checks.yml` 在 PR 的 preview 文件变化、手动 dispatch 或 reusable call 时运行 native Node 准入、解压、sanitation、发布与静态服务 focused suite。主干检查由统一定时回归 cycle 调用，不持有 push 触发器。两条 workflow 都不部署 Poppy、不调用 Cloudflare、不写 PR 评论，也不在持久 publisher 上执行贡献者代码。

唯一 publisher 是单独配置的受信内网进程。它下载 hostile artifact，复核 live PR/head/run/attempt 及 supersession，再将普通、不可执行文件发布到独立 generation origin。静态 server 没有 credential 或 control API。内网受众替代已经退役的 per-author/reviewer OAuth 策略；polling 与五分钟 catalog lease 提供有界收敛，不承诺即时撤销。配置、安全上限与运行验收见 `scripts/preview/README.md`。

旧 Poppy workflows、Pages provider、dcbot fallback 和重复 integration templates 已从源码移除。平台 workflow 注册、preview-only credentials、Pages resources 与已部署 bot/edge callbacks 的退役仍需 live 证据；删除源码和绿色测试不能证明外部清理或新的 hosted-build 到内网链路已经完成。

## 发布工作流（`release-packages.yml`）

该工作流仅通过 `workflow_dispatch` 手动触发。

### 关键入参

- `mode`：`scan` / `stage` / `publish-all`
- `profile`：`workspace` / `launch`
- `include_approved_candidates`：仅影响 launch 审计集合
- `resume_published`：仅用于部分发布恢复；只跳过 integrity 完全相同的已发布 tarball
- `publish_delay_ms`、`max_publish_retries`、`retry_delay_ms`：npm 限流保护参数

工作流不接受临时 `version`、`tag` 或 `only` 输入。版本和 dist-tag 均来自已评审的仓库状态：prerelease 使用 `next`，stable 使用 `latest`。

### 安全规则

- `publish-all` 仅允许在 `main` 上运行。
- `publish-all` 必须使用 `workspace` profile；`launch` 只用于产品范围审计和彩排。
- 真实发布会选择 GitHub `npm` environment，并使用 npm Trusted Publishing OIDC。Environment reviewer、分支限制和管理员 bypass 均属于外部配置；发布前必须现场核验，不能仅凭 workflow 文件推断这些保护存在。
- `stage` 与 `publish-all` 在 package 暂存前检查全部公开 package identity 均已可从 npm registry 读取，且其 bootstrap dist-tag/deprecation 状态满足发布门禁；该检查无法读取私有的 Trusted Publisher 设置，后者仍由维护者负责核对。
- 同一 ref 上启用并发互斥，避免重叠发布任务。
- 全部公开 package 发布成功后才创建 `v<version>` tag。

## Launch 治理与发布集合

`internal/governance/launch-package-governance.json` 定义首发产品承诺、文档和 smoke 的优先级。

- `--profile launch` 根据该文件检查首发承诺包和候选包。
- `--include-approved-candidates` 只扩展 launch 审计集合。
- `--check-governance` 检查 workspace package 是否全部完成分层。

这套分层不控制真实 npm 发布集合。全局精确版本策略要求 `workspace` profile 一次发布全部公开 `@proto.ui/*` package。

## 建议发版流程

1. 创建或更新 draft V 实体，并在 PR 中统一 `VERSION` 与 package manifests。
2. 重新生成并评审 release BOM 与说明，然后运行 `pnpm release:assets:check`。
3. 对每个首次出现的公开 package 名称，先发布明确不属于正式发行的 bootstrap 版本，并配置 Trusted Publisher。
4. 运行 `pnpm release:rehearse`，完成整套顺序执行的不发布门禁。CI 为了缩短反馈时间，仍将同一组检查拆成并行 job。
5. 审阅 launch 产品范围，以及隔离 React 与 CLI 多宿主 tarball consumer 结果。
6. 合入 `main` 后，记录当前 privileged publication authorization，再用 `workspace` profile 运行 `publish-all`。
7. 在单独的证据变更中核验 registry、tag、GitHub Release、assets、workflow head、deployment 与 spec snapshot digest，然后按受治理 lifecycle 推进 V 实体。

## 本地快捷命令

- `pnpm check:release-version`
- `pnpm release:bom`
- `pnpm release:assets:check`
- `pnpm release:registry:check`
- `pnpm release:scan:launch`
- `pnpm release:stage:launch`
- `pnpm release:stage`
- `pnpm release:smoke:react`
- `pnpm release:smoke:cli`
- `pnpm release:rehearse`
- `pnpm build:packages`
- `pnpm check:package-manifests`
- `pnpm check:package-budgets`
- `pnpm check:package-budgets:strict`
- `pnpm analysis:monorepo --benchmark --out <path>`

仓库不提供局部真实发布快捷命令；package 局部修复进入下一次全局 release train。

在已明确授权的 Finf 快速开发阶段，`check:package-budgets` 保留原阈值和真实失败比较，仅将尺寸超量作为 advisory；构建与测量错误仍阻断。`check:package-budgets:strict` 保持严格检查。详见[适用范围、68 项目标到期条件与恢复义务](finf-package-budgets.md)。
