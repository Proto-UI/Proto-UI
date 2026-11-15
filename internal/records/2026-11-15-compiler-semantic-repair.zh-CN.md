# Compiler 语义修复：三阶段设计、根因与验收记录

本记录对应当前用户授权的完整编译器修复。它解释实现选择及实际证据，不改变 spec 生命周期，不构成正式 GitHub approval 或发布承诺。原始只读审计 F1–F5、后续独立复验 R1–R25、失败记录及并行分支历史均保留。

## 修订与范围

- 最终本地可执行源码：`f5383ebf337570e2772fd818d79653724e0816dc`；tree：`d8956b5d066b0e1c851cc6de4dd3cf6daf719ca5`。
- 可从 GitHub 获取的等内容代码提交：[`06842612290860afe0871a6fe1795387f1e2f3ec`](https://github.com/Proto-UI/Proto-UI/commit/06842612290860afe0871a6fe1795387f1e2f3ec)。已读取 Git commit 对象，核对其内容 tree 与已验证源码完全一致。
- PR 基础分支：`fix/release03-comprehensive-20261115`，已纳入并测试真实上游 `8e0afb07c7d272f22f714c3b886a7b3b78c7e63a`。冻结后上游新增 `805766c2b652d8e70d3c5f80a5f6b57f35d725c9`；其六个修改路径与本次 diff 无重叠。本地结果没有包含该提交，实际合并树的 Anatomy/Adapter/Runtime React 集成检查仍需正常执行。
- 最终证据：同目录 `evidence/2026-11-15-compiler-semantic-repair.json`。其中分别记录执行、静态编译、环境受阻和未运行的检查。
- 关联现有工作：#1018 的 authored Transition lowering、#1055 的 reached support 与普通宿主消费者。这里只记录本次可证明的条件，不代替这些 Issue 的全部历史验收。
- 编译器继续 private / release.scan=false；IR 为 7，GPUI SDK 为 0.2.0。公开发布包及版本治理不因私有编译器实现而扩张。

## 为什么需要这次改动

最初五项问题有共同根因：编译器在缺少足够语义信息时，用源码拼写、语法遍历、组件特例或产物字节代替了应当明确的判断。改一个名字可能改变准入；创建一个闭包可能被当作已经执行；复制 Transition 状态机造成第二份业务真相；文件内容相同又被误用来推断跨库身份相同。

修复分别建立了四种依据：**声明绑定决定源码身份；类型与执行效果决定合法操作；调用和存储图决定捕获与需要保留的能力；显式导入导出决定跨产物身份。** 目标是让一个具体组件的成功成为通用模型的结果。compile-time IR 不随产物发货，目标程序执行普通宿主代码；必要的回调、状态、身份、资源管理和清理继续存在。

| 原审计 | 根因 | 实现选择及作用 |
| --- | --- | --- |
| F1 | 编译器复制 Transition 业务协议 | 从未修改的 authored source 推导普通闭包、State、scheduler、presence；退役新编译路径中的专用业务 operation 与替身状态机。源码变化控制输出行为。 |
| F2 | 名字和局部语法形状参与语义准入 | 解析 binding、词法 owner、类型 alias、import/re-export 后归一；同名本地对象没有 Core 权限，真实导入重命名后仍保留身份。 |
| F3 | 能力进入全量 interaction 工厂 | 根据实际调用、注册、公开 callable 和依赖闭包选择 support；分别测源码、生产 bundle 和真实资源初始化。 |
| F4 | 可观察语义与独立编译共享边界不明确 | 明确 Props 更新策略、State 通知与生命周期；加入版本化 library/link manifest、canonical owner 和 support ABI 检查。 |
| F5 | 对生成字符串切片再拼接 | 使用规范模板与 TypeScript binding/AST 分析进行编译期特化；共享 support 和 plan-local helper 各自有清晰依赖。 |

## 第一阶段：绑定、归一化和可观察语义

Source graph 区分执行依赖和擦除类型依赖。读取类型声明不会执行所在模块；未选中的缺失类型导出不会拖垮已选择的合法类型，真正需要的缺失源、路径逃逸、歧义和运行时依赖仍明确失败。外部 setup 函数保留原模块的词法 owner。

普通值的 IR 保留 callable 签名、record 字段权限、可变 cell、默认参数、异常和控制流。source admission 与 portable IR validation 各自验证输入，序列化数据不能靠伪造 metadata 获得权限。annotation 和 width subtyping 不能藏掉实际对象中的 callable 或 owner authority。可变 alias、写入和有写效果的调用会使旧细化失效；新 guard 或不可变快照可以建立新的证明。

初始化检查区分直接读写与延迟捕获。直接在初始化前访问词法变量会得到诊断，合法 block shadow、函数提升、提前创建但稍后调用的闭包继续成立。默认参数在调用时从左到右求值。模板 child 和 callable 返回类型共用同一准入规则，避免前端接受而 lowering 拒绝同一个值。

`proto-ui-observables-v1` 把输入接收、更新意图和 host commit 分开。旧 profile 默认值保留：React Runtime / Vue2 使用 host Props 更新，React DOM / Vue3 / WC / GPUI 使用 explicit 更新。State/Context 写入不隐式获得渲染语义，`updated` 位于实际 commit 之后。新增说明仍是 draft，不能从相同 metadata 推出 Adapter conformance。

State 按 owner 的 FIFO 派发已经记录的事件及订阅 registration。后来加入的注册不接收旧事件；移除再注册同一 callback 不会复活旧 registration。异常后仍排空有效通知和重入写入，再抛出原异常或有序 AggregateError，包括 falsy thrown value。这项修复同时进入独立 Runtime 模块与生成目标，避免只修编译器自己的参考实现。

## 第二阶段：普通 authored lowering、执行效果与能力闭包

普通函数、对象和闭包经过普通 IR。创建函数、返回函数、把函数装入 record 与实际调用分别处理；未知调用边不会成为删除函数体的证明。即使函数体未到达，可被观察的函数分配身份与 arity 仍保留。忽略 callback 的 effectful helper 仍执行自身副作用，未调用 callback 的 Overlay 依赖则可以排除。

执行分析追踪 lexical cell、record field/alias、closure environment、Hook installation 与 capture frame。setup 的确定写入可以覆盖旧值；分支和异常路径保留可能状态。公开 callback、返回的 callable、公开 record 字段和 render 参加同一后续存储分析，状态变化后重新检查。render 始终保持 render 阶段，不能因被放入普通函数缓存而获得 setup 权限。缓存键保留字段位置、环境和存储身份；同一组函数出现在不同字段中不是同一调用事实。

options callback 向实际执行所在的 capture frame 贡献成员。descriptor schema 是可能直接贡献的静态上界，不能代替每次安装的真实状态。multiple 安装保持独立，nested child 不被 flatten，同名成员的不兼容类型明确失败。parser 的局部推导只帮助建立后续类型，完整闭图与 portable validator 会重新证明 metadata。

Core 的 same-name once 安装语义保留，包括 pending/failed 安装与 completed-but-undefined 投影；这与“本地变量拼写不能授予能力”是不同边界。公开函数返回值和嵌套 callable 在 owner callback scope 内执行；双向投影维持往返身份。公开 record 在 registry read 或 public call result 边界刷新，新增函数进入 guard；没有声称任意外部字段写入会自动安装响应式追踪。

GPUI 发出普通 Rust 代码并使用固定 SDK。数值转换保持已定义的二进制浮点、NaN、负零、字符串转换与求值顺序；不会使用 Rust 默认格式化替代既定语义。关系比较仍遵守独立的同类型 number/string 准入，字符串按 UTF-16 排序。Rust 无法表达的可观察孤立 surrogate 明确拒绝。可捕获的 authored 失败通过 Result/受控边界返回，不能穿透 GPUI entity lease；无返回通道的 callback 留存失败供 owner 观察。清理不会因为前一个资源失败而丢弃后续义务。

## 第三阶段：显式链接、身份与兼容

`prepareCompilerLibrary`、write/read、`linkCompilerLibraries` 和 create-only writer 构成完整的库产物流程。Context、Anatomy、FocusScope、FocusRoving、A11y 声明只有显式 export/import 才共享身份；re-export 必须解析到唯一 owner。名字、路径、配置和源码 hash 相同都不自动合并私有声明。

内容 hash 用于完整性，schema/configuration 用于契约兼容，support ABI/fingerprint 用于共享宿主实现兼容。这三者各有用途。链接器在写出前验证 owner、循环、缺失项、目标 profile、路径、依赖与 hash；未链接外部义务不能静默分配替身身份。消费者使用普通 ESM、组件 imports、props/events/slots，无需专门启动器。

源包通过明确的 `proto` export 发布传递源码闭包，包括类型依赖；编译器不猜测 dist 对应的 src，也不执行包以发现定义。源码打包测试实际执行 npm pack（offline、ignore-scripts），校验真实 tarball 清单、路径与内容。Vite 仅声明为编译器既有浏览器夹具使用的 private devDependency，复用已经锁定的 6.4.1 解析，不增加发布运行时依赖。

IR 7 与生成 support ABI 分开版本化。旧 IR 需重编译；历史 emitted artifacts 只有精确已记录的内容才进入兼容路径。已退休的复制 Transition 产物在任何写入前拒绝，要求从 authored source 重编译。同名普通方法不会被误认作迁移标记。历史 archive 不变，也不是新编译的第二套实现。

## 独立复验发现的闭环

| 编号 | 需要防住的错误 | 修复后的约束 |
| --- | --- | --- |
| R1 | 公开返回的闭包绕过生命周期 | 递归投影与 owner callback scope；终止后 retained handle 失效。 |
| R2 | 同一含 callable 的 record 在多次公开读取后丢失 alias identity | 投影按原对象保留 identity，同时保留结构、字段权限和 callable provenance。 |
| R3 | 调用或写入后沿用旧 narrowing | 依据写足迹使旧观察失效，并在 portable 入口复验。 |
| R4 | alias/factory 路径漏捕获 | 实际调用环境参与捕获，不只扫描 Hook setup 语法树。 |
| R5 | detach/迟到 callback 再次启动计时任务 | 区分 view detach 与 terminal owner，按 epoch 和清理义务控制重启。 |
| R6 | 运输 callback 被当成调用 | 保留 helper 自身副作用，排除未到达 callback 的 support。 |
| R7 | 原生清理遇错提前停止 | 继续释放其他资源，再报告错误。 |
| R8 | 窄结构类型隐藏 owner authority | 实际 runtime shape 中的权限不能被 annotation 擦除。 |
| R9 | 特权 child 捕获 metadata 随名字或遍历顺序改变 | 用 binding 和真实 frame 重新推导。 |
| R10 | 可变公开 record 只投影一次 | 每次向外投影刷新字段并保留 alias。 |
| R11 | 暴露可变内部注册表 | registry read 返回受保护快照。 |
| R12 | GPUI 的 expose key 重复或空值未按公共边界拒绝 | 同 kind、跨 kind 共用 key 唯一性检查；duplicate/empty key 均拒绝。 |
| R13 | 原生 input control 在一次 authored callback 结束后仍可使用 | 每次 return/throw 后立即失效；RAII 在 invoke_scoped 内先 expire 再 poll，保留 throw 0，owner 后续合法操作仍可继续。 |
| R14 | 缓存键只看 closure 集合 | 保留字段位置、环境、factory invocation 与存储身份。 |
| R15 | 公开 callback 替换 callable 后效果漏检 | 用后续可变 store 的固定点检查各次可执行路径。 |
| R16 | 可捕获的失败变为原生 panic/lease 崩溃 | Result 与明确失败队列；失败后 owner 仍可继续合法操作。 |
| R17 | Runtime 模块丢 registration 身份 | 模块边界保留注册 token、FIFO、移除再注册与重入异常语义。 |
| R18 | public callable 往返产生新身份 | 双向 wrapper/original 映射保持 identity。 |
| R19 | 替换公开函数后新函数未 guarded | 在下一次明确投影边界刷新并保护新值。 |
| R20 | options 闭包贡献遗漏或多实例串状态 | 实际环境贡献到对应 frame；静态 schema 与实例存储分开。 |
| R21 | Rust 数值/字符串转换偏离已定义语义 | 以 685 个 Node 参考 case 和实际 Rust consumer 检验精确转换。 |
| R22 | 条件 once 被误判必定安装 | 合并可能安装状态，保留失败前已经发生的注册。 |
| R23 | pending/failed once 与 completed 投影混淆 | 保留 Core 各状态的真实后续调用结果和 identity。 |
| R24 | render 只在 setup 后分析一次 | render 加入公开回调变化后的存储工作表，并保持阶段权限。 |
| R25 | 伪造 typed index 暴露未 guarded 的函数 | 未实现的 typed index public projection 明确拒绝；内部 unknown store 与有限公开字段分开。 |

此外，统一验收修正了已经不成立的测试前提：固定 support 文件名、把所有生成 IIFE 当作 authored setup、把合法 shadow/alias 仍当非法、源包发布后的隔离 fixture 依赖，以及 release version 推进后的 current admission fixture。每项都保留原失败及对应正负控制。最终发现的生产模块初始化循环按真实依赖方向拆除，入口导入顺序也有 fresh-process 回归。

## 五类测试及实际执行

| 检查 | 精确候选上的实际结果 | 证据范围 |
| --- | --- | --- |
| 完整 compiler 非 Chromium 集合 | **152 个文件、2,503 项通过、1 项历史采集工具 skip** | 真实 discovery 清单逐文件核对；含一次明确记录的同源码串行替代执行。 |
| 独立原始反例集合 | **30 个文件、220/220** | 独立复验者亲自执行，原始断言保留；与 compiler 全集有交集。 |
| 编译器源码严格 TypeScript | **340 个 tracked roots、1,498 个传递文件、0 diagnostics** | 使用真实 workspace options；生成消费者另按各自目标配置检查。 |
| 生成 Web 消费者严格类型 | **10/10** | 五个完整目标 profile，各检查 Transition 与公开高阶结果；计入上述 2,503 项。 |
| Runtime State / Adapter | **7 个文件、53/53** | 实际 Runtime 通知、公开 record 与返回 callable 消费者。 |
| Core 类型契约 | **exit 0** | `internal/contracts/types/tsconfig.json`。 |
| package / release 回归 | **219/219** | 公开包、tarball、manifest 与 release fixture 的实际执行。 |
| manifest、release version/assets、spec lifecycle、prototype catalog | **各 exit 0** | 47 个公开包维持 `0.3.0-alpha.2`；lifecycle check 使用已测 base `8e0afb07`。 |
| fresh GPUI producer / Rust consumers | **29 个消费者模块、107 个生成文件；27/27 Rust tests** | 3 份原始 Transition 源码、consumer、685 个标量参考输入和 4 个 arithmetic text、manifest、Cargo.lock 均核对哈希；没有把参考输入数当成额外 Rust test 数。 |
| GPUI 默认 SDK 与格式检查 | **各 exit 0** | `cargo check --offline --locked --lib`；`native/gpui` 的 `cargo fmt --all --check`。 |
| 正常隔离 Chromium | **受阻，真实旅程 0** | 10 个真实 browser 文件单列；Happy DOM 和 SSR 生成测试的通过不替代浏览器旅程。 |

五类测试均有正控制与反例，并可从已提交的文件重跑：

| 类别 | 代表性文件 | 验证的因果边界 |
| --- | --- | --- |
| 重命名、alias、re-export 不变性 | `source-normalization.test.ts`、`source-graph.test.ts`、`reviewer-closure-provenance.test.ts` | 拼写不给普通 record Core 权限；真实 binding 经类型 barrel、setup alias、函数工厂仍保留语义；冲突的 star export 明确拒绝。 |
| 源码归一化 | `source-normalization.test.ts`、`source-values.test.ts`、`nominal-flow-normalization.test.ts`、`ordinary-flow-soundness.test.ts` | 合法函数形式、泛型、nullable/readonly 约束一致；调用和 heap 写入使旧证明失效，伪造 IR 不获得 authority。 |
| 能力组合与独立语义 | `differential.test.ts`、`native-support-capabilities.test.ts`、`reviewer-options-hook-capture.test.ts`、`fixtures/gpui-ordinary-values/consumer.rs` | 独立 oracle 检出多一次 click 的 mutation；嵌套 Text/Trigger、options capture、多实例和真实 Rust 资源/异常消费者均实际执行。 |
| 分别编译后的共享与隔离 | `src/artifact-linking.test.ts`、`test/artifact-linking-consumer.test.ts`、`test/native-support-published-migration.test.ts`、Rust consumer | 显式共享名义声明，私有同名同源码声明保持不同；缺失/循环/不兼容项在写出前拒绝；Rust 单独验证普通 crate 组合。 |
| 无关闭包排除与清理反例 | `reviewer-observed-closure-demand.test.ts`、`native-support-plan.test.ts`、`reviewer-delay-detach.test.ts`、`native-async-atoms.test.ts` | helper 自身副作用仍执行，未调用 Overlay callback 不引入 Floating UI；实际调用保留依赖；detach 中重新安排任务并抛错仍完成清理。 |

以上短文件名位于 `packages/compiler/test/`；单独标注 `src/` 或 `test/` 的路径以 `packages/compiler/` 为根。完整路径、逐批命令、原始 receipts、文件清单和 SHA-256 索引见机器证据。原始本地路径仅记录执行位置，不声称这些日志已经成为 GitHub 附件。

测试分为：重命名/alias/re-export 不变性；源码归一化；能力组合与独立语义；分别编译后的共享与隔离；无关能力排除及清理反例。除了实现侧回归，独立复验的 25 个新增测试及 5 个输入夹具已入库，保留独立预期和修复前证据。两个旧输入仅调整 Core 类型标注，未改可执行行为；类型修正前的 hash、原文与差异单独保留。

编译器全集来自真实 Vitest discovery，记录实际文件、每批退出码、遗漏/重复检查。`capture-old` 历史语料采集工具默认跳过，不算通过；当前 migration 消费者照常执行。独立 220 项与全集有交集，不将两个数字相加宣称不同测试总数。

最初全套运行的 batch 04 在十个 strict consumer tests 开始前发生 worker 异常退出，原始 overall receipt 保持失败。随后在同一源码、同一断言、相同 worker/heap 设置、没有其他重型任务的窗口执行 10/10；独立核对了前后完整 case 名称和 152 文件集合。native40 producer 的 SIGKILL 与 TypeScript 并发中止也保留，当前原生通过依据是 fresh native40b。本记录没有把并发相关推测写成已经证明的系统 OOM，也没有把合并后的成功集合改称从未中断的单轮通过。

初次全局 TypeScript 文件系统选择器误纳入两个并行生成的临时 consumer roots。最终选择冻结 Git tree 中的 compiler roots，再构建完整传递 Program；生成消费者在各自配置下另行严格检查。原错误选择器的诊断仍存档，没有删掉真实 tracked 源码来取得通过。

## 成本证据

下表全部以 bytes 计。`production` 是 esbuild 真实执行 bundle/minify/tree shaking 后保留的 JavaScript；`gzip` 对同一输出压缩。入口只导出 `createNativeInteraction`，目标为 ESM / browser / ES2022。

| Feature                  | Support 源码 | Production retained |   Gzip | 保留 Floating UI |
| ------------------------ | -----------: | ------------------: | -----: | ---------------- |
| 完整 monolithic 比较对象 |      210,590 |              97,215 | 33,535 | 完整比较闭包     |
| a11y                     |       57,289 |              12,400 |  4,679 | 否               |
| trigger                  |       66,568 |              13,122 |  4,746 | 否               |
| text                     |       54,181 |              11,077 |  4,044 | 否               |
| image                    |       53,632 |              10,306 |  3,893 | 否               |
| boundary                 |       51,005 |               9,396 |  3,597 | 否               |
| collection               |       56,947 |              12,284 |  4,442 | 否               |
| scope                    |      103,509 |              26,369 |  9,104 | 否               |
| scroll                   |       75,403 |              19,730 |  6,815 | 否               |
| positioning              |       52,283 |              33,507 | 12,916 | 是               |
| overlay                  |      114,421 |              54,996 | 19,937 | 是               |

这里的比较对象是冻结候选当前导出的 `nativeInteractionArtifact` 与 `nativeAdapterModulesArtifact` 的完整 monolithic 组合，不是未经修改的 published CLI 历史 archive。测量的是 support closure，不是完整应用，也不是 Rust 链接后二进制。同方法下，十项按需 support 的 production retained 为 9,396–54,996 bytes，对照为 97,215 bytes；不能据此宣称整个应用有同样降幅。独立的 migration 测试另外校验真实历史产物原 bytes/hash。

生产 bundle 通过真实 bundler 生成，metafile inputs 确认 Floating UI 只在需要的 positioning/overlay 闭包出现。实际初始化控制观察到 a11y-only 的 owned/observed State 为 0、input/global listener 为 0，卸载恢复 attribute；Rust plain owner 的 17 类相关资源计数为 0，同时普通 owner 必要的 scheduler binding 为 1、focus owner 的 native subscriptions 为 3。清单、实际计数、交付源码和生产保留字节分别成立，不从较小源码推断零分配。

## 边界、未执行项目与后续验收

- 当前环境正常 Chromium 隔离准备失败：`Cannot open netlink socket: Operation not permitted`。拆除生产 import cycle 后的直接 SSR browser 尝试已经完成真实 fixture build 并收集 21 项，但 Chromium 在 `process_singleton_posix.cc` 的 `socket()` 遇到 EPERM/SIGABRT，断言仍未执行。真实浏览器旅程为 0，10 个 browser 文件单列受阻；不降低 sandbox，不把 Happy DOM 改称浏览器验收。
- 整个 workspace 的 TypeScript 曾以 exit 137 中止，未声称通过。最终 compiler-root Program 使用真实 workspace options，包含全量传递依赖；它的零诊断也不能替代整个 workspace 检查。
- GPUI 原生测试使用实际 Rust/SDK 的 TestAppContext，覆盖生成代码和资源控制；不声称 OS/device/辅助技术或视觉验收。Linux 本地结果不能替代 macOS CI。
- public SSR、Qt、Flutter profile 仍未实现。内部已有实验选项与其测试不等于公开 profile；GPUI 固定上游缺少的物理 FocusEntry 继续明确拒绝。
- Web library manifest 的实现不意味着 Rust 接受同一种 manifest；GPUI 使用独立 Cargo 与 SDK ABI。
- 旧 Runtime/Core v0 scalar domain validation 仍有既有开放边界；差分声明只覆盖明确公共输入域，不通过改写旧契约制造一致性。
- 正式 GitHub 独立 approval、远端 CI、DCO 和 merge 以平台实际结果为准。本地代理复验是工程证据，不能自称正式审批。

## 来源与提交方式

本次实现、测试及说明由 OpenAI 编码代理在当前用户明确授权下生成和审查。人类已授权任务和设计选择，未声称人类逐行审查或提供未给出的 DCO 认证。输入是本仓库 MIT 源码、已锁定依赖及公开上游 SDK 接口；没有使用第三方私有代码或引入外部复制的组件业务实现。规范模板和历史 archive 的来源保持可追溯。

原始本地提交保留实际 Codex author/committer 与机器署名，机器证据索引保留相对已测 base 的 78 个本地提交对象。连接器发布分为两个载体：第一个代码提交 `06842612290860afe0871a6fe1795387f1e2f3ec` 以真实上游 `8e0afb07` 为 parent，tree 与本地 `f5383ebf` 完全相同；第二个提交只添加本记录与证据 JSON。第二个提交及 PR 的真实 SHA/URL 写入后续发布收据和 PR body，避免证据文件自引用自己的提交 SHA。

代码载体的 GitHub GET 显示 author/committer 为连接器账户 `cyjin.yl`，verification 为 `unsigned`。这是平台实际 transport metadata；实现和复验的 AI 来源已在 commit message 与本记录中明确披露，不据此声称人类创作、逐行审核或 DCO 认证，也没有复制用户的 Signed-off-by。没有执行的本地 `agent:publish` 或 `agent:collaborate` 路径不记为成功。原始上游提交通过 Git object hash 精确核验并保留，不伪造或重写其认证历史。
