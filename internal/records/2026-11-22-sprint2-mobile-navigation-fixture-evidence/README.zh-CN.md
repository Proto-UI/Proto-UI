# Sprint 2 移动导航夹具失败：保全记录

本目录保留原始失败和诊断材料，供后续修复与独立接受继续引用。它不改变原结果，不声明修复通过、PR Ready、合并或发布。

## 已取得的实际结果

| 执行 | 源码身份 | 实际终态 |
|---|---|---|
| [R2 45035380303](https://github.com/Proto-UI/Proto-UI/actions/runs/45035380303) | clean `4541dfbca5001d4ff9b1cc6afd34d4fe1cf32d5d`，tree `daf0dc7e5c6d29f45372b7bc1796379a98dab7eb` | 304 selected：303 PASS / 1 FAIL / 0 未终态；292 browser + 12 Node/HappyDOM。site 41/42。 |
| [诊断 45037951016](https://github.com/Proto-UI/Proto-UI/actions/runs/45037951016) | carrier `8da8222204d4101eb4334b1afc7f2bba096f2289`；执行候选仍为 4541，并保留明确的单文件 instrumentation patch | 61 selected：54 PASS / 7 FAIL / 0 未终态。原目标重复 20 次：13 PASS / 7 FAIL；不能当 clean 验收。 |

R2 唯一失败为 `C: zh-cn/brutalist/enhanced keeps full mobile navigation targets`。原 helper 在断言通过后才保存对应截图，因此 **原 R2 没有这条失败状态的 PNG，也没有同次失败点坐标**。本目录没有用后来诊断图补写成原 R2 图片。

诊断保留原 42 场景并增加同目标 19 次 fresh-context 重复，四个原始点坐标和严格 `closest(a, summary)` owner 等式均保留。七份失败点 JSON 为 `hit-0049/0054/0057/0062/0067/0070/0073`：目标 summary 的 `y=-1122`、height=44，四个采样点均位于视口上方、命中为 null；文档 scroll 为 0，记录中无活动动画。独立审读另核对了失败时缺少 group enhancement 标记。

这些事实支持继续修正测试前提，但 **诊断没有捕获具体 scroll writer 的调用栈或完整外层 scroll-owner 状态，不能声称已证明某一个写入者**。同目标的 13 次成功也不抹去七次失败。

## 原图与来源

七张 `hit-*-after-failure.png` 的原始字节完全一致，SHA-256 为 `46397a7c7b9039a701a8f9025afd4593f24b4c1dad2748bed796da72fb6d7555`。只复制 [hit-0049-after-failure.png](diagnostic/captures/hit-0049-after-failure.png) 一张；[failure-index.json](diagnostic/failure-index.json) 保留全部七个原文件名、大小、哈希及与代表图的对应关系。图片在点观察失败**之后**拍摄，不能当作失败瞬间的完整状态。

点 JSON 自身没有用例名。失败用例与点记录的关联采用已独立回读的单 worker 顺序，索引明确保留这个推断边界；原 JSON 未加字段或重排。

原 ZIP/API digest：

- R2 artifact `14759694693`，61,967,328 bytes，SHA-256 `a2ad68dd205806976c845f44abc08eb4e5d72f812ce200b99d794c5aca26b9e6`。
- 诊断 artifact `14760836024`，15,724,975 bytes，SHA-256 `463e074d2a79c1d4a6d0c4249775d65275ce67a49a9bf01dc4da89f3bf5226a5`。

本目录是有界子集归档，不复制两个完整 ZIP。所复制的 artifact 文件均与原 ZIP 成员逐字节核对；下载完整性和 GitHub run/artifact API 原始回执也保留。原 fixture 与 clean Git blob 逐字节匹配，instrumented fixture、patch、执行工具与 workflow 各自身份见 [source-manifest.json](source-manifest.json)。

## 独立审查与后续状态

[R2 终态审计](independent-review/hosted-native-r2-audit.json)、[R2 视觉抽样](independent-review/hosted-native-r2-site-visual-review.json)、[诊断 carrier 源审查](independent-review/site-hit-diagnostic-carrier-review.json)、[诊断原回执审计](independent-review/site-hit-diagnostic-r1-audit.json) 均按原始字节保留。R2 视觉只实际查看六张，CJK finding 的关闭限于这些样本，不记作完整视觉接受。

[修复候选源审查](independent-review/mobile-navigation-fixture-repair-review.json) 绑定单文件 SHA-256 `78009efe8cd85289acca6b1a86215943cd441a769f557e3c0fbe82dedefc593c`，其接受结论仅允许同源诊断执行。归档时，修复后的重复对照和最终 clean 42-site/304 队列结果仍为 **PENDING**。后续应追加带独立身份的新结果；不得修改本目录原红色报告或把诊断结果改称 final。

## 存储与回读

[manifest.json](manifest.json) 覆盖本目录除自身之外的每一个文件，区分复制原件与派生索引，记录原始/存储字节数及 SHA-256。源码快照与日志采用 `gzip (mtime=0)` 无损保存；解压后的 bytes 必须匹配 `rawSha256`。历史 `.ts` 不作为当前 workspace 编译单元，未改 tsconfig 或扩张任何排除规则。

```bash
gzip -dc diagnostic/source/original-site-test.ts.gz
gzip -dc r2/site/run.log.gz
```

任何后续维护都应保留原件，新增结果另存，并更新清单。该目录的创建没有运行构建、browser 或产品测试，也没有提交或 GitHub 写入。
