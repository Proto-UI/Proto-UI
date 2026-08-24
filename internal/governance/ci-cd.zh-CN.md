# Proto UI CI/CD 使用说明

本文说明仓库内 GitHub Actions 工作流的职责，以及它们与全局精确版本和首发 package 治理的关系。

发布身份来自适用的 `V-*` 实体与不可变发布证据。本指南不硬编码当前版本。

## 工作流总览

| 工作流 | 文件 | 作用 |
| --- | --- | --- |
| CI | `.github/workflows/ci.yml` | PR 与主干的类型、测试、spec 和全局版本门禁 |
| Release Packages | `.github/workflows/release-packages.yml` | 手动执行 release scan、stage 彩排或全量发布 |
| Release Cadence | `.github/workflows/release-cadence.yml` | 定期检查距最近 `v*` release 的时间并提醒维护者 |
| Agent Operations Shadow | `.github/workflows/agent-operations-shadow.yml` | 只读的 Issue 与 PR 路由实验 |
| RepoSteward Portfolio Shadow Trial | `.github/workflows/reposteward-portfolio-shadow.yml` | 手动触发的只读外部 portfolio 实验 |

## CI 工作流（`ci.yml`）

CI 在 pull request、`main` push 和手动触发时运行。除常规类型与测试外，它会执行 `check-version-governance`，确保：

- 根 `VERSION` 与全部公开 `@proto.ui/*` package 精确一致
- 当前版本有且只有一个对应的 V 实体
- `0.2.0-rc.0` 起的实体版本引用来自已声明 V 实体
- launch governance 的 release line 与当前版本一致

任何新数字版本都必须先成为受评审的 release train，不能通过局部 package 改版绕过。

仓库政策要求合并前取得相关 CI 证据。GitHub ruleset 与 required check 配置属于外部控制，必须单独审计；约定上的绿色状态不等于平台强制的合并门禁。带日期的协作取证记录保存调查时观察到的配置和已知缺口。

`public_package_plan` 会根据 pull request diff 推导受影响的公开 package 图。package 变化会选中改动 package、它的反向消费者，以及构建该集合所需的全部上游公开依赖；仓库级构建、release、lockfile、manifest 或 workflow 变化则选中全部公开 package。后续 build job 会检查生成式 manifest、产出 JavaScript 与声明文件、执行原生 ESM import smoke，并检查代表性 gzip 预算。如果 PR 的受影响公开 package 图为空，release stage 与隔离 consumer job 可以跳过；`main` 与手动触发仍运行全量集合。

`release-consumer-react` 会从当前源码构建全部公开 package tarball，并在 monorepo 外的临时 React + Vite 项目中安装当前发布依赖闭包。该门禁禁止 `@proto.ui/*` 回退到 npm registry 或 workspace 源码，验证 staged manifest 的全部非通配 export target，并验证 CLI facade 生成、TypeScript、production build 和基础运行时行为。在扩展完整 fixture 前，它还会先只生成 Shadcn Button，并检查最终 Rollup module graph 不包含其他 Base/Shadcn prototype family；这是一项 family 边界检测，不是固定 bundle 大小预算。

## Agent Operations Shadow 工作流（`agent-operations-shadow.yml`）

这项 Phase A 实验每天定时或由维护者手动触发。它会采集有上限的开放 Issue 与 PR 快照；在配置了 `OPENAI_API_KEY` 时执行只读结构化分析、校验结果，并以 14 天保留期上传输入和报告。没有配置密钥时，工作流只保留有边界的输入快照。

该工作流对 `contents`、`issues` 与 `pull-requests` 只有读取权限，禁用 checkout credential 持久化，并让 Codex 使用 `:read-only` permission profile 和 `drop-sudo`。它不响应 PR 事件，不发布评论、不修改 label、不创建分支或 PR，也不授权 integration。未来若增加 GitHub 写权限，必须通过 `internal/agent-operations/**` 下的独立策略变更接受评审，并取得维护者的明确决定。

普通 Contributor Agent 使用 `internal/agent-operations/skills.yaml` 下的懒加载 skill registry，不属于定时 shadow workflow。`$pui-dev` 负责普通开发，`$pui-maintain` 负责独立的自治维护协议。

## 私有贡献者预览工作流（`poppy-preview-*.yml`）

五条 workflow 共同实现 Poppy/Cloudflare 私有预览边界：

| Workflow | 触发 | 权限 / 外部边界 |
| --- | --- | --- |
| `poppy-preview-build.yml` | `pull_request` 与受信 bootstrap 的 `workflow_dispatch` | `contents: read`，无仓库或外部部署 secrets；构建 exact PR head，上传不受信 artifact 与 Actions 控制的 head binding。 |
| `poppy-preview-bootstrap.yml` | trusted default-branch 安装/更新或手动触发 | `actions: write`、`contents: read`、`pull-requests: read`；枚举 live PR，并携 exact expected head 调度 secret-free build。 |
| `poppy-preview-deploy.yml` | build 完成的 `workflow_run` | trusted default-branch code，`actions: read`、`contents: read`、`pull-requests: write`；复核 live PR/head/workflow/artifact，不执行贡献者代码地净化，部署 Cloudflare，向私有 Poppy 报告 lifecycle，并更新唯一 sticky comment。 |
| `poppy-preview-close.yml` | `pull_request_target: closed` | trusted default-branch cleanup，`contents: read`、`pull-requests: write`；删除每 PR Cloudflare project，并向 Poppy 报告 Closed。 |
| `poppy-preview-security.yml` | preview workflow/integration 在 PR 或 `main` 变化 | 只读 Node 22 证据 lane；运行 sanitizer/Worker/lifecycle/browser focused tests、固定 checksum 的 actionlint、installed/template workflow byte-for-byte lockstep。它是仓库 CI 证据，但**当前不是平台 required status check**。 |

贡献者 artifact 永不获得 Cloudflare/Poppy secrets。Deploy/cleanup 只执行 trusted repository code，并调用私有外部 control-plane API；exact endpoint、tuple binding、access policy 与 post-merge E2E 要求记录在 `integrations/proto-ui-preview/README.md`。合并前绿色检查不能端到端证明 default-branch `workflow_run`、bootstrap、live OAuth identities、failure convergence 或 close cleanup；这些仍是 post-merge production acceptance gates。

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
- `stage` 与 `publish-all` 在 package 暂存前检查全部公开 package identity 均已可从 npm registry 读取；该检查无法读取私有的 Trusted Publisher 设置，后者仍由维护者负责核对。
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
6. 合入 `main` 后，取得当前人工发布批准，再用 `workspace` profile 运行 `publish-all`。
7. 在单独的证据变更中核验 registry、tag、GitHub Release、assets、workflow head、deployment 与 spec snapshot digest，然后按已批准的生命周期推进 V 实体。

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
- `pnpm analysis:monorepo --benchmark --out <path>`

仓库不提供局部真实发布快捷命令；package 局部修复进入下一次全局 release train。
