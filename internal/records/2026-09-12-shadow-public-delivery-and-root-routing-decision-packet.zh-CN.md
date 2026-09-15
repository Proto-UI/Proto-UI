# Shadow public delivery 与 Root routing 决策包

日期：2026-09-12。状态：maintainer decision packet，non-normative。本文承接 `D-WEB-COMPONENT-SHADOW-PROFILE-0001` 的 A1、`D-WEB-COMPONENT-SHADOW-STYLE-0001` 的 B1 与 C1，决定下一阶段是先建立 role-bearing Root effect path、先公布 artifact delivery，还是直接合并为一个 public split vertical slice。本文不修改规范实体、不公开 API、不提升 draft lifecycle，也不批准 push、merge、publish 或 release。

## C1 已完成结果

本轮形成五个独立 checkpoint：

1. `ed25bab4`：在 `D-WEB-COMPONENT-SHADOW-STYLE-0001` 与 `T-WEB-COMPONENT-SHADOW-STYLE-0001` 中治理 private meta composition、atomic resources 与 owner-generation lifetime；
2. `adccdcd2`：增加 private `createShadowSplitMetaGetter()`，令 retained environment source 独占 `colorScheme`，其它 key 原样委托既有 getter；
3. `bc5b9892`：增加 private `createShadowSplitResources()`，同步组合 environment、artifact stylesheet 与 inner surface，并提供反向 rollback/dispose；
4. `0eda9bdb`：增加 owner-generation lifecycle harness，证明 first connection ordering、view epoch 与同步 DOM move retention、terminal cleanup 与 reconnect renewal；
5. `9e1499d2`：把三个 C1 implementation path 与 passing status 回写 catalog，同时保持 public single-truth activation 为 planned。

当前 Web Component suite 通过 69 files / 245 tests，`@proto.ui/adapter-web-component` package build、`check:types:workspace`、spec relations、catalog evidence integrity、workspace/Agent projections 与 prototype catalog 均通过。现有 `shadow` omitted/`false` 与 `shadow: true` 仍无 object form、marker、stylesheet、inner surface 或 package-root export 变化。

尚未获得的证据保持不变：完整 repository `test`、真实浏览器 computed style/paint、strict CSP journey、consumer bundler/SSR integration 与 public object compatibility。

## 当前可证事实

### 1. Artifact ABI 已有 producer 与 private consumer，但没有 delivery contract

`packages/cli/src/services/proto-style-css.ts` 已能从同一 token closure 生成 frozen `proto-ui.shadow-style` v1 artifact；`packages/adapters/web-component/src/shadow-style-artifact.ts` 与 C1 coordinator 已能验证和安装该 value。当前缺少的是 consumer 如何稳定取得这个 value：CLI command、preset output、package export 与 facade 都没有公开它。

已有 document style setup 同时生成：

- `proto-ui-tokens.generated.css`；
- `<preset>-theme.css`；
- 汇总二者的 `proto-ui-style.css`。

Split profile 仍需要 document CSS 处理 host 上的 placement token，并需要 Shadow artifact 处理 inner surface token。因此 Shadow output 应与 document token CSS 从同一 closure 一起生成，而不是成为一条互不校验的手工 CSS 路径。

### 2. Generated ESM module 比 JSON 或 runtime builder 更接近当前边界

候选 delivery 方案的主要差异如下：

| 方案 | 优点 | 主要问题 |
| --- | --- | --- |
| generated ESM `.js` + `.d.ts` companion | JS/TS consumer 都可静态 import；artifact 是无 DOM side effect 的 plain immutable value；bundler 可共享一次 module；SSR 可读取但不安装 DOM resource | CLI 需要新增成对输出、escaping/type fixture 与 consumer build evidence |
| generated `.ts` module | shape 与 literal type 最直接 | 纯 JS consumer 与不编译 dependency/source TS 的工具链不稳定 |
| JSON artifact | 静态、易缓存、语言中立 | JSON import attributes/assertions、TypeScript config 与 bundler 行为不一致；使用体验较差 |
| package-root runtime builder | 调用直接，不需要生成 JS file | 把 token closure 与 CSS generation带入 app runtime/build bundle；扩大 CLI/service responsibility，SSR 与 tree-shaking 成本更高 |
| facade/config injection | consumer 几乎不见 artifact | 把 component facade regeneration、style closure 与 Adapter config 耦合，难以单独共享和缓存 |
| raw CSS import + caller 手工包装 | 文件最少 | 丢失 generator/ABI 关系，允许 kind/version/environment 与 CSS 内容漂移 |

当前推荐 generated ESM `.js` + `.d.ts` companion。CLI 的 preset 与 `tokens` 路径应从同一 token closure 同时写 document CSS 与 Shadow module；生成的 JavaScript 用字符串 literal 安全编码 CSS，并导出一个 frozen v1 artifact。它不在浏览器运行 renderer，也不要求 `@proto.ui/cli` 成为应用依赖。

候选 consumer 形态仅用于说明 information path，字段名仍需在 public object checkpoint 固定：

```ts
import { protoShadowStyleArtifact } from './styles/proto-ui-shadow-style.generated.js';

AdaptToWebComponent(proto, {
  shadow: {
    mode: 'open',
    presentation: 'split',
    styleArtifact: protoShadowStyleArtifact,
  },
});
```

MVP 继续使用 owner `<style>` carrier，并明确“不保证 strict CSP”；generated ESM 本身不能解决 `style-src` nonce 或 constructable stylesheet policy。

### 3. Root routing 不是简单的 surface/placement 字符串分桶

Root-only collector 当前对三套官方 Prototype 库给出 267 个唯一 token：

| role         | unique token | occurrence | 含该 role 的 source file |
| ------------ | -----------: | ---------: | -----------------------: |
| `surface`    |          190 |        934 |                       73 |
| `placement`  |           55 |        138 |                       52 |
| `composite`  |            4 |         55 |                       55 |
| `unresolved` |           18 |         99 |                       50 |

共有 82 个 source file 含 Root style；这里的 file 是分析单位，不等同于公共 Prototype identity。若 split eligibility 同时拒绝 composite 与 unresolved，只剩 12 个 file；若先治理四个实际 composite token（`block`、`flex`、`grid`、`inline-flex`），仍只有 32 个 file 可进入，50 个 file 继续被 unresolved 用法阻塞。

此外，canonical `placement` 内部至少有两种 physical plan：

- margin、order/self、flex item sizing、position/inset/z-index 只应影响 host 的外部参与；
- width/height/min/max/size/aspect 等 geometry 必须令 host 参与父布局，同时让 inner surface 与 host 的可见盒保持一致，通常需要 mirror 或明确的 fill bridge。

`composite` 也需要 token-specific split plan。例如 collapsed `flex` 同时表达 block-level outer participation 与 flex inner formatting；split target 不能只把原 token放在 host 或 inner surface。`inline-flex` 需要 inline-level host 与 flex inner formatting。该 decomposition 必须被治理，不能由 Adapter 按当前 DOM 便利临时猜测。

### 4. 在 Adapter 末端重新分类会丢失 Rule role provenance

当前 `StyleHandle` 与 `EffectsPort` 只携带 string token。Rule Web lowering 会把 author token 变为 `data-[state]:...` 等包含 `:` 的 physical token；当前 classifier 明确不解析 role qualifier/variant，并会把未知字符串作为 surface fallback。因而在 `createWebEffectsPort()` 最末端对字符串调用 v0 classifier，会把例如 state-dependent placement transform 错误投到 inner surface。

安全的 information path 必须在 author-side Root token 尚未被 Web lowering 改写时解析 canonical role，并让 provenance 穿过 merge、Rule activation/deactivation、runtime patch/suppress、view replay 与 physical variant lowering。Template-node style 继续使用现有 `TemplateStyleHandle` 路径，不自动获得 Root application role。

推荐的概念路径为：

```text
Root feedback.style author token
  -> Core-owned canonical/default role resolution
  -> role-bearing Root style effect entry
  -> semantic merge + Rule/runtime updates preserve role
  -> Web lowering preserves role while rewriting selector token
  -> WC split translator
       surface --------------------------> inner surface
       placement/external ---------------> host
       placement/geometry ---------------> host + governed surface bridge
       composite ------------------------> governed host/surface decomposition
       unresolved -----------------------> fail closed before mutation
```

Collapsed React、Vue、Vue 2、Light DOM WC 与 direct Shadow WC 仍把这些 application roles 合并到同一现有 target，输出顺序、merge 与 physical token 必须保持兼容。Role provenance 是 Root effect information，不是 raw DOM target access，也不要求 Prototype author 立即学习新语法。

### 5. `placement` 可以先留在 Root style channel，不必现在新增 Module

当前证据足以确认 split WC 的 host 承担 component 对父布局的参与，而 inner surface 承担内部可见表面；但尚不足以证明所有 Adapter、portal 与 host-owned widget 都需要一个新的通用 `placementTarget` API。

下一阶段可以先把 `placement` 保留为 Root style application role，并在 split WC profile 中明确映射到 host；其它 profile 折叠处理。这样不会把 positioning、overlay layering、visibility、hit participation 或 scroll ownership并入 style。是否把 placement 提升为第三个通用 host projection role，仍留给出现第二种真实 split host projection 后的独立决策。

### 6. Unresolved 不能用默认 surface 掩盖

Unknown extension token 的 `surface` fallback 与“已知 unresolved token”不同。前者保留 compatibility provenance；后者已有冲突证据：

- transform 同时用于 Dialog viewport placement、Button/Toggle pressed surface effect与 Switch Thumb 状态位置；
- `hidden` 触及 view/layout visibility；
- `pointer-events-*` 触及 hit/event ownership；
- `overflow-*` 触及 Scroll surface；
- `relative` 触及 containing block；
- scale 必须与 transform composition 一起处理。

Public split profile 在收到 unresolved Root effect 时应同步 fail closed，并在首次 view 前或 runtime update mutation 前保留上一份完整 style projection；不得静默回退到 surface 或 host。诊断至少包含 Prototype identity、原 token、setup/rule/runtime phase 与所需后续 action。Source call-site 只有在 generated provenance 可用时才可以声称提供。

## 决策 D：下一阶段 admission 路线

### D1. Role-bearing effect 与 private split pilot 优先，随后交付 ESM 并公开 object（推荐）

本路线现在固定 delivery 方向为 generated ESM `.js` + `.d.ts` companion，但按依赖顺序实施：

1. 修订 Root style decision/test graph，治理 role-bearing effect provenance、collapsed compatibility、geometry bridge、四个 inventory composite token 的 split plan 与 unresolved atomic failure；
2. 让 canonical role 在 Rule lowering 前进入 Root-only effect path，并贯穿 merge、Rule、runtime patch/suppress 与 view replay；作者仍只写无前缀 `tw(...)`；
3. 增加 private WC split effects translator，把 surface 投到 inner、external placement 投到 host、geometry 投到 host + governed bridge，并实现 composite table；
4. 用 `P-SHADCN-CHECKBOX`（surface + size/shrink）、`P-SHADCN-DIALOG-MASK`（fixed/inset placement + visual surface）及一个仅含 composite 而无 unresolved 的候选（如 Brutalist Badge `inline-flex`）建立 private browser/DOM pilot；
5. CLI 从同一 closure 生成 document CSS 与 Shadow ESM companion，增加 JS/TS import、Vite/SSR consumer build 与 deterministic regeneration evidence；
6. 最后才固定 `shadow` object 字段并把 C1 coordinator、role translator 与 artifact 接入 `AdaptToWebComponent`；public activation 仍需 slot、state selector、focus/event/a11y、hostile global CSS 与 real-browser computed-style evidence。

优点：先解决会改变组件行为的 semantic routing，再固定 consumer delivery；generated output 一出现就有真实 Adapter consumer。每个阶段仍可独立提交与撤销。缺点：Root effect provenance 跨 Core、Feedback Module、Rule lowering、Runtime effect 与全部 Adapter compatibility tests，工作量高于只改 WC。

选择 D1 不批准显式 `tw.surface` / `tw.placement`；它只批准无前缀 canonical/default role 的内部 transport、四个已列 composite plan、known-unresolved fail closed，以及后续 generated ESM delivery 实验。显式多义 token 仍需单独语法决策。

### D2. 先公开 generated ESM delivery，Root routing 之后再做

先给 CLI 增加 Shadow companion output、public artifact type/export 与 consumer bundler fixtures，但不公开可工作的 split object；等 delivery 稳定后再进入 Root role pipeline。

优点：较快验证 escaping、module format、SSR 与 bundler。缺点：产生一个官方生成但暂无 public Adapter consumer 的 artifact；命名与目录容易先成为事实 API，后续 role/pilot 若失败可能留下需要兼容的交付面。当前不推荐。

### D3. 一次性完成 delivery、routing 与 public split object

同一 vertical slice 修改 CLI output、Root effect IR、Rule lowering、WC translation、public option、Template commit 与浏览器 journey。

优点：最早得到完整 consumer story。缺点：把跨 Core/Runtime/Adapter 的 semantic migration 与新 public API、generated file contract、DOM shape、browser evidence绑在一起；回滚和问题归因困难，也无法维持此前每个 checkpoint 可独立验证的节奏。当前不推荐。

### D4. 暂停 public delivery，先完整解决所有 unresolved family 与显式 author API

在任何 split pilot 前，先决定 `tw.surface` / `tw.placement` 或结构化 handle、visibility/hit/scroll ownership、transform composition 与通用 `placementTarget`。

优点：最终模型可能更统一。缺点：把可独立验证的 canonical routing、artifact delivery 与 role-closed pilot都阻塞在更大的跨 domain 设计上；也会过早迫使 Prototype author 学习新概念。当前不推荐。

## D1 的 compatibility 与 negative boundary

若选择 D1，必须保持：

- `shadow` omitted/`false`、`shadow: true` 与所有既有 public type/DOM/style target 不变，直到最后独立 public activation checkpoint；
- Template-node style 不进入 Root application-role transport；
- unknown extension token 保持带 `fallback` provenance 的 surface compatibility，known unresolved 则 fail closed；
- role 必须在 Web Rule variant lowering前解析并在 lowering 后保留；
- collapsed Adapter 的 observable token 顺序、merge、Rule update、owned cleanup 与 rendered output保持不变；
- split update 任一 target validation 失败时不产生半份 host/inner projection；
- document token CSS 与 Shadow artifact 从同一 closure 生成，theme declarations 仍只位于 document/host 并通过 custom-property inheritance 进入 Shadow Tree；
- `<style>` carrier 的 MVP 明示不保证 strict CSP，不接受 Promise/lazy artifact，也不增加 async first-reveal barrier；
- 不把 surface 当作 focus、a11y、event、hit、scroll 或 native-property owner；
- 不提升任何 draft entity，不授权 push、merge、publish 或 release。

## D1 建议的 spec/test graph

应优先修订而不是平行创建第二份真相：

- `D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001`
  - role-bearing Root effect provenance；
  - Rule/runtime/view replay preservation；
  - external placement 与 geometry bridge；
  - `block` / `flex` / `grid` / `inline-flex` split decomposition；
  - known unresolved atomic failure；
- `T-FEEDBACK-STYLE-ROLE-RESOLUTION-0001`
  - pre-lowering classification、lowered variant retention、merge/patch/suppress、collapsed Adapter parity；
- `D-WEB-COMPONENT-SHADOW-PROFILE-0001`
  - private split translator 与三个 pilot 的 admission boundary；
- `D-WEB-COMPONENT-SHADOW-STYLE-0001`
  - generated ESM companion 与同-closure document/Shadow delivery；
- `T-WEB-COMPONENT-SHADOW-STYLE-0001`
  - generated module import/build、host/inner atomic style projection、browser computed style、environment inheritance；
- 必要时新增一个 Test entity专门覆盖 split Root routing，但不应在 semantic owner 尚未确定前新增 Contract、Module 或 Host Capability placeholder。

## 可证伪 evidence

- author token 在 setup、Rule lowering、runtime patch/suppress 与 view replay后保持相同 application role；
- lowered `data-[state]:...` token 不会因 `:` 被误判为 fallback surface；
- collapsed React/Vue/Vue 2/WC 的 style output 与当前基线一致；
- Checkbox 的 size/shrink 作用于 host，而 background/border/ring 作用于 inner surface，两个盒保持一致；
- Dialog Mask 的 fixed/inset 作用于 host，background/backdrop/animation surface 作用于 inner；
- `inline-flex` composite 在 host 保留 inline outer participation、在 inner 提供 flex formatting；
- known unresolved 在 first view 或 runtime update 前失败且不留下半更新；
- generated `.js` artifact 可被 JS、TypeScript、Vite 与 SSR fixture 静态 import，重复生成 byte-stable；
- document CSS 与 Shadow module 来自相同 token closure，dark marker 与 inherited theme variable 在真实浏览器 computed style 下生效；
- hostile document selectors不能命中 inner surface，而明确的 host/custom-property customization 仍可观察；
- terminal teardown 与 reconnect 继续满足 C1 owner-generation evidence。

## Residual risks

- `styleArtifact`、generated filename 与 named export 仍是候选名；D1 在 delivery checkpoint 前需要固定 exact spelling。
- Artifact v1 不携带 closure digest；同一次 CLI generation 能降低漂移，但不能在 runtime 证明 document CSS 与 Shadow module同代。是否需要 artifact v2 hash 应由真实 stale-output failure 决定。
- Geometry mirror/fill 与 composite decomposition 需要真实 layout engine；jsdom 不能证明 box equivalence。
- 12/32/82 是当前 source-file inventory，不是长期 support percentage；Prototype 修改后必须重新生成 evidence。
- 即使 Root routing 完成，slot flattening、focus ring target、native text/image control、scroll surface 与 portal component 仍可能需要 profile-specific exclusion。
- Strict CSP、constructable stylesheet、nonce、closed ShadowRoot 与 async artifact 均不在 D1 MVP。

## 当前最小人工决策

请选择 D1、D2、D3 或 D4。推荐 D1。

选择 D1 将授权下一阶段先治理并实现无前缀 canonical role 的 Root effect transport与 private split pilot，再实现 generated ESM artifact delivery，最后回到 public object activation gate；它不会授权显式 role author API、known unresolved 的默认 role、strict CSP、draft lifecycle promotion、push、merge、publish 或 release。
