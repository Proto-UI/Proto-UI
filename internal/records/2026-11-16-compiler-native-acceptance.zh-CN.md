# Compiler 原生浏览器续验与源码解析修复

本记录续接 [2026-11-15 的编译器语义修复记录](2026-11-15-compiler-semantic-repair.zh-CN.md)，限定于 PR #1462 当时明确缺失的十个真实浏览器文件、完整 workspace 类型检查，以及执行时发现的具体缺陷。它记录原始结果与后续纠正，不构成规范变更、正式 GitHub approval 或发布验收。

十个文件中的 **97 个原用例均获得了真实、保持 sandbox 的 Chromium 成功执行记录**，分布于三个明确记录的源码修订。执行暴露的两个过期夹具前提已经修复，原断言、超时和负控制保留。随后核对依赖解析时发现，第一次 Box 完整 `check:types` 虽然退出 0，网站类型程序却读取了另一个 checkout 的一份旧声明文件。因此该结果降为历史执行记录，**不作为最终同源完整类型验收**。当前源码已补上缺失的 TypeScript 路径，并在独立离线依赖下验证三个真实导入都解析到当前源文件；最终合并候选上的完整诊断和隔离浏览器复验由集成工作继续完成。

机器记录、逐项日志、原始失败、源码映射和可恢复压缩收据位于 [2026-11-16-compiler-native-acceptance.json](evidence/2026-11-16-compiler-native-acceptance.json)。

## 源码与实现来源

本轮从已发布的 `d6c45a48795054635fe859fe4d78e0159042268a` 开始。三个最初的本地 AI 提交与重新建立的当前用户提交逐个具有相同 Git tree，原始分支和提交对象保留；没有重写 published 历史。

| 改动 | 原本地提交 | 当前用户提交 | 相同内容 tree |
| --- | --- | --- | --- |
| owner recreation 负控制定位 | `e8e5fc92064d7f87bb656d445e9f1d38fc34ff4e` | `7e461c7d53e2c4ea0bddf964113bdf86111ace9c` | `3c0429e0720df540241097e90e8ba981d7e763a0` |
| 四处不可达 conditional 分支清理 | `840c99a489cc1e9d14c984286e81d9198cae07cb` | `427240712a5a48299971f50323fc7330187d6d01` | `da59b5ffc7501019bbb96c978d29b118b659a11e` |
| Focus 消费者实际 support 闭包 | `9f413b107c093f1ac25c6c5700f3410fe5ea8289` | `3283e486df1235085d159758fe9fa71a62e3725b` | `b999ebbb2f6a3eca623ae58118f00333aef51943` |

后续网站源码解析修复是 `4681c078efcbceb87c75368326311db6e4c6f2b2`，tree 为 `ef62640bbc42ed6c30cfb509466814e67cb91044`，仅向 `apps/www/tsconfig.json` 增加三行既有 root alias。该修复也适用于 #1460 的网站分支。

当前用户分支上的四个提交以本会话已核对的 `cyjin.yl` 身份署名，正文明确 AI-assisted 和实现来源。初始三个 AI 本地提交及其实际 author/committer 仍可追溯。这里不声称人类逐行审核，也不把本地测试视为正式审批。

## 为什么修改夹具

### owner recreation 负控制必须保留完整适配选项

原负控制用完整字符串查找旧的 `return __puiAdapt(prototype, options);`。语义修复已经在公开 factory 中加入 Props 更新策略，因此原字符串不存在。初次运行的失败顺序是：mutation 未注入、Vite 虚拟模块返回 404、原 ready 等待超时。那次 4/5 的结果保持失败，没有被改写为产品行为成功。

新夹具依据 TypeScript AST 找到顶层 `createComponent`、React namespace import 和唯一返回调用。它保留整个原返回表达式，包括 `autoUpdateOnPropsChange` 与用户 options，只在外层包装组件并通过 `key: String(props.present)` 制造 owner recreation。这样负控制改变的就是需要检测的 owner 生命周期，不能顺带删除更新策略。

修复后同一个原测试文件 5/5。三个原 mutation 都被原 oracle 检出：reset-state 首次差异在 detach，recreate-owner 在 attach，reattach-state-loss 在 reattach；每个预期差异之前的 trace prefix 仍相同，未修改的参考与候选路径继续通过。原始 control、mutant、comparison 和完整 trace 已打包。

### Focus 夹具必须验证实际发出的 support 图

Focus 首次运行在启动阶段拒绝 `.proto-ui/interaction/ownership-v2.ts`，22 项断言尚未执行。原因是夹具仍只允许旧 monolithic support 文件名，并要求每个 entry 都带齐旧 support 列表。实际编译器已经按可达能力输出版本化和内容寻址的 support。

夹具现在接收 emitted inventory 中合法的 `.proto-ui/**/*.ts`，继续要求 TypeScript source kind、路径不逃逸、entry 内无重复，以及多个消费者共享路径时内容相同。原 esbuild resolver 继续只从这份闭合 inventory 解析生成代码的相对依赖；除明确允许的 Floating UI 外，遗漏或逃逸依赖仍失败。这里验证实际编译结果的完整依赖，不再要求本不该到达的旧文件。

修复后 22/22 原用例执行成功。夹具原有的 `compiledPopoverConformance: false`、`cleanHeadAcceptance: false` 保留：这是 generic FocusScope / Focusable 的 Light DOM Chromium 消费者，不能替代正式 Popover 32 项或其他宿主验收。

## 原十个浏览器文件的执行结果

环境为 Box 普通用户、Node `v24.21.0`、Google Chrome `157.0.8103.38`，使用原浏览器 harness 与 sandbox。每次只运行一个文件，Vitest 一个 worker，Node heap 上限 2048 MiB。测试未添加 skip，未放宽 deadline、oracle 或 sandbox。

| 原文件（位于 `packages/compiler/test/`） | 成功项 | 实际执行源码 |
| ---------------------------------------- | -----: | ------------ |
| `control-label-native.browser.test.ts`   |  24/24 | `d6c45a487`  |
| `web-component-native.browser.test.ts`   |  12/12 | `d6c45a487`  |
| `browser-differential.test.ts`           |    3/3 | `d6c45a487`  |
| `browser-native-lifecycle.test.ts`       |    5/5 | `e8e5fc920`  |
| `browser-pointer-props.test.ts`          |    1/1 | `e8e5fc920`  |
| `browser-source-presentation.test.ts`    |    1/1 | `e8e5fc920`  |
| `browser-update-intent.test.ts`          |    2/2 | `e8e5fc920`  |
| `focus-scope-native.browser.test.ts`     |  22/22 | `9f413b107`  |
| `vue2-native-editor.browser.test.ts`     |    6/6 | `e8e5fc920`  |
| `browser-button-ssr.test.ts`             |  21/21 | `e8e5fc920`  |

合计是 97 个不同的原测试用例，不把失败后重跑再次相加，也不称为同一个 head 上从未中断的全绿运行。初次 native-lifecycle 的 4/5 和 Focus 的 22 pending 均保存在原始报告中。

这些原执行使用复用的依赖目录。后续检查在 229 份消费者 JSON 中发现的非 node_modules 外部 workspace 引用是 Core package manifest，其字节与候选完全相同；原 Vitest/Vite source resolver 指向当前 checkout。为消除复用目录带来的隐含输入，集成候选仍需使用独立依赖重验，不能将上表直接改标为后续合并源码的结果。

## 完整类型检查的纠正与实际根因

本地原命令再次以 exit 137 结束，99.77 秒，记录的最大 RSS 为 2,098,932 KiB。未得到 TypeScript diagnostics，未将中止推断为已证明的系统 OOM；随后停止本地重试。

Box 第一次串行运行原命令 `corepack pnpm@10.32.1 -s check:types`，heap 3072 MiB，211.55 秒退出 0，最大 RSS 2,771,252 KiB。Astro 报告 1,228 个文件、0 errors、0 warnings、30 hints；日志中两条重复 compiler-guide docs id 的警告同样保留。执行后源码 worktree 为空改动。

**检查干净的 worktree 不足以证明依赖来自同一源码。** 进一步读取实际 TypeScript 文件清单后，workspace 程序的 8,188 个文件没有外部 workspace 源码，网站程序的 6,288 个文件却包含另一 checkout 的 `packages/adapters/base/dist/host/instance-associations.d.ts`。该旧声明来自复用的 workspace 包链接，可能掩盖当前源码的缺失。因此第一次完整命令的 exit 0 不纳入最终同源验收。

根因是网站的 `compilerOptions.paths` 覆盖了 root 的整张路径表，遗漏 root 已增加的 `@proto.ui/adapter-base/internal/instance-associations` 映射。React、Vue、Vue2 adapter 均有真实的传递导入；在未构建包 dist 的独立 checkout 中，只依赖包 exports 会找不到该声明。

处理分两步，原始失败都保留：

1. 将 59 个复用的 node_modules 目录或链接移入专用备份位置，执行 `corepack pnpm@10.32.1 install --offline --frozen-lockfile --ignore-scripts`。557 个包全量来自现有缓存，1.90 秒完成，不修改 donor 源码或全局 dependency store。
2. 在网站路径表补上 root 同一条源码映射。fresh install 下，修复前对三个真实 adapter importer 执行 `ts.resolveModuleName` 均为 null；修复后均解析到当前 `packages/adapters/base/src/host/instance-associations.ts`。实际 workspace / website 文件清单分别为 8,188 / 6,288，外部 workspace 源码均为 0，且都包含当前 association 源文件。

上述 resolver 正负对照和 file discovery 证明的是源码选择。它们不能替代最终候选的完整诊断；第一次绿色命令及后来的污染发现同时归档，后续隔离执行须提供自己的结果。

## 不可达 conditional 分支清理

浏览器构建还提示四个 emitter 的重复 `case 'conditional'`。React、Vue3、Vue2、Qt 的第一个 value group 已包含 conditional 并直接调用统一的 `emitJavaScriptValue`，后方各两行 conditional 分支无法到达。本轮只删掉这些死分支。

删除前后分别用数字结果、嵌套条件、带可变捕获状态的 effectful 分支调用三个 authored prototype，生成四个目标，共 12 个输入/目标组合、66 个主输出及 support artifacts。完整输出对象与每个文件的字节/hash 一致。既有 `value-ir`、`control-label-lowering`、`exception-flow`、`relational-comparison` 四个文件的 267/267 项通过。该回归在原 cleanup 提交前的工作候选上执行，记录没有把它伪装成额外一轮 clean-head 全集。

## 证据恢复与边界

机器 JSON 的 `receiptRecovery.archives` 含原压缩包、SHA-256、字节数和每个成员的 hash；按 `base64` 解码后可验证并恢复 gzip tar。它包括原 Vitest 报告和日志、229 份原始 consumer/build/source-state JSON、所有 417 张 PNG 的索引、两张实际目检的代表截图、完整 TypeScript 文件清单、resolver 正负对照、条件输出等价证明以及 GitHub 原始只读快照。其余 415 张 PNG 的原文件仍在执行环境，记录没有将仅有索引的文件声称为已提交附件。

代表截图分别为 ControlLabel 激活后和 Focus ordinary scope 打开后。前者的可见 label 与 focus control 无明显裁切，后者的内外控件与 scope focus outline 可见；这两次 AI 目检不扩写为全部主题、设备、宿主或辅助技术验收。

以下状态保持分开：

- [x] 原先因 sandbox EPERM 而未执行的十个浏览器文件，在正常 sandbox Chromium 中实际执行；原 97 项均有成功收据。
- [x] 修复 owner mutation 和 Focus inventory 的过期测试前提，保留原行为断言及负控制。
- [x] 修复网站遗漏的同源 TypeScript alias，保存独立依赖下的 resolver red/green 与实际 file list。
- [x] 删除四处不可达 conditional 分支，保存输出等价和既有回归。
- [ ] 最终合并候选上的独立依赖完整 `check:types` 与浏览器复验；由集成工作继续，不能使用被 donor declaration 污染的历史绿色代替。
- [ ] Linux/macOS GPUI 远端执行、正式平台 DCO 和独立 review，以后续实际平台结果为准。

2026-11-16 02:33:49 UTC 的只读 GitHub 快照仍对应 `d6c45a487`：[CI run 43769246608](https://github.com/Proto-UI/Proto-UI/actions/runs/43769246608) 只有 lockstep-check、public_package_plan、test-plan、ci-config-audit 四个轻量 job 成功，其他 18 项包括 type-check、test-browser、compiler-gpui-consumers、rust、rust-macos 均 skipped；review 列表为空，[DCO](https://github.com/Proto-UI/Proto-UI/runs/132981201517) 为 action_required。原四个提交的精确 SHA、平台 author/committer、DCO output 与原作者 remediation 建议已保存。本分工没有触发远端 workflow、push、提交外部评论或执行 DCO remediation。
