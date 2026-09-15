# Shadow split-surface Web Component profile decision packet

日期：2026-09-12。状态：maintainer decision packet，non-normative。本文汇总从 Root token inventory、call-site matrix 与 Shadow owner shell implementation 得到的证据，并把下一阶段拆成最小人工决策。本文不创建 Adapter profile、不修改公共 API，也不批准 style-role semantics。

## 已完成基础

当前分支已有四个独立 checkpoint：

1. `9c953261`：建立 draft application-role decision/test entity 与非集成 Core classifier；
2. `3f363cf9`：增加 Root-only token collector，证明 18 个 unresolved token 均有真实 Root 使用；
3. `942a1011`：增加 path/line/context occurrence provenance，得到 99 个 unresolved Root call site；
4. `fd92bac2`：Shadow commit 改为 owner shell 管理，只替换 view-owned node，保持现有 DOM shape 与 host style target。

这些基础允许继续安装 owner-lifetime stylesheet 或 inner surface，但不会自动回答公共 profile、style delivery 与 role authoring 的语义。

## 已确认事实

### Existing profile

- `WebComponentAdapterOptions.shadow?: boolean` 已是公开配置；默认 `false`。
- `shadow: true` 创建 open ShadowRoot，但 generic Root `feedback.style` 仍写 host。
- 当前精确 Shadow DOM shape 已有 contract test，例如 slot 的初始 `innerHTML` 为 `<slot></slot>`。
- 因此把 `shadow: true` 静默改成带 wrapper 的 split surface 会改变 observable DOM、layout 和 style target。

### Physical CSS delivery

- CLI 当前生成 document stylesheet，selector 以 `[data-pui-style]` 为中心。
- 普通 token rule、scoped box-model baseline 与 keyframes 放入 ShadowRoot 后可以匹配内部 surface。
- theme custom property 可以从 document/host 继承到 Shadow Tree，不需要复制全部 theme declaration。
- `dark:*` rule 当前依赖 `.dark`、`[data-theme='dark']` 与 `:root` ancestor selector；这些 selector 不能跨 Shadow boundary 匹配内部 surface。
- `getMeta('colorScheme')` 会把 document root marker 与 system preference 解析成 runtime fact，但当前 optimized Rule 依靠 CSS variant 保持动态，不会自动把该 fact 投影成 Shadow-local selector context。

因此“把现有 token CSS 文本原样复制到 ShadowRoot”不足以提供等价 style delivery。Shadow CSS generator 或 Adapter 必须提供显式 environment selector context。

### Style role evidence

- 267 个 Root token 中，190 个 canonical surface、55 个 canonical placement、4 个 composite、18 个 unresolved。
- transform family 已有互相冲突的真实 intent：Dialog viewport placement、Button/Toggle pressed surface effect、Switch Thumb state position。
- `hidden`、`pointer-events-*`、`overflow-*` 与 `relative` 分别触及 visibility、hit participation、scroll target 与 containing block，不应按物理 DOM 便利直接归类。
- 现有 `StyleHandle` 与 `TemplateStyleHandle` 是同一 type alias；任何 Root-only role API 都必须处理这条类型边界。

## 决策 A：公开 profile 形态

这是继续实现前最先需要确认的选择。

### A1. 扩展现有 Adapter 的 discriminated `shadow` 配置（推荐）

候选形态：

```ts
type WebComponentShadowOption =
  | boolean
  | {
      mode: 'open';
      presentation: 'split';
      tokenCssText: string;
    };

type WebComponentAdapterOptions = {
  shadow?: WebComponentShadowOption;
};
```

兼容规则：

- `false` / omitted：现有 Light DOM；
- `true`：现有 direct Shadow profile，Root style 继续在 host，DOM shape 不变；
- object + `presentation: 'split'`：新的显式实验 profile，允许 stable inner surface 与 shadow-local style delivery。

优点：复用 lifecycle、event、props、surface projection 与 owner shell；旧调用无静默迁移；一个 Prototype 不会因 profile 选择获得第二套 Adapter identity。缺点：`shadow` 字段从 boolean 扩为 union，配置会承担 profile negotiation。

### A2. 新增 `AdaptToShadowWebComponent` 公开入口

优点：新保证在命名上完全分离，类型和必需配置更清晰。缺点：容易复制或分叉 lifecycle/event/module wiring；消费者可能误以为这是另一个 Adapter identity；公共导出与文档成本更高。

即使选择此项，底层仍应复用当前 `AdaptToWebComponent` implementation core 和 owner shell，不能维护两套独立 runtime owner。

### A3. 暂不公开，仅保留内部测试 profile

优点：可以先验证 box model 与 CSS delivery，不承诺 API。缺点：无法获得真实 consumer/bundler 的 stylesheet input evidence；容易让私有测试 option 变成未经治理的事实 API。

### 推荐

采用 A1。现有 `shadow: true` 已经表达“使用 ShadowRoot”，新的 object form 正好表达更具体的 presentation/style-delivery guarantee。未来若 split profile 足够稳定，可以再增加命名 facade；不应现在复制 Adapter。

## 后续决策，不在 A 中一并批准

### B. Shadow stylesheet artifact

推荐让 split profile 显式接收 immutable `tokenCssText`，Adapter 按 document/cache 能力优先复用 constructable stylesheet，并以 owner `<style>` fallback。不要使用隐式全局 registry、document stylesheet scraping 或 per-root arbitrary callback。

CLI 后续应增加 Shadow-targeted token CSS mode：

- 复用普通 token declarations、baseline 与 keyframes；
- 把 theme/environment selector 改写为 Shadow-local、由 Adapter 明确投影的 context；
- theme variable declaration仍留在 document/host，并通过 inheritance 进入 Shadow Tree；
- stylesheet readiness 进入首次 reveal barrier。

`tokenCssText` 是否由 bundler inline import、CLI manifest loader 或更高层 facade 提供，可在 artifact contract 中继续讨论，不属于 A 的批准范围。

### C. Root role authoring

推荐保留无前缀 `tw(...)` 的 canonical classification，并在真实冲突 token 上采用结构化 Root-only handle，而不是开放冒号：

```ts
tw.surface('translate-x-px');
tw.placement('-translate-x-1/2');
```

该形式不与 Tailwind variant grammar 冲突。实现时应让 role 成为 Style IR 与 merge group identity 的一部分，并把 `TemplateStyleHandle` 从可携带 Root role 的 handle 中类型化分离。Single-role canonical token 不允许被任意 override；显式 role 只解决已治理的 multi-role family。

该 API 名称、handle shape 与 compatibility migration 仍需要独立决策，A 不授权修改 `StyleHandle`。

### D. Unresolved family policy

推荐先保持 fail closed：split profile 遇到 unresolved Root token 时产生同步、带 Prototype/token/call-site 语义的诊断，不由 Adapter 猜 target。

- transform：等待显式 role；
- `hidden`：先决定是否由 ViewIntent/visibility semantic 接管；
- `pointer-events-*`：先决定 hit participation ownership；
- `overflow-*`：先和 Scroll host target 对齐；
- `relative`：先补 containing-block evidence；
- scale：与 transform composition 一起处理。

这意味着首个 split pilot 只覆盖 role-closed Prototype/composition，不宣称所有现有 Prototype 已可等价投影。

## A1 获批后的提交序列

若 maintainer 选择 A1，建议继续以下独立节点：

1. public option normalization：保持 boolean behavior，object form 先只完成验证与 type evidence；
2. Shadow stylesheet owner：`tokenCssText` 安装、dedupe、fallback、detach/reattach identity 与 cleanup；
3. environment context：dark/light/system marker 的动态同步与 Shadow CSS selector evidence；
4. stable inner surface：owner-lifetime surface + view-epoch render contents，不接入 unresolved token；
5. role-aware IR：经决策 C 后接入 merge/runtime/export；
6. split translation pilot：选择一个 role-closed visual Prototype 和一个 placement-sensitive Prototype；
7. cross-adapter parity 与 public documentation；
8. 独立 review 后再讨论 draft profile admission。

每一步都应独立提交，且 Light DOM、`shadow: true` direct profile 与其他 Adapter 必须保持回归证据。

## 当前最小人工决策

请只决定 profile 形态：选择 A1、A2 或 A3。推荐 A1。

选择 A1 只授权下一阶段设计/实现 backward-compatible object configuration 与 stylesheet owner 基础；它不授权：

- 修改现有 `shadow: true` 行为；
- 公布 `tw.surface` / `tw.placement`；
- 给 unresolved token 猜默认 role；
- 把 draft entity 提升为 active；
- merge、publish 或 release。
