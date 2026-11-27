# 2026-05-01 v0 首发任务系列与负责人分配图

> Internal planning record. 本文用于把 2026-05-01 当前剩余的 v0 首发任务，整理成可分派给核心贡献者的任务系列。本文不是规范文档；后续应拆成 GitHub issues / milestone / project board。

---

## 1）当前判断

截至 2026-05-01，v0 首发的主要风险已经不再是“核心能力是否存在”，而是：

- 官方上手路径是否真实可跑
- CLI 首发路径是否足够闭环
- package 发布治理是否能可靠验证 CLI 与首发包
- 文档、release workflow、smoke 验证是否说的是同一条路径

当前本地状态显示：

- `feat/v0-release-prep` 已包含 CLI 初步实现相关提交
- CLI 已存在为 `@proto.ui/cli` package
- CI workflow 已存在，覆盖 type check 与 test
- release workflow 已存在，覆盖 `scan` / `stage` / `publish`
- 本地 `pnpm -s check:types` 通过
- 本地 `pnpm -s test` 通过，结果为 `153 passed | 3 skipped`、`556 passed | 34 todo`
- 本地 `pnpm -s docs:build` 通过
- 但 `pnpm -s release:scan:launch` 当前失败，因为 `@proto.ui/cli` 是 workspace package，却未进入 `launch-package-governance.json`
- Quick Start 仍写着 CLI 当前不可安装，因此对外主路径仍未闭环

因此，当前最高优先级不是继续扩张组件或 adapter，而是先把 **CLI 首发路径 + package CI/CD 治理 + clean smoke 验证** 收成一条可执行发布链路。

---

## 2）优先级总览

| 优先级 | 任务系列 | 建议负责人类型 | 是否阻塞首发 |
| --- | --- | --- | --- |
| P0 | CLI + Package Release Governance 主线 | 最强核心贡献者 / release owner / CLI owner | 是 |
| P0 | Quick Start 真实路径重写与 smoke 对齐 | 文档 + 工程双栈贡献者 | 是 |
| P0 | 首发 package readiness 清零 | 细致型 package / build 负责人 | 是 |
| P1 | Contract / Test Catalog | 熟悉架构与测试的人 | 强建议 |
| P1 | Prototype 首发承诺面审计 | 熟悉原型库的人 | 强建议 |
| P1 | Review Rules / Contributing 收口 | 架构 reviewer / 维护者 | 强建议 |
| P1 | Docs build 进入 CI | CI / docs infra 负责人 | 可降级 |
| P2 | Release note / launch page / 社区公告 | 文档 / 社区负责人 | 不阻塞核心发布 |
| P2 | 发布后一周 triage 方案 | 维护者 / 项目负责人 | 不阻塞核心发布 |

---

## 3）P0 Epic：CLI + Package Release Governance 主线

### 3.1 目标

把 CLI 首发可用性与 package 发布治理合并成一条自动验证链路：

```txt
CLI 最小路径定义
  -> package governance 修正
  -> package scan / stage
  -> clean fixture 安装
  -> CLI init/add smoke
  -> Quick Start 真实路径
  -> release rehearsal
```

这条线应被视为当前首发最高优先级。

### 3.2 建议负责人

- `CLI Owner`：负责 CLI 命令面、生成物、测试与用户路径。
- `Release / Package Owner`：负责 governance、scan、stage、publish workflow。
- `Smoke Owner`：负责 clean environment fixture，最好由 Release Owner 兼任。

如果人手紧张，可以由两个人承接：

- A：CLI Owner
- B：Release / Package / Smoke Owner

### 3.3 子任务

#### P0.1 定义 CLI 首发最小面

当前首发不应追求完整 CLI 生态，只需要覆盖官方 onboarding。

最低建议：

- `proto-ui init`
- `proto-ui add react shadcn-button`
- 如时间允许，再覆盖一个复合组件路径，例如 `shadcn-dialog`

需要明确：

- `add` 是否直接生成用户项目内组件入口
- 生成目录是否仍为 `proto-ui/components`
- adapter 与 prototype package 是安装依赖、复制源码，还是生成 glue code
- `react` 是否确定为默认 onboarding adapter
- Web Component script/html 路径是否独立于 CLI smoke

完成标准：

- 有一份 CLI 首发命令面说明
- Quick Start 不再描述 CLI 尚未实现的命令
- CLI README 与 Quick Start 的命令一致

#### P0.2 补齐 CLI `add` 路径或收窄 Quick Start

如果坚持 CLI 作为主路径，则必须补齐一条真实 `add` 路径。

任务：

- 实现或修正 `proto-ui add react shadcn-button`
- 生成可导入的组件入口
- 确认依赖安装策略
- 明确失败提示与不支持场景
- 增加 CLI 测试

完成标准：

- 在 clean fixture 中能执行 `npx @proto.ui/cli init`
- 能执行首发承诺的 `add` 命令
- 用户可从生成入口导入 `Button`

如果时间不足，允许收窄方案：

- Quick Start 暂时只承诺 `init`
- `add` 不作为首发主路径
- 但这会和既有“CLI 主路径”决策产生冲突，需要重新记录决策

#### P0.3 修正 `@proto.ui/cli` 的 package governance

当前 `release:scan:launch` 的直接阻塞是 `@proto.ui/cli` 未进入治理映射。

任务：

- 决定 `@proto.ui/cli` 属于：
  - `launchCommitmentPackages`
  - `publicNonLaunchCommitmentPackages`
  - `candidatePackages`
  - 或其它治理层级
- 更新 `internal/governance/launch-package-governance.json`
- 同步中英文 package policy / release workflow 文档中对 CLI 的解释

建议判断：

- 如果 Quick Start 继续以 CLI 为默认主路径，`@proto.ui/cli` 不应只是普通非首发包。
- 最保守可选方案是先进入 `candidatePackages`，并设置明确准入条件。
- 最直接方案是进入 `launchCommitmentPackages`，但前提是 CLI smoke 必须成为 release gate。

完成标准：

- `pnpm -s release:scan:launch` 不再因为 unclassified package 失败
- governance 文档能解释 CLI 的首发地位

#### P0.4 建立 package release gate

当前 release workflow 已存在，但需要形成更严格的发布前闸门。

建议新增或强化以下 checks：

- governance check
- launch release scan
- package pack check
- install from packed tarballs
- CLI smoke from packed tarball
- release artifact 上传

建议 CI 分层：

| 场景                       | 检查                                                 |
| -------------------------- | ---------------------------------------------------- |
| PR                         | type check、test、governance check、release scan     |
| PR 或 nightly              | pack check、clean fixture install                    |
| release workflow `scan`    | 产出 `release-scan.json`                             |
| release workflow `stage`   | dry-run publish + smoke logs                         |
| release workflow `publish` | 仅允许在受控分支、显式 version、NPM_TOKEN 存在时执行 |

完成标准：

- PR 能发现 workspace package 未分类
- PR 能发现首发 package metadata blocker
- release workflow 能稳定执行 scan / stage
- publish 前有可审计 artifact

#### P0.5 建立 clean environment CLI smoke

这是验证 CLI 可用性的前提，不应只靠 monorepo 内部测试。

建议 smoke 形态：

```txt
tmp-fixture/
  package.json
  src/
```

流程：

1. 从 workspace 打包 `@proto.ui/cli` 与首发 packages
2. 在临时 clean project 中安装 packed tarballs
3. 执行 CLI 主路径
4. 检查生成文件存在
5. 运行最小 build / type check / import check

最低验证：

- `Button` 路径

建议验证：

- `Button`
- `Dialog` 或另一个复合组件

完成标准：

- smoke 可在本地一条命令运行
- smoke 可被 CI 调用
- smoke 失败时能明确指出是 CLI、package metadata、依赖安装还是生成物问题

---

## 4）P0：Quick Start 真实路径重写

### 4.1 建议负责人

文档与工程都能处理的人。这个任务不能只交给纯文档负责人，因为文档必须跟 smoke 命令一致。

### 4.2 子任务

- 重写 EN Quick Start
- 重写 ZH Quick Start
- 删除“当前暂不可安装”提示
- 只写已经被 smoke 验证的命令
- README 与 Quick Start 对齐
- status / roadmap / homepage 对发布日期与能力边界的表达对齐
- Web Component 文档并列呈现 CLI 与 HTML/script 路径

### 4.3 完成标准

- 用户照 Quick Start 能跑通组件
- Quick Start 的命令在 CI smoke 中有对应验证
- README 不承诺 Quick Start 尚未验证的能力
- release note 使用同一条上手路径

---

## 5）P0：首发 Package Readiness 清零

### 5.1 建议负责人

细致型 package / build 负责人。这个任务需要耐心，不适合边做边扩功能。

### 5.2 首发 package 范围

当前 launch governance 中的首发承诺包为：

- `@proto.ui/adapter-react`
- `@proto.ui/adapter-vue`
- `@proto.ui/adapter-web-component`
- `@proto.ui/prototypes-base`
- `@proto.ui/prototypes-shadcn`

CLI 的归属待本轮 P0 决定。

### 5.3 子任务

- 检查首发包 README 是否存在且内容可发布
- 检查 `exports`
- 检查 `types`
- 检查 `files`
- 检查 `publishConfig`
- 检查包之间 workspace 依赖是否会影响 npm 安装
- 检查是否仍直接导出不该发布的 `src/*.ts`
- 跑 `release:scan:launch`
- 跑 `release:stage:launch`

### 5.4 完成标准

- `pnpm -s release:scan:launch` 通过
- `pnpm -s release:stage:launch` 通过
- 首发 package 清单与 docs 提及完全一致
- 没有未归类 workspace package

---

## 6）P1：Contract / Test Catalog

### 6.1 建议负责人

熟悉架构、runtime、adapter 测试的人。

### 6.2 目标

让贡献者和 reviewer 能快速回答：

- contract 在哪里
- 实现在哪里
- 代表性测试在哪里
- 哪些 coverage 是 debt

### 6.3 子任务

- 建立 contract family 索引
- 建立 contract-test 映射索引
- 标记首发关键 contract
- 标记 post-launch debt
- 将 docs 中占位性质的 contracts-and-tests 页面补成可导航入口

### 6.4 完成标准

- reviewer 能从 contract 找到代表性测试
- 新增 adapter / prototype 改动能明确关联 contract
- 不要求 100% 穷尽，但首发关键路径必须覆盖

---

## 7）P1：Prototype 首发承诺面审计

### 7.1 建议负责人

熟悉 prototype library 和 docs/demo 的人。

### 7.2 当前冻结集合

Base 首发官方支持集合：

- `dialog`
- `hover-card`
- `select`
- `transition`

shadcn 首发官方支持集合：

- `button`
- `dropdown-menu`
- `hover-card`
- `switch`
- `tabs`
- `toggle`

### 7.3 子任务

- 检查上述 prototype 是否都有测试
- 检查 docs/demo 可见度
- 检查 release note / docs 是否只承诺这批集合
- 清理“看起来像已首发支持但其实没承诺”的表述
- 对不在首发集合中的 prototype 标记为 post-launch 或 experimental

### 7.4 完成标准

- 首发 prototype 清单、docs、demo、tests 一致
- 不因仓库已有实现而自动扩大首发承诺

---

## 8）P1：Review Rules / Contributing 收口

### 8.1 建议负责人

架构 reviewer 或核心维护者。

### 8.2 子任务

- 写 adapter 改动最小 review 规则
- 写 prototype 改动最小 review 规则
- 写 contract/test 变更说明要求
- 写 docs-only 改动的验证要求
- 将规则链接到 CONTRIBUTING 或 docs build/contribute 页面

### 8.3 完成标准

- PR 作者知道自己要补什么测试
- reviewer 能用同一套标准判断改动是否可进
- 不追求完整治理体系，只追求首发期最小一致性

---

## 9）P1：Docs Build 进入 CI

### 9.1 建议负责人

CI / docs infra 负责人。

### 9.2 当前事实

本地 `pnpm -s docs:build` 已通过，但 CI workflow 当前主要覆盖 type check 与 tests。

### 9.3 子任务

- 增加 docs build job
- 决定是否 PR 必跑，还是仅 main / release branch 必跑
- 如成本过高，可先设为 workflow_dispatch 或 release workflow gate

### 9.4 完成标准

- 发版前至少有 CI 或 release workflow 证明 docs build 通过
- docs build 失败不会等到发布当天才发现

---

## 10）P2：发布物料与发布后运营

### 10.1 可分配任务

- release note / release summary
- 官网首发页或 changelog 入口
- GitHub release 文案
- Discord / 社媒短文案
- 发布后一周 issue triage 方案
- 常见问题回复模板

### 10.2 完成标准

- 有最小公告包
- 有发布后响应机制
- 但这些任务不应抢占 P0 主线资源

---

## 11）建议 Issue 拆分

### Epic A：CLI + Package Release Governance

1. `CLI: define v0 launch command surface`
2. `CLI: implement init + first add path`
3. `CLI: add clean fixture smoke test`
4. `Release: classify @proto.ui/cli in launch governance`
5. `Release: make launch release scan pass`
6. `Release: add package pack/install smoke gate`
7. `Release: stage launch packages from workflow`
8. `Docs: align CLI README with Quick Start`

### Epic B：Quick Start Truthfulness

1. `Quick Start(EN): rewrite around verified CLI path`
2. `Quick Start(ZH): rewrite around verified CLI path`
3. `Docs: align README/status/roadmap/homepage launch wording`
4. `Docs: add Web Component CLI + script dual-path note`

### Epic C：Package Readiness

1. `Package: audit launch package README/export/types/files`
2. `Package: remove launch metadata blockers`
3. `Package: verify npm-installable dependency graph`
4. `Release: run and archive stage rehearsal`

### Epic D：Contributor Confidence

1. `Contracts: create contract family catalog`
2. `Contracts: create contract-test catalog`
3. `Contributing: add adapter/prototype review rules`
4. `Prototypes: audit launch docs/demo/test coverage`

### Epic E：Launch Materials

1. `Release note: draft v0.1.0 summary`
2. `Website: add launch/changelog entry`
3. `Community: draft announcement snippets`
4. `Ops: define first-week triage rotation`

---

## 12）推荐分派方案

如果现在有 4-6 名强开发者可投入，建议这样分：

| 人员 | 主要职责 | 备注 |
| --- | --- | --- |
| Contributor A | CLI Owner | 负责 `init + add + generated output + CLI tests` |
| Contributor B | Release / Package Owner | 负责 governance、release scan、stage、workflow gate |
| Contributor C | Smoke / Fixture Owner | 负责 clean project、packed tarball install、Button/Dialog smoke；可与 B 合并 |
| Contributor D | Quick Start Owner | 负责 EN/ZH Quick Start、README/status/roadmap 对齐 |
| Contributor E | Contract/Test Catalog Owner | 负责 contract/test 索引与 review 规则 |
| Contributor F | Prototype Surface Owner | 负责首发 prototype docs/demo/test 审计 |

如果只有 2-3 人，建议压缩为：

| 人员          | 主要职责                         |
| ------------- | -------------------------------- |
| Contributor A | CLI Owner                        |
| Contributor B | Release / Package / Smoke Owner  |
| Contributor C | Quick Start + Package docs Owner |

在资源不足时，优先保证：

1. CLI 首发路径真实可跑
2. package governance 不再阻塞 release scan
3. clean environment smoke 能验证 Quick Start
4. Quick Start 不再承诺未验证能力

---

## 13）首发前最终判断标准

当以下条件同时成立时，才应认真进入最终发布动作：

- `pnpm -s check:types` 通过
- `pnpm -s test` 通过
- `pnpm -s docs:build` 通过，或 docs build 已进入 release gate
- `pnpm -s release:scan:launch` 通过
- `pnpm -s release:stage:launch` 通过
- clean fixture 中 CLI 主路径跑通
- Quick Start EN/ZH 与 smoke 路径一致
- 首发 package 清单与 docs 提及一致
- 首发 prototype 清单与 docs/demo/test 一致
- release note / release summary 至少有一版可发布草稿

如果以上任一 P0 条件不成立，不应再新增首发能力，而应继续收口当前主路径。
