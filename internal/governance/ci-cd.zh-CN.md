# Proto UI CI/CD 使用说明

本文说明仓库内 GitHub Actions 工作流的职责，以及它们与全局精确版本和首发 package 治理的关系。

当前已发布的 prerelease release train 为 `0.2.0-rc.7`，使用 npm `next` channel。

## 工作流总览

| 工作流 | 文件 | 作用 |
| --- | --- | --- |
| CI | `.github/workflows/ci.yml` | PR 与主干的类型、测试、spec 和全局版本门禁 |
| Release Packages | `.github/workflows/release-packages.yml` | 手动执行 release scan、stage 彩排或全量发布 |
| Release Cadence | `.github/workflows/release-cadence.yml` | 定期检查距最近 `v*` release 的时间并提醒维护者 |

## CI 工作流（`ci.yml`）

CI 在 pull request、`main` push 和手动触发时运行。除常规类型与测试外，它会执行 `check-version-governance`，确保：

- 根 `VERSION` 与全部公开 `@proto.ui/*` package 精确一致
- 当前版本有且只有一个对应的 V 实体
- `0.2.0-rc.0` 起的实体版本引用来自已声明 V 实体
- launch governance 的 release line 与当前版本一致

任何新数字版本都必须先成为受评审的 release train，不能通过局部 package 改版绕过。

`public_package_plan` 会根据 pull request diff 推导受影响的公开 package 图。package 变化会选中改动 package、它的反向消费者，以及构建该集合所需的全部上游公开依赖；仓库级构建、release、lockfile、manifest 或 workflow 变化则选中全部公开 package。后续 build job 会检查生成式 manifest、产出 JavaScript 与声明文件、执行原生 ESM import smoke，并检查代表性 gzip 预算。如果 PR 的受影响公开 package 图为空，release stage 与隔离 consumer job 可以跳过；`main` 与手动触发仍运行全量集合。

`release-consumer-react` 进一步从当前源码构建全部公开 package tarball，并在 monorepo 外的临时 React + Vite 项目中安装当前发布依赖闭包。该门禁禁止 `@proto.ui/*` 回退到 npm registry 或 workspace 源码，验证 staged manifest 的全部非通配 export target，并验证 CLI facade 生成、TypeScript、production build 和基础运行时行为。在扩展完整 fixture 前，它还会先只生成 Shadcn Button，并检查最终 Rollup module graph 不包含其他 Base/Shadcn prototype family；这是一项 family 边界检测，不是固定 bundle 大小预算。

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
- 真实发布由 GitHub `npm` environment 审批与 npm Trusted Publishing OIDC 保护。
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
6. 合入 `main` 后，用 `workspace` profile 运行 `publish-all`。
7. 发布成功后核对 GitHub release/spec snapshot 证据，再通过后续 PR 将 V 实体转为 `active`。

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
