# Shadow split 最新评审收尾与预算归因

## 范围与状态

本记录跟进 PR #652 在 `d09e1c8a0de5f98dd20353a14e2df6b8139b09cc` 上的最新源码评审，并把该 head 与 `main@72a8e395f8d955f732be64da526d32074b74b069` 的本地合并候选作为后续验证基线。它不替代 exact-head CI、独立预算接受、review dismissal 或 merge 授权。

当前评审收尾有两个独立主题：

1. 明确 plain-v1 companion receipt 的信任边界，避免把局部 canonical recipe 检查误述为任意 CSS 认证。
2. 对五项 whole-entry budget 超限重新做当前 main 对照与文件级闭包归因，不借用 #689 的 A11y 专用额度，也不在 #652 内自行抬高上限。

## Receipt 信任边界处置

选择并固化“可信、同源、未手改的 CLI companion”边界：

- plain-v1 companion 必须由 CLI 从与 document CSS 相同的 token closure 生成，并与 document CSS 一起重新生成；
- 普通 per-rule receipt 用于发现陈旧或误改，只证明制品内部自洽，不认证对抗性或独立编写的 CSS；
- 任意修改 declaration 后重算 receipt，不等于恢复 canonical generator recipe；
- 对跨 split boundary 的已治理 recipe，Adapter 仍持有独立 canonical 声明并在 target mutation 前 fail closed；当前 native sizing 的 `w-full` / `min-h-16` 属于该类；
- 不为实验性 profile 手写通用 CSS 安全解析器，也不把未知 recipe 默认为已认证。

对应投影与证据：

- `D-WEB-COMPONENT-SHADOW-STYLE-0001-R` 记录上述 draft 决策边界；
- Web Component 与 CLI README 要求消费生成制品、禁止手改或手工重算 receipt；
- `shadow-split-effects.test.ts` 保留 canonical sizing declaration 被改写且重算 receipt 仍拒绝的用例，并新增非 sizing paint token 被改写且重算 receipt 后仍只按“自洽制品”接纳的边界用例。

## Correctness 评审处置清单

`d09e1c8a` 前两笔 signed-off 修复已由后续 exact-head review 确认，不再携带以下 finding：

- canonical `w-full` / `min-h-16` 声明与可信 recipe 对比；
- 非法 `@layer proto-ui, extra {}` block fail closed；
- native-text marker 在 verified base rule 内的注册前检查；
- descendant open ShadowRoot transition lifecycle invalidation；
- keyboard modality / `:focus-visible` 在 substituted Tab traversal 前刷新。

本轮新增的 receipt 边界不是对上述修复的回退：canonical cross-boundary recipe 继续 fail closed；新增用例专门说明普通非 sizing receipt 不构成通用 CSS authentication。

当前 GitHub review threads 查询结果为 0 个 unresolved thread。`CHANGES_REQUESTED` 仍保留，需由独立 reviewer 在新 exact head、green gate 与预算事务完成后处置；本轮不回复、不 resolve、不 dismiss。

## Main 同步

`main@72a8e395` 与 PR 只在两个 Focus 接线点发生内容冲突：

- `packages/modules/focus/src/caps.ts`：同时保留 #652 的 `FOCUS_SAMPLE_SCOPE_TARGETS_CAP` 与 main 的 `FOCUS_ORDER_CAP`；
- `packages/adapters/web-component/src/runtime/modules.ts`：同时提供 composed-tree scope sampler 与 `orderFocusTargetsByDocument` host ordering。

两项 capability 解决不同层次的问题，不能互相替代；合并候选未删除任一侧逻辑。

## 可比预算测量

本地对照使用同一 Node v22.23.2、esbuild 0.25.12、Darwin arm64 与 zlib 1.2.12。它用于同环境差量与归因，不覆盖 Linux CI 的 canonical 数值。

| whole-entry           | main `72a8e395` | 合并候选 | gzip 差量 | 当前上限 |
| --------------------- | --------------: | -------: | --------: | -------: |
| core                  |           4,907 |    6,017 |    +1,110 |    6,000 |
| runtime               |          63,202 |   64,895 |    +1,693 |   64,000 |
| adapter-react         |          82,811 |   85,561 |    +2,750 |   83,500 |
| adapter-vue           |          82,555 |   85,305 |    +2,750 |   83,500 |
| adapter-web-component |          85,992 |  103,003 |   +17,011 |   97,000 |

旧 exact head 的 canonical CI run `35993763862` 实际日志为 core 6,013、runtime 64,912、React 85,510、Vue 85,247、WC 103,006；此前 review 正文中的 WC 103,851 是转录错误。其它四项与日志一致。

## 文件级闭包归因

使用与 budget gate 相同的 esbuild bundle/minify/tree-shaking/external 设置，并对 main 与合并候选的 metafile `bytesInOutput` 做逐文件对比。该数值用于闭包定位，不是可相加的 per-file gzip 贡献。

共享闭包的主要增长：

- `packages/core/src/spec/feedback/application-role.ts`：约 +2,175 minified bytes；
- `packages/core/src/spec/feedback/root-effect.ts`：约 +710；
- `packages/modules/context/src/center.ts`：约 +874；
- `packages/adapters/base/src/events/web-event-router.ts`：React/Vue/WC 闭包约 +1,520；
- `packages/adapters/base/src/platform/instance-tree.ts`：各 Web Adapter 闭包约 +822–835；
- `packages/core/src/spec/feedback/recorder.ts`：约 +275。

`packages/modules/focus/src/create.ts` 在当前 main 对照下反而约减少 1,026–1,033 minified bytes；新 main 的 focus-ordering 合并没有制造重复 Focus runtime。

WC 专有增长的主要来源：

- `packages/adapters/web-component/src/runtime/modules.ts`：约 +15,505 minified bytes；
- `shadow-split-effects.ts`：约 +8,125；
- `focus-scope-targets.ts`：约 +6,253；
- `shadow-style-artifact.ts`：约 +3,105；
- `adapt.ts`：约 +3,100；
- `portal-mount.ts`：约 +1,898；
- `shadow-color-scheme-environment.ts`：约 +1,320；
- 其余 owner/resource/surface/conceal/profile 文件各约 +325–762。

本次 metafile 未发现同一物理 source 的重复副本、`src`/`dist` 双份包含、新第三方 external 被误打入，或测试/证据文件进入 public entry。主增长与已接受的 Root role transport、portal/Shadow owner、组合树 Focus 与 live invalidation 能力一致。文件级数据不证明实现已全局最优，但没有证据支持通过删除 correctness 路径来回收现有缺口。

## 当前结论与 gate

- #652 内不修改 `scripts/analysis/package-budgets.mjs`，不借用 #689 的 A11y attribution，也不删除或跳过测试。
- 共享闭包与 WC 专有增长均已定位；缺口不是压缩环境漂移或一个意外依赖造成。
- 若维护者接受这些能力对应的当前体积，需要遵循 #654 的独立 numeric transaction：canonical Linux before/after、主增长归因、明确 headroom、独立 review 与 green CI。
- 在该独立事务落地并将 #652 更新到 resulting main 前，`public_package_build` 仍是预期且真实的 merge blocker。

## 本轮本地验证

- `shadow-split-effects.test.ts`：34/34；
- Focus `center.test.ts` + `center-order.test.ts`：14/14；
- 三个 focused files 合计 48/48；
- `check:spec-authoring -- --base origin/main`：通过，检查 24 个 catalog inputs；
- `check:types`：通过，250 个 Astro files，0 errors / warnings / hints；
- `check:package-budgets`：按上表预期失败五项；当前 main 对照九项全部通过。

尚未在合并候选上执行完整根级 test/browser matrix、canonical Linux package build 或独立 review。没有降低 coverage、timeout，也没有迁移 self-hosted runner。

## 执行后补充（2026-09-27）

本节保留后续操作的实际结果，不改写上面的时间点记录：

- 根级 `corepack pnpm@10.32.1 test` 的重跑中，非浏览器阶段通过（539 files、3,153 tests passed，34 todo）；浏览器完整阶段在 Codex 客户端更新中断。中断前有一条 Brutalist Tooltip Group 用例失败；之后完整重跑其所属 browser shard 2/4，11 files、55 tests 全通过，因此尚不能声称完整根级测试全绿。
- PR #652 的 review-thread GraphQL 连接有多页。完整分页后查询到 13 个 unresolved threads；此前仅查询第一页所得“0 个 unresolved thread”是错误结论。本轮没有回复或 resolve 这些 inline threads。
- 为信任边界收尾创建并推送了 signed-off commits `0ec7be814e7dd37d650ad26e9f670b4dd62d9ef0`（同步 `main@72a8e395`）和 `9bc440855caaefd81badbea22727f401d62a425c`（receipt 边界代码、spec、文档与回归）。新 head 的 GitHub Actions 已启动，仍待结果。
- 本轮计划对最新 review 留言，只说明 plain-v1 trusted same-source companion 的选定边界、对应回归与验证；预算 gate、其它未解决线程和 `CHANGES_REQUESTED` 仍待后续独立处置。
