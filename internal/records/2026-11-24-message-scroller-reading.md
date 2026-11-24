# MessageScroller 可见阅读锚点修复与目录绑定

## 请求、范围与源码

Agent 对当前请求的公开转述：继续推进 Proto UI 的既有 Sprint 工作，修复可复现的回归，并保留真实验证、审查和整合状态。本批对应 [#1099](https://github.com/Proto-UI/Proto-UI/issues/1099) 的 Message Scroller 消息锚点／初始位置条件，并向 [#1673](https://github.com/Proto-UI/Proto-UI/issues/1673) 的整体接受提供一个有界修复。

原始基线为 `88fc0883bec70abbc0d7505d88370657c279639e`。修复随后正常 rebase 到包含 Sprint 6 的主线 `06d4f20249d8128575d6e0e13385e9dcf540c84c`，并在源码提交 **`fe134ee3a08c2875d7cee49899034ffdd442e441`** 重跑受影响的 Reading 组合与严格类型检查。该提交的四个源码／规格文件哈希保存在 [receipt.json](evidence/2026-11-24-message-scroller-reading/receipt.json)。后续证据提交不改变这四个文件。

本批只修复 `visible-preferred` 的既有可见范围判定，并把公开 `asMessageScrollerReading` Hook 的现有 draft 条件绑定到具体源码和可执行测试。没有修改原规范条件、`readingInset` 输入范围、first-crossing 策略、共享宿主滚动执行权或 draft 准入状态。

## 首次分歧与最小修复

`P-BASE-MESSAGE-SCROLLER-KEYED-CAPTURE` 已要求 `visible-preferred` 只考虑视口内可见条目。原实现先检查 `entry.end > inset`，再只检查条目顶部在视口底部之前；当 inset 为负数时，完全位于视口上方的 primary 也会满足这两个条件。零高视口同样可能选中跨过零点的条目。

以下结果来自真实公开有限数据 helper 的执行。坐标与 `scrollOffset` 是测试注入的宿主事实，没有声称实际浏览器几何或物理输入。

| 输入与观察量 | 原实现的选中 key | 修复后的选中 key | 有意义的对照 |
| --- | --- | --- | --- |
| viewport=100、inset=-20；primary `above-only` 范围 -30..-10，fallback `visible` 范围 0..30 | `above-only` | `visible` | first-crossing 仍选择 `above-only` |
| viewport=100、inset=-40；primary `candidate` 范围 -30..0，fallback 范围 10..30 | `candidate` | `fallback` | 部分可见 -30..10 的 primary 仍可选 |
| viewport=0、inset=0；primary `crosses-top` 范围 -10..10 | `crosses-top` | 空锚点，保存 scrollOffset=100 | first-crossing 仍选择 `crosses-top` |

修复只改变 `reading-plan.ts` 的 visible-preferred 分支条件：

```ts
frame.viewportSize > 0 && entry.end > 0 && entry.start < frame.viewportSize;
```

它要求非空视口及上下边界的实际相交。第一条可见 primary 的优先级、无 primary 时第一条可见 fallback、恰好从视口底部开始的排除，以及 first-crossing 的 inset 和视口以下行为都保留。空 capture 不会被重新解释为退休初始恢复 hint。

## 测试与规范登记

新增文件使用公开 MessageScroller entry、真实 Reading／Viewport Hook、Web Component adapter 和一个真实 RuntimeSession。测试包括有限数据 capture／identity／selection 判定，以及一处滚动 owner、初始 hint、显式输入事实交接、selection replay、终止销毁和保留实例的 mount epoch。

WC 从 DOM 移除会终止销毁该 session，旧公开 handle 必须拒绝调用；这个边界与保留 RuntimeSession 的 unmount/mount 使用不同 fixture。后者验证旧 frame 和 selection ticket 不得修改新 epoch。本测试没有验证 position restore-ticket replay，T 记录明确保留这个边界。

新增 `T-BASE-MESSAGE-SCROLLER-READING-0001` 为 draft，六个 CASE 映射到四个既有 P 条件。P→T 关系显式从 `0.3.0-alpha.2` 开始，避免回填不存在的历史测试。实现状态 `passing` 仅对应这里实际执行的有限数据／确定性组合证据。

| 验证 | 实际结果 | 源码与范围 |
| --- | --- | --- |
| 新增 33 例在未修复实现上的负控 | 30 pass / 3 fail | 原三个可见范围缺陷；[原始结果](evidence/2026-11-24-message-scroller-reading/visibility-boundaries-red.json) |
| 独立审查者执行新增测试 | 33 pass / 0 fail / 0 skip | 冻结实现和测试哈希；[结果](evidence/2026-11-24-message-scroller-reading/independent-reading-review.json) |
| 新主线组合的四个 MessageScroller 测试文件 | **36 pass / 0 fail / 0 skip** | `fe134ee3`；[结果](evidence/2026-11-24-message-scroller-reading/integrated-reading.json) |
| 受影响源码和四个测试文件的严格 TypeScript 检查 | exit 0 | 继承仓库 tsconfig，未降低 strict；[可复现配置](evidence/2026-11-24-message-scroller-reading/typecheck.json) |
| prototype catalog 与 bounded-map 控制 | pass；7/7 控制 | 1015 declaration files、1408 entries、469 cataloged P entities；[日志](evidence/2026-11-24-message-scroller-reading/integrated-catalog.log) |
| 新主线完整 graph suite | **29 pass / 0 fail / 0 skip** | `fe134ee3`，七个文件、单 worker、原 5000ms 期限；[结果](evidence/2026-11-24-message-scroller-reading/integrated-spec-graph.json) |
| spec authoring | exit 0 | 对主线 `06d4f202` 的两个变更目录输入；[日志](evidence/2026-11-24-message-scroller-reading/integrated-spec-authoring.log) |
| Agent 文档投影生成及 check | exit 0 | 使用仓库生成器；输出是被忽略的本地投影；[日志](evidence/2026-11-24-message-scroller-reading/integrated-projection.log) |

可复现命令（Node 24.22.3、pnpm 10.32.1、锁定依赖）：

```bash
corepack pnpm@10.32.1 exec vitest run packages/prototypes/base/test/message-scroller-reading.test.ts packages/prototypes/base/test/message-scroller.test.ts packages/prototypes/base/test/message-scroller-capture.test.ts packages/prototypes/base/test/message-scroller-anchor.test.ts
corepack pnpm@10.32.1 exec tsc -p internal/records/evidence/2026-11-24-message-scroller-reading/typecheck.json --noEmit
corepack pnpm@10.32.1 -s check:prototype-catalog
node --import tsx scripts/spec/check-lifecycle-authoring.mjs --base 06d4f20249d8128575d6e0e13385e9dcf540c84c
node --import tsx scripts/spec/generate-agent-project-understanding.mjs
node --import tsx scripts/spec/generate-agent-project-understanding.mjs --check
```

## 保留失败与实际边界

首次组合 fixture 错把 WC terminal detach 当成同一 session remount，得到 20 pass / 1 fail；[失败原件](evidence/2026-11-24-message-scroller-reading/reading-first.json) 保留。修正 fixture 后以两个生命周期分别验证，没有修改产品生命周期来迎合测试。

规范登记的中间版本遗漏 CASE 前缀，随后又发现 P→T 关系缺少版本起点。两次真实拒绝分别保留在 [schema 日志](evidence/2026-11-24-message-scroller-reading/spec-authoring-final.log) 和 [关系日志](evidence/2026-11-24-message-scroller-reading/spec-authoring-green.log)，最终上述 authoring 检查通过。独立复核确认最终规格只补这两类元数据，原 criteria 和 draft 状态没有改变。

较宽的、rebase 前的 graph suite **没有全绿**：单 worker、原 5000ms 期限下为 25 pass / 4 timeout / 0 skip，分别是既有 Checkbox baseline 三例和 Dropdown evidence 一例。[原始结果](evidence/2026-11-24-message-scroller-reading/spec-graph-accepted.json) 保留。在 `88fc0883` 的 sparse checkout 对这四例进行同预算控制，得到 2 pass / 2 workspace.issues assertion failures，失败出现在工作区有效性断言（103 项），不是 timeout；[这份控制](evidence/2026-11-24-message-scroller-reading/spec-graph-baseline-control.json) 未形成与候选相同失败模式的归因证据。未扩大期限或把该完整 suite 宣称为通过；后续从相同 `88fc0883` 精确物化缺失的 81 个文件（1,063,614 bytes），未改测试或实现；[完整有效性](evidence/2026-11-24-message-scroller-reading/baseline-workspace-valid.json) 为 1330 entities / 0 issues，[有效基线控制](evidence/2026-11-24-message-scroller-reading/spec-graph-baseline-valid.json) 为 4/4。新主线 `fe134ee3` 上完整 graph suite 随后实际得到 29/29，仍用单 worker 和原 5000ms 期限。后续通过不重标旧 timeout 或无效控制，也不宣称已经证明此前四次 timeout 的全部原因。

执行环境还出现过 tsx CLI IPC `EPERM`、隔离 checkout 缺少已锁定 leaf 依赖，以及一次临时完整基线 checkout 磁盘空间不足。分别使用同脚本的 `node --import tsx`、补齐本地依赖链接、清理失败的本轮临时 checkout 后改用 sparse baseline。没有修改依赖版本、测试阈值、权限配置或其他执行者的文件。

## 审查与后续接受

[独立技术审查记录](evidence/2026-11-24-message-scroller-reading/independent-review-summary.json) 未发现剩余阻断性源码问题；独立审查者也复核了最终 CASE／关系版本元数据。该记录不是 GitHub `APPROVED`，不会代替平台审查或可信 CI。

Agent evidence 的有界内部逻辑证据已包含可复现负控、实际变量分歧、源码哈希和回归结果。本批没有界面视觉改动，使用上述内部行为说明，没有制造截图。原生浏览器、物理输入、辅助技术、非 Web、包／工作区／发布周期接受与 platform review 仍各自未完成。完整 graph 的本次 29/29 只归属上述 `fe134ee3` 源码组合。原 #1099 与 #1673 的完整接受条件不因这一补丁自动勾选或关闭；实际合入后再按 merge SHA 更新有界开发子项。
