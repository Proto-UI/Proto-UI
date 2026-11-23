# Sprint 2 — 9d0f47d4 并行合并后的独立增量审查

## 结论与精确对象

**对 `9d0f47d4ef67bbc3676e4db24c7906f8721e5b42` 相对已审 `1450ffd549bce8da636f2ccd45044aff5121e6ad` 的全部实质源码差异，未发现新增、仍未修复的阻断性产品代码问题。** 134 份冻结档案逐项核对结果为：新 head 与 main 的 Git blob、字节数全部一致。

本次另发现一项验收编排缺口 **S2-DELTA-ACCEPTANCE-001**：原完整 types 命令不能整体由 hosted 的 workspace types 子集代替；外部门禁未验证时也不能无条件写入 `acceptanceClaim:true`。这属于临时验收 runner 的证据边界，不是产品源码回归。修订及真实执行情况见下文。

- reviewed HEAD：`9d0f47d4ef67bbc3676e4db24c7906f8721e5b42`。
- reviewed tree：`0c9d31e5bb05d3af79932ec3c62a61480197f9eb`。
- 相对的已审候选：`1450ffd549bce8da636f2ccd45044aff5121e6ad`。
- main：`b715b8a6d08c2c79417272c8d4ca9254984feadb`。
- 实际 merge parents：`f78c407efa14659294e795105f0b7af6caa48246`、`1450ffd549bce8da636f2ccd45044aff5121e6ad`。
- Reviewer 未参与产品实现、原三文件修复或这次并行合并；没有发布 GitHub review、Ready 操作或 APPROVE。
- 审查输入来自实际 GitHub immutable SHA、实际 control 原件及其哈希；没有使用并行作者正在变化的工作区作为未注明的最终源。

[实际提交](https://github.com/Proto-UI/Proto-UI/commit/9d0f47d4ef67bbc3676e4db24c7906f8721e5b42) 与 [1450→9d 的 raw compare](https://api.github.com/repos/Proto-UI/Proto-UI/compare/1450ffd549bce8da636f2ccd45044aff5121e6ad...9d0f47d4ef67bbc3676e4db24c7906f8721e5b42) 返回 ahead 4、behind 0、66 个完整文件条目，merge base 为1450。66 小于该接口的300文件上限；没有把截断列表当作完整覆盖。

这是内部独立源码增量审查，可与此前1450源码审查共同作为 Ready 验证材料；不是 canonical clean packet，也不产生平台独立身份或 APPROVE。全部1450测试成绩继续按历史提交记账，9d的最终验收需要自己的真实收据。

## 覆盖的17个非records文件

| 范围 | 文件数 | 实际变化及判断 |
| --- | ---: | --- |
| Compiler | 8 | diagnostic registry、Flutter、GPUI、IR validation、parser、Qt、React、targets 的换行、缩进、等价括号和格式。逐patch检查了控制流、空值合并/三元表达式、静态循环分析、模板字符串、Rule Meta admission；未观察到语义分支变化或组件名/路径业务分派。 |
| 验收/历史工具 | 2 | `produce-button.mjs` 和 `history-audit.mjs` 的格式。前者的拒绝、closure负控、真实build、preflight范围和失败保留逻辑不变；后者 digest 的键值/数组顺序与更新顺序不变。 |
| Spec | 1 | `C-COMPILER-GPUI-A11Y-VALUE-0001.yaml` 只增加两个空行；定义、criteria、lifecycle 均未改变。 |
| CLI 生成样式 | 3 | 重新生成 shadcn、Brutalist 与两 draft families 的实际 token closure，详见下一节。 |
| Base package manifest | 1 | 只有 `files` 数组中 `dist/` 与 `README.md` 的顺序调整，文件集合和 exports 表均未改变。 |
| 网站测试 | 1 | Brutalist radius 从“非空”加强为精确 `5px`，原四角与family bank一致性断言保留。 |
| 格式保护 | 1 | `.prettierignore` 增加10个精确冻结文件路径，防止 formatter 改写已归档字节，没有扩大为整个产品或所有记录目录的豁免。 |

其余49个变更文件是记录，其中44个为gzip原始材料。已实读其主要source binding、formatter recovery、checked-owner merge记录及与本次问题直接相关的原件；没有以档案总数代替代码审查，也没有声称逐字阅读所有历史gzip。

网站 CSS 在1450→9d的净差异中未变化。`sprint2-site.browser.test.ts` 唯一净变化在第177行；没有删除测试、调高时限、取消真实动画、减少capture或弱化交互断言。当前 [Brutalist theme](https://github.com/Proto-UI/Proto-UI/blob/9d0f47d4ef67bbc3676e4db24c7906f8721e5b42/packages/prototypes/brutalist/src/theme.ts) 的 light/dark radius 均为 `5px`，所以新增常量断言有实际定义来源。42 cases / 100截图的逻辑仍保留，截图数量仍不能替代逐图视觉审查。

作者的11文件 canonical formatter 等价记录已回读，并核验原件 SHA-256 `122eda814832a7269abde65ca5a88990f70fd1c2622fc011e53cb5dcb1ac7bbe`。本 reviewer 的判断以实际patch阅读为主；该记录注明为作者执行，不冒称本人重新运行了格式化或完整测试。

## 两个已修缺陷与 TextControl 整合保持完整

完整compare中以下四文件没有任何变化；它们仍与1450独立审查绑定的字节一致，新提交的 source-binding 也列出相同hash：

| 文件 | SHA-256 |
| --- | --- |
| packages/prototypes/base/src/checkbox/root.proto.ts | `4167b55452680d76451ef731142c01e8a12561cce01c7481d135421a741f6dd4` |
| packages/prototypes/base/test/notification-retirement-lifecycle.test.ts | `412c9661cdfea6ad9d1bf9133c155999a36c3bd8e018bac10d52a37988c45626` |
| packages/compiler/src/native-support/dom-modules.template.ts | `9dfd8afa22b03499b50f7df86edd4668e05b5ab8d9c90b00716ce863efcbf64a` |
| packages/compiler/test/text-reset-native.test.ts | `e894522b8fd97366a739f29ed66f37d48e0e3b4bb3253599f05aa25b6829fa4d` |

- S2-FINAL-001 的 checked owner epoch 在 pressed cleanup 前捕获、live组合判定和publish返回后二次校验保留；ordinary reset、mixed-only确认正控及owner/ABA退休回归没有丢失。
- S2-FINAL-002 的两处 DOM listener options 保持真正 optional 的原类型；未恢复 TS2345，也未用cast/any弱化约束。
- TextControl reset/selection 同lease整合、原reset20条和新增8条的断言没有被并行合并删减；selection20与support-plan25的旧执行仍按真实1450记录使用。

这证明源修复被保留；它不是 reviewer 在9d重新执行8-case、275-case或完整workspace types的声明。1450的实际完整hosted types已关闭当时的002验证缺口；9d的同head验证仍从新流水线读取。

## 生成样式清单的核对

实读三个 maintained generators、`family-style-closure.ts` 与新的三个生成文件。Closure沿实际静态 value import/export依赖进入Base，跳过type-only依赖，拒绝无界Base root value import；生成器的 `--check` 比较完整生成字节，stale/missing output会抛错；draft还保留不支持物理token的诊断。

Reviewer从GitHub精确9d取得文件，独立计算SHA-256，并在不执行源代码的情况下解析literal数组、检查排序与去重：

| 生成文件 | 实际token数 | 当前SHA-256 |
| --- | ---: | --- |
| brutalist-style-tokens.ts | 555 | `bd8bf4841ff0acb8306bbf1e29bc3eca3962502ba2e64584e13da2c168181237` |
| shadcn-style-tokens.ts | 954 | `232c977a85e10786f289457d874f8a67ee195b99ef2a3b2a81813761af8abe1d` |
| draft-family-style-tokens.ts | bootstrap 655；liquid-glass 449 | `7cf8a7a58458fe309a03d0deaa56b0d5f8439ebd2b50cb13d8f6c4725a81bb75` |

它们与作者source binding的三个hash全部一致。实际 `presets-current.log` 原件SHA-256为 `513e338a0d3e8dce8bde9067bf987eacff766ae0b623fd7030951c2c22707bf7`；其strict生成检查给出相同555/954计数、draft closure current和13个motion-palette测试通过。该日志属于作者此前的真实执行，不记作本reviewer对9d的新的运行。

新增Brutalist值域/区间物理token和方向padding来自该闭包；旧未再到达的direction token移除。未发现为掩盖失败而删除来源、跳过异常或放宽生成一致性的新增代码。这不替代最终hosted、真实consumer及视觉对输出的验收。

## 134份冻结档案保护

实际读取的 `frozen-main-byte-manifest.json` 为39,276 bytes，SHA-256 `72ae1372fab85850732606dd0079159cdf89c23b692d4deb446172b0867654a8`，与9d已提交的[archival source binding](https://github.com/Proto-UI/Proto-UI/blob/9d0f47d4ef67bbc3676e4db24c7906f8721e5b42/internal/records/evidence/2026-11-23-sprint2-readiness/source-binding.json)相符。

随后独立向GitHub查询每个受保护路径在main与9d上的实际对象，核对path、Git blob及bytes。**134/134完全一致，无缺失、替换或内容改写。** `independent-delta-review-9d0f47d4-binding.json` 保存逐文件结果。

查询中主动处理了一个覆盖陷阱：Contents API对 `internal/records` 只返回1000项，缺失3个目标。没有把“未看到变化”当通过；改读两个完整nonrecursive Git tree，`truncated:false`，main1051项、9d1064项，补齐了batch记录、snapshot.gz、decisions.gz三个大文件。其余131项由精确ref的目录条目核对。

这里独立验证的是Git对象与字节数相同；表内逐文件SHA-256来自已核hash的原inventory，没有声称本人解压并重新计算所有大档案。原始134字节保护与旧manual decisions的接受与否是两件事：作者仍保留history ready的预期失败及 `historicalDecisionsAccepted:0`，本审查不把保护通过变成历史接受。

新增的10条ignore恰对应曾被formatter改写、随后恢复main原字节的精确文件。旧误格式化的提交和before hashes仍存在于历史与recovery记录；没有rewrite掉这段事实。

## S2-DELTA-ACCEPTANCE-001 — P2 / high confidence

**类型：** 临时验收编排缺口，不在上述17个产品差异中。

**位置：** 9d consumer `run-final-consumers.py` 的首版第303–317行外部门禁映射，以及第336–337行无条件 `acceptanceClaim=True`。

**Authority与原有预期：** 用户要求保留原验收条件；当前 [package.json第109–111行](https://github.com/Proto-UI/Proto-UI/blob/9d0f47d4ef67bbc3676e4db24c7906f8721e5b42/package.json#L109)定义：

```text
check:types =
  apps-www generate:proto-ui-style
  + check:types:workspace
  + check:types:docs
```

而正式 [run-sprint2-consumers.mjs第337–339行](https://github.com/Proto-UI/Proto-UI/blob/9d0f47d4ef67bbc3676e4db24c7906f8721e5b42/scripts/analysis/run-sprint2-consumers.mjs#L337) 只运行 `check:types:workspace`。原1450 consumer runner实际调用完整 `check:types`，20分钟后timeout并保留FAIL；把它整体替成“hosted workspace负责”会遗漏docs。47个public builds与304功能案例也不是docs typecheck。

**影响与复现：** 对比两个临时runner并展开这两个canonical命令即可确认遗漏；不需要故意制造产品错误。首版即使external gate为NOT_RUN_HERE，仍可写overall acceptance true，机器读者可能误把未执行的外部条件算完成。

**处理要求：** 保留旧timeout与原runner；新head实际运行style生成和 `check:types:docs`，workspace由精确同head hosted收据负责；local PASS与完整acceptance分开，外部门禁未合并前保持acceptance false。Root与runner owner已接受这一修正，不要求用户重复授权或重跑完整20分钟串。


### 修订复审 — 编排源码问题已关闭，执行条件仍待终态

已实读修订模板，并由原生文件hash核对：`run-final-consumers.py` 为23,321 bytes，SHA-256 **`95a201bcf878822d0315a2cac18095076cb60d826fb39e483871584af67a3488`**。

与首版逐项diff确认：

- 原consumer断言、47完整public builds和原Tabs13命令/数量断言保留。
- 新增实际的 `apps-www generate:proto-ui-style` 与 `check:types:docs`，分别记录stdout/stderr/退出码；超时、执行错误、真实失败继续保留并终止成功路径。
- aggregate command标为NOT_RUN_HERE；workspace子门禁标为REQUIRES_INDEPENDENT_READBACK；docs按本地实际结果记账。
- local全部通过可写PASS、localVerificationClaim和consumerScopeAccepted，但 `acceptanceClaim` 明确为false，等待外部门禁的真实合并结论。

因此，**S2-DELTA-ACCEPTANCE-001的编排源码缺陷已修复。** 此处独立绑定的是已读模板；第一次读取时bootstrap的执行副本尚未存在，没有冒称已经读到或执行了该副本。实际pipeline应在自己的summary里绑定同一orchestrator hash。源码修复不等于docs/workspace执行已经通过。

这段修订没有修改产品提交，也没有提高测试时限、删除原断言或把unsupported/未执行项改为通过。

## 当前执行证据边界

- 1450 reviewer独立8-case、owner-run275-case和完整hosted304-case/types为真实历史结果，已分别封存；它们不是9d的同head结果。
- 1450更广consumer流程的原前项成功，与后来附加完整 `check:types` 的1200.055秒timeout FAIL分开保留；该流程中的后续Tabs13未执行。此终态来自consumer审计owner的报告，本delta审查不冒称重新运行了该流程。
- 9d source-controls 244与negative-control8失败/4正控是并行作者的记录，范围不同于275，不能相加或替代整个验收。
- 9d最终hosted、真实consumer、docs/workspace types、100张实际图像及原任务其他条件按同head实际收据判定，本报告不预判。
- GitHub Ready状态和不存在的平台APPROVE不由本报告改变；Vercel等平台事实须看对应head的真实状态。

## 可复查材料

- `independent-delta-review-9d0f47d4-binding.json`：66文件scope、17个实质source路径、三个实际生成hash、134项逐文件对象核对及验收编排finding处理。
- 原1450 source review及其公开副本继续保留；公开副本首段已标明它是历史候选，不是当前9d的完整接受证明。
- [9d formatter recovery](https://github.com/Proto-UI/Proto-UI/blob/9d0f47d4ef67bbc3676e4db24c7906f8721e5b42/internal/records/evidence/2026-11-23-sprint2-readiness/formatter-recovery.json) 与 [source binding](https://github.com/Proto-UI/Proto-UI/blob/9d0f47d4ef67bbc3676e4db24c7906f8721e5b42/internal/records/evidence/2026-11-23-sprint2-readiness/source-binding.json)保留并行作者的原始过程与失败边界。

本reviewer没有改产品、改冻结档案、修改验收runner、stage/commit或发布外部review。后续只补同一源码的真实验收收据可以追加到报告；新head或实质源码/断言变化需要按实际delta再审。

## 执行副本绑定补记

在bootstrap完成复制后，已独立回读实际执行副本的原生hash：`consumer-9d0f47d4ef67/run-final-consumers.py` 为23,321 bytes，SHA-256 `95a201bcf878822d0315a2cac18095076cb60d826fb39e483871584af67a3488`，与上文已审模板完全一致。先前“首次读取尚未存在”的观察保留；现在代码复制绑定已核实。这个核对不声明pipeline已结束，也不把尚待执行的docs/workspace gate写为通过。
