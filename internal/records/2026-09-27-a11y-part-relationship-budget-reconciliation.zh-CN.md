# #549 relationship 预算在 #738 后的对账

非规范性、按准确提交绑定的数值记录。2026-09-22 的[原始归因](2026-09-22-a11y-part-relationship-budget.zh-CN.md)保留当时的测量和假设；本文件只对账已合入的 #738、#689 当前提案和 #688 当前候选，不改变 `spec/**`、功能语义或发布准入。

## 当前基线与增量

以下可信仓库作业都使用 Linux x64、Node v22.23.2、zlib 1.3.1-e00f703、esbuild 0.25.12，及 `scripts/analysis/package-budgets.mjs` 原有 whole-entry browser ESM/ES2020、minify/tree-shaking、external boundary 和 gzip level 9。字节数是此门禁的测量值，不是消费者下载量。

| 入口 | main `eead9d3d` | #688 `51cf494a` | 增量 | #738 已接受上限 | #689 提案上限 | 提案余量 |
| --- | --: | --: | --: | --: | --: | --: |
| Runtime | 63,328 | 66,021 | +2,693 | 66,000 | 66,500 | **479** |
| React | 82,947 | 85,634 | +2,687 | 86,500 | 86,500（不变） | 866 |
| Vue | 82,666 | 85,380 | +2,714 | 86,500 | 86,500（不变） | 1,120 |

- [main CI 36292960236 / package job 108546435733](https://github.com/Proto-UI/Proto-UI/actions/runs/36292960236/job/108546435733)通过九项预算，Runtime/React/Vue 的 minified bytes 为 252,531 / 314,109 / 312,818，SHA-256 分别为 `0e8f2ac09df710a4d866da3a2940c44694c8bca99d59d50c6a578c61d39a09af`、`662d1659042550a6c2133611c904faaadd2220b8e50de0798ea26fd831b2ea8e`、`fc6d0881e216acb7a7b11744e7758f3298fe17aa1b4748d66d02460981515`。
- [#689 head `7211a6a0` 的 CI 36294576382 / package job 108550950804](https://github.com/Proto-UI/Proto-UI/actions/runs/36294576382/job/108550950804)也测得相同三个产物和 hash，44/44 包、manifest 与九项预算通过；整个 run 包括 test、type、release、Rust 在内均成功。这只验证提案脚本在未合入功能的 main 上运行，不能替代 #688 的功能 CI。
- [#688 head `51cf494a` 的 CI 36295183826 / package job 108552636088](https://github.com/Proto-UI/Proto-UI/actions/runs/36295183826/job/108552636088)构建 44/44 包并检查 manifest；Runtime **66,021 / 66,000** 失败 21 bytes，React/Vue 通过。三个 minified bytes 为 261,485 / 323,216 / 321,915，SHA-256 分别为 `014882ebba61b3d683f50068bc65e497dad37d7600d36a17202b345a691bf14b`、`980f2646de55ed8765f79dd7f1eff730c434e700dff4776ba282a93ca96f0e75`、`54e693c7e231cca1d542171d0f5b600e22ebbf1e2fafdef3bfd27fd019ad4d56`。同一 head 的 test、type、DCO、Rust 和其余仓库 CI 作业通过；整次 run 因预算仍是红色。

原 #688 功能 head `868d3adb` 与此 `eead9d3d` 主线的本地合成测得 Runtime 65,951；本轮关系通知失败隔离使当前候选到 66,021，约增 70 bytes。原始合成只是 Windows / Node 22.22.1 的本地对照，不可冒充原 head 的可信 CI；当前候选在该 Windows 环境的三个 minified bytes/hash 和 gzip 测量则与上述 Linux 作业逐项一致。GPUI Button 录制夹具经生成器追加 `a11y.snapshot`，不改变这三个打包入口。旧记录的 95.5%～98.1% minified 归因仍属于旧基线对照，不在此重算或假称新归因比例。

## 数值处置与余量判断

#689 在 #738 接受的五项上限之上，只使 Runtime 增加 500 bytes（66,000 → 66,500）；React/Vue 留在 86,500，Core/WC 等其余门槛不变。当前精确功能候选距 Runtime 提案上限 **479 bytes**，比旧记录的“至少 500 bytes”少 **21 bytes**。#654 决策要求说明余量、能力归因与独立接受，未把 500 bytes 定为硬下限。维护者在此提出接受这个 479-byte 的有限余量：新增能力及可重试通知有明确来源，重复闭包检查见原始归因，继续为 21 bytes 扭曲正确性或把预算改动塞回功能 PR 没有收益。该判断不是独立审查的替代；审查者可要求缩减、更多测量或更大余量。

提案不是对 #652 或未来增长的预授权。若工具链、功能组合或压缩结果再改变，必须重新按当前准确 head 与可信 CI 测量，而不能沿用本记录的余量。#689 需由非任一提交贡献者的维护者独立批准；`cyjin-yl` 已在其合并提交署名，因此不能自批。既有 `CHANGES_REQUESTED` 与线程/分支规则仍须按可审计方式处理。#689 真正合入后，#688 才能同步 main、重跑完整准确 head CI，并接受独立源码与来源审查；预算通过本身不使 #688 合并就绪。
