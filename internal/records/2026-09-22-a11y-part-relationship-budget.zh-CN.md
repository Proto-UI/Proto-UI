# Same-domain part relationship 预算事务（#549 / #654）

## 范围与状态

#549 的完整 prerequisite 实现位于 #688。能力方向来自 [#388 Checkpoint A](https://github.com/Proto-UI/Proto-UI/issues/388#issuecomment-5378970491) 与已合入的 #553：structured family/domain/role/key carrier、精确匹配、view epoch 与 lease 生命周期、非破坏性 Web 身份及 IDREF ownership，以及 Tabs 迁移。C/M/HC/P/T 仍为 draft；本事务不授予稳定语义准入，也不交付 Disclosure、Collapsible 或 Accordion。

维护者对 #688 准确 head `868d3adbd22fae98b8e33ea58a9f3353158c506d` 的 [review 5274632674](https://github.com/Proto-UI/Proto-UI/pull/688#pullrequestreview-5274632674) 未提出独立源码正确性阻碍，但正式结论为 **CHANGES_REQUESTED**。该 head 的可信 CI 在三个包预算上失败。修复条件是降低体积，或先合入单独审查、合理归因的预算事务，再同步接受后的 main、通过新准确 head 的完整 CI、转 Ready 并复审；不得在功能 PR 内直接提高上限来消除自己的红色门禁。

本提案采用 [#654 已接受的数值事务流程](https://github.com/Proto-UI/Proto-UI/issues/654#issuecomment-5677625733)，数值部分只调整 Runtime、React、Vue 三个 whole-entry 上限并记录归因。它不是已发生的预算批准，不替代 #688 的独立 review，也不关闭 #549。阈值只有经独立审查并实际合入后，才成为功能分支可以同步的 main 状态。

## Canonical before / after

测量形状保持现有脚本：固定 source entry、esbuild bundle/minify/tree-shaking、browser ESM/ES2020、既有 external boundary、gzip level 9。两侧 canonical job 均为 Node v22.23.2、zlib 1.3.1-e00f703、esbuild 0.25.12、linux/x64。

- Before：接受的 main `9d9552bbe0bc747e9b7f2f1ff6f6db3414086424`，[run 35683310407 / package job 106604782868](https://github.com/Proto-UI/Proto-UI/actions/runs/35683310407/job/106604782868)，九项预算均通过。
- After：功能 head `868d3adbd22fae98b8e33ea58a9f3353158c506d`，[run 35691550964 / package job 106629473832](https://github.com/Proto-UI/Proto-UI/actions/runs/35691550964/job/106629473832)。实际 checkout 是 `daa2c683a76d39758214f39f8bb67d6a136de924`，tree `1cd9e6e5201a77366bef0daf0f3b4e2634e7dc89` 严格等于功能提交。44/44 包构建与 44 个 manifest 检查通过，失败发生在预算命令；整个 run 为 8 个作业成功、1 个失败，不能称为全绿。

| 入口 / 源码 | gzip bytes | minified bytes | minified SHA-256 |
| --- | --: | --: | --- |
| Runtime / main `9d9552bb` | 63,228 | 252,198 | `fa390cd0799e48130fabd7da8a2a2d1095c5c20010c2eecedf33d654af1a92a4` |
| Runtime / feature `868d3adb` | 65,865 | 260,957 | `908061b21b10686eb720b9f8a593c1b1962275eb739e023c7bd658f946c43ae7` |
| React / main `9d9552bb` | 82,758 | 313,491 | `f6d78b86a28703fa8ee5c3dd18a056424396897e2b4b2c5a59fd2fe237aa9e35` |
| React / feature `868d3adb` | 85,351 | 322,409 | `5187f6b74f62a0870bc92cf86f98e7ef57df92380e32d1585142a9818ac5d59c` |
| Vue / main `9d9552bb` | 82,480 | 312,200 | `afa0650dc04bd113b9396e254528b7c422751914d866c210c0870b6f4847df4f` |
| Vue / feature `868d3adb` | 85,093 | 321,108 | `e4683c6dfef82f433278dfae4bf68a1a29ed3218e4647fa25a817fa68af4daac` |

完整 whole-entry gzip 增量分别为 **+2,637 / +2,593 / +2,613 bytes**。同版本 Node/zlib/esbuild 的 darwin/arm64 对照逐项复现了两侧全部九项 gzip、minified bytes 与 minified SHA-256；本提案没有工具链升级，也没有用本地数字覆盖相反的 CI 结果。这里记录的是固定入口防回归预算，不是 npm 包总大小或任意应用路由的下载成本。

## 增长归因与意外开销检查

有界 esbuild metafile 对照使用相同 bundling/external 配置，仅增加 `metafile: true`，对两个准确 head 各检查 Core、Runtime、React、Vue、WC、standalone A11y 六个入口。候选与基线输出均匹配上述同环境测量；没有运行另一套简化打包算法。

四个受影响的 Runtime/Adapter 闭包都只新增 `packages/modules/a11y/src/part-relationships.ts` 一个输入。没有重复物理 input ID、src/dist 双份、其他 checkout 副本、新的外部依赖或外部 import。按 package 路径归类，Core 与 Runtime 自身的输入集合不变；A11y 从五个源码输入增加到六个。

主要 minified 输出归因如下；这些不是可相加的逐文件 gzip 贡献：

| 源码增量                   | Runtime |  React |    Vue |     WC |
| -------------------------- | ------: | -----: | -----: | -----: |
| A11y `create.ts`           |  +3,717 | +3,738 | +3,738 | +3,738 |
| A11y `web.ts`              |  +2,920 | +2,947 | +2,883 | +2,885 |
| 新 `part-relationships.ts` |  +1,959 | +1,959 | +1,959 | +1,959 |
| 三项占整个 minified 增量   |   98.1% |  96.9% |  96.3% |  95.5% |

这些代码承担完整 tuple 的 fail-closed 匹配、缺失/歧义诊断、key/domain 重索引、epoch 和 L1 撤销/恢复、精确旧 ID 恢复、独立 writer ownership、observer 尚未交付时的身份调和与 physical binding replacement。其余增量包括现有 Runtime view-presence 订阅、Adapter target-change/reveal 接线，以及未声明 Table role 时不清除其他 Module 投影的一行 guard；部分未改源码也会因整个 bundle 改变而产生 minified 命名/布局差异。

新增 manifest 边 A11y → Anatomy 不等于新拉入整个 Anatomy：`AnatomyPort` 是 type-only import，运行时通过既有 `deps.tryPort('anatomy')` 取得 port；standalone A11y 两侧均有零个 Anatomy 输入。Runtime/Adapter 在 main 已包含同样七个 Anatomy 文件，本次该模块只有两处 capability guard 的 +46 minified bytes。既有 A11y ModuleDef/barrel 已使 create/Web projector 进入 whole-entry 闭包；新服务沿用这条路径。

本次有界检查未发现可明确删除的无关新增闭包或重复副本；这不证明实现已达到理论最小体积。把既有 ModuleDef/barrel 改为另一种交付架构是独立设计工作，不能冒称为已经证实的小修复。本提案不通过删减已接受的 A–K 语义来换取数字，也不把 gzip 字典共享造成的结果当成逐文件可加成本。

## 提案上限与余量

| 入口    | 当前上限 → 提案上限 | 功能 head 实测 |      提案余量 |
| ------- | ------------------: | -------------: | ------------: |
| Runtime | 64,000 → **66,500** |         65,865 | **635 bytes** |
| React   | 83,500 → **86,000** |         85,351 | **649 bytes** |
| Vue     | 83,500 → **86,000** |         85,093 | **907 bytes** |

本次数值按 500-byte 边界取整，并保留至少 500 bytes 的小幅余量；635～907 bytes 也处于已接受 #675 记录采用的约 0.5～1.5 KB 范围。这里是本事务的可复核选择，不是今后能力可自动增长或自动涨预算的一般授权。

WC 在 main / feature 分别为 85,908 / 88,554，维持既有 97,000 上限；lucide icon/root、Core、Base Button、shadcn Button 五项也均通过，其上限不变。whole-entry 阻塞机制、测量算法、external boundary、两个非阻塞 consumer diagnostics 及其他六项 ceiling 全部保留。

## 预算事务自身的 CI 覆盖

#689 初始 head `d0977f03c1d8e5c6a31552ecd4ae8c8ce39ec508` 的 [run 35699734276](https://github.com/Proto-UI/Proto-UI/actions/runs/35699734276) 保留为失败记录：主阶段 2,597 项通过；独立浏览器阶段 136 项通过、1 项失败。失败是 Demo Matrix 首次访问发现 61 个 `[Preview Error]`，日志没有具体错误文本。同套件后续三项通过；全新本地 checkout 的原四项测试和有界原生页面对照未复现，不能据此断言根因或称为 flake。

[review 5275480727](https://github.com/Proto-UI/Proto-UI/pull/689#pullrequestreview-5275480727) 还指出该脚本/记录事务选中了零个公开包，导致预算作业跳过。因此补上 `scripts/analysis/package-budgets.mjs` 的精确全局构建输入匹配，让预算脚本变更选择全部公开包并执行既有 pinned CI whole-entry 门禁。回归同时保留无关记录/analysis 不选包、普通 package 的依赖和反向消费者选择；workflow、测量算法、其他上限及失败退出行为不变。

Demo Matrix 的零错误断言现在附带失败 previewer 的 demo、runtime、ID 与完整文本，保留原判断和超时，便于新的可信作业记录实际原因。这是诊断信息补充，不是已证实的页面缺陷修复。新准确 head 仍须取得实际执行预算命令且成功的仓库 CI，不能用本地对照或旧作业的跳过替代。

## 接受与后续边界

本记录不改变 #688 的源码、API、依赖、生命周期或测试断言。功能 head 的默认可信 test job 已通过 2,647 项主阶段测试与 27 文件 / 137 项独立浏览器测试，保留 34 个既有 TODO；主阶段也实际执行 Chromium Scroll。这些结果不能消除当前预算失败或替代独立批准。

既有[源码/浏览器证据](https://github.com/HyacinthHaru/Proto-UI/tree/92d60ba32ae39579278fcd6127327a7c8fe1444a/evidence/2026-09-22/a11y-part-relationships)与[可信 CI 对账](https://github.com/HyacinthHaru/Proto-UI/tree/90b929d8b4f5ecf50abf2d395f98bd66fab3b8f5/evidence/2026-09-22/a11y-part-relationships-ci-868d3adb)保持原始 head 与时间。原生功能浏览器运行发生在 `fd9fc6b4`，对后续仅改变 Workspace 测试的 `868d3adb` 复用依据是全部相关输入字节相同，不是新 head 的新浏览器运行。

本事务的归因不包含未合入 #652 的 Shadow/Core/Runtime 增长，也不证明其通过任何预算。其他能力增长、能力组合或工具链/压缩变化仍须新的准确测量与独立审查。

只有本预算事务获独立接受并实际合入后，#688 才能以非改写 merge 同步 resulting main，取得新准确 head 的完整必需 CI，再转 Ready 并请求独立复审。预算 PR 本身的绿色结果不能代替功能 PR 的这些步骤。
