# Sprint 2 最终接续验收：9d0f47d4

**原 Sprint 2 范围的代码、消费者、网站视觉与类型验收已收齐，均按实际执行来源对账。** 当前产品来源为 `9d0f47d4ef67bbc3676e4db24c7906f8721e5b42`，tree `0c9d31e5bb05d3af79932ec3c62a61480197f9eb`。PR [#1716](https://github.com/Proto-UI/Proto-UI/pull/1716) 已处于 Ready for review；平台要求的独立评审批准仍须以 GitHub 的真实记录为准。本目录不生成 APPROVE，不表示已经合并。

本目录是独立证据分支上的归档。文件载体的 Git commit 与实际执行的产品 source 分开记账，归档分支不应合入产品 PR。此前 `1450ffd5` 的执行、修复和失败原样保留在[独立历史目录](../2026-11-23-sprint2-final-1450ffd5/README.zh-CN.md)，没有改标为 9d 的测试。

## 已完成的修复与独立复核

- TextControl 的 reset/selection continuation 绑定真实监听 lease 与 owner epoch，退休旧监听、排队观察和重入回调。
- Checkbox / FieldCheckbox reset 在同步 checked owner 变化、A→B→A 或 pressed 清理中退休旧提案。保留合法普通 reset 与仅确认 mixed 的路径，新增12项有区分力的回归。旧实现负控4 PASS/8 FAIL，候选专项275/275及独立8/8均分别绑定1450，未加到当前304分母。
- 两个 DOM listener spy 的 options 改为实际可选参数，修复真实 TS2345。当前9d托管 workspace-types 及本地 docs-types 分别实际通过。
- Brutalist fallback 导航恢复四角5px；网站保留原生 summary/details/a 所有权、真实命中要求和原时限。Tabs五次捕获有独立文件名，观察等待真实动画结束。
- 1450→9d 的独立完整增量复核未发现新的阻塞产品问题；现有 runtime 修复和12项回归保留。17个非记录文件的变化、生成 token 同步、精确5px断言与134份冻结档案均有源绑定检查，冻结档案与 main 的原字节一致。

[独立源码评审](independent/code-review.md)与[source binding](independent/source-binding.json)保留其当时的状态；后续实际工作区、文档与视觉结果由本目录其他原件补足。内部独立评审不等于正式 GitHub 审批。

## 当前来源上的实际结果

| 范围 | 实际终态 | 主要证据 |
| --- | --- | --- |
| 原完整 Sprint 2 队列 | **13/13阶段；304/304 PASS** | [receipt](hosted/receipt.json)、[逐项对账](hosted/reconciliation.json)、[原IDs](hosted/selected-case-ids.json) |
| public-packages / styles / workspace-types | **三个前置均exit0，无timeout** | 同一托管receipt、[types日志](hosted/workspace-types.log) |
| 双语网站 | **B8 / C24 / D8 / Hook2，全42/42** | [原网站JSON](hosted/site/report.json)、[原日志](hosted/site/run.log) |
| 网站独立视觉 | **100图矩阵接受，无确认阻断** | [完整视觉报告](visual-review/README.md)、[逐图index](visual-review/index.json) |
| source-pinned compiler / CLI | **实际双构建确定性、安装及原完整CLI旅程通过** | [本地执行索引](consumers/README.md)、[步骤](consumers/steps.json) |
| 普通消费者 / family / costs | **四Web目标、三Button家族×四目标及原生产成本阶段通过** | 同一消费者原JSON与日志 |
| 冻结源库存 | **23入口：9 PASS / 14 UNSUPPORTED / 0 FAIL** | [消费者summary](consumers/summary.json)，不替换原F6/全仓分母 |
| Shenko真实应用 | **source-seam与installed-artifact两路各51/51** | 39份authored source与冻结提交一致；原identity 3/4负控及仅测试身份迁移保留 |
| Verdant真实应用 | **原producer与check通过，20产物** | 原旧pin拒绝exit2保留；仅临时上游pin变更，authored source/producer未改 |
| 完整公共包构建 | **47包实际build退出0** | 420.551s，与较早42包closure分开 |
| Tabs公开Code/同实例/unsupported | **原两文件2 suites / 13 tests / 13 PASS / 0 skip** | [同源恢复与历史失败](consumers/historical/9d0f47d4-initial-worker-failure.json) |
| 文档styles | **exit0，无timeout** | 独立实际命令135.453s |
| 原docs-types命令 | **exit0，无timeout** | 477.341s；前后HEAD/tree/lock及clean检查均相符 |

304明确分为 **292真实Chromium浏览器 + 12 Node/HappyDOM**。普通消费者、Tabs13、275源码回归与其他旧组合不能加成新的304总数。未选中18项Collapsible、5项Accordion实验家族仍未选中。四条preferences用例不代表完整material/blur/alpha/fallback接受。

冻结下游分别为 Shenko `f3fa6f4d8bf22cfd2baf490d9c3a08bd39af4d42`、Verdant `91a775546ebd21a87d76d76568195a6513437719`；本轮没有声称它们是最新下游开发分支。Cargo、桌面、live backend、完整Harness/session、物理IME/AT及非Web验收仍按原范围保留。两应用没有 authored Tree/Table/VirtualList/Resizable/Carousel 的直接消费，演示配方不会被改记成两领域应用或Inspector。

## 原件与来源

[原工作流45188583301](https://github.com/Proto-UI/Proto-UI/actions/runs/45188583301)，job `137740608739`，完成于2026-11-23 14:20 UTC，实际success。

[原artifact14826253625](https://github.com/Proto-UI/Proto-UI/actions/runs/45188583301/artifacts/14826253625)：64,794,471 bytes、1,019 ZIP entries；完整ZIP SHA256：

`48ffcfc5a814d129d1cefa8faed91b4dc5529b5a1677c7d752faa12210519781`

原receipt SHA256：

`b169a04ad9004030ee79d4194e638acd182376fc6e50941615e0285b5bf184c1`

本目录保留全部100原PNG及相邻100原JSON，逐图哈希在视觉index中；因此完整站点捕获不依赖Actions artifact的保留期。全部304 case IDs与原队列逐项对应，无重复计数、失败或未终态。完整ZIP保留在原Actions及任务控制区，未把64MB ZIP重复纳入Git。

## 视觉结论与原条件映射

44张有像素变化的PNG重新实际审读；56张与已接受1450原PNG逐字节一致，明确复用此前实读，同时独立验证新的source/theme/viewport/case metadata。共实际显示22张联系图及3张原尺寸整页图。Shadcn四角8px、Brutalist四角5px，桌面32px、移动44px，所有保留owner/paint宽差为0。

四张mobile no-JS图保持preferred-light / actual-SSR-dark。failed-scripts是加载时阻断网络脚本；移动最终PNG为leaf滚动终态，group命中在同case较早观察中；五张Tabs图是初始态加四次键盘切换。没有把这些观察扩大为任意中途故障、物理触摸或五次同等强度identity验证。

[原#1488逐条件映射](independent/issue-1488-acceptance-mapping.md)最初条件化的Tabs13与最终视觉前提现已实际满足，可回填B1–B3、C1–C4、D1–D3。D3的普通文章链接保留由Hero限定变更与未改动的text-link规则共同支持，不增设原条件未要求的完整文章链接矩阵。实际Issue修改由独立collaboration写入与readback确认。

#1154仅接受当前双语公开证据页面功能与视觉子项。原R3 exit1、后续未到达断言、原两个复合条件及13项Hook条件继续未完成。旧4541dfb的C23 PASS/1 FAIL和其他历史失败保留。

## 执行器失败与恢复按真实来源保留

9d初始本地流水线在Tabs启动时退出1，0 suite/0 test，原summary仍是FAIL。默认reporter复现了Tinypool/Vitest的 `options.minThreads and options.maxThreads must not conflict`。只在后续执行的原两文件argv添加 `--minWorkers=1`，保留 `--maxWorkers=1`、原断言、13分母与1200秒时限，随后实际13/13及原style/docs命令通过。

后续执行起止与每步前后均核对HEAD、tree、lock SHA256 `96dbd55a65d85ba1fcf2f4268a42842c20844c409f41f1a0e457019c4cdd5672` 与clean状态。原FAIL summary SHA256 `cff996a44c584d3a4f4ba141e7cc8b2a13f6f2457ebaff70f4fde7b5be4d0392` 保持不变。消费者目录明确分别记录initialReplayStatus=FAIL、followupStatus=PASS、combinedLocalStatus=PASS；它自身不声称聚合Sprint接受。

1450较早的 `check:types` 达到1200.055秒上限，exitCode=null，继续保留为TIMEOUT。当前工作区类型由9d原托管命令证明，docs由9d原本地命令证明；没有声称当前重新跑过聚合 `check:types`。

## 平台状态与归档完整性

[平台观察](platform/observation.json)记录当时PR Ready、mergeable=true、mergeable_state=blocked、0正式review及0未解决review thread。DCO、四个轻量PR检查和本次S2队列成功；19个check-runs仍skipped。Vercel为部署速率限制失败，不改写为通过。

[main规则实际回读](platform/branch-rules.json)确认required DCO、独立review及thread resolution等规则；本次不改变任何规则、不代替平台批准、不合并或生产部署。后续平台状态以GitHub为准。

[完整文件清单](publication-manifest.json)记录两个归档目录的最终文件哈希与大小，manifest自身排除。消费者[manifest](consumers/manifest.json)与SHA256SUMS记录149份公开文件及原件到公开副本的路径脱敏映射，原件未改；视觉[delivery manifest](visual-review/delivery-manifest.json)保留包内文件来源。早期 `assembly-progress.json` 与历史目录初次assembly清单保留其当时状态，当前哈希以最终publication manifest和各脱敏ledger为准。

本报告的接受仅覆盖上面的原Sprint 2范围。没有关闭整个父Issue、接受全历史审计、提升draft spec或把内部review冒充GitHub APPROVE。
