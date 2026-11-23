# Sprint 2 集合交付与跨工作流独立评审记录

日期：2026-11-22。执行者：`/root/collections`，模式为当前用户指示下的 `human-assisted / current-user`。本记录属于 Sprint 2 的有界开发与证据整理，不是规范，不提升任何 draft 生命周期，也不是 GitHub APPROVE、完整发布验收或最终 PR head 的 Ready 回执。

**角色边界：**我实现了本轮 Tree、Data Table、Virtual List 切片；该切片的独立源审查由整合者 `/root` 完成。我随后只读审查了网站、共享输入、编译器消费者与队列实现；没有提交被审实现。文中的「我独立执行」「作者执行并回读」「整合者观察但未取得原文件」分别记录，不混作同一验收。

## 1. 阅读入口和来源

- 本路实现与原 Issue 条件：[集合交付记录](2026-11-22-sprint2-collections.md)。原始实现为 `6c59bbc20176fd523427ac46d7333908d978bc7b`，中文 Git 路径库存修复为 `b3e4cd0d2cfdeb4fe48787911cd5dd4cee7a006b`；二者均基于 `dc3b184ba10b0de53e40359c52d012b204b2cd01`。
- [原文件哈希索引](evidence/2026-11-22-sprint2-collections-review/evidence-files.json)记录每个实际保存文件的原路径、原字节数/SHA-256、存储字节数/SHA-256和编码。`.log.gz` 是确定性、无损压缩；解压后的字节已与原文件核对。文件名中的 `green` 或 `final` 不代替实际终态，索引另保留日志打印的测试汇总。
- [源码和执行绑定](evidence/2026-11-22-sprint2-collections-review/source-map.json)区分作者分支 commit、整合 commit、评审工作树哈希和实际 probe。cherry-pick 后的提交号不能替换原执行来源。
- 编译器作者的完整实际消费者材料单独保存在 [编译器消费者记录](2026-11-22-sprint2-compiler-consumers.zh-CN.md)及其 `evidence/2026-11-22-sprint2-compiler/evidence-files.json`，原提交 `f8ffe8e`。本包保存我的独立反例/回读，不重复那套 127 文件归档。

独立 probe 的原脚本可能保留当时的绝对工作树路径。归档保留执行原文，而不将后来重写为相对路径的脚本冒充原执行源。复现时需要对照索引和源码 commit 设置对应路径。历史错误 oracle、启动方式错误和不完整运行也保留并单列。

## 2. 集合切片：实现、失败反证与保留范围

| 对应条件 | 本轮实际交付 | 有区分力的原失败与结果 |
| --- | --- | --- |
| #1099、#523 Tree | Root direction/RTL；逐 Item/Group 键关系；动态层级、重排、重连；祖先折叠的焦点修复；三个发布家族的真实公开 recipe | `tree-red.log` 为 5 失败/2 正控；末期动态/关系/样式组合进入 287 条集合终态。独立审查要求只处理 Anatomy 已定义的无 domain 状态，不能吞掉任意 `ANATOMY_CLAIM_INVALID`；Root 方法内部同码错误仍传播的 8 条回归通过。 |
| #1099 Data Table | 列过滤、列可见性、当前页批量选择、保留页外选择、公开自定义 Cell recipe，以及 Root 拥有的可移植 Row/Header activation | 原 6 条新能力用例全部失败；实际 React/Vue recipe 暴露以 `setPresent(false)` 隐藏列会退休作者子 Cell 的差异。最终使用隐藏呈现保留逻辑拓扑/实例，原 Table 结构断言保留。 |
| #1099 Virtual List | 可移植 window/model 独占 materializer lease；Root 退休；旧 host 隔离；失败与重入清理 | 原 4 条 lease 用例失败。审查补充的真实 AdapterHost + Root 两反例证明 `renderItem` 内 dispose 会误入终态 handle、或覆盖原错误；修复先检查本地 lease 寿命，退休后只清自己的物理节点。 |
| #1099、#522 Resizable / Carousel | 保留现有 N-pane/nesting、连续滚动实现，重跑本路源回归并沿用原 native runner | 本路没有复制一套几何实现，也没有更改原矩阵断言。历史原生 24 lane 的来源边界见下一节。 |

原日志位于归档的 `collections/`。完整候选源回归是 **20 文件 / 287 tests**；独立审查补充后是 **4 文件 / 42 tests**；最后的错误码传播套件是 **8 tests**。这些是各自执行记录，不能相加称为一个无重复的全库矩阵。实际公开 Tree、Data Table、Virtual List recipe 各执行三家族 × 四 Web Adapter；这些 source tests 使用真实框架、真实 DemoSpec 和实际 Adapter，只替换依赖获取，不是 native browser 或辅助技术回执。

开发过程中也有测试前提修正，未伪称为产品回归：HeaderRow 原测试漏掉 Shadcn StyleScope；隐藏列的旧 probe 错把隐藏认作逻辑删除；A11y probe 漏掉已定义的 self naming token；一次 page-selection probe 错把已经送达的请求视为应该撤销；Vue 同 turn 注入早于宿主排队 commit；React StrictMode 的延迟终态清理不能用立即 unmount 代替 dispose。完整原失败文件和解释保留在集合交付记录及本归档中。

### 原生执行状态

集合新 runner 固定 **36** case。首次远端启动在任何 browser case 前失败：`git ls-files` 默认 quoted path 将既有中文文件路径当成转义字符串，导致 readFile ENOENT。`b3e4cd0` 改为 `git ls-files -z`/NUL 分割，Node 反例仍使用该真实中文文件，原 ENOENT 与新的完整库存成功分别保存。启动修复没有被当成 36 case 通过。

整合者报告曾通过远端工具读取 `native-r2` 的 Resizable/Carousel **24 lane PASS**，源码为 `f5de205`，含 sandbox 启动修复 `3105d5d`；远端目录 `/home/ezra/proto-ui-sprint2-20261122/native-r2`。**本 reviewer 没有取得其完整 raw receipt，也没有独立重验**。远端工具随后到达额度硬停止，用户会话已明确禁止重试。该观察保留为带来源的历史结果，不能记到最终 head；后续托管 geometry 36 case（再含 Date Picker）必须产生自己的可下载正式 artifact。

### 真实下游与原条件

按用户指定，检查了 Shenko `f3fa6f4d8bf22cfd2baf490d9c3a08bd39af4d42` 和 Verdant `91a775546ebd21a87d76d76568195a6513437719`。这些实际 authored sources 没有直接消费本路 Tree/Data Table/Virtual List/Resizable；聚合 vendor bundle 中存在实现不能代替实际 App 使用。没有为了制造证据而向下游注入新功能。

#523 的两独立领域、原 #678 接收和完整 transition packet，#522 的实际 Inspector 应用/断点/最小宽度/折叠旅程，Message Scroller 的实际 transcript 与 announcement，以及原独立编译器、非 Web、完整 AT、Bootstrap/Liquid 条件均保留。对应后续 Sprint 的范围不因本轮切片通过而消失。

## 3. 网站和共享输入的独立评审

### 网站 #1488 B/C/D 和 #1154 展示证据

详见 [网站评审](evidence/2026-11-22-sprint2-collections-review/reviews/collections-agent-website-review.md)。

- `SITE-REVIEW-001`：双语 Hook R3 页面缺失原失败记录链接。补入准确 `dc3b184…` 原 preparation JSON，browser oracle 改为读取实际 doc-flow，仍明确原 exit 1、后续冻结断言未执行和 13 条件未完成。
- `SITE-REVIEW-002`：实际 Hero 截图显示 native anchor 外圈与内部 Surface 同时绘制 focus。修复把焦点呈现集中到外层圆角原生链接，同时保留 forced-colors Highlight，并检查所有后代没有第二圈。
- Header source-test 的一次延迟通知失败有独立 HappyDOM GC probe：无 callback keeper 只观察一次 aria-current，有仓库既有 keeper 才观察两次。测试接入真实 keeper，未伪造通知或修改导航语义。原失败保留。

我实际查看了归档中的三张 `site-r4` 原截图：中文 Hero、深色 Brutalist 侧栏、React Rhea live Tabs。这些属于原 `r4` 快照，不是最终整合截图。原 r4 为 40/42；两失败与缺链接 finding 一致。后续 `site-r5` 启动后未取回终态，不能写为通过。最终同 owner profile、全部导航模式、Hero 与无 JS/移动/forced-colors 图像以各自正式原生 artifact 为准。

### TextControl 受控回调与 caret

详见 [TextControl 评审](evidence/2026-11-22-sprint2-collections-review/reviews/collections-agent-text-control-review.md)。共享模块 `b1033a4` 延伸候选保护至受控 input/change/compositionend 回调；`14c47f2` 防止实际 canonical A→B→A 再激活旧窗口。我独立执行实际模块 + Web host 的 18 条边界反例/正控，原红与修复后绿分开保存。编译器通用 helper `c5ebad5`/`a165c40` 独立实现同一契约，不能用共享 Adapter 结果代替其验收；生成消费者的 20 条 native case 仍需正式运行。

### 显式 Checkbox / Radio / Switch Field

详见 [Field choices 评审](evidence/2026-11-22-sprint2-collections-review/reviews/collections-agent-field-choices-review.md)。源链 `e16e820 → ebbfc57 → 3693622 → 42ee3b9 → 095ecbd`。前四个源缺陷和新增 Switch reset 缺陷均经原独立反例复验：

| Finding | 原失败 | 修复及独立结果 |
| --- | --- | --- |
| FIELD-CHOICE-001 | 受控 Radio 在卸载期更新 value，重连仍保留旧值 | onMounted 同步当前 provided value，保留 creation reset baseline；普通/显式 Radio 与 Checkbox 对照通过。 |
| FIELD-CHOICE-002 | mixed-clear 回调提交新 checked=true，旧激活随后发 false 反转它 | 激活开始值 + 单调 owner revision；新值和 ABA 退休旧 checked 阶段，单独确认 mixed 仍能正常 toggle。 |
| FIELD-CHOICE-003 | queued blur 在 Form reset 后重新设置 touched | 独立 focus generation；reset/policy 退休旧采样，再同步真实焦点；三家族原反例及 baseline 正控 6/6。 |
| FIELD-CHOICE-004 | focused subscriber dispose Root 后，无变化协调方法继续读取终态 disabled | 保存原 no-op 意图并复核 view/operation/value owner；原 unmount/dispose/remount 3/3。 |
| FIELD-CHOICE-005 | reset 清 pressed 的状态回调提交新 owner，旧 reset 随后仍发旧 baseline | reset 入口固定 intent/view；自己的 Axis cancel 与新 owner/新请求分开；原一正一反 2/2，新 owner 不再被反转。 |

作者的 active-axis reset 后 fresh-contact 正控与原 Switch 非 debounce report 测试保留；六文件 232/232 日志已回读，包含实际公开四宿主 12 recipe。它不是我重复执行的完整矩阵。Fieldset 仍只有 disabled 分组策略；曾误写 `Fieldset.readOnly` 的 recipe 失败保留后改为显式各 Field.readOnly，没有扩展 Fieldset 定义。

`095ecbd` 的 native runner 加入 choices 12 case，总 form/select/choices 36。新增 stylesheet helper 使用锁定的实际 Tailwind 4.2.2、网站 stylesheet、公开 recipe 源 literal 和原字体字节；我独立生成并核对必要 `.size-5`/`.block`/`.inline-flex` 与字体嵌入，哈希回执为 `field-choice-stylesheet-review.json`。这只证明构建前提，没有注入组件 value/geometry，也不证明 native 结果。

## 4. 编译器、安装与真实消费者的独立评审

详细分工和证据分别见 [语义评审](evidence/2026-11-22-sprint2-collections-review/reviews/collections-agent-compiler-review.md)、[固定源码与 CLI](evidence/2026-11-22-sprint2-collections-review/reviews/collections-agent-pinned-cli-review.md)、[真实下游与成本](evidence/2026-11-22-sprint2-collections-review/reviews/collections-agent-real-consumer-cost-review.md)、[native 消费者源审查](evidence/2026-11-22-sprint2-collections-review/reviews/collections-agent-compiler-native-review.md)。

原 `936a6f4` 的三个有区分力缺陷已分别修复并独立验证：

1. Rule Meta listener acquire/release 不能分别选择不同 API 半对；异常清理需 attempt-all，缓存/lease 先退休再调用外部释放，重入的新 source 不能被旧 teardown 删掉。
2. 静态 Object.keys 展开必须尊重 hoisted function/class/enum 与 binding pattern 的本地 shadow，不能把未知方法替换成编译器凭空发明的 Rule effects。
3. 进入模块常量 initializer 后必须使用模块词法作用域；setup 的同名局部 PARTS 不能改写模块 TEXT 的值。跨回本地常量后仍需恢复正确 resolver。

`3624d24`、`f618a76` 的反例/正控和 Props guarantee 保守推导有独立回执。Vue 3 默认 slot、Vue 2 keyed watchRaw、React disposer 的契约边界已源审；unknown Meta/其他后端/SSR 仍按独立定义拒绝，未拿当前 Button 扩展代替完整原编译器问题关闭。

固定源码路线是真实 clean source pin、声明的 TypeScript 5.9.3 依赖、源码与锁文件/产物 manifest。两次相同 `3ea9e34` clean build 的九产物逐 hash 一致。真实 `npm ci` 证据只建立 compiler 安装；框架目标的精确 installed payload 拷贝不得写作 registry 安装。12 普通家族消费者的 imports/children/build/mount、CLI create-only/F13 parent/diff/用户编辑/maps/watch 失败恢复与退出，均有单独工具和 receipt 绑定。

Shenko 最后回执使用 `a165c40` 上游产物、固定真实 consumer head，验证 39 authored Git blobs 与执行前后字节不变。两实际路线均完成 generate→strict tsc→完整 App production→51/51；原不匹配 identity 负控 3 pass/1 fail 单列。实际编译的只有它两个自有 Proto；九家族仍走 Adapter。Verdant 的 GPUI source 单列，未冒称其非 Web 运行已通过。本轮不拿库中存在的所有 collection 源当成两 App 的真实使用。

新 native20 test 源与静态 4.59 MB bundle 的输入闭包已回读。最初静态 manifest 日志 hash 是 compact JSON，保存文件是 pretty JSON；实际执行 fixture 原文已按 SHA 恢复，后来改为对实际保存字节取 hash。这项来源差异未被改写历史文件来掩盖；静态组装不是浏览器通过。

## 5. Date Picker 补充回归与队列

[Date Picker 评审](evidence/2026-11-22-sprint2-collections-review/reviews/collections-agent-datepicker-review.md)保留原 dc3 基线四红和 `3bd5bcf` 对 outward callback/accepted completion 顺序的修复。作者完整 106/106 与我的四个 Runtime 独立 probe 属于该边界，不是以后新增 State/Context 重入的证明。

后续另一独立 reviewer 发现更早的 public State subscriber、合法更早 Calendar Context subscriber，以及嵌套 Popover Context subscriber 创建新 request 的路径。原红、中间修复的有限绿和精确三源快照分别保留；`reviewedCommit` 表示被审基线的旧 JSON header 没有被篡改成执行候选，新的 source binding 明确执行的工作树字节。初版 `8251f7f` 准确保留这些 OPEN_FINDING。随后定义 `2419927` 与实现 `322a871` 改为真正的请求开始 capture + canonical opening session：capture 先于所有可观察副作用，Picker 只匹配实际 request/root/session，当前 Popover 事实不再受旧通知回写。编译器 reviewer 原八个反例复验 8/8，我只读核对全 delta 并逐字节确认五个产品源与执行快照相同，已知源码 finding 现已解决；这仍不代替 native/整合验收。

来源对账保留两个非产品差异：新测试在 dispose 前保存旧方法引用、测试记录从 pending 标 passing；`dbcdecb` 再补测试 relation since。原八 probe 不导入这两测试/登记文件。作者日志的 `green.log` 实际为 143/144（新 probe 错读已清空 exposes），`r2.log` 才是最终 144/144；原字节与解释均保留，不按文件名判断结果。

队列详见 [串行验收评审](evidence/2026-11-22-sprint2-collections-review/reviews/collections-agent-sprint2-ci-review.md)。两个实际反例已修复：timeout 不能在 leader 退出后取消 descendant 的最终 group kill；相同数量的假 case 不能替代精确 family/host/scenario 集合。新增 compiler20 的相同 count-only 弱点也用原伪造 receipt 复验拒绝，真实 ID 集合接受、selected skipped 仍 incomplete。

`2430aeaf1c74dc1f4563a543e0021574e7d5c441` 的最终已审计划是 **10 suites / 304 cases：292 browser + 12 Node/HappyDOM**。choices 与 Date Picker 只增加原套内 case；12 阶段最大 180 分钟，加 process-group grace、安装 10 分钟、上传 3 分钟和 setup 余量，由 210 分钟 job 覆盖。整合者日志 `sprint2-integration-controls-r2.log` 实际打印 Node 合并 **26/26**（含 queue 五条）、Rhea **103/103**、catalog helper **7/7** 和 305 双语 primary routes 检查通过；不把 26 再与其子集重复相加。

这些是队列控制流和 inventory 的证据。原 ordinary-linked 两次 unexpected worker exit 的原因仍 unknown；带观察器的 12/12 和计划里的正常托管重跑不能删掉原失败。托管 304 case 仍需完整终态与最终候选 source 回读。

追加队列 `dbcdecb077283d4e3fe11fe1077b74708f24fa4b` 单独运行既有 workspace 类型检查。它与后续十套一样只依赖 public-packages/styles，类型失败使总结果失败但不会跳过独立套件。现在 13 阶段最大 195 分钟 +65 秒 grace +10 分钟安装 +3 分钟上传，job 调为225分钟。此 delta 已只读核对并绑定原文件 hash，没有在本机重跑广测或提前记录类型通过。

## 6. 发布传输的边界

临时 carrier 仅传输原 Git objects，不合入 PR，不 checkout/执行候选代码。独立 read-only verify 与唯一 publisher step 分开；验证 exact tree/parents/sign-off/路径 digest，固定 feature ref、fast-forward 祖先与 expected-head lease，单次写后回读，不复制凭据或改写作者。

实际原 run `45021743737` 的 verify 通过，publisher 因自写 human `viewerPermission` guard 在写入前停止，`writeAttempts=0`。官方 GitHub 文档说明 App 认证该字段为 null；审过的后续小修严格确认预期 App、repository database ID、job、workflow SHA/ref、原 actor 和 triggering actor，保留已有 contents:write grant 与 Git push 的实际服务端授权边界。没有把 null 伪造成 WRITE，也没有放宽规则或替换凭据。

本 reviewer 只做 source/本地无认证 verify/原真实 receipt 回读，没有做 GitHub 写入。传输成功也不自动代表技术 CI、native DCO、独立 GitHub review、merge 或发布；实际平台若拒绝，必须保留拒绝。

## 7. 本记录出口

本路可交付的集合实现、公开 recipe、来源修复和已解决独立 finding 都有可读源码与原失败/正控。新定义保持 draft，各 Issue 的原完整条件由各自追踪继续承接。当前仍需最终候选完整 native/类型/CI artifact，以及 PR 层实际审核/检查/Ready 回读；此记录不代替这些步骤。

## 8. 本报告文件的检查

原记录/脚本/JSON按字节归档并校验存储与解压 SHA；源码映射保留原提交与整合提交。报告链接在本分支或已给定整合分支逐项核对，原文件不为通过格式检查而改写。

报告类检查的实际结果单列于 `docs-validation/collections-review-document-validation.json`：`check:agent-doc` 首次因 tsx CLI 试图建立本机禁止的 Unix socket 而未进入检查；通过标准 `node --import tsx` 加载器执行同一检查脚本，exit 0。`check:agent-operations` 的实际规模大于预估，打印了局部成功但未取得完整终态；我主动中断自有进程，真实 exit 130，保留原 log 并标 incomplete，不记作整套通过。该检查与整合者报告的 workspace tsc exit 137 存在时间重叠，未建立因果；已停止本路执行，不将后者无依据归因为产品或单一资源来源。整合者将完整类型检查单独纳入托管终态队列，本报告不预写其结果。
