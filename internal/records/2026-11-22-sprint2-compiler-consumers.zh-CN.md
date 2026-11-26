# Sprint 2：固定编译器与真实消费者交付记录

本记录承接 #1458、#1145、#1055、#1061、#732、#733 的本轮消费者切片。它记录实际实现、原失败、执行来源和未验证条件；不改变原 Issue 的完整条件，也不把实验 profile 提升为正式发行。

本轮完成了固定源码的 Node 编译器/CLI 路线、三个 0.3 家族完整 Button 的四 Web 普通消费者、生成文件的编辑和重建旅程，以及用户指定的 Shenko 应用构建和 Verdant 生成链。原生 Chromium 的 20 条新增旅程已经实现并完成静态装配，**本记录初版尚未收到其浏览器执行终态**。托管运行应追加实际源码和回执，不能把这里的静态结果改称浏览器通过。

## 1. 对象和证据入口

完整机器清单为 [consumer-inventory.json](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint2-compiler/consumer-inventory.json)。它把 source × target × consumer × 验证表面分开，使用 `PASS`、`FAIL`、`UNSUPPORTED`、`UNTESTED`。其中不同表的行不能相加为完成率。

| 对象 | 冻结来源 | 本轮实际消费方式 |
| --- | --- | --- |
| Base、Shadcn、Brutalist Button | 当前仓库未改写的 `packages/prototypes/<family>/src/button/button.proto.ts` 及其完整作者闭包；逐文件 hash 在回执中 | 四个 Web source profile 的普通目标框架构建与挂载 |
| Shenko | `cyjin-yl/shenko@f3fa6f4d8bf22cfd2baf490d9c3a08bd39af4d42` | `transport-badge`、`message-bubble` 两个自有生成组件；九个 Shadcn 家族的 20 个导出仍通过 Adapter 使用 |
| Verdant | `OpenGreendam/verdant@91a775546ebd21a87d76d76568195a6513437719` | 原 `pitch-gesture-surface` 作者源码和原 GPUI producer |
| 通用组合夹具 | `scripts/compiler/native-consumer-smoke.mjs` 中三个独立组件、Context 和普通目标代码 | 构建、更新、订阅、detach/reconnect、dispose、消费者编辑、重新构建；属于共享契约夹具 |

工具为 Node `24.22.3`、pnpm `10.32.1`、TypeScript `5.9.3`、esbuild `0.25.12`。本分支执行所用 pnpm lock SHA-256 为 `e374ba03f76079fd191d63c2da1f62861b7e90bbeba64a0b310027fc2c15b7f8`，profile digest 为 `c50ae94bd3a7aa5f8852ce4b9216c72fc45773774a688659605c908992f7f212`。整合分支后续修改 lock 或源码时，保留这些旧执行身份，另留新运行身份。

关键编译器来源分别为：

- `3ea9e34545615ce4a981e2e19c3c3fcc9de3b0bb`：确定性构建、三家族四宿主普通消费者、CLI 完整旅程和成本测量。
- `a165c4058188aa802b475d1d50ce46ab0d574320`：加入 controlled editing callback 的候选保护与真实 canonical 转换后的退休；最新 Shenko 双路线重放使用此固定产物。
- `d53d9cb41b90258c467b5614bcf4dd318786f256`：Verdant 原 producer 的上游 pin。
- `ee943e59d6f6bd9a418c2ba6f11487e349d5ccc1`：新增真实浏览器消费者和 Shenko 初始 Git blob 校验的执行工具；这不是前面全部产物的编译器来源。

原始回执保留内部的实际路径，便携副本由 [evidence-files.json](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint2-compiler/evidence-files.json) 逐文件绑定长度和 SHA-256。较大的日志、详细构建报告与执行工具使用无损 gzip，另记录解压后的原始长度与 SHA-256；不改写原日志。执行工具正文另存于 `tools/`；后续代码修订不覆盖旧执行工具。

## 2. 独立定义与实现责任

编译器从共享定义独立实现通用语言和宿主能力，三个家族的 prototype 没有为适配 parser 而简化。没有新增组件名称/源码路径分派、运行时 IR evaluator 或第二个公开响应式 runtime。

| 能力 | 依据与状态 | 本轮实现和有区分力的检查 |
| --- | --- | --- |
| 有限静态表、枚举、样式字符串 | `internal/compiler/source-language.md` 的封闭语言准入 | 不执行作者模块；本地表须证明不逃逸、不修改；函数声明、解构绑定和局部同名声明不能冒充 builtin `Object.keys`；模块 initializer 保留模块词法域 |
| Rule 环境与偏好 | draft `C-RULE-COLOR-SCHEME-0001`、`C-RULE-PREFERENCES-0001`、`C-RULE-WHEN-0001` | 只交付 reached 的 native source；完整成对 listener API、共享租约、unknown、旧回调退休、部分安装回滚、抛错清理和重入订阅；GPUI/Qt/Flutter/SSR 保留明确拒绝 |
| 原始 Props 观察与默认 Slot | active `C-PROPS-0012`、`C-PROPS-0013`，既有 Template/Slot 定义 | 四 Web keyed `watchRaw`；raw-before-resolved、`Object.is`、回调窗口和取消；Vue2 all-key watcher 仍明确拒绝。Vue3 无作者 renderer 时通过既有 SlotView 投影普通默认 children |
| TextControl selection/caret | draft `C-TEXT-CONTROL-0001` 与本轮共享输入侧的 `C-TEXT-CONTROL-SELECTION-0001` | native 输入事实、未知/null、受控候选与 canonical snapshot 区分、detach/reconnect、退休事件；不引入 OTP 专用编译操作或 selection 写入 API |
| controlled editing callback | `C-TEXT-CONTROL-0001-D` 的 callback boundary | 同一旧 owner 在 input/change/compositionend 回调内的同步不能提前覆写 candidate/caret；不同 canonical 立即权威；A→B→A 不重新激活旧候选窗口；拒绝仍在原 microtask 边界恢复 |
| 严格生成类型 | 已解析 Props 和目标语言原有类型责任 | 只从无条件且相同的 scalar descriptor 建立 required/non-null 证明；条件、early return、try/catch、nullable 和未调用 helper 负例不升级。数组 literal-union 保留注解；WC `unknown` 保持 opaque unknown |

独立 reviewer 找到的三个问题均有原反例和修复：listener 的 modern/legacy pair 混用；hoisted `function Object` 未阻断 builtin 静态展开；模块样式常量错误捕获 setup 同名变量。独立复验记录及红绿日志在 [review/](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint2-compiler/review/collections-agent-compiler-review.md)。后续 TextControl 修复也保留旧 helper 的 caret `2→1` 红例及四宿主、同步/queueMicrotask owner 的对照。

## 3. 固定版本安装、CLI 和可编辑生成文件

`scripts/compiler/build-pinned.ts` 提供受支持的 source-pinned Node 产物。它要求完整 40 位 HEAD、干净工作树和冻结工具身份，输出九份文件。独立执行只依赖精确锁定的 TypeScript 和 Node built-in，不借用别的包安装的 Floating UI。`compiler-build.json` 记录 compiler 输入，生成 provenance 记录此次 build identity。

实际在两个新目录构建 `3ea9e34`，九份文件逐字节相同；之后在隔离 artifact 中执行了真实 `npm ci --ignore-scripts`，安装一个锁定的 TypeScript 包。最新 `a165c40` artifact 也完成独立 `npm ci`。前一次双目录确定性证据仍绑定 `3ea9e34`，没有重标为较新源码。见 [确定性回执](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint2-compiler/receipts/pinned-determinism.json) 与 `logs/s2-pinned-*-install.log.gz`。

支持路线和最小 family 命令已投影到 [中文指南](../../apps/www/src/content/docs/zh-cn/build/compiler-guide.md#受支持的固定源码编译器构建)、[英文指南](../../apps/www/src/content/docs/en/build/compiler-guide.md#supported-pinned-source-compiler-build) 及 [compiler README](../../packages/compiler/README.md#supported-source-pinned-consumption)。少量生成 family 可直接读取 pinned authored closure，无须构建全部 runtime 公共包。Runtime Adapter 消费仍拥有自己的公共包闭包，两条依赖责任分别记录。

完整 [CLI 回执](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint2-compiler/receipts/pinned-cli.json) 包含以下真实 plain-Node 步骤：

1. 缺父目录失败且不创建祖先；调用方创建父目录后成功。
2. 新目录 compile、只读 diff、已有 output collision 拒绝。
3. 消费者把生成模板 `section` 改为 `article`，普通目标构建和挂载实际观察到修改，原 provenance/map 保留。
4. watch 读取依赖编辑并发布新 immutable revision；非法源码失败保留最后成功版本；修复后发布新版本；历史目录不变。
5. watch 正常收到 SIGTERM，退出记录保留。

生成目标依赖的这批隔离验证使用**完整复制的已安装精确依赖 payload**，有无 symlink 检查和逐文件 hash；它们不是目标依赖的 registry 安装实测。编译器自身的 `npm ci` 则确实执行。没有覆盖生成文件、跳过冲突保护、改变父目录原子创建责任或发布 npm 包。

## 4. 普通四宿主消费者结果

| 验证 | 结果 | 实际表面 |
| --- | --- | --- |
| 三个完整家族 Button × React/Vue3/Vue2/WC | 12/12 PASS | 普通 TypeScript/helper 构建、真实目标框架在 Happy DOM 挂载、普通 children、click、disabled 拒绝、Root/child identity、终态清理 |
| 三组件/Context/编辑重建 | 四目标 PASS | 初次 React/Vue3/Vue2 成功，WC 在校正过时 runner 假设后完整通过；两次回执并存 |
| `observable-consumer.test.ts` | 13/13 PASS | 更新、事件/订阅顺序、callback/lifecycle 边界 |
| `text-selection-consumer.test.ts` | 20/20 PASS | 四宿主 selection、候选 callback、同步/queueMicrotask owner、显式 canonical、拒绝、detach/reconnect |
| `native-support-plan.test.ts` | 25/25 PASS | reached closure、strict native helper、依赖与初始化/清理负控 |
| `authored-transition-frontend.test.ts` | 4/4 PASS | 不改写作者 Transition，行为从输入定义导出 |
| `artifact-linking-consumer.test.ts` | 后续完整运行 12/12 PASS | ordinary imports、native wrappers/portals/slots、Context 身份、不同 feature closure 的 Anatomy/Focus/A11y、生命周期 |

三家族的 [原始成功回执](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint2-compiler/receipts/families-ordinary.json) 保留完整 source 文件清单。Vue2 的 JavaScript component body 使用既有 `checkJs:false` 路线，helper/TypeScript 通过严格检查；本轮**不声称修复原 strict checkJs 全量债务**。

初次严格构建暴露了 Props 非空证明、数组类型扩大和 WC unknown 投影问题，已修复实际 emitter。type-only 模块被擦除后允许无 executable mapping 的测试修正仍要求准确 `sourcesContent`，没有削弱可执行语句映射。初次 WC consumer 则错误假定默认 ShadowRoot 和自动 Props 重绘；runner 按当前 native light DOM 与 explicit update 定义校正，继续检查实际身份、更新和清理，不以旧假设要求产品改变。所有原失败回执保留。

补跑四个相关文件的组合命令曾出现 `Worker exited unexpectedly`：三个文件通过，链接文件没有完整终态；单独重跑链接文件也出现相同失败。React、Vue3 单例随后通过；加入只观察子进程退出的外部 preload 后，原链接文件完整 12/12、零 skip 通过，源码和断言未改。该成功运行仅记录 Vitest 正常 SIGTERM 收尾，无法反推出之前失败的 signal；原因保持 unknown，不声称已证实 OOM 或产品失败。原两次失败、观察脚本和最终成功日志全部保留，托管整合验收仍需其自己的精确来源。

## 5. 真实 Shenko 应用重放

最新 [Shenko 回执](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint2-compiler/receipts/shenko-application.json) 使用 `a165c40` 固定编译器，在独立临时工作树执行。冻结时先用 Git blob 逐字节校对 39 份 `web/src` 与 `web/prototypes` 作者文件属于原 consumer commit，再检查运行前后 hash 一致。

| 路线 | generate | 严格 tsc | 整个应用生产 build | 原应用测试 |
| --- | --- | --- | --- | --- |
| 原 source seam，仅更新上游 pin | PASS | PASS | PASS | 51/51 PASS |
| 安装后的固定 JavaScript compiler artifact | PASS | PASS | PASS | 51/51 PASS；一次身份断言按新 seam 迁移，行为测试保留 |

第二条路线先原样运行旧身份测试，得到 3 PASS / 1 FAIL，准确指出旧测试要求 `src/index.ts` 和原 Floating UI bundle 位置。之后仅把这一身份断言改成安装 artifact 路径、精确 compiler build/provenance 和已声明 TypeScript-only 闭包，再执行完整 51 项测试。原失败与 [临时消费者 patch](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint2-compiler/shenko/temporary-consumer.patch.gz) 都保留，不能称为“所有测试文件未改”。App/prototype 作者源码不变，未向下游仓库写入。

实际 consumer 锁定 React/React DOM `19.3.1`，编译器声明的 React target 是 `19.2.6`；后者在公开家族和通用消费者中独立验证，没有互相替代。原 runtime App 的三个公共入口实际公共构建闭包是 **42/47 包**，该数字是构建闭包，不是最小生成消费者的依赖或运行时 bundle 大小。

两条路线的整个生产 App 输出相同：JS 模块总计 `1,231,311 B`，逐模块 gzip 合计 `351,937 B`；进入 bundler 的生成源码 `112,132 B`，实际 retained generated bytes `43,850 B`。这些是整个真实 App 的构建结果；本轮未执行 Rust 服务、模型 session 和原生浏览器完整 Harness 旅程，也没有测量真实 App 初始化延迟。下游原 manifest 的 `generated_imports` 文本扫描结果原样保留；本记录依赖实际 bundler metafile 和 compiler dependency metadata 判断闭包，不把那份正则扫描视为 import oracle。

## 6. 实际入口的编译边界与 Verdant

[source-admission.json](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint2-compiler/receipts/source-admission.json) 读取冻结 Shenko 的真实 `ui-kit.tsx` imports。20 个现用 Adapter 导出中，Button、ScrollAreaThumb、CollapsibleTrigger、CollapsibleContent、SeparatorRoot、Toggle 六个入口通过当前 React source 准入。它们在冻结 App 中仍是 Adapter 消费；准入成功没有被记成已经迁移的 App。

| 仍不支持的实际入口 | 首个诊断 |
| --- | --- |
| TextareaRoot | PUI1004：top-level runtime binding 尚未属于 admitted static core declaration |
| ScrollAreaRoot | PUI1006：Context value 与 key 声明类型不匹配 |
| ScrollAreaViewport | PUI1006：array 不能把 semantic handle 变成普通 data |
| ScrollAreaScrollbar | PUI1024：Rule state 必须解析为 declared portable identity |
| CollapsibleRoot | PUI1020：未支持的 ordinary TypeReference |
| Drawer Root/Content/Mask/Header/Title/Description 六入口 | PUI1003：`asAxisInput` lowering 尚未实现 |
| ToggleGroupRoot | PUI1020：array elements 必须为 data |
| ToggleGroupItem | PUI1006：未声明的 prop `value` |
| InputRoot | PUI1006：outward payload 不符合声明的 data boundary |

此外 Shenko 两个自有 compiled source、Verdant 一个 GPUI source 均准入通过，所以这张冻结表是 **9 PASS + 14 UNSUPPORTED / 23 行**，不是三家族覆盖率、整库进度或原 `5/394` 的替换分母。Tree、DataTable、VirtualList、Resizable、Carousel 在这两份冻结的作者公开入口库存中未找到直接消费；静态聚合 bundle 中含库实现不算真实 App 使用。

Verdant 使用未改写的 `frontend/proto-ui/tools/build-proto-ui.mjs`：原 `--check` 对旧 pin/receipt 正确报漂移；临时上游 pin 更新到 `d53d9cb` 后，原 producer 生成 **20 份产物**，随后原 `--check` PASS。原源码 SHA-256 是 `9e1add6f335945f024db95ecdde0b65b960f84f0c12d69995fdbb2971e5e5e78`；compiler IR source digest 为 `5a3a0f8a41876b1c5bfff90116767a7c9c2e330bbf48c07205d9ac5fb27e2806`，二者表示不同对象。

目标是 `gpui-source-v1`、`gpuiDependency: workspace`，沿用实际 workspace GPUI `e5f2f9db75e97613232b5c1946333e61fa3828ab`。SDK `0.2.0` 的完整 content digest、生成 crate 身份和 20 文件 hash 在 [原 producer receipt](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint2-compiler/receipts/verdant-producer.json)。实际调用 Cargo 得到 `ENOENT`，因此 [Rust 编译为 UNTESTED](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint2-compiler/receipts/verdant-cargo.json)；桌面输入、焦点、AT、资源释放继续是各自平台验收条件。

## 7. 成本、原生浏览器与剩余条件

三个完整家族 Button 的 1→3 个 independently generated module 使用普通 production bundler，保留全部导出 API。表中的 bytes 均有源路径、helper hash、metafile 与独立 gzip 记录，见 [production-costs.json](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint2-compiler/receipts/families-production-costs.json)。

| Profile       | module 数 |    生成输入源码 B | retained production B |          gzip B |
| ------------- | --------: | ----------------: | --------------------: | --------------: |
| React         |     1 / 3 | 234,575 / 446,031 |      82,452 / 169,598 | 27,574 / 44,184 |
| Vue3          |     1 / 3 | 232,627 / 444,613 |      88,633 / 171,517 | 30,803 / 47,469 |
| Vue2          |     1 / 3 | 238,982 / 461,019 |      68,586 / 162,527 | 23,141 / 40,408 |
| Web Component |     1 / 3 | 236,531 / 428,735 |      71,441 / 150,659 | 23,870 / 38,842 |

Production React 在 Happy DOM 中实际创建 1/3 个 owner 的单次观察分别为初始化 `18.304 / 12.393 ms`、清理 `1.372 / 1.141 ms`，清理后 Root 数为零且 1/3 个 retained handle 都拒绝访问。该单次观察包含调度和冷暖差别，不作为速度比较、预算或分配计数。其他三个目标的本轮 production bundle 初始化成本未据此推断。

原 F6 的 `17.2 / 110.7 / 224.5 / 562.6 KiB` 是原 text-watch/counter-press/three-probe/Adapter 的 minified excluding-React 报告；当前表包含其所需目标依赖，源码和任务也不同，因此不能据此宣称重现或改写旧数字。原四个具名 profile 各自 `5/178 Base + 0/216 Shadcn = 5/394` 报告也完整保留，Vue2/GPUI 没有被倒填进旧测量。

新增 `sprint2-native.browser.test.ts` 包含四宿主 × 三家族 Button 的 12 条，以及四宿主 × 同步/queueMicrotask owner 的八条 TextControl。真实浏览器将检查 native pointer/key/focus、disabled、普通 children identity、Shadcn colorScheme、Brutalist reducedMotion、`5678` 顺序和 caret、拒绝、detach/reconnect、旧物理输入事件、isTrusted 与 listener 释放。每条独立留下首个失败、截图和 trace。它使用宿主标准 sandbox；本地启动权限不足没有通过关闭 sandbox 绕过。

静态装配生成了 16 个完整图、207 个 artifact，浏览器 bundle 为 `4,587,670 B`；执行时 source/input/artifact hash 都保留。原装配脚本返回 compact JSON 对象的 hash，但保存的是 pretty JSON 文件；提交前已改为返回实际文件字节 hash。旧日志和 manifest 不重写，实际执行脚本从 hash 核对恢复保存，具体差异见 [static-assembly-reconciliation.json](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint2-compiler/static-assembly-reconciliation.json)。这项记录仅证明静态装配，不证明原生测试通过，更不证明物理 OS IME 或辅助技术验收。

本批可以按实际结果回填的独立子条件包括：#1458 的固定消费路线、F11 旅程和 F13 契约；#732/#733 的完整三个家族四 Web 普通消费和当前组合结果；#1055 的当前真实 App 与 1→N 成本记录；#1145 的上述共享定义独立实现和反例；#1061 的当前 WC 普通 DOM 生命周期结果。完整父条件继续保留：全文件/全 profile 分类与原分母审计、全部独立 Adapter 差分与 mutation/seeds/shrinking、原 F6 同边界重现、Vue2 完整 strict checkJs、原生浏览器终态、GPUI/额外后端平台、SSR、AxisInput compiler 以及原私有来源恢复。不可用本轮子项通过来关闭这些完整父条件。
