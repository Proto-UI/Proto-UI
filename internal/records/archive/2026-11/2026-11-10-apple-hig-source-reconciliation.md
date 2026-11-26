# Apple HIG × Proto UI：源比较、归属与未完条件续接

日期：2026-11-10。Issue：[#864](https://github.com/Proto-UI/Proto-UI/issues/864)。工作基线：`0607c6c5c386b8a932ab850e92a8873b2121dc45`。

本片修复比较数据消费者丢失已记录平台范围的问题，并连接完整原始条件。Apple HIG 仍是比较材料。每项先看理念相容性，再看 Base、family/platform projection、应用组合、不采纳或待讨论的归属；差异本身不产生 Proto 缺陷、规范或生命周期晋升。

## 保留的来源

- [2026-10-06 完整比较](2026-10-06-apple-hig-proto-ui-first-review.md)及其 [158 行结构化记录](2026-10-06-apple-hig-proto-ui-first-review.json)保持原字节、访问日期、文章 hash 和 `25c3d0731e39003d87f541afc5e1a294a9d95568` 源码基线。
- [2026-10-14 完整条件载体](2026-10-14-finf-followup-source-debt.json)保持原字节。全部 `hig:*` 键、82 条仍需 followup 的 topic、76 条历史不适用决定、原始讨论/回复、历史 source flags 和 GPUI README drift 均保留；PR 合入不替代条件验收。
- [Issue 冻结源条件](../governance/release-0.3-source-ledger.json)的 `issue.864.001` 至 `issue.864.163` 保留原文及原来的 release/acceptance 状态。新 [158 行索引与补正数据](2026-11-10-apple-hig-source-reconciliation.json)以 URL 连接每个 `hig:*` 和其原 `issue.864.*`，同时绑定完整原行与父级记录的 SHA-256，不能重新按排序分配旧 key。
- 2026-11-10 已读取 #864 的全部 4 条当前评论，以及 [原 PR #869](https://github.com/Proto-UI/Proto-UI/pull/869)的 12 条 conversation comments、12 条 review comments/replies 和 9 个 review。11月6日的 0.4 延后意见保留为历史；当前用户授权本片有界修复，不改写 release disposition。

`K-COMPONENT-INTERACTION-0001`、`K-PROTOTYPE-COMPOSITION-0001`、`D-A11Y-SEMANTIC-DOMAIN-0001`、`C-A11Y-0001` 和 `C-FEEDBACK-MATERIAL-0001` 均为 `draft`。组件主体、上层组合、语义对象、host 投射与 family paint 的边界继续按这些实体及 `spec/README.md` 的生命周期解释。四个 `active` Web Adapter profile 不使其依赖的 draft 语义、Apple native 或 AT 自动获得完整保证。

## 具体源修复

原始 [thread:869:4203974712](https://github.com/Proto-UI/Proto-UI/pull/869#discussion_r4203974712)指出 27 篇已有摘要明确排除平台，但结构化 `excludedPlatforms` 未记录。[thread:869:4210272378](https://github.com/Proto-UI/Proto-UI/pull/869#discussion_r4210272378)另指出 Always On、Apple Pay、Complications、Top Shelf 等明确肯定范围仍丢失。这些是已报告的源数据问题，不在本片重新声称产品失败复现。

新消费者 `scripts/docs/hig-comparison.mjs` 组合原记录、父级载体、Issue 条件和 additive 数据。它保留每个完整原行于 `rows[].original`，另提供 `appleArticleScope`；原始数据不会被补正结果覆盖。历史视图只读原字段，补正视图采纳可追溯的自写摘要，不重新抓取 Apple 正文。

32 条补正各自绑定 `source.platformScopeSummary` 的原字符串和文章 hash，其中 27 条补齐排除项。肯定范围逐项录入，不取排除项的补集。其余仅列平台节、没有独立范围证据的文章保持未知或仅提及，包括 Generative AI、HomeKit、iCloud、Machine learning、ShazamKit、Siri、Notifications。原先已补正的 18 篇、六个 Designing-for 主题和 Digital Crown 的系统/应用区别也保持原记录。

限定范围单列：

| 文章 | 保留的区别 |
| --- | --- |
| Game Center | watchOS 的 GameKit 服务与可调用的系统 Game Center UI 不同；保留配对 iPhone 内容限制。 |
| Live Photos | visionOS 可观看、不可拍摄。 |
| Maps | watchOS 是不可交互快照，点击打开系统 Maps；不是完整交互地图。 |
| Live Activities | iOS/iPadOS 启动与配对 macOS/watchOS 接收投射不同。 |
| App Shortcuts | macOS 排除的是该主体；App Intents actions 与自定义 shortcut 的肯定事实另外保留。 |
| NFC | 原摘要仅列 iOS/iPadOS 平台节，设备能力仍待核验；不据此作整篇肯定支持。 |
| Wallet | iPhone/Apple Watch 核心容器与其它平台段提及不同；不扩成相同容器保证。 |
| Apple In-App Purchase / VoiceOver / Augmented reality | 单独保留 watchOS 布局、visionOS 手势模式或独立 ARKit 指导，不并成新的 Proto host 承诺。 |

平台 triage 仍输出全部 158 行，包括 `affirmed`、`excluded`、`qualified`、`mentioned-only`、`unknown`。`protoSupport` 始终为 `not-established`。它回答的是 Apple 文章在该平台上的比较范围，不能回答 Proto 是否实现或通过测试。

读取工具对历史输入使用清楚标出的 immutable Git revision 与 SHA-256。当前源码另按工作树字节读回 hash、实体生命周期、criterion IDs 和声明关系。HEAD 只作工作树上下文，不能将未提交文件说成已在该 commit 中。源路径存在、`active` profile 或 `passing` 声明均不转成实际运行证据。任何缺失路径单列，非 ENOENT 的读取错误继续失败。

## 原条件逐项记账

| 原 key / 条件 | 本片状态与剩余工作 |
| --- | --- |
| `issue.864.001` — Every discovered index/article/subtopic is accounted for, including inaccessible and not-applicable entries. | 保留已勾选的历史入册事实、158 URL、6 主类、8 Components 子类与 4 个 canonical alias；不把本次写源当成重新访问文章。 |
| `issue.864.002` — Every applicable row has concrete current code/spec evidence, including website, prototype, host and generated-path boundaries. | 保留已勾选的历史源映射。当前允许的元数据读回得到 143 个源路径、59 个实体头（4 active / 55 draft），不是 143 个行为验证。新消费者执行后的 source readback 仍需由 Main 收集。 |
| `issue.864.003` — High-priority failures have reproducible tests and actual commit-bound visual evidence where applicable. | 未验收。新专项测试仅针对比较数据消费者；Label/selection、ScrollArea 投射、对比度、RTL 及真实 AT 等仍须各 owner 的实际 revision-bound 交互/视觉证据。 |
| `issue.864.004` — Related issues are deduplicated; remaining evidence debt and unsupported native capabilities remain explicit. | 保留所有原 Issue/PR 候选、限定说明、父级讨论原文与 followup 状态。未新建重复 Issue。Main 仍须按实际结果完成 current dedup/closure readback。 |
| `issue.864.005` — Final totals distinguish inventory, content-reviewed, source-mapped, runtime-verified and inaccessible items. A first batch never closes this full audit. | 保留历史 158 入册 / 158 正文已读 / 158 源映射 / 0 整篇运行认证 / 0 最终未读及失败日志未公开保留的事实；本次产品、native、AT、视觉与测试执行均为 not-run。 |
| `issue.864.006`–`issue.864.163` | 158 条 topic 条件逐项连接原 `hig:*`，完整原行及全部父级条件由消费者保留。82 个父级 topic 要求不因 76 个历史不适用项而消失；所有原 topic 复选框继续由实际 criterion 验收决定。 |

原有 #865/#868 的 selection 与真实 Label 关联、#861/#863 的 Shadcn 角块、#792/#793 的 family/material、#687 的 native 及 #732/#733/#828 的 Compiler 边界继续复用。#1094、#853、#1164 等本轮已有 owner 分别承担其 Label/Form、scroll paint、contrast 原有工作；本片不重复实现或替其验收。CLI 的 CSS 导出不代表 Prototype Compiler；有界 GPUI 不代表 AppKit/SwiftUI 或真实 VoiceOver。

`thread:869:4197472600` 的历史 ModelTrace 争议及 owner 回复保持原状，不伪造旧 receipt、不重写别人的贡献或将本片当作该争议裁定。原始瞬时读取失败后来恢复，但公共逐次失败日志不存在；本片不补造该日志。

## Main 串行执行入口

以下是待执行命令，不是本片运行结果。使用 Node24，工作目录为本片 worktree。每项完成并保留 stdout、stderr、exit status、准确耗时和候选源 hash 后再进入下一项。

```sh
/home/ezra/.npm/_npx/387698761821791d/node_modules/node/bin/node scripts/docs/hig-comparison.mjs --view historical --platform watchOS --format json
/home/ezra/.npm/_npx/387698761821791d/node_modules/node/bin/node scripts/docs/hig-comparison.mjs --view reconciled --platform watchOS --format json
/home/ezra/.npm/_npx/387698761821791d/node_modules/node/bin/node --test scripts/docs/test/hig-source-reconciliation.test.mjs scripts/docs/test/hig-comparison-record.test.mjs
/home/ezra/.npm/_npx/387698761821791d/node_modules/node/bin/node scripts/docs/hig-comparison.mjs --view reconciled --format markdown
```

前两个 producer 是真实保留输入的源消费者前后对照，不是历史产品程序 failed-before 的执行证明。应看到：AirPlay/watchOS 的原未分类变为明确排除；Always On/watchOS 与 Complications/watchOS 的原非肯定变为明确肯定；Siri/watchOS 保持未知。两视图都须保留 158 原行、82 followup topic、163 Issue 条件、所有父级 source keys、全部原状态和原文章 hash，并保持 0 新整篇认证。

专项测试文件包含 source conservation、双向平台 triage、限定平台、未知保留、条件/摘要/冲突注入的拒绝，以及真实 CLI JSON 与 Markdown 消费。注入项是工具的负控输入，不是产品 bug 或原始 Apple 观察。原测试的五个历史检查仍针对原 `25c3d073` 基线。

在 Main 完成依赖准备后，再按实际 diff 的比例运行 `corepack pnpm@10.32.1 test:public-docs` 与本仓库文档要求的 `check:agent-operations`、`check:agent-doc`。只格式化本片新增文件；本片没有执行格式器、安装或这些检查。

Markdown 应在实际 GitHub/标准 Markdown 渲染面检查：6 个主类和 8 个组件子类可定位；所有 158 官方链接、理念/理由、owner/采纳、原平台说明、状态/优先级、完整代码路径、原始及当前实体生命周期、未完条件均可读；表格不因 `|` 或换行断裂。输出是读者投射，不得以源码字符串或日志截图替代该检查。

## 原产品条件的实际消费与视觉路径

本片没有产品改动，不需要为平台数据补正制造组件截图。原 Issue 的产品验收仍是独立工作，必须保留真实接受标准与证据边界。Main 在已有串行网站服务中使用实际消费者：

- `/en/`：在真实 homepage 的 checkbox/标签组合检查原 Label 关联和有用文字复制。点击关联标签与 Space 激活、拖选被动说明、disabled 拒绝激活分别留证，不能以全站禁选或 sr-only 副本掩盖可视关联缺口。
- `/en/ui-libraries/shadcn/checkbox/`：实际 `demo-shadcn-checkbox`，按现有 Web Component、React、Vue3、Vue2 消费检查 unchecked/checked/mixed/disabled/focus 状态；保持 Rhea 的 family 呈现归属。此页本身没有 Label prop，不据此声明所有关联场景通过。
- `/en/ui-libraries/shadcn/scroll-area/`：实际 `demo-shadcn-scroll-area`，双轴 wheel/keyboard/Thumb、host-owned 同一滚动表面、两轨交角、10px track、角色/Tab 边界、focus ring，以及 320px 不溢出。比较既有源定义中的透明被动交角；不要通过 Apple HIG 新增 Base Corner 或恢复用户拒绝的 tile。后续与 #853 owner 的实际 paint 截图合并验收。

Main 启动入口是现有 `corepack pnpm@10.32.1 docs:dev`；不与 workspace typecheck、CLI dist 清理或其它 native 作业并发。每段使用实际可见组件的相邻状态截图及 commit/source 绑定，无法访问的 Apple native/VoiceOver/Switch Control 环境继续记为 unverified/unsupported。Web DOM、模拟 DOM、截图外观和此比较工具都不能替代真实 Apple AT 证据。

## 交付边界

本片是可供 Main 验证和独立评审的源候选：四个新增文件，包含源消费者、158 行索引、此记录和独立路由编写的专项测试。未执行该消费者、测试、格式、build、native/browser；未 commit、push、写 GitHub 或关闭 Issue。所有新 producer 输出、视觉证据、PR、实际合入和原条件关闭仍需 Main 的真实 receipt。#864 保持 open。
