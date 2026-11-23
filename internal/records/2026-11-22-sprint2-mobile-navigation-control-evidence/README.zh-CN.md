# Sprint 2 移动导航 control：分轮保全

本目录保存修复夹具的真实 control 结果。每轮原件分别保留；后来成功不能改写之前失败，也不把插桩或重复 control 当最终 clean 42-site/304 验收。

## Control R1：新增 wheel 前提失败

[Run 45040087414](https://github.com/Proto-UI/Proto-UI/actions/runs/45040087414) 的 carrier 为 `648856da599106e5b8b1d7d6396683dfe4e1c227`。产品 source 仍为 `4541dfbca5001d4ff9b1cc6afd34d4fe1cf32d5d`；修复 fixture SHA-256 为 `78009efe8cd85289acca6b1a86215943cd441a769f557e3c0fbe82dedefc593c`，重复控制后的执行源码 SHA-256 为 `a421408593ed1639fb66eeb52a5a546a49d75def0231c509afabade3c30fcf43`。

| 分母                                 | 实际结果                                      |
| ------------------------------------ | --------------------------------------------- |
| 原 42 个逻辑场景 + 19 个额外目标重复 | **61 selected：38 PASS / 23 FAIL / 0 未终态** |
| 中文 Brutalist enhanced 移动目标     | **20 次：0 PASS / 20 FAIL**                   |
| 另外三个 enhanced-mobile 场景        | **3 FAIL**                                    |

23 条失败均停在执行源码第 252 行的新增断言：

```ts
expect(wheel.trusted && wheel.includesLeaf && wheel.includesScroller).toBe(true);
```

它们尚未进入原 `fullNativeHitTarget` 四点断言。因此，不能把这轮写成“原四点断言全部复现”，也不能据此关闭旧 `7/20` 失败。**原 artifact 没有保存这些失败 wheel 的 JSON、各布尔值或失败截图；具体哪个 conjunct 为 false 及其原因均未知。** 后续被动观察若取得更多信息，必须以新轮次和新 source 身份记录，不能回填成本轮已测事实。

[原 report](r1/report.json)、[原日志 gzip](r1/run.log.gz)、[source manifest](r1/source-manifest.json) 保留完整结果。原 fixture、repaired fixture、执行 fixture，以及 fixture-repair/instrumentation 两份 patch 分开归档，避免混淆产品 source 与诊断源码。

## Artifact 与来源校验

R1 artifact `14761726730` 为 14,763,894 bytes / 203 files；原 ZIP 与 GitHub API digest 均为 SHA-256 `a019b1cfc2f0dcb720423115e8c1e0642e58aa3318b0b64a9d1a8772a237a442`。本次逐字节核对全部 203 个解压文件；本目录只保留有界必要材料，不复制完整 ZIP 或成功截图。

[capture-inventory.json](r1/capture-inventory.json) 列出原 96 对成功 capture 的全部 192 个路径和哈希，明确失败 wheel JSON/截图为零；不得用成功的 desktop/no-JS/其他页面图代替失败状态。没有宣称打开或审读这 96 对图片。

[独立终态审计](r1/independent-review/site-hit-control-r1-audit.json)、[carrier 源审查](r1/independent-review/site-hit-repair-control-carrier-review.json)、[修复 fixture 源审查](r1/independent-review/mobile-navigation-fixture-repair-review.json) 均保留原字节。源审查允许执行有界 control，不等于 control 通过；实际失败仍保持失败。

## 原失败与后续轮次

已提交的 [原 R2 / 首次诊断失败目录](../2026-11-22-sprint2-mobile-navigation-fixture-evidence/README.zh-CN.md) 保持不变：R2 为 303/304，首次诊断的目标为 13 PASS / 7 FAIL。本目录仅交叉引用，不重写其原件或 manifest。

下一轮计划分别取得原 helper 的被动 wheel 观察和新 viewport fixture 的 control；归档时尚未接收真实 artifact，**没有预填后续通过**。新材料应追加到独立 `r2/` 目录，并保留本 `r1/` 原件及 manifest 字节。最终 clean head 的 42-site/304、实际视觉回读和 Ready 仍为独立待接受条件。

## 文件清单

[总 manifest](manifest.json) 覆盖自身之外的全部文件，[R1 manifest](r1/manifest.json) 固定该轮材料。每份原件记录原始/存储大小与 SHA-256；源码和日志用 `gzip (mtime=0)` 无损保存，解压后必须匹配原始 hash。没有可被当前 workspace 枚举的历史 `.ts`，也没有改类型检查排除规则。

创建本目录未执行产品测试、构建或 browser，未修改 fixture、提交或写入 GitHub。

## 追加：Control R2 的实际双阶段结果

[Run 45041365026](https://github.com/Proto-UI/Proto-UI/actions/runs/45041365026) 已取得真实终态。上文“尚未接收”的叙述是创建 R1 归档时的历史状态；这里追加新事实，`r1/` 每个文件及 manifest 均逐字节保持不变。

Carrier 为 `75431ad5bef39ee8dbc8d74a3287f66b5d25475c`，产品 source 仍为 `4541dfbca5001d4ff9b1cc6afd34d4fe1cf32d5d`。两个阶段分别记账：

| 阶段 | 实际结果 | 说明 |
| --- | --- | --- |
| 原 helper + 被动观察 | **1 PASS / 0 FAIL**，另41未选中，exit0 | 保留原 leaf.hover、原三项 wheel predicate 与原命中断言；这一新上下文未复现 R1 的 predicate 失败。不能反推旧23条哪个布尔值失败。 |
| 新 viewport helper control | **48 PASS / 13 FAIL / 0 未终态**，61 selected | 原42场景与19额外目标重复均保留；目标20次为8 PASS /12 FAIL，另一个英文Shadcn enhanced-mobile失败。 |

13条新失败均发生在执行源码第284行的 **exact-scroll poll**，使用原1000ms截止；它们尚未执行后面的原四点命中断言。这些失败确实记录了 trusted wheel、同一 scroll owner 的 composed path、delta -32 与后续位置。这里的 `startTop` 来自 wheel listener 内部，而没有独立的“送入输入前”位置：12条目标失败记录2216→期待2184→最终2216，另1条记录690→期待658→最终690；对应10条通过的enhanced控制记录的事件时位置高32px后到达同样的最终位置。**compositor先于listener更新是解释假说，不是这份数据已证明的因果关系。** 下一有界修复应直接冻结实际pre-input位置；归档没有替root修改夹具或降低断言。

原始 [原observer report](r2/original/report.json)、[新control report](r2/repaired/report.json)、两阶段原日志/全部source与patch、[来源汇总](r2/source-manifest.json)、[独立终态审计](r2/independent-review/site-hit-control-r2-audit.json) 分开保存。另保存两条原observer capture JSON、全部13条新失败JSON，以及10条已通过enhanced的原始比较JSON。失败PNG共有两个真实字节类：12张Brutalist相同、1张Shadcn；只复制独立评审实际打开过的两个代表原图。归档者没有另外宣称逐图审读。

R2 artifact `14762565567` 为15,662,240 bytes /261个文件，原ZIP与API digest均为 `6b166144ebb89ccba48d88d160a23d4d98c096a61556317f07ca6f383b2a2777`。已逐字节核对全部261项；[capture inventory](r2/capture-inventory.json) 保留全部242个capture路径/大小/hash。原observer执行源码 `3ea5d5a966d3eb7ef711cb6efb0ca316d856824867025c64aaeb2a8d800c7eb8`；新fixture `cd825e63655e16759638241373ea3c55810b82b86fa3203dd5df61a020d39f1d`；重复后的实际执行源码 `25d95a60f72140acfa47d7db5b59a9fe604ae044fe7c8a040b91304a5f9da522`。完整source与carrier的独立review hash一起保全。

R1旧失败原因、原R2失败四点时的PNG与具体scroll writer都没有被这轮补成已知。后续Control R3、最终clean head的site42/full304和84张逐图视觉审读仍待各自实际回执；本记录没有预填通过。

## 追加：Control R3 已取得完整终态

2026-11-23 接续工作回读 [run 45043843835](https://github.com/Proto-UI/Proto-UI/actions/runs/45043843835)，并下载 artifact `14763246293`。原 ZIP SHA-256 为 `472c632d6e232dcbd820a809f249d5462737a94b524820eb5291691265ff9e85`，与 GitHub API digest 一致。产品源码仍为 `4541dfb`，fixture 为 `e711131db264547dd7193f3ff8d6fa3fab82f6ca153b33a7d82fbe7d81250780`。

结果为 **61 PASS / 0 FAIL / 0 skipped**：保留原42个场景，另加原失败中文Brutalist enhanced移动场景19次，共20个独立context全部通过。修正的是测试对实际enhancement就绪和native wheel输入前位置的观察；原四点坐标、native owner相等、44px及家族圆角断言全部保留。全部23个enhanced-mobile回执均记录真实trusted wheel、实际scroll owner路径、独立pre-input位置、期望/实际位移及双frame保留。

[r3/derived-summary.json](r3/derived-summary.json) 对账原JSON；原report、源码、patch、日志和全部capture哈希保留，22日前R1/R2失败原件没有重写。本次查看中文Brutalist和Shadcn mobile两张实际原图：可见完整Button/Tabs行、真实家族外观与中文，没有以它们代替全部截图视觉验收。group与leaf依次滚入视口，末帧截图仅显示leaf时刻，四点命中依据各自观察JSON。

本轮控制通过说明修正前置后的同源命中结果稳定；不把旧7/20失败原因归咎于已经证明的某个scroll writer。此后仍需clean候选42-site验收与整体304结果对账，最终PR独立review和原Issue回填独立执行。
