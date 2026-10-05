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

Registry 还登记了 GPUI、Qt、Flutter source profile 和四个 Web SSR profile。GPUI artifact generation 不等于完整 native Adapter parity 或浏览器 preview 支持；Qt、Flutter 与四个 SSR profile 当前仍按未实现拒绝。实际测试的 target version 不构成对其他版本的 compatibility 承诺。Restricted source admission、semantic IR version **5**、target profile identity 与生成 helper ABI **1** 是不同的私有 compatibility 维度；IR 和 helper 文件都不是 public plugin SPI。

Frontend 读取限定 root 内的完整 TypeScript source graph，不 import 或 evaluate 作者程序。准入范围包括 checked data、primitive/control-flow callback、static helper 和 authored hook、显式 update、named State 与 typed expose、Props/Context read/watch、单 Root template、serializable Rule condition/style intent，以及已声明的 native event/focus/accessibility 切片。Unsupported syntax、phase/capture authority、operation、target version 和缺失 host capability 会生成 diagnostic，不会静默 bridge。

Static Module requirements 可以使用 checked declaration array、checked array spread，或静态解析到已准入 `definePrototype`/`defineAsHook` descriptor 的 `modules` snapshot，包括 local import/re-export alias 与字面 `['modules']` 访问。只解码已准入的 declaration factory；不会执行作者 input 中的 factory、getter 或 computed lookup。Cycle、初始化前读取和重复 declaration ID 会被拒绝。Pre-render Root selection 仅由所选 caller Prototype 的显式 declaration 决定；setup 中调用 authored hook 不会隐式提升它的 requirements。该冻结复用准入与 physical-Root 修复不代表所有 canonical source、每种 Module projection 或完整 target/Adapter parity 已成立。

Native template 将 child style 与 Root feedback 分开，并支持 singular anonymous slot。任意 attribute、`PrototypeRef`、multiple/named slot、native interaction group/portal，以及准入 vocabulary 之外的 interaction operation 仍不支持。Raw host event 是 opaque；可读取 raw Props snapshot，但任意 raw member 不会冒充 typed portable data。Setup style 的 `unUse` 与 Rule declaration disposer 仍是 setup-only；runtime 变化使用 Rule 和 `run.feedback.style.patch/suppress/clearPatch`。

State write 与 feedback projection 本身不会请求 template render。作者显式 update intent 与 host policy 分开：React/Vue 3 consumer 执行 authored update；Vue 2 的默认 props policy 与 Custom Element `setProps` 可以显式请求 semantic update。View detach 保留 instance state、exposed handle、Context 与 pending intent；terminal disposal 才关闭它们。Framework wrapper 使用 native ownership 组合 component，而不是在 template 内嵌入 Prototype node。

四个 Web source profile 将 ExposedState Host projection 降低为独立 supporting helper。命名使用 State semantic，缺失时回退到 exposure key，并复用现有 Module 的 official alias 与 normalization。Boolean `true` 写空 attribute、`false` 移除；string/enum 写 attribute，discrete number 写 attribute 与 CSS variable，continuous number 默认只写 CSS variable。JavaScript compile API 接受现有 `exposeStateWebMode` 的 `allowStringVar` 与 `allowContinuousAttr` flag。这是 Web extension，不是对 GPUI、Qt、Flutter 的 DOM projection 承诺。

Projection subscription 属于可投影的 view epoch，host/commit 变化时重放，并覆盖不同的 presentation mirror。Detach 和 terminal disposal 使排队 write 失效；detach 不销毁保留的上游 State。Readonly Focus 与 Scroll State 保留 semantic name 和 numeric kind。旧 DOM artifact 的清除或恢复、collision ownership 仍是 governing contract 的未决项，helper 不自行发明这些 policy。

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

私有 `@proto.ui/compiler/browser` API 在 caller-owned module Worker 中，通过 **QuickJS WebAssembly 执行同一份 canonical compiler**。这是 WASM-hosted JavaScript compiler execution，不是把 TypeScript Compiler ahead-of-time 改写成 WASM。调用者必须独立信任传入的 compiler bundle；作者 source 始终只是 AST input，不会被 evaluate。Host 绑定 UTF-8 SHA-256，virtual source path 保留正常 POSIX 语义；不提供浏览器 filesystem，也不下载作者 import 的 module。

在仓库 root 构建可信 bundle，以及包含 TypeScript version / digest 的 manifest：

```sh
node scripts/compiler/build-browser.mjs
```

Vite consumer 将生成的 `compiler.js` 作为 text、`build.json` 作为 data 加载，再调用 `createBrowserCompilerClient(bundle, build)`。Request 是 `{ format: 1, revision, source, options: { fileName, profile, files?, exportName?, componentName?, exposeStateWebMode? } }`；`files` 是 virtual path 到 source text 的 closed map。必须显式选择 target，不会静默替换。可选 Web projection mode 仅接受上述两个 boolean flag；malformed mode 在 Host 边界拒绝。成功 response 包含 canonical generated source、supporting file、dependency version、provenance、source map，以及 source identity、compiler-bundle identity 和 request revision。它**不负责挂载或执行生成的 target code**。

可信 bundle 使用 Vite `?raw` import，或未经 transform 的 public asset。直接 fetch Vite transform 后的 JavaScript 可能附带 source map，改变字节；build-identity 校验会正确拒绝该 response。不能通过替换 manifest digest 接受变更后的 delivery。

Digest 比较只检查 **bundle/manifest consistency，不认证 authenticity**。两者都由 caller 提供，同时修改两者就能执行变更后的 program。从同一个可变位置获取 `compiler.js` 和 `build.json` 不构成独立 trust anchor；调用 API 前，应用应通过可信 deployment configuration 或已验证的 supply chain 认证或 pin compiler delivery。此 API 不提供独立 signature verifier 或 trust root；resource limit 也不意味着可以安全接受任意 compiler program。受控测试会修改 compiler program，并为可信 entry 的 fault injection 重算 manifest；这些测试演示了仅检查 consistency 的边界。

Source rejection 返回 `phase: 'compile'` 和正常 diagnostic code/category/file/span；host rejection 返回独立的 `phase: 'host'`。准入在可信 entry 内校验序列化后的 request，先于 compilation 的默认值处理；因继承、nonenumerability 或 `toJSON` 丢失的 target 字段会被拒绝。Worker construction / initialization / transport error 都会 reject client promise。重叠编辑只保留一个 running request 和最新一个 queued request；被取代的 request 以 `AbortError` 拒绝。每次调用绑定提交时的 revision 和 source graph（包括排队 request 的 nested `files`），不受调用者后续 mutation 影响。导航或 owner terminal teardown 时调用 `dispose()`；它终止 Worker，并拒绝尚未完成的工作。

配置边界是 UTF-8 serialized input 256 KiB、WASM heap 128 MiB、VM stack 2 MiB、output 8,388,608 字符、initialization 30 秒、VM compilation 5 秒、Worker response 10 秒。这些是 resource / failure boundary，不是已经准入的即时预览性能预算，也不代表 whole-browser memory 测量。

真实 Chromium module Worker 已通过 WASM 编译仓库的 canonical Base Button；记录的 artifact 与普通 Node compilation、直接 WASM execution 一致。另行比较了四个 Web source emitter、Unicode source/graph identity、source-located rejection 和 graph insertion order。一次本地观察中，初始化 2.83 秒、编译 116 毫秒；可信 compiler JavaScript 是 5,035,825 uncompressed UTF-8 byte，QuickJS WASM asset 是 503,134 byte。单次样本不构成 cold/warm distribution、mobile 支持或 startup budget。永久 WASM regression 还在**可信 entry** 内注入非终止调用，验证 interruption、后续 canonical compilation 和 terminal disposal；不会 evaluate 作者 input。

审查修复将真实 Chromium Worker result 与 Node 对照，覆盖十二个已登记 profile identity，并另行验证 Unicode GPUI field 和 embedded-NUL source。GPUI Rust artifact（包括 Cargo package identity）已在不提供 Node `Buffer` global 的情况下保持一致；SHA-256 bridge 保留 NUL separator。Qt、Flutter 与四个 SSR profile 仍返回 canonical unsupported-target diagnostic。这些是 compiler-artifact 对照，不是 native widget 执行、generated-preview sandbox 或新的 target admission。Source-bound 修复 receipt 记录在 `internal/compiler/browser-wasm-evidence.json`；上面的早期时间样本保留为历史观察。

ExposedState 修复另行将四个原 Web Adapter 与生成的 native consumer 实际并排挂载：18 个 scalar/mirror surface 验证不触发 structural render 的 write、真实 detach 和保留 State 的 remount；8 个 readonly surface 验证实际 focus/blur 与 continuous Scroll projection。真实 WASM Worker 对照覆盖 23 个成功的完整 output、GPUI 的 Web-only mode 拒绝、6 个未实现 profile 拒绝，以及 4 个 malformed mode request。早期失败观察和修正后的 driver 错误仍保留。该 revision 观察到的 Root 与 Scroll marker 缺口由下面的后续修复处理；这些有限观察不代表完整 Adapter parity 或 RuntimeBox migration。

Static Module declaration 在 render 前选择 physical Root，但 image/text property 只在调用对应 hook 后激活。未激活 declaration 不能覆盖 consumer-owned alternative text、image fit 或 editing value。生成的 Custom Element 只给 connected canonical host 写 `data-pui-root`，不标记 template child 或 physical image/input part；constructor 不添加 host attribute。激活的 Scroll surface 投影 negotiated `data-pui-scroll-projection` marker、实测 position/visible-ratio fact 与 view-scoped readiness；detach 将 projection 退回 `unresolved`，remount 重新协商 live Root。TextControl 独占 client editing value，不再有 Vue 2 / Vue 3 VNode 的 competing writer。Explicit update 保留 composing value，composition end 恢复 controlled value；server serialization 保留独立的 value 路径。

后续修复在真实浏览器 WASM Worker 中，将七个受控 Prototype fixture 编译到四个 Web source profile：28 份完整 output 与 Node 一致，再将未经改写的 emitted module 与原 Adapter 并排挂载为 56 个真实 surface。证据覆盖 inactive/active image/input declaration、controlled editing、ordered template children、实测 Scroll request、detach/remount 与 terminal cleanup。Composition 输入是 Chromium 中的 synthetic event，不是 OS/IME 自动化。共用 stylesheet 只提供 geometry，不注入 Module value、Root marker、overflow policy 或 Scroll fact。完整原始 attribute、markup 与仍存在的 Custom Element presentation 差异保留在 `internal/compiler/browser-wasm-evidence.json`。这不等于 native widget、SSR/hydration profile、全部 canonical Demo、RuntimeBox mount 或 editor/security boundary 的准入。

另一个 Root 审查修复在 physical detach 时交付 Scroll 的 `system` → `unresolved` notification，包括 authored watcher；不放宽 input 或 terminal-owner guard。四组原/generated Web consumer 验证 detach 与 retained-owner remount，七份完整 browser Worker output 与 Node 一致。Custom Element 仅在 validated port 接受 owner 后取得 Root marker，dispose 时恢复原值，但不覆盖 consumer 的后续替换。Required-Context 初始化失败和两种 shared-port hydration mismatch 均不留下 generated Root marker 或 owner；挂入真实 provider 后可创建新的 client owner。原 marker baseline 与后续 consumer write 在 disposal 后保留。Port 检查只借助未准入的 private serializer 复现共用 client helper，不构成 SSR/hydration 准入。Raw event reason、terminal notification 差异，以及原 Web Component Adapter 初始化失败后的 marker/recovery 缺口仍记录为未完成项。Dispose 后十四个 reproduction container 全空，八个 retained getter 拒绝调用；四个 intentional initialization error 单独保留，不计作 unexpected error。

Canonical scalar Props 现在通过 source admission、checked-IR validation 与五个已实现 source target 保持作者契约。String enum 的 options 保留为 descriptor metadata，包括合法的 empty-string option；后续 superset declaration 不使早先注册的 watcher 失效。Descriptor/default validation 与重复 declaration merge 保持 atomic：保留最先确立的 default 和更严格的 empty policy，narrowing 拒绝，widening diagnostic 只在 merge 成功后发出。Missing key 使用最新 defaults，不复用旧 host value。Provided empty 或 invalid value 按声明 policy 与各 key 独立的 previous-valid history 回退；accepted empty 不抹掉该 history。

Source-bound Props run 在真实浏览器 WASM Worker 中，将三个受控 fixture 与 canonical Base Scrollbar/Tabs List graph 编译到四个 Web profile 和 GPUI：**25 份完整 output 与 Node 一致**。四组原/generated Web consumer 将受控 fixture 与 canonical Scrollbar 实际挂载为 **32 个 surface / 68 组 step observation**；default host update 与显式 public update 后的 desired value 和 change payload 均一致。原 Vue 3 / Vue 2 修复先复现 lost queued commit：旧 commit completion 可能同步安装新 signal，因此 Adapter 必须在 callback 前仅捕获并清空自己持有的 signal。修复不改变 host auto-update policy，关闭 auto-update 的 conformance 仍通过。Dispose 后 32 个 container 全空，没有 captured error。早先的 stale-Vue observation 与错误 driver assumption 保留在 evidence ledger，不重写为通过。

真实 GPUI headless-window consumer 另行通过 creation、physical commit、`set_props` 与 terminal disposal 验证 provided-empty、missing 和 invalid canonical Props。Web 修复后，生成 Rust 与 SDK source 仍逐字节一致；不据此声称重复 native build 或 native enum/range-widget 广度。Canonical Tabs List graph 已编译，但所需真实 Tabs provider preview 尚未执行。这些观察不构成完整 raw-DOM/terminal-event Adapter parity、完整 native target、SSR/hydration 准入，也不是 RuntimeBox/editor/security boundary 的迁移。

### 全站 Demo 迁移清单

重建 source-bound 清单：

```sh
node --import tsx scripts/compiler/website-demo-inventory.mjs
```

`internal/compiler/website-demo-migrations.json` 记录每个含 Demo 的 MDX 文档页面、homepage/library/Matrix 展开、demo declaration、registration binding 和 canonical prototype definition。它追踪 import 的 Astro wrapper（包括两个 `UiLibraryGallery` mount），并保留底层 preview 的 file/line 地址。Literal equality choice 用于解析有限的 template-generated demo ID，不执行作者 script；无法解析的动态 mount attribute 保留为明确的行级义务。它复用 Website 的 manifest-exported source resolver，保存实际 canonical Node admission diagnostic，不用 Adapter 替代 compiler。当前清单覆盖 **122 个页面、65 个 demo declaration、145 个 prototype definition**；选择的 Web Component source profile 中，5 个 definition 准入，140 个被现有 source admission 拒绝。Canonical Base Scrollbar 与 Tabs List 加入此前三个准入 definition；这不是 page migration。Registration/source 地址均已解析；不能因编译失败就把页面排除。

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
