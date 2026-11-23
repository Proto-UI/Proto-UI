# Sprint 2：1450ffd5 的真实验收与并行接续记录

**本目录接受的运行来源是 `1450ffd549bce8da636f2ccd45044aff5121e6ad`。PR #1716 已随后正常推进到 `9d0f47d4ef67bbc3676e4db24c7906f8721e5b42`；本目录不把旧运行改记为新提交通过。** 两个提交的原作者、父关系与修复均保留。后续提交的验收在独立记录中追加。

## 已完成的修复

TextControl 的 reset/selection continuation 使用实际 lease 与 epoch，退休旧监听、排队观察和重入回调；Sidebar 的 Brutalist fallback 恢复其四角 5px 家族几何；网站用例保留原物理输入、命中、尺寸和时限要求，等待真实动画完成，并为五个 Tabs 状态分别保存截图。

在此基础上，1450 修复了独立评审发现的 Checkbox / FieldCheckbox reset 缺陷：在同步回调或 pressed 清理中出现新的 checked owner（包括 A→B→A）后，不再继续旧的 checked 提案；普通 reset 和只确认 mixed 的合法行为保留。两个 DOM listener spy 的 options 改为宿主 API 的可选参数，关闭真实 TS2345。

## 原始执行结果

| 执行 | 真实结果 | 来源与边界 |
| --- | --- | --- |
| 原完整 Sprint 2 队列 | **304/304 PASS** | 292 个 Chromium 原生浏览器用例、12 个 Node/HappyDOM 普通消费者；与上一轮原 304 个 distinct IDs 逐项一致 |
| 三个独立前置阶段 | **全部 PASS** | public-packages、styles、workspace-types，均 exit 0、无 timeout |
| 专项源回归 | **275/275 PASS** | 6 文件：158 lifecycle、8 Checkbox、36 Field choices、28 reset、20 selection、25 support plan |
| 独立 reset probe | **8/8 PASS** | 原 8 场景在干净 1450 上独立重放；修复前 4 正控通过、4 缺陷场景失败 |
| 新 12 项回归的原实现负控 | **4 PASS / 8 FAIL** | 失败保留；不同于独立 8 场景，也不同于先前未保留 raw 的 TextControl 负控 |
| 站点视觉 | **100/100 图实际审读** | 42 个站点 case：B8 / C24 / D8 / Hook2；已测矩阵内无新增视觉阻断 |
| 额外本地全局类型命令 | **TIMEOUT，未接受** | `check:types` 达到编排 1200 秒上限，exitCode=null；后续 Tabs13 未运行，不能记为类型失败诊断或通过 |

275、304、独立 8 场景和历史组合存在范围重叠，不能相加成一个覆盖总数。未选中的 18 项 Collapsible、5 项 Accordion 实验家族仍是未选中。物理 OS IME、辅助技术、非 Web 平台、完整 Harness/session 以及原历史接受不在这些运行的证明范围内。

## 可核验的原件

- [正式运行 45183604935](https://github.com/Proto-UI/Proto-UI/actions/runs/45183604935)，job `137723420016`，最终 success。
- [原 artifact 14823732540](https://github.com/Proto-UI/Proto-UI/actions/runs/45183604935/artifacts/14823732540)：64,782,377 bytes，ZIP SHA256 `273454fef6331bebdc8b110699db3b8ffba885d4f1b29f3daac6576289220667`。
- [原 receipt](hosted/receipt.json)：SHA256 `447048497f3d8b0793a939dfca0b350522b6de3ca760717ef2c326e482ccdd9f`；[独立对账](hosted/reconciliation.json)与[完整选中 IDs](hosted/selected-case-ids.json)。
- [完整 100 图逐项视觉报告](visual-review/README.md)与[index](visual-review/index.json)。本目录保留全部 100 PNG 及其相邻原始 JSON，供 Actions artifact 到期后继续复核。
- [专项回归 manifest](focused/manifest.json)、[275 原 JSON 的公开副本](focused/vitest.json)和[日志公开副本](focused/vitest.log)。
- [独立源码评审](independent/code-review.md)、[最终独立 probe](independent/1450-r5.json)，以及 `prior/` 内保留的失败记录。
- [公开副本说明](PUBLICATION-NOTES.md)与[original → public 哈希映射](sanitization-manifest.json)。涉及设备私人路径的文本仅作明确列出的参数化替换；公开副本不冒充原始字节。标准 GitHub hosted-runner 路径保留在未修改的托管原件中。

## 视觉结论的精确范围

Shadcn 导航四角为 8px，Brutalist 为 5px，桌面记录高度 32px、移动记录高度 44px。历史 d039 的 enhanced 已为 5px；有区分力的旧缺陷是 blocked-script fallback 的 0px，本候选为 5px。真实原图对照与哈希保留。

四张 no-JS mobile 图的首选配色为 light、实际 SSR 主题为 dark，按 dark 实拍接受。failed-scripts 表示从加载起阻断网络脚本。五张 Tabs 图为初始态及四次键盘切换；后续指针操作的较窄断言单独记录。移动最终图处于 leaf 滚动终态，较早 group 命中以同 case 的原 JSON/日志为证。

两语 Hook 页面清晰展示原 R3 exit 1、后续断言未执行与原 13 项未完整接受。页面渲染通过不关闭 #1154 的两个原复合条件。原 #1488 C23/24 历史失败和 B/C/D 更广条件不被重写。

## 并行接续与平台状态

9d 正常合入 1450，并保留其 Checkbox 修复。后续完整验收入口为 [run 45188583301](https://github.com/Proto-UI/Proto-UI/actions/runs/45188583301)，其结果必须按 9d 的实际终态另行记录。1450 本地真实应用/CLI 核验也只属于原来源。

平台于 2026-11-23 13:28:14Z 由 cyjin-yl 将 PR 标为 Ready。内部独立评审不产生 GitHub APPROVE；仓库要求的独立 approving review 继续以平台真实记录为准。自动 Codex review 的用量限制、Vercel 构建频率限制和未执行的重型检查保留，不改成通过。

此为独立证据分支上的归档。归档提交不是新的产品候选，也不应合入产品分支；其 formatter ignore 只保护本次原件字节。文件载体的 Git 父提交与各项实际执行 source 分别记录。
