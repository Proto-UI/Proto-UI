---
title: 'Compiler 指南'
desp: '0.2 release 边界与分别验证的私有 Compiler 实验'
description: '0.2 release 边界与分别验证的私有 Compiler 实验'
---

Proto UI 0.2 **没有**交付 Compiler 实现或 Compiler authoring workflow。0.2 release 中不存在 `@proto.ui/compiler` package、compiler entity type、official compiler profile、CLI compile command 或受支持的 compiler input/output artifact。

Release support 与仓库实验分开。下文的私有实验不改变 0.2 package、catalog、CLI 或 official-support 边界。

## 前置阅读

先读[第五章：翻译层](/zh-cn/whitepaper/5-translation-layer/)理解概念差异，读[核心规范](/zh-cn/specifications/core/)理解 portable syntax，再读 [Runtime 架构](/zh-cn/build/runtime-architecture/)理解当前执行路径。

## 0.2 实际交付的内容

| 层 | 当前职责 |
| --- | --- |
| `@proto.ui/core` | Prototype definition、setup/render syntax、template structure、module declaration、Rule authoring type |
| `@proto.ui/runtime` | 物化 Prototype、运行 Module、拥有 lifecycle/update flow、把 commit 交给 host |
| 官方 Adapter | 为 Web Component、React 与 Vue profile 翻译 Runtime output 和 semantic host capability |
| `@proto.ui/cli` | 初始化项目并生成 theme、token、style 与 component preset material；它不是 Prototype compiler |

当前 production route 是：

```text
Prototype TypeScript → Runtime execution → official Adapter → Web host
```

0.2 没有交付 Compiler 路径：

```text
portable analyzable input → [future Compiler] → host artifacts
```

0.2 不承诺第二条路径接受什么 source language、如何优化、生成哪些文件、是否包含 runtime 或采用什么 compatibility policy。

## 已经适用的约束

即使没有 Compiler package，已经编目的协议边界仍会约束任何未来 official translation：

- `K-PROTOTYPE-COMPOSITION-0001`：template 描述一个 Root Node，不嵌入另一个 Prototype definition。
- `C-TEMPLATE-0005`：v0 slot 是 anonymous、singular、parameterless。
- `C-TEMPLATE-0006`：official Adapter 或 Compiler 遇到 `PrototypeRef` template node 时必须拒绝，不能私自发明 composition。
- `C-RULE-0003`：Rule declaration 生成 serializable `RuleIR`，其中不保留 function、host reference、closure 或 live handle。
- `C-MODULE-DECLARATION-0001`：static typed Module declaration 在 Module construction 和潜在 host selection 之前可见。

这些是协议约束，不是 Compiler SPI；它们没有定义 parser、AST format、incremental build graph、code generator 或 deployment artifact。

## Static intent 与任意 function

有些作者形式比 callback 更能保留可分析 intent。Rule 是当前最清楚的例子：它把 condition 与 semantic intent 分开，并在内部编译为 `RuleIR` 供 Runtime evaluation。这不代表仓库已经有通用 Prototype compiler，也不意味着任意 callback body 都可以无损翻译。

当 declarative form 能准确表达行为时应优先使用，但不要围绕想象中的 Compiler 改写已经成立的 0.2 semantics。`internal/contracts/integration/portability-and-integration.md` 对长期方向有更多解释，但它属于 non-normative material。

## 0.2 没有受支持的 Compiler input/output

| 问题 | 0.2 回答 |
| --- | --- |
| `.proto.ts` 能否脱离 Runtime 编译？ | 没有受支持流程 |
| `TemplateChildren` 是稳定 compiler IR 吗？ | 不是；它是当前 Core/Runtime template data |
| `RuleIR` 是完整 Prototype IR 吗？ | 不是；它只覆盖 Rule |
| CLI 能否从 Prototype 生成 React/Vue/Custom Element component？ | 不能 |
| 是否支持 zero-runtime delivery？ | 不支持，仍属未来方向 |
| 是否有 Compiler conformance matrix？ | 没有 Compiler entity/profile |

如果未来 proposal 要改变这些回答，必须显式新增 catalog 与 API 工作，不能从文档推断。

## 仓库内的私有 Compiler 实验

`packages/compiler` 是已实现的**私有实验**，不是 official Compiler distribution。Manifest 保持 `private: true` 与 `protoUi.release.scan: false`。私有 Compiler CLI 与已发布的 `proto-ui` CLI 分开；publication、catalog admission 和长期 compatibility 需要各自的批准。

### 已实现 profile 与 compatibility

| 私有 profile | 实际运行的 target | Output dependency 边界 |
| --- | --- | --- |
| `react-runtime-v1` | React / React DOM 19.2.6 | 保留 Proto UI Core、Hooks 与 React Adapter；不独立于 Runtime |
| `react-dom-source-v1` | React / React DOM 19.2.6 | Target framework 加生成的 native helper；不依赖 Proto UI Runtime/Adapter |
| `vue-source-v1` | Vue 3.5.31 | Target framework 加生成的 native helper；不依赖 Proto UI Runtime/Adapter |
| `vue2-source-v1` | Vue 2.6.14 | Target framework 加生成的 native helper；不依赖 Proto UI Runtime/Adapter |
| `web-component-source-v1` | Custom Elements v1 | 生成的 native helper；不依赖 framework 或 Proto UI Runtime/Adapter |

私有 pipeline 还实现了 GPUI、Qt、Flutter source emitter 和四个 Web SSR profile。能够生成 source，不等于完整 native Adapter parity、浏览器 preview 支持或普遍 hydration compatibility。实际测试的 target version 不构成对其他版本的 compatibility 承诺。Restricted source admission、semantic IR version **5**、target profile identity 与生成 helper ABI **1** 是不同的私有 compatibility 维度；IR 和 helper 文件都不是 public plugin SPI。

Frontend 读取限定 root 内的完整 TypeScript source graph，不 import 或 evaluate 作者程序。准入范围包括 checked data、primitive/control-flow callback、static helper 和 authored hook、显式 update、named State 与 typed expose、Props/Context read/watch、单 Root template、serializable Rule condition/style intent，以及已声明的 native event/focus/accessibility 切片。Unsupported syntax、phase/capture authority、operation、target version 和缺失 host capability 会生成 diagnostic，不会静默 bridge。

Native template 将 child style 与 Root feedback 分开，并支持 singular anonymous slot。任意 attribute、`PrototypeRef`、multiple/named slot、native interaction group/portal，以及准入 vocabulary 之外的 interaction operation 仍不支持。Raw host event 是 opaque；可读取 raw Props snapshot，但任意 raw member 不会冒充 typed portable data。Setup style 的 `unUse` 与 Rule declaration disposer 仍是 setup-only；runtime 变化使用 Rule 和 `run.feedback.style.patch/suppress/clearPatch`。

State write 与 feedback projection 本身不会请求 template render。作者显式 update intent 与 host policy 分开：React/Vue 3 consumer 执行 authored update；Vue 2 的默认 props policy 与 Custom Element `setProps` 可以显式请求 semantic update。View detach 保留 instance state、exposed handle、Context 与 pending intent；terminal disposal 才关闭它们。Framework wrapper 使用 native ownership 组合 component，而不是在 template 内嵌入 Prototype node。

### 本地命令与 consumer ownership

在安装了 development dependencies 的仓库 root 执行，并选择未使用的 output directory：

```sh
node --import tsx packages/compiler/src/cli-entry.ts check packages/prototypes/base/src/button/button.proto.ts --root . --profile react-dom-source-v1
node --import tsx packages/compiler/src/cli-entry.ts compile packages/prototypes/base/src/button/button.proto.ts --root . --profile react-dom-source-v1 --output .cache/compiler-guide-button
node --import tsx packages/compiler/src/cli-entry.ts diff packages/prototypes/base/src/button/button.proto.ts --root . --profile react-dom-source-v1 --output .cache/compiler-guide-button --json
node --import tsx packages/compiler/src/cli-entry.ts watch packages/prototypes/base/src/button/button.proto.ts --root . --profile react-dom-source-v1 --output .cache/compiler-guide-watch --json
```

`inspect` 输出 checked IR；`explain` 输出 profile、requirements 与 dependencies。`--config` 显式选择 JSON，字段限于 `entry`、`root`、`export`、`output`、`profile`、`json`；配置路径相对配置文件，命令行路径相对 working directory。命令行覆盖配置；unknown/repeated flag 或 field 会失败。

Compilation 先规划 source、supporting helper、standard source map 与 hash/provenance manifest，再 create-only 发布。现有 consumer file 从不被覆盖。`diff` 只读，通过记录的 hash 识别 consumer modification。`watch` 发布 immutable `<output>/<session UUID>/revision-<N>`，输入被拒绝时保留最后成功 generation，不维护可变 latest pointer。Consumer edit 使用普通 target rebuild；原 compiler map 是历史证据，编辑后可能 stale，rebuild 才生成当前 executable-to-edited-source map。

### 已执行证据与成本测量

私有验证在四个 native profile 的独立物理 consumer 中编译、挂载三 component/Context assembly，type-check 生成的 TypeScript/helper，重建并执行 consumer-owned template edit，拒绝引入的 syntax error，并验证物理 dependency tree 与 artifact hash。Vue 2 的 JavaScript component body 不执行 `checkJs`。另有 offline private-package rehearsal，在普通 Node 中执行打包 Compiler 的 JavaScript API，并记录 tarball integrity、实际 bundled compile-time input、dependency、BOM 和 license；这不等于 official package 或 public declaration-file release。

真实 Chromium 分别核对原 React Adapter、runtime-backed output 与 native React output 的 explicit update/detach/reattach，以及有限 Rule/style/AX/input 程序。Missing-update 与 duplicate-activation mutant 被实际观察拒绝。独立的生成 callback 真实错误堆栈通过 standard executable-to-generated、generated-to-author 两段 map 精确定位；不宣称自动 map composition。

重放独立 native consumer 测量：

```sh
node --import tsx scripts/compiler/native-consumer-smoke.mjs
```

每次执行在输出的 evidence directory 中保留 `summary.json`、`timing.json`、`costs.json`、runtime trace、diagnostic 与 dependency integrity。测量包括 cold/hot/changed compilation、whole-process peak RSS 与 coarse memory snapshot、生成/supporting source 和 dependency payload byte、真实 framework initialization/update/teardown、retained handle identity，以及观察到的 instance/view-epoch/Root count。**没有**测量 exact allocation、garbage collection、native-browser layout latency 或相对 Adapter 的速度。Happy DOM consumer 是单边证据；有限 Chromium 程序不构成普遍等价、SSR/hydration 支持或编译产物必然更快/更小的承诺。

### 浏览器内 WebAssembly 执行

私有 `@proto.ui/compiler/browser` API 在 caller-owned module Worker 中，通过 **QuickJS WebAssembly 执行同一份 canonical compiler**。这是 WASM-hosted JavaScript compiler execution，不是把 TypeScript Compiler ahead-of-time 改写成 WASM。只有经过 digest 校验的可信 compiler bundle 会执行；作者 source 始终只是 AST input。Host 绑定 UTF-8 SHA-256，virtual source path 保留正常 POSIX 语义；不提供浏览器 filesystem，也不下载作者 import 的 module。

在仓库 root 构建可信 bundle，以及包含 TypeScript version / digest 的 manifest：

```sh
node scripts/compiler/build-browser.mjs
```

Vite consumer 将生成的 `compiler.js` 作为 text、`build.json` 作为 data 加载，再调用 `createBrowserCompilerClient(bundle, build)`。Request 是 `{ format: 1, revision, source, options: { fileName, profile, files?, exportName?, componentName? } }`；`files` 是 virtual path 到 source text 的 closed map。必须显式选择 target，不会静默替换。成功 response 包含 canonical generated source、supporting file、dependency version、provenance、source map，以及 source identity、compiler-bundle identity 和 request revision。它**不负责挂载或执行生成的 target code**。

Source rejection 返回 `phase: 'compile'` 和正常 diagnostic code/category/file/span；host rejection 返回独立的 `phase: 'host'`。Worker initialization / transport error 会 reject client promise。重叠编辑只保留一个 running request 和最新一个 queued request；被取代的 request 以 `AbortError` 拒绝。导航或 owner terminal teardown 时调用 `dispose()`；它终止 Worker，并拒绝尚未完成的工作。

配置边界是 UTF-8 serialized input 256 KiB、WASM heap 128 MiB、VM stack 2 MiB、output 8,388,608 字符、initialization 30 秒、VM compilation 5 秒、Worker response 10 秒。这些是 resource / failure boundary，不是已经准入的即时预览性能预算，也不代表 whole-browser memory 测量。

真实 Chromium module Worker 已通过 WASM 编译仓库的 canonical Base Button；记录的 artifact 与普通 Node compilation、直接 WASM execution 一致。另行比较了四个 Web source emitter、Unicode source/graph identity、source-located rejection 和 graph insertion order。一次本地观察中，初始化 2.83 秒、编译 116 毫秒；可信 compiler JavaScript 是 5,035,825 uncompressed UTF-8 byte，QuickJS WASM asset 是 503,134 byte。单次样本不构成 cold/warm distribution、mobile 支持或 startup budget。永久 WASM regression 还在**可信 entry** 内注入非终止调用，验证 interruption、后续 canonical compilation 和 terminal disposal；不会 evaluate 作者 input。

### 全站 Demo 迁移清单

重建 source-bound 清单：

```sh
node --import tsx scripts/compiler/website-demo-inventory.mjs
```

`internal/compiler/website-demo-migrations.json` 记录每个含 Demo 的 MDX 文档页面、homepage/library/Matrix 展开、demo declaration、registration binding 和 canonical prototype definition。它复用 Website 的 manifest-exported source resolver，保存实际 canonical Node admission diagnostic，不用 Adapter 替代 compiler。当前清单覆盖 **120 个页面、65 个 demo declaration、145 个 prototype definition**；选择的 Web Component source profile 中，3 个 definition 准入，142 个被现有 source admission 拒绝。Registration/source 地址均已解析；不能因编译失败就把页面排除。

所有迁移行仍是 **not migrated**。这份清单和浏览器 Compiler API 不会关闭 [#817](https://github.com/Proto-UI/Proto-UI/issues/817)：canonical-source admission 缺口、supported-target RuntimeBox mount、可选编辑、同 revision 的 diagnostic/preview、失败 rollback、lifecycle/security boundary 和逐页浏览器证据仍是明确义务。现有 RuntimeBox frame ownership 保持在 [#786](https://github.com/Proto-UI/Proto-UI/issues/786) / [#777](https://github.com/Proto-UI/Proto-UI/pull/777)。WASM Compiler 本身不 sandbox 生成的 preview code。

## 贡献边界

Compiler proposal 从 Agent-led governed research 开始。research、candidate entity、实现探针与 executable evidence 可以立即推进；只有现有 authority 未决定的产品选择才形成 attended decision。proposal 至少说明：

1. portable source subset，以及 unsupported construct 如何失败；
2. output host 与 generated artifact ownership；
3. 如何与现有 Contract criteria 保持 semantic parity；
4. lifecycle、capability 与 component composition 如何处理；
5. versioned identity 与 executable conformance model；
6. 如何迁移并与 Runtime/Adapter path 共存。

不要把 `packages/modules/rule/src/compile.ts`、CLI style generation 或 bundler transform 当成缺失的 Compiler architecture 并直接发起实现 PR；它们是由其他层拥有的局部实现。

## 验证当前边界

以下检查覆盖今天已经存在的 portable template 与 analyzable Rule 约束：

```sh
corepack pnpm@10.32.1 vitest run packages/core/test/contract/template.normalize.contract.test.ts
corepack pnpm@10.32.1 vitest run packages/adapters/web-component/test/contract/template.no-prototype-composition.v0.contract.test.ts
corepack pnpm@10.32.1 vitest run packages/runtime/test/contract/rule.props-style.smoke.v0.contract.test.ts
corepack pnpm@10.32.1 check:types
```

希望现在就能交付的工作，请继续阅读 [Runtime 架构](/zh-cn/build/runtime-architecture/)、[模块与扩展架构](/zh-cn/build/module-extension-architecture/)或边界明确的 [Adapter 指南](/zh-cn/build/adapter-guide/)；未来顺序见[里程碑](/zh-cn/project/roadmap/)。
