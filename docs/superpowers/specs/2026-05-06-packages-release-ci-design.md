# 2026-05-06 Packages Release CI(minor 锁步 / 纯 OIDC / 周四节奏)

> Spec. 本文记录 v0 首发(`0.1.0`)前 packages release CI 的总体设计:VERSION 作 minor 锁步锚点、npm Trusted Publishing(纯 OIDC,不再依赖 NPM_TOKEN)、单包 patch 热修通道、周四自动节奏报告。

---

## 1)背景

### 1.1 上游

- [`internal/governance/versioning-policy.zh-CN.md`](../../../internal/governance/versioning-policy.zh-CN.md):v0 阶段所有 `@proto.ui/*` 包共享相同 **minor 线**,patch 是同一 minor 内部的安全升级边界。
- [`docs/superpowers/specs/2026-05-03-v0-cli-package-governance-design.md`](./2026-05-03-v0-cli-package-governance-design.md)(PR #220):已经搭好 `release-packages.yml`(scan / stage / publish 三模式 manual workflow)、`ci.yml` 三道闸(release-scan / release-stage / cli-smoke)、`scripts/release/{publish,scan,lib}.mjs` build+publish 链路。

### 1.2 v0 首发还缺什么

#220 让维护者**能**手工发包,但有四条工程缺口与 versioning-policy 不一致:

1. **没有锁步实施面**。policy 说"所有 `@proto.ui/*` 保持相同 minor",但代码里没有 source of truth,也没有 CI 闸。33 个包目前都还停在 `0.0.1`,CLI 是 `0.0.4`——已经飘了。
2. **NPM_TOKEN 长期凭据是供应链风险**。`release-packages.yml` 用 `secrets.NPM_TOKEN`,token 一旦泄漏可以远程发任意 `@proto.ui/*` 版本;且 token 不带 provenance,publish 来源无法被 npm 侧审计。
3. **单包 patch 热修没有路径**。当前 publish 模式只支持 profile(launch / workspace),不能定向发"只重发 `@proto.ui/adapter-vue` 的 patch"——但 v0 阶段 patch 修复就是要在同一 minor 线内**单包**递进(每个包按自己的更新频率走 patch,不强制锁全员)。
4. **发版节奏全靠人记忆**。没有"每周看看是否要切版本"的规律性触发。

本 spec 把这四条同时收口。

### 1.3 核心约束(brainstorming 阶段已确认)

- **首次发版** 统一为 `0.1.0`,把 34 个包从 `0.0.x`(33 个)和 `cli@0.0.4`(1 个)直接拉到同一条 `0.1.x` 线
- **锁步粒度**:**minor 锁步,patch 自由**(per versioning-policy.zh-CN.md §3 + 项目 owner 原计划)。所有 `@proto.ui/*` 包必须 minor 一致,同 minor 内每个包的 patch 由该包自己的发版频率决定
- **鉴权**:**纯 OIDC**,Trusted Publishing 是发布链路的**唯一**入口;`NPM_TOKEN` 不进 CI,不进 environment secrets
- **5 个新包先 bootstrap 上 npm**:OIDC 不能创建 npm 上不存在的包(npm/cli#8544),`@proto.ui/{hooks, module-boundary, module-hit-participation, module-presence, prototypes-lucide}` 在 spec PR 合并**之前**先用维护者本地 npm 会话发个 `0.0.1` 实验版本上去,纯粹是"让 npm 先认识这个包",之后才能去 npm UI 给它们配 trusted publisher
- **命名**:workflow 文件名 `release-packages.yml`(沿用)+ GitHub Environment 名 `npm-publish`
- **运行时**:Node 全仓 20 → 22 LTS(Trusted Publishing 要求 Node ≥ 22.14.0 / npm CLI ≥ 11.5.1)

---

## 2)总体设计

### 2.1 一图概括

```
repo top:
  VERSION                          minor 锁步锚点(纯文本一行,如 0.1.0)

scripts/release/
  stamp-version.mjs                跨 minor 重置:VERSION 与某包 minor 不同 → 改写;
                                   同 minor 内的不同 patch → 不动
  check-lockstep.mjs               校验所有 @proto.ui/* 与 VERSION 共享 minor
  publish.mjs / scan.mjs / lib.mjs   #220 已存在,本次接入 stamp + lockstep

.github/workflows/
  release-packages.yml             多模式(scan / stage / publish-all / publish-single)
                                   走 OIDC,environment: npm-publish,Node 22
  release-cadence.yml              周四 10:07 UTC cron(+ workflow_dispatch)
                                   git log 自上次 release tag,开 release readiness issue
  ci.yml                           PR-gate;新增 lockstep-check job;Node 20 → 22

GitHub Environment:
  npm-publish                      required reviewers + deployment branch 限制
                                   release-packages.yml(publish-* 模式)走这个 env
                                   environment 不需要任何 secret(纯 OIDC)
```

### 2.2 minor 锁步:`VERSION` 单一来源

`VERSION` 文件只解决一件事:**这个仓库当前在哪条 minor 线上**。它不规定 patch。

- 仓库根放一个 `VERSION` 文件,纯文本一行,内容如 `0.1.0`
- `scripts/release/stamp-version.mjs`(新增,语义"对齐 minor"):
  - 读 `VERSION` 解出 `MAJOR.MINOR.PATCH_DEFAULT`
  - 遍历所有 `@proto.ui/*` 工作区包:
    - 若 `pkg.version` 与 VERSION 的 minor 不一致(典型场景:跨 minor 升级,如 `0.0.x → 0.1.0`)→ 把 `pkg.version` 改为 VERSION
    - 若 minor 一致(典型场景:同一 minor 内已有 patch 飘移,例如 cli 单包 patch 到 `0.1.5`,VERSION 仍是 `0.1.0`)→ **不动**该包的 patch
  - **不动** `dependencies` / `peerDependencies` 里的 `workspace:*` 协议——发布时由 #220 的 `lib.mjs` 在 `npm publish` 之前 normalize 成各自 `pkg.version`
  - 是幂等的(对齐过就 no-op)

- `scripts/release/check-lockstep.mjs`(新增,语义"minor 必须一致"):
  - 读 `VERSION` 的 `MAJOR.MINOR`
  - 校验所有 `@proto.ui/*` 工作区包的 `pkg.version` 共享同一 minor(`MAJOR.MINOR.*`,patch 任意)
  - 任何包跨 minor → 非零退出码,CI 红
  - **允许** 不同包 patch 不同(per 1.3 锁步粒度)

- `ci.yml` 加 `lockstep-check` job(只跑 `node scripts/release/check-lockstep.mjs`),作为 PR gate

- **PR 规则**:
  - **跨 minor 修改** 必须改 `VERSION` 一处(或被 `release-packages.yml publish-all` 自动改),其他 `pkg.version` 由 stamp 跟着对齐;手工把某个包的 minor 改到与 VERSION 不一致 → lockstep-check 失败
  - **同 minor patch 修改** 是允许的:维护者(或 `publish-single`)直接改某个 `pkg.version` 的 patch,VERSION 不动,其他包不动

### 2.3 三个 workflow

#### 2.3.1 `release-packages.yml`(改造)

把 #220 的现状(scan / stage / publish 三模式 + `NODE_AUTH_TOKEN: secrets.NPM_TOKEN`)改造为 4 模式纯 OIDC:

| `inputs.mode` | 含义 | 鉴权 | VERSION 行为 | tag |
| --- | --- | --- | --- | --- |
| `scan` | `release:scan` 不发包,产出 artifact | 无 | 不动 | 无 |
| `stage` | `release:stage`(tsc + `npm publish --dry-run`)所有包 | 无 | 不动 | 无 |
| `publish-all` | 跨 minor 发版:stamp 全部 `@proto.ui/*` 到 VERSION,publish 全部 | OIDC | 由 PR / inputs.version 决定 | `release/${VERSION}` |
| `publish-single` | 同 minor 单包 patch:把 `inputs.only` 列出的包(通常 1 个)在工作树里 patch++,只发它们 | OIDC | **不动** | `${pkg.name}@${pkg.version}` |

publish-\* 模式公共开关:

```yaml
permissions:
  id-token: write # OIDC token signing
  contents: write # post-publish 回写 commit + tag
environment: npm-publish # required-reviewer gate(Settings → Environments)
```

##### publish-all 步骤(适用首发 0.1.0 与未来 minor 升级)

1. `actions/checkout@v4`
2. `actions/setup-node@v4`(`node-version: '22'`,`registry-url: 'https://registry.npmjs.org'`)
3. corepack pnpm activation block(line-for-line 复用 ci.yml 的 lockfile-version 自适应版本)
4. `pnpm install --frozen-lockfile`
5. (可选)若 `inputs.version` 非空 → 改写 `VERSION` 文件为 `inputs.version`
6. `node scripts/release/stamp-version.mjs` — 把 33 个 `0.0.1` + cli@0.0.4(或后续偏离 minor 的包)对齐到 VERSION
7. `node scripts/release/check-lockstep.mjs`(防御:stamp 后必须通过)
8. `node scripts/release/publish.mjs --publish --profile workspace`(不带 `--only`,发全部)
   - **不**设 `NODE_AUTH_TOKEN`——npm CLI 检测到 GitHub Actions OIDC 环境(`ACTIONS_ID_TOKEN_REQUEST_URL` + `ACTIONS_ID_TOKEN_REQUEST_TOKEN`)会自动用 OIDC token 鉴权 + 自动附带 provenance attestation
   - 发包前 `lib.mjs` 把 `workspace:*` normalize 为各自 `pkg.version`
9. `git config user.{name,email}` → commit `chore(release): publish ${VERSION}` → tag `release/${VERSION}` → push commit + tag 回 main

##### publish-single 步骤(适用 v0 期间日常 patch 热修)

1. inputs:`only`(逗号分隔的包名列表,通常 1 个)+ 可选 `bump=patch|minor`(默认 `patch`)
2. checkout / setup-node / corepack pnpm / install(同 publish-all 1-4)
3. `node scripts/release/check-lockstep.mjs`(确认进入时锁步状态健康)
4. 对 `inputs.only` 列表中每个包:
   - 读取该包当前 `pkg.version`
   - `pkg.version` patch +1(默认),改写 package.json
5. `node scripts/release/check-lockstep.mjs`(再确认:patch 自由,minor 仍一致)
6. `node scripts/release/publish.mjs --publish --profile workspace --only ${inputs.only}` 走 OIDC
7. 对每个发布的包:
   - commit `chore(release): publish ${pkg.name}@${pkg.version}`
   - tag `${pkg.name}@${pkg.version}`(每个包一个 tag)
   - push 单个 commit + 单个 tag 回 main(多个包 → 多个 commit + 多个 tag)

publish-single **不**改 VERSION 文件——VERSION 始终是 minor 锚点,由 publish-all 跨 minor 时改写。

#### 2.3.2 `release-cadence.yml`(新增)

```yaml
on:
  schedule:
    - cron: '7 10 * * 4' # 周四 10:07 UTC,避开整点拥堵
  workflow_dispatch:

permissions:
  contents: read
  issues: write
```

每次跑:

1. checkout
2. 算 `LAST_TAG=$(git describe --tags --match 'release/*' --abbrev=0 || echo '')`(最近一次 publish-all 的锚点)
3. `git log ${LAST_TAG:+$LAST_TAG..}HEAD --oneline -- packages/`
4. 如果 0 条 commit → 退出 0,无操作
5. 否则:
   - `gh issue create --title "release readiness: $(date -u +%Y-%m-%d)"`
   - body 写出"自上次 release tag (`$LAST_TAG`) 起 packages/ 下的 commit 列表"
   - body 提示"维护者评估:哪些包需要 patch 热修(走 `publish-single`)、是否要切新 minor(走 `publish-all`)"
   - 加 label `release-cadence`(便于过滤)

不做的事(刻意保留简单):

- 不自动开 PR(避免 bot-PR 噪音 + 把判断责任转给维护者)
- 不做"per-package 变更扫描"(`git log -- packages/X/`),v0 阶段维护者自己看 commit 列表更可靠;后期可以加进来当 §9 follow-up
- 不在 cadence 里 publish——发布动作必须经 `npm-publish` environment 的 required reviewer 放行

#### 2.3.3 `ci.yml` 增强

- 新增 `lockstep-check` job,跑 `node scripts/release/check-lockstep.mjs`,5 秒级 PR gate
- 5 个现有 job(type-check / test / release-scan / release-stage / cli-smoke)的 `node-version` 从 `20` 改为 `22`
- corepack pnpm activation block 不变(已经是 lockfile-version 自适应)
- release-stage / cli-smoke 的 timeout 不变

### 2.4 GitHub Environment:`npm-publish`

需要在仓库 Settings → Environments 新建,配置:

- **Required reviewers**:`255doesnotexist`(本 PR 作者)+ `guangliang2019`(项目 owner);任一审批可放行
- **Deployment branches**:`main` only(防止从 feature branch 触发 publish)
- **Environment secrets**:**无**——纯 OIDC,不需要 token

`release-packages.yml`(publish-all / publish-single 模式)引用这个 environment;`scan` / `stage` 模式不需要 environment(无副作用)。

---

## 3)Trusted Publisher 配置(维护者侧手工动作)

### 3.1 npmjs.com 配置内容(锁定 5 字段)

对**每一个** `@proto.ui/*` 包,在 npm UI(Settings → Trusted Publishers → GitHub Actions)配:

```
Publisher:               GitHub Actions
Organization or user:    Proto-UI
Repository:              Proto-UI
Workflow filename:       release-packages.yml
Environment name:        npm-publish
```

5 个字段对所有 34 个包都是同一份。

### 3.2 已发布的 29 个包(已在 brainstorming 阶段配完)

```
@proto.ui/adapter-base
@proto.ui/adapter-react
@proto.ui/adapter-vue
@proto.ui/adapter-web-component
@proto.ui/cli
@proto.ui/core
@proto.ui/module-anatomy
@proto.ui/module-as-trigger
@proto.ui/module-base
@proto.ui/module-context
@proto.ui/module-event
@proto.ui/module-expose
@proto.ui/module-expose-state
@proto.ui/module-expose-state-web
@proto.ui/module-feedback
@proto.ui/module-focus
@proto.ui/module-overlay
@proto.ui/module-props
@proto.ui/module-rule
@proto.ui/module-rule-expose-state-web
@proto.ui/module-rule-meta
@proto.ui/module-state
@proto.ui/module-state-accessibility
@proto.ui/module-state-interaction
@proto.ui/module-test-sys
@proto.ui/prototypes-base
@proto.ui/prototypes-shadcn
@proto.ui/runtime
@proto.ui/types
```

### 3.3 尚未发布的 5 个新包(本 PR 工作流的一部分)

```
@proto.ui/hooks
@proto.ui/module-boundary
@proto.ui/module-hit-participation
@proto.ui/module-presence
@proto.ui/prototypes-lucide
```

OIDC trusted publisher 必须在包**已经存在**于 npm 后才能配——这是 npm 侧 UI 限制(npm/cli#8544)。所以这 5 个包必须先用维护者**本地 npm 会话**发一次 `0.0.1` 实验版本上去(不进 CI、不需要任何 token),让 npm 知道这些包存在。完整步骤见 §4.1。

---

## 4)首发 `0.1.0` 迁移路径(单阶段)

整个迁移分为 4 个时间段,**只有 §4.1 与 §4.4 是手工动作,§4.2 / §4.3 是自动**。

### 4.1 Pre-merge:bootstrap 5 个新包

**谁做**:维护者(或 assistant 在维护者授权下,使用维护者本地 `npm login` 会话)。 **前提**:本地已 `npm login`(web 会话),且账号是 `@proto.ui` scope 成员。

**操作**:

```bash
node scripts/release/publish.mjs --publish --profile workspace \
  --only @proto.ui/hooks,@proto.ui/module-boundary,@proto.ui/module-hit-participation,@proto.ui/module-presence,@proto.ui/prototypes-lucide
```

效果:5 个新包按当前 `pkg.version`(`0.0.1`)发到 npm。其他 29 个包不受影响。

**Windows 注意**:`scripts/release/lib.mjs` 的 `spawnSync('pnpm'/'npm', ...)` 没设 `shell: true`,Node 18.20+ 在 Windows 原生终端上会 EINVAL。绕过路径任选其一:

- 从 WSL / git-bash 跑(推荐,完全不动代码)
- 把 lib.mjs 三处 spawn 加 `shell: process.platform === 'win32'`(与 #220 §3.7 给 CLI 加的修复同形;若顺手做,可以放进本 PR)

**Bootstrap 后维护者动作**:去 npm UI 给这 5 个包配 trusted publisher(同 §3.1 的 5 字段)。

### 4.2 PR merge:spec + workflows + VERSION + stamp

PR 内容:

1. 加 `VERSION` = `0.1.0`
2. 加 `scripts/release/stamp-version.mjs` + `scripts/release/check-lockstep.mjs`
3. 改 `.github/workflows/release-packages.yml`:4 模式 + 纯 OIDC + environment + Node 22(无 NPM_TOKEN fallback)
4. 加 `.github/workflows/release-cadence.yml`
5. 改 `.github/workflows/ci.yml`:加 `lockstep-check` + Node 20 → 22(全 5 jobs)
6. **跑一次** `node scripts/release/stamp-version.mjs`,把 33 个 `0.0.1` + cli@`0.0.4` 全部对齐到 `0.1.0`,**入 PR commit**(让 reviewer 看到批量 stamp diff)

PR merge 后 main 状态:34 个包工作树版本 = `0.1.0`,但 npm 上还是各自旧版本(29 个 `0.0.x` + 5 个刚 bootstrap 的 `0.0.1`)。

### 4.3 Post-merge:trigger publish-all → 全部 34 个 OIDC 发 `0.1.0`

维护者在 GitHub Actions UI 触发:

```
Run workflow: release-packages.yml
Mode:    publish-all
Branch:  main
```

`npm-publish` environment 的 required reviewer 批准后,workflow 跑:

- check-lockstep(VERSION=0.1.0,所有包都是 0.1.0 → 通过)
- publish.mjs --publish(OIDC,自动 provenance,34 个包发 `0.1.0`)
- commit `chore(release): publish 0.1.0` + tag `release/0.1.0` 推回 main

### 4.4 Post-release:配 5 新包的 trusted publisher(若 §4.1 阶段没配)

如果 §4.1 bootstrap 后维护者已经把 5 个新包的 trusted publisher 配上,则 §4.3 的 publish-all 就已经是纯 OIDC 全员通过——无后续。

如果 §4.1 阶段忘了配,§4.3 会在那 5 个包上失败(npm 拒绝 OIDC 发包到没配 trusted publisher 的包)。补救:

- 维护者去 npm UI 给 5 个新包补配 trusted publisher
- 重新触发 publish-all(发过的 29 个会因 version 已存在被 npm 拒,publish.mjs 已有重试容忍策略;可加 `--only` 只跑 5 个新包)

为什么不在 §4.1 强制要求配完才能进 §4.2:`@proto.ui/prototypes-lucide` 等新包 bootstrap 当下不一定立刻能配 trusted publisher(npm UI 偶尔有缓存延迟,新包索引有几分钟空窗)。把"配 trusted publisher"放成 §4.1 的尾随动作而非强阻塞,降低 race。

---

## 5)Node 22 升级

| 文件                                          | 当前               | 改为               |
| --------------------------------------------- | ------------------ | ------------------ |
| `.github/workflows/ci.yml`(5 jobs)            | `node-version: 20` | `node-version: 22` |
| `.github/workflows/release-packages.yml`      | `node-version: 20` | `node-version: 22` |
| `.github/workflows/release-cadence.yml`(新增) | —                  | `node-version: 22` |
| `package.json#engines.node`(若声明)           | 不限制             | 保持现状,不收紧    |

理由:

- npm Trusted Publishing 要求 npm CLI ≥ 11.5.1 → 内置 npm CLI 11.5.1 的最低 Node LTS 是 22.14.0
- 仓库内部 CI 升 22 不影响下游用户 runtime——`engines.node` 不动,用户照旧可以在 Node 18 / 20 装包

---

## 6)本 PR 修改文件清单

新增:

1. `VERSION`(纯文本一行 `0.1.0`)
2. `scripts/release/stamp-version.mjs`
3. `scripts/release/check-lockstep.mjs`
4. `.github/workflows/release-cadence.yml`
5. `docs/superpowers/specs/2026-05-06-packages-release-ci-design.md` — 本 spec

修改:

6. `.github/workflows/release-packages.yml` — 4 模式 + 纯 OIDC + environment + Node 22(去掉所有 NPM_TOKEN 引用)
7. `.github/workflows/ci.yml` — 加 lockstep-check job + Node 20 → 22
8. 全部 34 个 `@proto.ui/*` `packages/*/package.json#version` — stamp 后从 `0.0.1`(33 个)/ `0.0.4`(cli)统一到 `0.1.0`

可选(若维护者愿意一并解决 Windows bootstrap 阻塞):

9. `scripts/release/lib.mjs`:第 285 / 356 / 384 行 spawn 加 `shell: process.platform === 'win32'`

---

## 7)PR 描述必须包含的事项

PR description 模板:

```
## 合并前(维护者准备)

- [ ] 跑 §4.1 bootstrap 命令,把 5 个新包(hooks / module-boundary / module-hit-participation / module-presence / prototypes-lucide)发到 npm 的 0.0.1
- [ ] 在 npm UI 给 5 个新包配 trusted publisher(spec §3.1 的 5 字段)
- [ ] 在仓库 Settings → Environments 新建 `npm-publish`
  - required reviewers: 255doesnotexist + guangliang2019
  - deployment branches: main only
  - **不**加任何 secret(纯 OIDC)

## 合并后(维护者动作)

- [ ] 在 GitHub Actions UI 触发 release-packages.yml(mode=publish-all),批准 npm-publish environment 的 deployment
- [ ] 验证 main 拿到了 commit `chore(release): publish 0.1.0` + tag `release/0.1.0`
- [ ] `npm view @proto.ui/cli version` 返回 `0.1.0`(挑任一包验证)

## 已知限制

- 本 PR 不动 `internal/governance/launch-package-governance.json`,该文件目前漏列 `@proto.ui/prototypes-lucide`——`--profile workspace` 模式不卡这个,但治理文件应在 follow-up issue 补齐
```

---

## 8)验收清单(本地 / CI 双侧验证)

| 检查项 | 状态 | 备注 |
| --- | --- | --- |
| `node scripts/release/stamp-version.mjs` 幂等 | 待写 | 跑两次 git diff 应为空 |
| stamp 跨 minor 重置 | 待写 | 手工把某包 version 改回 `0.0.1`,跑 stamp,应回 `0.1.0` |
| stamp 同 minor 不动 patch | 待写 | 手工把某包改成 `0.1.5`,跑 stamp,应保持 `0.1.5`(VERSION=`0.1.0`) |
| `node scripts/release/check-lockstep.mjs` 拒绝跨 minor | 待写 | 手工把某包改成 `0.2.0`,check 应失败 |
| `check-lockstep` 允许同 minor 内 patch 不同 | 待写 | 多包混合 `0.1.0 / 0.1.3 / 0.1.7`,check 应通过 |
| `ci.yml lockstep-check` job YAML 解析 | 待写 | actionlint |
| `release-packages.yml` 4 模式 YAML 解析 | 待写 | actionlint;workflow_dispatch dry-run |
| `release-cadence.yml` cron + issue-gen 路径 | 待写 | workflow_dispatch 触发,确认能开 issue |
| Node 22 全部 5 个 ci.yml job 能跑 | 待写 | PR CI 跑一次确认全绿 |
| 34 个包 stamp 后版本号 = 0.1.0 | 待写 | `node -e` 遍历断言 |
| publish.mjs(OIDC,无 NODE_AUTH_TOKEN)在 dry-run 下不报缺 token | 待写 | 看 `npm publish --dry-run` log |
| 5 个新包 bootstrap 真实生效 | 待写 | `npm view @proto.ui/hooks` 返回 `0.0.1` |

---

## 9)已知缺口 / 后续工作

不在本 PR 范围,但应在 follow-up issue 跟踪:

- **`internal/governance/launch-package-governance.json` 漏列 `@proto.ui/prototypes-lucide`**:发现于本次 spec 起草。`--profile workspace`(本 PR publish 路径)不卡,但 `--profile launch` 会少这个包。维护者应在 follow-up 补到合适的 bucket(看 lucide 的发布定位决定 launch / public-non-launch / candidate)
- **`scripts/release/lib.mjs` Windows spawn 缺 shell**:Node 18.20+ 在 Win 原生 PowerShell / cmd 上 spawnSync 不能直接调 `pnpm.cmd` / `npm.cmd`,需 `shell: true`。本 PR 可顺手修(§6 第 9 项),也可作为 follow-up;#220 已经给 CLI 的 spawn 同形修过
- **release-cadence per-package 检测**:当前 cadence 只列 `git log`,不做 per-package 路径过滤。后期可加 `git log -- packages/${pkg.relDir}/`,issue 直接列出"哪个包有哪些 commit",节省维护者梳理时间
- **publish-single 自动 patch 计算的边界**:当前默认 patch+1。如果维护者想跳号(如发 `0.1.7` 而非 `0.1.6`),需要 `inputs.bump` 支持 `1.2.3` 这种显式版本号,而不是只支持 `patch / minor` 关键字。本 PR 先做关键字版,显式版本号留给 follow-up
- **provenance 显式化**:OIDC 模式 npm CLI 自动附 provenance,但若未来某天又需要 token 模式应急,publish.mjs 应显式加 `--provenance` 保证 attestation 不丢
- **release-cadence cron 自身的 7 天衰减**:GitHub Actions schedule 在仓库无 push 60 天后会自动停。v0 期间这不是问题,但要记录

---

## 10)spec 自检

- **占位符**:无 TBD / TODO / 模糊需求;`(待写)` 标记仅用于 §8 的"实施阶段需验证"清单,不是 spec 占位符
- **内部一致**:
  - VERSION → stamp → check-lockstep 链路:§2.2 / §2.3.1 / §4.2 一致(stamp 跨 minor 重置 + 同 minor 不动 patch)
  - Trusted Publisher 5 字段:§3.1 / §4.1 / §7 一致
  - 4 模式语义:§2.3.1 表格 / §4.3 描述 / §7 PR 模板 一致
  - 鉴权:全文都是"纯 OIDC,无 NPM_TOKEN"——§1.3 / §2.3.1 / §2.4 / §6 / §7 全检
- **范围**:本 spec 是单一发版治理改造,bootstrap 是同一 PR 的 pre-merge 步骤(同主线),不混入其他基础设施(满足 `feedback_no_unrelated_fixes`);唯一 optional 项是 §6 第 9 项的 lib.mjs Windows fix,标了"可选"
- **歧义**:逐条检查,无双解读项;唯一刻意保留的弹性是 §4.4(若 §4.1 trusted publisher 没配完导致 §4.3 失败的补救路径)——已显式说明
