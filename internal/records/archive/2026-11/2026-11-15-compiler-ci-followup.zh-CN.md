# Compiler CI 跟进：依赖边界、调度修复与增量验收

本补充记录对应 PR [#1462](https://github.com/Proto-UI/Proto-UI/pull/1462) 首次真实平台运行后修复的两个 CI 问题。原 [Compiler 语义修复记录](2026-11-15-compiler-semantic-repair.zh-CN.md) 及其完整机器证据保持原字节。本记录只增加失败来由、五路径修复、增量测试及平台观测，不把轻量 PR CI 改称全量验收。

## 修订及内容对应

| 身份 | 精确值 | 本记录中的作用 |
| --- | --- | --- |
| 原完整本地验证源码 | `f5383ebf337570e2772fd818d79653724e0816dc` / tree `d8956b5d066b0e1c851cc6de4dd3cf6daf719ca5` | 原 compiler、类型与 native 完整证据仍绑定此版本。 |
| 本地增量验证源码 | `4dff077b0e85241dd63149548e30591b1d9a4608` / tree `ed65509cf4b87a63bde801f34914262427ddf643` | 集成后的统一增量验证使用的 clean HEAD；执行前后相同。 |
| 原公开记录提交 C2 | `56acca7cdce1c37745d6b2019d1db85f139ed283` / tree `364809ec1c63f08c1745c70acff953f9a053d64f` | 原代码加两份原验收文档，首次失败时的 PR head。 |
| 已公开修复提交 C3 | [`e7595e139e2e286abf7af6e5a0293a26addd7258`](https://github.com/Proto-UI/Proto-UI/commit/e7595e139e2e286abf7af6e5a0293a26addd7258) / tree `987fb53ac1fdd9e55d412d75a84c930f8c1612af` | parent 为 C2；五路径内容与本地增量源码逐字节一致。 |

C3 的 Git commit 原始对象、parent、tree、branch ref 均已读取核对。它比本地 `4dff077b0` 多出的仅是 C2 已有的两份记录；这两份文件的 Git blob、SHA-256 和内容未变。两个原始局部修复提交为 `925d32eb3126059c93f4c278d2afdfbaca1d827b`（规划依赖边界）与 `395292e91d598bfd59c823ebde53b29df320986a`（GPUI 调度/上下文）。本记录于补充发布提交创建前定稿；其真实提交 SHA 和读回另记于 PR 与发布收据，避免文件自引用自己的提交 SHA。

## 首次真实失败保留了什么

[首次 CI run 43767308588](https://github.com/Proto-UI/Proto-UI/actions/runs/43767308588) 的两个 job 都有实际日志，不是根据本地推测重建的失败。

| 实际平台证据 | 观察到的失败 | 修复的责任边界 |
| --- | --- | --- |
| [`public_package_plan`，job 132975208387](https://github.com/Proto-UI/Proto-UI/actions/runs/43767308588/job/132975208387) | checkout 后执行规划，`ERR_MODULE_NOT_FOUND`：`scripts/build/proto-source.mjs` 顶层导入 `typescript`，但规划阶段尚未安装依赖；exit 1。 | 纯 metadata/依赖图规划不应付出源码 parser 的依赖。 |
| [`ci-config-audit`，job 132975208555](https://github.com/Proto-UI/Proto-UI/actions/runs/43767308588/job/132975208555) | 既有审计准确报告 `pull-request-not-allowed`：新的 GPUI 重型 workflow 自动触发 `pull_request`，不属于轻量平台检查 allowlist；exit 1。 | 新增任务必须服从原调度政策，不能为它扩大 allowlist。 |
| [GPUI workflow run 43767259371](https://github.com/Proto-UI/Proto-UI/actions/runs/43767259371) | 平台记录 `failure`，列出的 jobs 为 0；没有 native 测试执行证据。 | 静态检查另定位到 job-level `env` 使用尚不可用的 `runner` context。平台 validation annotation 未取到，因此保留“零 job 失败”和“静态定位”这两种证据，不伪造平台报错文本。 |

首次 package-plan 日志记录的 checkout 是 PR 合并树 `49dc00dfe1171f2ef9d027136cccf66416917fe2`，base 为 `805766c2b652d8e70d3c5f80a5f6b57f35d725c9`，Node 为 `v24.22.2`。这与本地完整验收使用的已测上游 `8e0afb07c7d272f22f714c3b886a7b3b78c7e63a` 分开记录。

## 为什么这样修

### 规划与源码验证在真正需要 parser 的边界分开

`public-packages.mjs` 需要读取 `proto` export 的 metadata。之前共享 helper 顶层加载 TypeScript，使没有源码解析任务的 `--plan` 也提前失败。修复保留同一工具模块及同步 API；使用 `createRequire(import.meta.url)`，只在 `protoSourceFiles` 确认存在非空、合法 source entries 后加载原 TypeScript parser。

metadata 路径继续检查真实 source export；真正的源码闭包仍解析 import/type import、检查源文件和路径、打包完整传递依赖。没有缺 parser 时继续运行的 fallback，也没有通过给 plan 增加 install 掩盖层次问题。

四个新增控制使用实际脚本和隔离 Git 仓库，明确没有 `node_modules`：实际 CLI 与 source metadata 成功；docs-only 与 runtime 改动保持原选包规则；未知 build dependency 仍拒绝；合法非空 source entry 真正进入闭包验证时仍因缺 TypeScript 失败。before 为 **3 失败、1 通过**；修复后连同既有打包控制 **13/13 通过**。既有控制仍实际执行 npm pack、核对源码及擦除类型依赖、验证真实 Transition machine/types，拒绝缺失、逃逸、歧义和 symlink 源路径。

### 重型消费者进入已有完整周期，证据不中途丢失

GPUI workflow 保留 `workflow_call` 与手动 `workflow_dispatch`，由 `ci.yml` 的非 PR 完整周期调用一次，并加入 cycle report 的依赖。既有调度审计实现和 allowlist 未改。Linux/macOS matrix、native 生成与 Cargo 六个既有执行步骤保持不变；没有把重型测试删成无操作。

取消进行中的 evidence 会损失失败与来源信息，因此共享 workflow 不再自动取消 active run。checkout 与 artifact 名使用同一 `github.sha`，保留 `contents: read`、不持久化 checkout credentials、始终上传 evidence，缺 artifact 仍失败。Cargo target 在 runner 分配后的 shell step 中通过 `RUNNER_TEMP` 写入 `GITHUB_ENV`，再供 cache 和 Cargo 使用，避免 job-level context 提前求值。

调度控制 before 为 **17 通过、3 失败**；after 为 **20/20**。新增测试不仅读 YAML，还实际执行环境初始化 shell，使用含空格的临时路径并验证原环境内容保持。既有负控制继续拒绝越权 PR 触发、调度绕过、stale source identity、证据取消和缺失的完整周期调用。

## C3 只改变五个路径

| 路径 | 变化及目的 |
| --- | --- |
| `.github/workflows/ci.yml` | 非 PR 完整周期调用 GPUI consumers，并纳入报告。 |
| `.github/workflows/compiler-gpui-source-consumers.yml` | 正确的触发/并发/来源身份；runner 分配后初始化 Cargo target。 |
| `scripts/build/proto-source.mjs` | 仅真实源码闭包加载 TypeScript。 |
| `scripts/ci/test/ci-scheduling-policy.test.mjs` | 完整周期可达性、证据来源和实际环境 step 控制。 |
| `scripts/release/test/public-package-plan.test.mjs` | 未安装依赖的真实 CLI、metadata、选包与严格负控制。 |

C2→C3 为 **5 files、225 insertions、12 deletions**。机器证据逐项保存 before/after Git blob、文件 SHA-256 及与本地 `4dff077b0` 的一致性。没有 compiler/adapter/Rust 实现变更，也没有扩大 package 发布范围、权限或 DCO 规则。

## 集成后的本地增量验证

统一 runner 于 `2026-11-15T22:13:34.061Z` 开始，`22:18:10.525Z` 结束，Node `v24.22.1`，各检查串行执行。HEAD/tree 前后相同、工作树 clean。完整命令和原始 receipt 内嵌于 [本补充机器证据](evidence/2026-11-15-compiler-ci-followup.json)。

| 检查 | 实际结果 | 证明范围 |
| --- | --- | --- |
| CI scheduling policy | **20/20，0 skip** | 既有调度政策和新增 GPUI 可达性/环境初始化。 |
| Source ledger checkpoints | **21/21，0 skip** | 既有 provenance、接受状态与历史冻结义务。 |
| CI schedule inventory | **exit 0** | 实际 workflow 清单符合原政策。 |
| 全部 release Node 测试 | **223/223，0 skip** | 24 个文件；原 219 项及此次 4 项规划回归。 |
| Compiler source-package 两文件 | **19/19，0 pending** | `package-source.test.ts` 18 项；`package-source-consumer.test.ts` 1 项实际安装包→生成 Vue→mount/update/dispose。 |

这 19 项是原完整 compiler cohort 的受影响部分重跑，不是额外 19 个 unique tests。局部 13 项和调度的 before/after 也与集成复跑重叠，不能相加成新的独立总数。原 `f538` 的 **2,503 compiler pass + 1 历史 skip、219 release pass、严格类型、native、browser 阻塞**继续只作为原版本的完整证据；此次没有把全套 compiler/native 再执行一遍。

## 远端结果与仍然成立的限制

最终平台快照时间为 `2026-11-15T22:19:52.876Z`。[CI run 43768254051](https://github.com/Proto-UI/Proto-UI/actions/runs/43768254051) 关联 C3，event 为 `pull_request`，实际完成且 conclusion 为 **success**。已逐项读取 22 个 jobs/steps：**4 个实际 success，18 个 skipped**。

四个成功 job 是 `ci-config-audit`、`lockstep-check`、`test-plan`、`public_package_plan`。18 个跳过项包含 `compiler-gpui-consumers`、生产 suites、类型、浏览器、Rust 和 release 重型任务，符合已有 PR 调度政策。没有声称远端 Linux/macOS GPUI 消费者已在这次 PR CI 执行，也没有把 skip 计为 pass。新的 GPUI runner 配置已通过本地精确控制，远端 native 实际执行仍须完整周期或手动运行。

在 `22:19:52.876Z` 的 CI 快照中，**DCO 为 `action_required`，Vercel deployment 为 `pending`**。后续 `2026-11-15T22:22:27.533Z` 独立读取同一 C3 的 provider status，Vercel 已为 **success / Deployment has completed**（平台状态于 `22:20:26Z` 更新）；原 pending 快照仍保留。部署完成和 Preview Comments check 都不等于真实浏览器交互、视觉或可访问性测试通过。

DCO 的 `action_required` 尚未解除。C3 为明确标识 AI authored 的 unsigned carrier；connector 的 author/committer 是传输身份，不代表人类 DCO 签署。本记录不更改这些状态或权限，也不构成正式 review approval。

## 证据保存方式

本补充机器证据完整嵌入原始小型 JSON receipts、逐 case 报告及平台/发布读回；完整文本日志按文件名、执行路径、字节数和 SHA-256 索引。原始失败与 before 日志未覆盖。记录中的本地路径只是执行出处，不声称已成为 GitHub 可下载附件；机器证据中的原始 receipt 仍保留其当时的 pending 描述，并由独立时间戳的最终快照补充。
