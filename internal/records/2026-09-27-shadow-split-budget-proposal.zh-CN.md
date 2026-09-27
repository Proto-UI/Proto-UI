# PR #652 Shadow Split 的独立包体积预算提案

## 提案范围与治理边界

本记录作为独立 PR 提议调整五个 whole-entry gzip 上限，以容纳 PR #652 已实现的共享 core/runtime 增长，以及 Web Component Shadow Split、组合树 Focus 和相关 correctness 修复。此 PR 只调整测量阈值和记录证据：保留 whole-entry blocking anti-regression gate、九个入口、esbuild bundle/minify/tree-shaking 配置、external 边界和 gzip level 9；不改变产品实现、公共 API、运行时语义、coverage 或 CI timeout。

这是供独立评审的额度申请，不代表 #654 决定已批准具体数字，也不代表已接受后续能力的任意增长。PR #652 当前仍是独立 open PR；必须在本提案审查通过、合入后，由 #652 的新 exact head 重新运行 package gate 和完整 CI。评审者可以要求缩减阈值、先做额外优化或拒绝本提案。

本提案遵循已完成的 #654 测量政策切片：whole-entry 预算继续作为阻断性防回归门；CI 固定工具链是 canonical；每次数值变化须说明能力归因、同环境前后测量与明确余量。consumer/profile diagnostics 仍是补充报告，不取代 whole-entry gate。

## Canonical Linux 前后测量

对比使用 GitHub-hosted Linux x64 上相同的 Node.js 22.23.2、zlib 1.3.1-e00f703、esbuild 0.25.12、browser ESM / ES2020、相同 workspace/external 边界及 gzip level 9：

- **Before（当前 main）**：[CI run 36225968301](https://github.com/Proto-UI/Proto-UI/actions/runs/36225968301)，成功 head `72a8e395f8d955f732be64da526d32074b74b069`，2026-09-26。
- **After（待评审的能力 head）**：[PR #652 CI run 36284538941](https://github.com/Proto-UI/Proto-UI/actions/runs/36284538941)，head `a51c8fb0f959d98afea46bd8eb0a810e5a7e0b7d`，2026-09-27。测试、类型、Rust、四个 browser shards、release、consumer 等相关任务成功；唯一失败为 `public_package_build` 中五个 whole-entry 上限。

| 入口 | main gzip | #652 gzip | 增量 | 当前上限 | 提议上限 | #652 实测后的余量 |
| --- | --: | --: | --: | --: | --: | --: |
| core root | 4,894 B | 6,013 B | +1,119 B | 6,000 B | 6,600 B | 587 B |
| runtime root | 63,328 B | 65,003 B | +1,675 B | 64,000 B | 66,000 B | 997 B |
| React Adapter root | 82,947 B | 85,696 B | +2,749 B | 83,500 B | 86,500 B | 804 B |
| Vue Adapter root | 82,666 B | 85,422 B | +2,756 B | 83,500 B | 86,500 B | 1,078 B |
| Web Component Adapter root | 86,096 B | 103,173 B | +17,077 B | 97,000 B | 104,500 B | 1,327 B |

上限根据同一 Linux 工具链下的 #652 产物分别留约 0.5–1.5 KB 空间；不会把已有 main 空间再次作为增长额度。其它四个入口的阈值不变。#652 测量的 minified SHA-256：core `9fcd4580e89f1c4c5cf6da6064c4ff46e1b0b751cf1b979847bae41afa6b39ec`；runtime `4b4f91c6ba8fcc757a0bdafe49972aa7288a03dc0ce1e3c2932391d35fe3b346`；React `ec3c46db13192f4aab5fa308fa9c070e92a996d55977ba5bfe1d6156afd37916`；Vue `9fc2a9b34d99b9208a7bed8f56804cd70b0ce0d995436a325cd099e8a6a15321`；Web Component `c806723cafd8fdcd173dd051f98dffd96575c929aa1bc6dbb6ccd9b3daeba566`。哈希显示候选测量对应相同 minified artifact；本地 zlib 不同造成的 gzip 差异不用于设定上限。

## 增长归因与优化检查

本提案不以“功能正常增长”为由略过意外闭包检查。相对 `main@72a8e395` 对 #652 候选做同配置 esbuild metafile/source 闭包对照，没有发现测试/证据文件打入公共入口、第三方依赖误入、同一 source 重复副本或 `src`/`dist` 双份包含。增长与已实现能力相符：

- 共享 core/runtime/Adapter 路径包括 Feedback application-role（约 +2,175 minified bytes）、root-effect（约 +710）、Context center（约 +874）、Web event router（各 Web Adapter 闭包约 +1,520）、instance-tree（约 +822–835）及 recorder（约 +275）。这些共享路径解释 core、runtime 和 React/Vue/Web Component 的共同增量。
- Web Component 专属增量主要落在 `runtime/modules.ts`（约 +15,505 minified bytes）、`shadow-split-effects.ts`（约 +8,125）、`focus-scope-targets.ts`（约 +6,253）、`shadow-style-artifact.ts`（约 +3,105）、`adapt.ts`（约 +3,100）、`portal-mount.ts`（约 +1,898）及 shadow color-scheme environment（约 +1,320）。这是 Shadow Split、owner/lifecycle、组合树 Focus 与 live invalidation 能力的闭包，不是意外依赖副本。
- 分析明确指出没有通过删减正确性路径换取预算空间的依据。此次额度仅覆盖已归因的 #652 切片和有限余量；进一步包拆分、懒加载或改变 API 的方案不在本 PR 范围。

完整文件级对照、能力解释和边界见 [PR #652 head `a51c8fb0` 的预算归因记录](https://github.com/Proto-UI/Proto-UI/blob/a51c8fb0f959d98afea46bd8eb0a810e5a7e0b7d/internal/records/2026-09-27-shadow-split-review-closeout-and-budget-attribution.zh-CN.md)。该分析用于解释增长来源，不把 per-file minified 数量误当成可相加的 gzip 贡献。

## 验证与剩余门禁

本提案本身的验证是：当前 main 上执行 `corepack pnpm@10.32.1 check:package-budgets`，确认所有当前入口仍符合提议的 ceiling；并由此 PR 的 GitHub-hosted Linux CI 重新执行相同 gate。macOS 本地 gzip 只作辅助，不替代 canonical Linux CI。提案获批并合入后，PR #652 必须在更新后的 head 取得完整新 CI；本提案不会替该 PR 的测试、review thread 处置、`CHANGES_REQUESTED` 或 merge gate 提供任何豁免。

没有降低测试覆盖、关闭或改为非阻断的 whole-entry gate、调低 timeout、迁移 self-hosted runner，或改变 #652 的测试集合。组织成员对数值和余量的独立评议仍是待完成的人类决定。
