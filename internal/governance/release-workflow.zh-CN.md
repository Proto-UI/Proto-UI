# Proto UI 发版工作流

> 内部治理文档。本文定义从 `0.2.0-rc.0` 开始的全局精确版本准备、验证、发布与证据回填流程。

## 1. 权威状态

`main` 是 release tag 与真实发布的唯一来源。日常工作使用短期 topic branch 和 PR；仓库不再依赖长期 `feat/v0-release-prep` 分支承载发行身份。

一次 release 由以下事实共同识别：

- 一个 `V-*` version entity
- 根 `VERSION`
- 全部公开 `@proto.ui/*` package 的精确版本
- `v<version>` Git tag
- npm dist-tag 与已发布 package 集合
- 对应 spec snapshot 与 digest

其中任一事实不一致，都不能宣称 release 完成。

## 2. V 实体生命周期

### 2.1 Draft

维护者决定进入新 release train 时，先创建或更新一个 `draft` V 实体。它固定：

- exact semver，包括 prerelease 后缀
- Git tag，例如 `v0.2.0-rc.0`
- npm dist-tag；prerelease 使用 `next`，stable 使用 `latest`
- `packageVersionPolicy: exact`
- 公开 package scope

`VERSION` 与全部公开 package manifest 必须在同一 PR 中投射为该版本。实体 revision 可以引用 draft V 版本，但 workspace 必须把它明确标为 draft，不能表现成已发布版本。

### 2.2 Active

只有在 npm package、Git tag 与 spec snapshot 已发布后，V 实体才能转为 `active`。Active V 实体必须记录：

- 发布时间
- 40 位发布 commit SHA
- `sha256` spec snapshot digest

### 2.3 Prerelease 阶段

Prerelease suffix 用来表达稳定化阶段，而不是泛化的内部构建顺序：

- `alpha` 可以接纳经过评审的架构调整、顶层 API 变化与新 feature；它不表示 API freeze 或 feature freeze。
- `beta` 在核心范围与主要 API 收敛后开启，重点转向集成、兼容与缺陷修复；出现新的 breaking 方向时必须明确判断是否退回 alpha。
- `rc` 只用于维护者认为可在最终验证或 blocker 修复后直接晋升对应 stable 的候选；仍计划架构重构、顶层 breaking API 变化或新增核心 feature 时不得使用 rc。

每个实际发布的阶段仍必须拥有精确 V 实体、完整全局对齐 package set、tag、dist-tag 与不可变 snapshot evidence。

## 3. 准备流程

1. 从最新 `main` 创建 topic branch。
2. 创建 draft V 实体并更新 `VERSION`。
3. 使用 `stamp-version` 将全部公开 package 精确对齐。
4. 更新 release note、package BOM、spec snapshot 与治理映射。
5. 运行版本治理、spec、类型、测试、release scan 和 tarball consumer smoke。
6. 通过 PR 评审后合入 `main`。

官网主 Quick Start 始终跟随 npm `latest`，不得把普通使用者静默切换到预发布版本。独立的 prerelease trial 页面必须固定到 V 实体声明的精确版本，以便复现验证；`@next` 可以作为便利 channel，但不是试用记录的版本身份。CLI 在安装 Adapter 与 Prototype package 时，必须把 package spec 固定为 CLI 自身的精确版本并以 exact dependency 写入 consumer manifest；不得让未标注版本的 `latest` 或自动扩张的 semver range 混入其他 release train。

普通 package 局部修复不会使用 `publish-single`。它进入下一次全局 release train。

每条 release train 在 `internal/releases/<version>/` 下维护 `release-notes.md`、对应中文投射与确定性的 `package-bom.json`。`pnpm release:bom` 根据公开 workspace package 图和 launch governance 角色重新生成 BOM；`pnpm release:assets:check` 会在已评审 BOM 漂移或任一 release note 缺失时失败。英文说明作为 GitHub Release 正文，BOM、中文说明、spec snapshot 与 checksum 作为 release evidence 附件。

npm Trusted Publisher 是 package 级配置，因此 package identity 不存在时无法预先绑定。每个首次出现的公开 package 都必须在 release train 前使用明确不属于正式发行的 bootstrap 版本完成创建，并绑定到已评审的发布 workflow。bootstrap 不得占用发行 channel dist-tag，且 identity setup 后必须移除其 `bootstrap` tag。若 npm 拒绝移除指向 package 唯一 bootstrap 版本的 `latest`，则仅当该唯一版本已 deprecated、`next` 不指向该 bootstrap 版本，且没有为了覆盖它而发布 release-train 或 stable 版本时，允许该 `latest` 暂留。`pnpm release:registry:check` 会核验这些公开 identity、dist-tag 与 deprecation 条件；它不宣称能够检查私有的 Trusted Publisher 配置。

## 4. 发布流程

真实发布只允许从 `main` 手动触发，并由 GitHub `npm` environment 审批保护。

`stage` 与 `publish-all` 都会在任何 package 暂存或发布前运行公开 registry preflight。任一 identity 缺失或 bootstrap 状态不合规都会中止，避免形成可预防的部分发布。

发布 workflow：

1. 从仓库读取 `VERSION`，不接受临时版本覆盖输入。
2. 执行 `check-version-governance` 与 launch governance scan。
3. stage 全部公开 package，并将 workspace dependency 改写为同一精确版本。
4. 使用 V 实体声明的 npm dist-tag 发布整个 package set。
5. 全部 package 发布成功后创建 `v<version>` tag。
6. 生成 GitHub prerelease/release 与 spec snapshot artifact。
7. 通过后续证据 PR 回填发布时间、tagged commit 与 snapshot digest，并将 V 实体转为 active。

发布 workflow 不直接改写 `main` 中的 V 实体。这样 tag 始终指向发布前已经评审的 draft release identity，而 active 状态作为发布后可复核事实进入下一次 PR；V 实体记录的 snapshot digest 指向 tag 所附的 immutable draft snapshot，避免 snapshot 自身包含 digest 所造成的循环。

若中途发生部分发布，禁止提升 dist-tag 或创建完成态 V 实体。恢复时仍运行完整 workspace release set，并显式启用 `resume_published`；工作流只会跳过 npm registry 已存在且 SHA-512 integrity 与当前 staged tarball 完全相同的 package，未发布 package 继续使用同一版本发布。任一 integrity 不一致都会中止恢复，实际 registry 状态必须进入恢复记录。

## 5. 首个统一版本

首个进入本流程的版本为：

- version：`0.2.0-rc.0`
- Git tag：`v0.2.0-rc.0`
- npm dist-tag：`next`

历史 `0.1.x` package 版本属于全局锁步建立前的 fragmented releases。最高局部版本 `@proto.ui/cli@0.1.4` 不构成全局 `v0.1.4`，不得补造该 tag。

## 6. 必须通过的检查

- `pnpm check:release-version`
- `pnpm release:assets:check`
- `pnpm release:scan:launch`
- `pnpm release:stage`
- spec workspace 0 issue
- 全仓类型与测试
- 当前源码 tarball consumer smoke
- Quick Start 与实际安装命令一致

`pnpm release:rehearse` 是不发布的一键准备门禁。它会依次执行发行身份与物料检查、编目和测试、类型检查、临时 spec snapshot、共享公开 package 构建、package publish dry-run、React 与 CLI 多宿主 tarball consumer smoke，以及官网构建。release staging 会复制开发与 CI 已验证的同一份本地 `dist` 产物，不再单独编译另一套输出。该命令可能因 dry-run 或临时 consumer 安装访问 npm registry，但绝不会进入真实 publish 路径。

纯文档或内部 app 的变化可以不立即触发 release；但一旦创建新的数字版本或修改 `VERSION`，就必须通过上述 release train 流程。

## 7. 维护者端到端执行清单

本清单把上述策略展开为每条 release train 必须遵循的实际顺序。准备、真实发布与证据回填是三个可独立评审的阶段；完成前一阶段不代表后一阶段已经发生。

### 7.1 通过 PR 准备 release train

1. 获取最新默认分支，并从 `origin/main` 创建短期 release topic branch。
2. 更新根 `VERSION`、创建新的 `draft` V 实体，并对齐 launch governance release line。
3. 运行 `node scripts/release/stamp-version.mjs`，使全部公开 package manifest 使用同一精确版本，再用仓库声明的 pnpm 版本刷新 lockfile。
4. 更新双语 release notes 并运行 `pnpm release:bom`。随 tarball 分发且会引用自身版本的 package README 也在此阶段更新。
5. 运行 `pnpm spec:docs:agent` 生成被 Git 忽略的本地 Agent 投影，并审阅新 V 实体影响的 entity graph；不得把该一次性投影加入提交。
6. 提交前运行 `pnpm release:rehearse`、`pnpm check:agent-doc` 与 `git diff --check`。
7. 创建 Draft PR，明确发行范围、检查结果、package 数量，以及尚未执行真实发布这一事实。

这一阶段的公开 prerelease trial 页面、仓库状态与 Release 链接必须继续指向上一个已验证版本，只能在发布后的证据 PR 中切换到新版本，避免把已评审的 draft 表现为可安装发行。包含在新 tarball 内的 package README 可以预先写入自身精确版本，因为它只会在该 tarball 真正发布后对外可见。

### 7.2 执行受保护的真实发布

准备 PR 合入后，从 `main` 手动触发 `.github/workflows/release-packages.yml`，使用：

- `mode=publish-all`
- `profile=workspace`
- 正常发布使用 `resume_published=false`
- 除非 launch governance 已明确批准候选包，否则使用 `include_approved_candidates=false`

只有在确认 workflow head SHA 等于已评审的 merge commit，且 `VERSION` 仍是目标版本后，才能批准受保护的 `npm` environment。不得从 topic branch 发布，也不得使用 `launch` profile 执行真实发布。workflow 必须先完成全部公开 package 发布，之后才能创建 tag、GitHub Release 与 snapshot assets。

如果运行形成部分发布，必须保持同一版本与 commit。审计 registry integrity、记录失败事实，并使用 `resume_published=true` 恢复完整 workspace 发布集合；不得创建替代 tag，也不得静默推进到另一条 release train。

### 7.3 核对不可变发行证据

将 V 实体转为 active 前，必须核对并记录：

- 成功 workflow 的 URL、`headSha`、开始时间与结束时间
- `package-bom.json` 中每一个 package 都在 npm 存在精确版本；只检查 CLI 不足以证明全局发布完成
- 每一个 package 的目标 dist-tag 都指向该精确版本
- `v<version>` 解析到与 workflow head SHA 相同的 40 位 commit
- GitHub Release 的 prerelease/stable 状态正确，并包含已评审 BOM、本地化说明、spec snapshot 与 checksum
- 上传的 spec snapshot digest 与 checksum 一致，并等于 V 实体记录的 digest

`release.publishedAt` 统一使用 GitHub Release 的发布时间，此时完整 package set、tag 与 release assets 均已存在。npm 首尾 package 发布时间与 workflow 时段可以作为辅助证据记录，但不能替代这一规范时间。

V 实体必须记录 tag 所附不可变 draft snapshot 的 digest。不得在 V 实体转为 `active` 后重新生成 snapshot，再用新 digest 替换发行证据；生命周期变化会改变 snapshot bytes，从而形成自指证据。

### 7.4 合入证据 PR

从最新 `origin/main` 创建新的 topic branch，不复用准备分支。证据变更必须：

1. 将 V 实体从 `draft` 转为 `active`
2. 填写 `publishedAt`、tag 对应的 40 位 commit 与 `specSnapshotDigest`
3. 新增一条描述已验证发行的 `updated` revision
4. 将 release notes 从草稿措辞切换为已发布措辞
5. 更新双语仓库状态、精确 prerelease trial 命令、Release 链接与当前版本 CI/CD 说明
6. 新增 dated record，记录 workflow、npm、tag、GitHub Release 与 snapshot 事实
7. 生成并审阅被 Git 忽略的本地 Agent 投影，再运行 `check:release-version`、`release:assets:check`、`check:agent-doc`、类型检查与文档构建
8. 证据 PR 合入后，使用已合入的英文 `internal/releases/<version>/release-notes.md` 更新 GitHub Release 正文，并确认公共页面不再保留发布前 draft 措辞；不得在评审前发布这项可变文案更新，也不得替换或重新生成不可变 snapshot assets

证据 PR 不改动 `VERSION` 或 package manifest，也不会重新发布 package。它的职责是让仓库真理与已经不可变的外部事实一致。只有该 PR 合入后，release 才能在 catalog 中表述为 `active`，并在公共文档中表述为当前可复现的 prerelease。
