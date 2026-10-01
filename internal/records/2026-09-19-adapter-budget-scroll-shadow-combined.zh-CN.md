# Adapter 预算：scroll end-follow 与 shadow split 合并归因（#654 流程）

## 背景

#654 的维护者决定要求数值上限调整是一笔可评审事务。#659 已按该路径为 WC adapter 上限（76,000 → 86,000）提供过评审记录。#623（scroll end-follow）与 #652（shadow split S1-S5）都会增长 react / vue / web-component 三个 eager adapter 闭包：单独合并任意一个，另一个的 canonical 测量都会越过既有上限。本记录给出三者合并后的稳态测量与归因，本 PR 即对应的独立上限调整事务。

## Canonical 前后测量

测量形状不变：esbuild bundle + minify + tree-shaking，browser ESM/ES2020，同一 external 边界，gzip level 9。本地（Windows x64）与 CI（linux/x64）在相同 pinned 工具链下逐字节一致（Node v22.23.2、zlib 1.3.1-e00f703、esbuild 0.25.12）。

| 对象 | 组合 | 测量值（gzip） | 当时上限 |
| --- | --- | --- | --- |
| main @124f44c9 | 基线 | react 72,749 / vue 72,463 / wc 75,920 | 75,000 / 75,000 / 86,000 |
| main + #623 | 单切片 | react 75,397 / vue 75,148（CI 89ac55c2：75,346 / 75,091） | #623 分支内 76,000 / 75,500 |
| main + #652 | 单切片 | react 75,033 / vue 74,757 / wc 85,179（CI run 35417935814 复核 react 75,033） | 75,000 / 75,000 / 86,000 |
| main + #623 + #652 | 合并稳态 | react 77,986 / vue 77,742 / wc 88,106 | 本 PR 调整后 78,500 / 78,500 / 89,000 |

合并稳态 minified 产物：react 295,838 bytes（SHA-256 `38ea1a8af2d2171c7cb6f91681a26c1baa6a26c84bbcd05c086777a7075e4982`）、vue 294,578（`b257b79a9d8eb80a3546954e98a43135fac30093788b2c911e6168c83dbbb4f2`）、wc 329,422（`5fa34b337c806d0644b5c853ec1a4caf880934b4a4e5818aeb1e88f53ed022df`）。

## 增长归因（相对 main 基线）

- react +5,237 / vue +5,279：#623 的 scroll end-follow 运行时/模块切片约 +2.9 KB；#652 的 core feedback application-role / root-effect 分类器（shadow split 的组合树焦点正确性依赖）约 +2.3 KB。两切片职责不交叠，增量近似可加。
- wc +12,186：#652 shadow split 能力族（85,179 − 75,920 = +9,259，归因详见 internal/records/2026-09-18-wc-adapter-budget-shadow-split-baseline.zh-CN.md）加 #623 scroll 切片约 +2.9 KB。
- 无意外包含：两个切片均在各自 PR 内完成过文件级归因评审；合并测量未发现测试工具、重复运行时副本或与能力无关的模块进入闭包。

## 上限与余量

`adapter-react root` 75,000 → 78,500（余量 514）、`adapter-vue root` 75,000 → 78,500（余量 758）、`adapter-web-component root` 86,000 → 89,000（余量 894）。余量与既往约 0.5–1.5 KB 惯例一致；这不是对未来增长的普遍授权。两个切片全部落地前，上限相对 main 实际用量偏松，属无害状态。

## 边界

本变更不解除 whole-entry anti-regression 门的阻断性，不改变测量形状，不扩张公共 API 或运行时语义，不修改 spec 实体。#623 分支内曾自带的 react 76,000 / vue 75,500 数值由本记录的合并稳态数值取代；#623 合并 main 时以本 PR 数值为准解决冲突。
