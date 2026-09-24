# Table Structure eager-closure 预算事务（#621 / #654 流程）

## 范围

#621 Checkpoint B 在既有 draft `D-BASE-TABLE-STRUCTURE-0001` / `C-TABLE-STRUCTURE-0001` 边界内新增 `M-TABLE-STRUCTURE-0001` 与五个 Base Table identities。它把 Table Structure Module 注册到 standard Runtime，并通过既有 Anatomy、State 与 A11y path 提供 passive topology、diagnostics、coordinates、spans 与 opaque header relationships；不新增 `HC-TABLE`、host service、交互、Data Table 或 design-language 能力。

本记录对应 Table 切片进入 eager 闭包后 runtime 与 React/Vue adapter 三个 whole-entry ceiling 的独立 numeric transaction。它不修改 Table 语义，不替代 #621 implementation review，也不解决 #652 的历史 Core/Runtime 预算或未合入能力。本事务基于当前 `main` 重新测量；早期针对 `main@c473eae3` 的草稿数字（runtime 62,651 / 63,500 上限）在 `main` 前进后失效，由本记录取代。

## Canonical 测量

测量形状不变：esbuild bundle + minify + tree-shaking，browser ESM/ES2020，同一 external boundary，gzip level 9。Node v22.23.2、zlib 1.3.1-e00f703、esbuild 0.25.12、linux/x64。

| 对象 | gzip / minified / SHA-256 | 旧上限 |
| --- | --- | --: |
| `main@9eb93e9b` runtime | 60,000 / 239,913 / `ac798197516a9e8629f75c4705f6eff0a0125edb9faf9b52ce0a33d8a0a1b8a7` | 60,000 |
| `main@9eb93e9b` react | 79,422 / 301,206 / `7ae5f362c7cb20e850c0a9fb3699fd10ecff4bc97e6b12752cf396fedd47cf` | 83,000 |
| `main@9eb93e9b` vue | 79,163 / 299,915 / `53719c92eeb52b27084f7a4610a5d4bd950770ab4d2735d6eb08810cb29bb71bc` | 82,500 |
| Table head `2d305208` runtime | 63,294 / 252,585 / `cc937db39a8e6484d948ce19c53c362dc8e7fdd6b0f88519ac6ece85c69d23b1` | 60,000 |
| Table head `2d305208` react | 82,816 / 313,878 / `cfbe1f0b0a17f0656f9a3fb81d3a65f0c5dc70e5f18cb789e190373288678f18` | 83,000 |
| Table head `2d305208` vue | 82,527 / 312,587 / `34d7fa1b7dcb24584fdc15c14926a041efd07b1b38c88b3facdc5f62cca6915d` | 82,500 |

Table Checkpoint B 的增量是 runtime **+3,294**、react **+3,394**、vue **+3,364** gzip bytes。增长来自新 Module projector、nearest-domain coordination、State/A11y projection 与 Runtime ModuleDef registration；44 个 public packages build、focused topology/Base/adapter tests 与 package import smoke 验证交付面，不能用删减已批准语义来换取 gzip 数字。

## 新上限与余量

- `runtime root`: **60,000 → 64,000**；相对 63,294 留 **706 bytes**。
- `adapter-react root`: **83,000 → 83,500**；相对 82,816 留 **684 bytes**。
- `adapter-vue root`: **82,500 → 83,500**；相对 82,527 留 **973 bytes**。

余量落在 #654 已批准的约 0.5–1.5 KB bounded headroom 范围内，不是对后续增长的普遍授权。`adapter-web-component root` 保持在 97,000：Table head 实测 85,960，无需调整。

## 边界

- whole-entry anti-regression gate、measurement algorithm、diagnostic consumer profiles 与 external dependency boundary 不变；
- 不修改 Core 或 Web Component ceiling；
- 不吸收 pending #652 的 Shadow/Core/Runtime 增量；#652 当前 head 仍须自己的 exact-source 完整 gate；
- 不证明四 Adapter Table conformance；`T-TABLE-STRUCTURE-0001` 的 Adapter paths 保持 `planned`；
- 后续能力增长、toolchain/compression drift 或 #652 合入均需要新的 exact measurement 与独立 review transaction。
