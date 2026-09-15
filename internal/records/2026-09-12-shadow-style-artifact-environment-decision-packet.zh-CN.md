# Shadow style artifact 与 environment selector ABI 决策包

日期：2026-09-12。状态：maintainer decision packet，non-normative。本文承接 `D-WEB-COMPONENT-SHADOW-PROFILE-0001` 的 A1 方向，收敛 public split object form 之前必须确定的 Shadow-targeted stylesheet artifact 与动态环境同步边界。本文不修改公共 API、不接入 split Template commit 或 Root style routing，也不批准 style-role authoring。

## 已完成基础

当前分支已新增三个 A1 checkpoint：

1. `37606bda`：以 draft decision/test entity 记录同一个 `AdaptToWebComponent` identity、boolean compatibility 与 object form 原子启用约束；
2. `42e1b78a`：增加未导出的 Shadow stylesheet owner，保证 stable `<style>` identity、更新去重、view-content replacement 保留与幂等 dispose；
3. `f3d3fac0`：增加未导出的 stable inner surface，区分 owner-lifetime container 与 view-epoch children。

两项 helper 均未从 package root 导出，也未接入 `WebComponentAdapterOptions`。`shadow: false`/omitted 与 `shadow: true` 的 DOM、slot、Root style target 和 lifecycle 均保持不变。

## 当前可证事实

### Document CSS 不能直接成为 Shadow CSS contract

`renderProtoStyleTokenCss()` 当前生成以下 document-targeted 内容：

- `[data-pui-style]` box-model baseline；
- `@layer proto-ui` 内的 token declarations 与 composed-property reset；
- 需要时生成 `pui-enter` / `pui-exit` keyframes；
- `dark:*` selector 依赖 document ancestor `.dark`、`[data-theme='dark']` 与 `:root`；
- system fallback 使用 `@media (prefers-color-scheme: dark)` 加 document-root exclusion selector。

普通 token、baseline 与 keyframes 可以在 ShadowRoot 内重新生成后匹配 inner surface；document ancestor selector 与 `:root` exclusion selector则不能跨 Shadow boundary 保持原义。因此 public split profile 不能把现有 document CSS 字符串原样复制后宣称等价交付。

### Theme variables 与 selector environment 是两条输入

Theme CSS custom properties 可以经 Custom Element host 继承到 Shadow Tree。它们不需要为每个 ShadowRoot 重复声明，但这只解决 declaration value 输入，不解决 `dark:*` rule 何时匹配。

当前 `resolveWebColorScheme()` 的默认 Web precedence 为：

```text
documentElement[data-theme=dark|light] 或 .dark/.light
  > matchMedia('(prefers-color-scheme: dark)')
    > light fallback
```

`getMeta('colorScheme')` 是 pull-only callback，没有变化订阅。optimized Rule 则刻意使用 CSS variant 保持动态。因此一个 Shadow-local marker 若只在 mount 时读取 `getMeta`，会在 document theme 或 system preference 改变后变 stale；若它完全绕过 `getMeta`，又可能制造 runtime meta 与 CSS environment 两份 truth。Public profile 必须明确同步 owner，而不能依赖偶然的 `update()`。

### Physical installation 与 semantic artifact 应分离

当前 private stylesheet owner 使用 owner `<style>`，足以作为通用 fallback。未来可在支持的浏览器中以 constructable stylesheet / `adoptedStyleSheets` 优化共享，但 physical carrier 不应成为调用方必须选择的语义 API：`CSSStyleSheet` 具有 realm、mutation、SSR 与 bundler 差异，也不能自行说明 CSS 使用的 environment selector ABI。

## 信息路径候选

推荐的信息路径是：

```text
Prototype token closure + Shadow CSS generator
  → immutable/versioned ShadowStyleArtifact
    → AdaptToWebComponent split object
      → artifact validation
        → owner-lifetime stylesheet installation

default Web theme facts or explicit subscribable override
  → one Adapter-owned color-scheme environment owner
    → host-local data-pui marker
      → :host(...) selectors inside generated Shadow CSS
```

Custom Element host 继续拥有 lifecycle 与 marker lease；inner surface 只接收 Root presentation projection。Marker 是 CSS evaluation context，不是第二份 Proto state，也不把 surface 变成 event/focus/a11y owner。

## 选择 B：artifact 与 environment ABI

下列 API 只用于表达方案形状，不是已批准命名。

### B1. Versioned artifact + Adapter-owned environment owner（推荐）

候选 artifact：

```ts
type ShadowStyleArtifactV1 = Readonly<{
  kind: 'proto-ui.shadow-style';
  version: 1;
  cssText: string;
  environment: 'host-color-scheme-v1';
}>;
```

候选 environment source：

```ts
type ColorSchemeSource = {
  get(): 'light' | 'dark';
  subscribe(listener: () => void): () => void;
};
```

默认 source 复用当前 document marker + `matchMedia` precedence，并订阅 `documentElement` 的 `class`/`data-theme` 与 media-query change。若 split consumer 需要自定义 color-scheme truth，必须提供可订阅 source；该 source 同时供 CSS marker 与 runtime color-scheme meta 使用，避免双 truth。其它 `getMeta` key 保持现有 callback。

Shadow CSS 使用版本化 host-local marker，例如：

```css
:host([data-pui-color-scheme='dark']) [data-pui-style~='dark:bg-input/30'] {
  background-color: color-mix(in oklab, var(--pui-input) 30%, transparent);
}
```

优点：artifact 可以验证 generator/Adapter selector ABI；CSS physical carrier 可在不改公共 API 的情况下从 `<style>` 优化为 constructable stylesheet；默认环境动态同步；自定义环境有单一 truth。成本：引入一个小型 artifact schema 与 subscribable environment source，并需要定义 marker ownership/cleanup。

### B2. Raw `cssText` + 隐式 Adapter convention

Object form 只接收字符串，Adapter 约定它必须使用某个 host marker，并负责默认同步。

优点：类型最小，bundler inline import 直接。缺点：字符串无法证明它是 Shadow-targeted 输出、无法声明 selector ABI version，也无法在错误地传入 document CSS 时 fail closed；后续 marker 变化只能靠文档约定和破坏性迁移。`getMeta` 与 marker 的单一 truth 问题仍需另行解决。

### B3. Caller-owned `CSSStyleSheet` / marker

调用方提供 `CSSStyleSheet` 或自行操作 `adoptedStyleSheets`，并负责 host environment marker。

优点：Adapter 实现最少。缺点：把 environment consistency、realm compatibility、mutation ownership、SSR fallback 与 cleanup 推给每个 consumer；同一 Prototype 在不同集成中可能获得不同 selector ABI。该方案不适合作为 official profile guarantee，但未来可作为低层非便携 escape hatch 单独讨论。

### B4. 仅使用 media query，不投影显式主题

Shadow CSS 只保留 `prefers-color-scheme`，不响应 document `.dark`/`.light` 或 `data-theme`。

优点：不需要 Adapter observer。缺点：直接丢失当前显式 theme override precedence，不能称为与 Light/direct profile 等价。除非未来明确建立一个功能更窄的新 profile，否则不建议。

## 推荐与兼容边界

推荐 B1，原因不是“结构化对象比字符串更高级”，而是 public split profile 需要验证三件必须共同演进的事实：CSS 确实面向 Shadow target、它期待哪一版 selector environment、Adapter 能否提供该 environment。Plain string 与 mutable `CSSStyleSheet` 都不能携带这组可验证关系。

B1 下应保持：

- artifact 是生成物和 immutable value，不允许 per-root arbitrary callback 生成 CSS；
- Adapter 可选择 `<style>` 或 constructable stylesheet，但二者必须渲染同一 artifact；
- theme custom property 继续从 host 继承，不复制整份 theme declaration；
- color-scheme marker 属于 owner lifetime，首次 reveal 前同步，terminal teardown 撤销；
- explicit source 变化与 document/system 默认变化都必须动态更新；
- `shadow: true` 不安装 marker、stylesheet 或 inner surface；
- Light DOM、React、Vue 与 Vue 2 不因该 physical profile 增加 wrapper 或 marker。

## 仍然不在 B 中决定

- 不决定最终字段名、package export 名或 artifact 文件扩展名；
- 不决定 `tw.surface` / `tw.placement`、冒号 grammar、Template style role 或 unresolved token fallback；
- 不决定 split Root token 如何在 placement/surface target 间分流；
- 不决定 `::part` customization、Declarative Shadow DOM、SSR/hydration 或 CSP nonce policy；
- 不把 constructable stylesheet 设为唯一 carrier；
- 不公开 object form，不提升 draft lifecycle，不 merge、publish 或 release。

## B1 获批后的最小提交序列

1. CLI 增加纯函数 Shadow CSS renderer：复用 declarations/baseline/keyframes，只把 environment selector 改为 `host-color-scheme-v1`，并用 document 与 Shadow 输出对照测试证明差异边界；
2. Adapter 增加 private color-scheme environment owner：默认 document + media subscription、stable marker、dedupe、首次同步与 terminal cleanup；
3. 定义内部 versioned artifact validator，并把 artifact 安装到现有 stylesheet owner；仍不公开 `shadow` object；
4. 以一份 record/evidence packet 复核 CSP、custom `getMeta` coexistence、consumer bundler input 与首次 reveal；
5. 到 role-aware Root translation 或 public object activation 前再次请求独立人工决策。

每一步继续独立提交。前两步可以独立验证，第三步只连接已批准 artifact，不得把 generic Root style 提前迁入 inner surface。

## 可证伪 evidence

- 同一 token closure 的 document CSS 与 Shadow CSS 具有相同 declarations、baseline、keyframes 与 unknown-token diagnostics，只有 environment selector target 不同；
- document `.dark`/`.light`、`data-theme` 与 system preference 成对切换时，host marker 和 Shadow computed style 同步，precedence 与 `resolveWebColorScheme()` 一致；
- explicit source 同时驱动 runtime `colorScheme` fact 与 CSS marker，不产生一帧双 truth；
- repeatable view detach/remount 保留 artifact、style node 与 marker owner，terminal teardown 清除 Adapter-owned resource；
- 错误 kind/version/environment、document-targeted CSS 或缺失 artifact 同步 fail closed；
- boolean profiles 的 exact DOM、slot、style target 与 package types 不变。

## 候选 entity / test graph

若选择 B1，可考虑新增或修订：

```text
D-WEB-COMPONENT-SHADOW-PROFILE-0001
  → decision/contract: versioned Shadow style artifact + environment ABI
    → CLI test: document/shadow selector and declaration parity
    → Adapter test: environment owner transitions and cleanup
    → T-WEB-COMPONENT-SHADOW-PROFILE-0001
```

是否用新 `D-*`、`C-*` 或修订现有 decision，应在 B1 获批后的 `pui-trace` 中根据 ownership 决定；本文不预先 admission。

## 当前最小人工决策

请选择 B1、B2、B3 或 B4。推荐 B1。

选择 B1 只授权实现上述 Shadow CSS renderer、private environment owner 与内部 artifact validation 基础；它仍不授权 public object form、Root role translation、customization/SSR/CSP guarantee、stable lifecycle promotion、push、merge、publish 或 release。
