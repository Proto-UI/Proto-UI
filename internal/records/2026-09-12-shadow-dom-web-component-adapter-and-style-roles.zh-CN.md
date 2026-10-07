# Shadow DOM Web Component Adapter 与 style projection role 初步方向

日期：2026-09-12。状态：design discussion record，non-normative。本文记录当前人工讨论形成的候选方向、证据、风险与待裁定问题，不建立稳定保证，不授权实现、spec 准入或公开 API。后续若方向稳定，应将语义提升到对应 knowledge、decision、contract、Adapter profile 与 test entity，而不是让本文成为长期 shadow specification。

## 触发问题

现有 Web Component Adapter 已允许把 Template commit 到 Shadow DOM，但 Prototype Root style 默认仍落在 Custom Element host。由于 host 不受自身 Shadow DOM 的 selector 隔离保护，单纯把 authored children 放入 `#shadow-root`，对当前大量“无附属节点、主要依赖 Root style”的 Prototype 只能提供有限隔离。

本轮讨论围绕以下问题展开：

1. Shadow DOM 是否对当前 Prototype 拆分方式具有足够价值。
2. 是否应在 ShadowRoot 中创建稳定的内部 presentation surface，把 Prototype Root visual intent 从 host 迁入该 surface。
3. Shadow profile 应作为现有 Adapter 的配置、独立公开 profile，还是独立实现。
4. host 与 inner surface 分离后，Root style 中的外部布局参与、内部 formatting 与视觉装饰如何保持语义。
5. Prototype author 是否必须理解这些角色，是否需要新的 style token 语法或 API。
6. 新语义如何渐进引入，避免破坏 Light DOM Adapter 和现有 Prototype。

## Authority map 与现状

当前可用依据如下；其中相关 catalog entity 均应按其实际 lifecycle 解读，`draft` 不得呈现为稳定保证。

- `K-HOST-SURFACE-ROLES-0001`（draft）区分 logical `boundaryTarget` 与 presentation `surfaceTarget`，并明确普通 projection 可以折叠二者，host-specific wrapper 不向 Prototype author 暴露 raw target。
- `C-HOST-SURFACE-PROJECTION-0001`（draft）要求 lifecycle、logical tree、event boundary、exposes/ref 与 Adapter identity 留在 boundary；Prototype Root visual intent、`feedback.style` 与 normalized surface class/style 投射到 surface；focus、a11y、event、hit-testing 与 native-property target 仍由各自 domain 决定。
- `T-HOST-SURFACE-PROJECTION-0001`（draft）已有 collapsed projection、WC Text Control split surface、surface replacement、normalized surface channel 与 state selector context 的可执行先例。
- `C-FEEDBACK-STYLE-0001`、`C-FEEDBACK-STYLE-0003`、`C-FEEDBACK-STYLE-0004`、`C-FEEDBACK-STYLE-0005` 当前把 `feedback.style` 描述为作者侧视觉意图、token set、selector/state-pure 输入和 translation 前的 style result。
- `C-FEEDBACK-STYLE-0004` 当前禁止作者 token 包含 `:`，用于阻止 hover、focus、data selector 与 host realization 依赖进入作者侧 token；若未来接纳 role qualifier，需要精确修订该边界，而不是泛化开放 Tailwind variant。
- `D-WEB-STYLE-BASELINE-0001`（draft）要求 Web physical CSS 为 `[data-pui-style]` 提供 scoped box-model baseline；Shadow-local surface 需要等价获得该 baseline。
- `C-HOST-VIEW-ATTACHMENT-0001` 与 `C-LIFECYCLE-0008` 相关生命周期方向要求 detached view、owner lifetime、view epoch 与首次 reveal barrier 保持区分。

当前实现事实：

- `WebComponentAdapterOptions` 已有 `shadow?: boolean`，默认 `false`。
- 构造期在 `shadow: true` 时把 `_root` 设为 open ShadowRoot，否则设为 Custom Element host。
- 普通 Prototype 当前令 `boundaryTarget === surfaceTarget === host`；Text Control 与 Image View 已令 host 保持 boundary，并把内部物理控件设为 surface。
- generic `feedback.style` token applier 当前仍以 host 为 target，因此 `shadow: true` 没有保护 Root visual styling。
- Shadow commit 当前直接对 ShadowRoot 执行 `replaceChildren()`；view release 也会清空整个 ShadowRoot。稳定 inner surface、内部 `<style>` 或其他 owner-shell node 不能继续依赖这一策略。
- 2026-09-12 的初步仓库扫描在 Base、Shadcn、Brutalist 三组目录中共发现 135 个 `.proto.ts` 文件；直接 authored 的内部 `el/svg` 结构相对有限，约 28 个文件使用 slot。该观察只说明现有库不是以大型私有 DOM subtree 为主，不证明 Shadow DOM 没有消费者价值。

## 当前形成的方向

### 1. Shadow DOM 的价值不只来自附属节点数量

即使 Prototype 没有 authored child，内部 presentation surface 本身仍可以被 document global selector、reset 和宿主 class collision 影响。把该 surface 放入 ShadowRoot 后，可以保护背景、边框、圆角、ring、内部 formatting 与 Adapter-owned helper DOM。

不过 Shadow DOM 只能提供有边界的保护：

- document selector 不能直接匹配 inner surface 与普通 shadow descendants；内部规则也不向 document 泄漏。
- Custom Element host 仍在 document tree 中，consumer 仍可修改其 `display`、尺寸、opacity、position 等。
- inherited property 与 CSS custom property 可以沿 host 进入 Shadow Tree；这应成为有意的 theme/environment 输入，而不是被误称为“完全隔离”。
- slotted node 仍属于 Light DOM，继续受 document CSS 影响。
- `::part`、CSS custom property 或未来显式 theme channel 是有意开放的 customization surface。

因此候选保证应描述为“内部 selector 与实现结构隔离”，不得描述为“组件完全不受外部 CSS 影响”。

### 2. Shadow boundary 与 split presentation surface 是两个设计轴

应避免把“存在 ShadowRoot”与“Root visual intent 必须迁入 inner surface”写成同一个不可分割概念。候选组合包括：

| DOM realization | presentation surface | 主要用途                                             |
| --------------- | -------------------- | ---------------------------------------------------- |
| Light DOM       | host/collapsed       | 当前默认行为                                         |
| Shadow DOM      | host/collapsed       | native slot、私有 helper DOM，但 Root style 隔离有限 |
| Shadow DOM      | inner/split          | 内部 selector 隔离与稳定 visual surface              |

短期倾向继续复用现有 Adapter 实现和 `shadow` 实验入口，不立即复制一套独立实现。如果 split-surface Shadow 模式最终形成不同的公开保证、style delivery、customization 与兼容要求，可以暴露独立 Adapter profile 或公开入口，但底层实现仍应共享。

当前证据不足以把 Shadow 或 split surface 设为所有 Web Component 的默认 realization。

### 3. “空壳 host”仍然不是无职责节点

候选 Shadow split 结构为：

```text
Custom Element host
  #shadow-root
    shadow-local stylesheet
    stable inner presentation surface
      Template children / native slot / Adapter-owned nodes
```

host 即使不承载背景、边框等 Root visual style，仍可能承担：

- Custom Element lifecycle owner；
- logical tree 与 event boundary；
- exposes/ref 与 `data-pui-root` 等 Adapter identity；
- canonical Web state exposure；
- authored Light DOM children 与 slot distribution；
- 作为整体参与父布局的物理盒子。

因此“空壳”只表示它不应形成第二个竞争的视觉表面，不表示它可以被无条件设为 `display: contents`。`display: contents` 会取消 host box，并影响 focus、a11y、hit-testing、containing block 与 layout 行为，不应成为通用 baseline。

### 4. 现有 boundary/surface 二角色可能不足以解释外部布局

本轮讨论发现，logical boundary 不等于必然存在的外部布局盒。候选模型需要至少区分：

```text
boundaryTarget   = logical instance owner
placementTarget  = 参与父布局、定位和 stacking 的盒子
surfaceTarget    = User 感知 Root visual intent 的表面
```

普通 Light DOM projection 可以让三者重合。典型 Shadow split projection 可以让 host 同时承担 boundary 与 placement，inner root 承担 surface。Portal、`display: contents` 或 host-owned widget 可能产生其他映射。

`placementTarget` 目前尚未被 catalog 接纳；它可能是新的通用 host projection role，也可能最终只作为 style translation 内部概念。不得在本文中把它当成已决定的第三 target。

Surface role 仍不自动决定 focus、a11y、event、hit-testing、scroll 或 native-property target。各 domain 必须独立解析 target，并在 replacement/detach 时遵守自身 lease 与 cleanup contract。

## Root style 暴露出的语义混合

当前 `feedback.style` Root token 同时承载了至少三类信息：

1. presentation appearance：background、border、radius、shadow、color、padding 等；
2. internal formatting：`flex-row`、`justify-*`、`items-*`、`gap-*` 等对内部内容的布局；
3. external placement：margin、`order-*`、`self-*`、flex item sizing、absolute/fixed positioning、inset、z-index 等。

部分 token 具有复合或上下文相关语义：

- `inline-flex` 同时表达 outer inline participation 与 inner flex formatting context；
- `w-full`、`h-full` 等尺寸既影响组件相对父容器的几何，也要求 inner surface 与 placement box 一致；
- `transform` 可能是 surface animation，也可能是 overlay placement；
- `relative` 可能为内部 absolute descendant 建立 containing block，也可能参与自身定位；
- `overflow` 可能是视觉裁切，也可能形成 scroll surface；
- `hidden` 可能表示 surface 不绘制，也可能要求整个实例退出父布局；
- `pointer-events` 涉及 hit participation，不能因为 CSS 物理实现方便就获得该 domain 的语义 ownership。

Adapter 在接收到合并后的 string token set 时无法恢复作者为何写入某个 token。仅按 CSS property 或 Tailwind 名称启发式分流，会让 Light/Shadow 与不同 Adapter 的行为不稳定。若要求强语义等价，role 信息必须在进入 Adapter 之前存在。

## Prototype author 应感知什么

当前倾向是隐藏 host、ShadowRoot、wrapper、raw `boundaryTarget` 与 raw `surfaceTarget`，但不隐藏 portable semantic distinction：

- 普通作者继续描述组件 appearance 与 internal formatting，无需理解 Shadow DOM。
- 只有当 Prototype 主动规定“组件作为整体如何参与周围布局”时，作者才需要理解 placement semantics。
- 作者侧概念应使用 `surface` / `placement` 或更中立的 presentation vocabulary，不应使用 `hostStyle`、`shadowStyle` 或允许 raw target access。
- 页面如何摆放普通组件通常由 consumer/父布局拥有；Prototype 只应在 overlay、group root、viewport 等确实拥有 placement guarantee 的场景声明该意图。

## Style token role 的渐进引入候选

### 解析优先级

当前倾向采用以下 resolution order：

```text
显式 role
  > token family 的 canonical role
    > translator 已知的 composite semantics
      > 未识别 token 的 surface fallback
```

这里的 default 是 Core style vocabulary 的稳定语义，不是 Adapter 可配置默认值。不同 Adapter 不得为同一无前缀 token 选择不同 role。

候选 canonical 分类：

| token family | 候选 canonical semantics |
| --- | --- |
| background、border、radius、shadow、color、padding | surface |
| `flex-row`、`justify-*`、`items-*`、`gap-*` | surface internal formatting |
| `order-*`、`self-*`、grow/shrink/basis、margin | placement |
| absolute/fixed、inset、z-index | placement，或由更具体 positioning/layering capability 接管 |
| width/height/min/max size | placement geometry，translation 负责保持 surface 同步填充 |
| `inline-flex`、`inline-grid` | composite outer participation + inner formatting |
| transform、relative、overflow、visibility | 需逐组确定 canonical semantics；真实非默认需求出现前不得伪装为已解决 |
| 未识别或 extension token | surface fallback，并允许 split profile 发出开发期诊断 |

“前缀可省略”必须意味着 token family 只有一个已治理的 canonical role，而不能只依赖当前常见用法。对单一合法 role 的 token，不应允许任意 override，例如 `placement:bg-red-500` 应 fail closed，以免 role qualifier 退化成指定物理节点的 escape hatch。

### 暂缓公开 qualifier 语法

可以先让内部 Style IR 记录 role 与 provenance，而保持现有 author syntax：

```ts
{
  token: 'order-2',
  role: 'placement',
  roleSource: 'canonical'
}
```

只有出现真实的非默认用例后，再选择公开形式。候选包括：

```ts
tw('surface:translate-x-2 placement:translate-x-1/2');
```

或避免与 Tailwind variant 冲突的结构化 handle：

```ts
surface(tw('translate-x-2'));
placement(tw('translate-x-1/2'));
```

若采用冒号，grammar 只能允许一个受保留字约束的 portable application-role qualifier，其他 hover/focus/data/selector variant 继续同步拒绝。该变化需要显式修订 `C-FEEDBACK-STYLE-0004`，不能解释为全面放开 `:`。

### Role 必须进入 Style IR，而不是 Adapter 临时字符串技巧

候选信息路径为：

```text
author token
  → token validation / role resolution
    → semantic merge
      → Rule intent / runtime patch
        → feedback.style export
          → Adapter translation
            → one or more physical targets
```

role 必须参与 semantic group identity。例如 `surface:w-full` 与 `placement:w-auto` 不能仅因为同属 width group 而互相覆盖。setup merge、Rule activation/deactivation、runtime `patch`/`suppress`、debug output、Web CSS generation 与 owned-style cleanup 都必须保存相同 role。

Composite token 需要 translation 在 target collapsed 时重组、在 target split 时分解。不能简单地剥掉 qualifier 并把原 class 字符串分别写到两个元素；`inline-flex` 等 CSS display semantics 与额外盒子的 baseline、intrinsic sizing 并不天然等价。

Template node 的 `style` 当前与 Root `feedback.style` 复用 `StyleHandle` shape，但 Template node 已有明确物理/逻辑节点。role qualifier 是否只允许用于 Root style，还是 Template style 也需要统一语义，尚未决定；在该边界明确前不应扩大公共类型。

## 对 Light DOM 与其他 Adapter 的影响

引入 portable role 不应迫使 React、Vue、Vue 2、Light DOM WC 或普通宿主增加 wrapper。

- 当 boundary、placement 与 surface 折叠到同一 target 时，translation 应保持现有可观察结果，并在必要时重组 composite semantics。
- split-surface 是 host projection choice，不是 Prototype logical tree change；不得因此产生第二个 component、第二份 state owner 或第二个 event owner。
- normalized `surfaceClass` / `surfaceStyle` 继续表达 presentation intent；原生 host `class` / `style` 仍可作为 Adapter-local boundary escape hatch，但不能冒充跨 Adapter portable Props guarantee。
- 非 Web Adapter 可以把 placement 与 surface 折叠到同一 widget，或映射到其原生布局/装饰机制；role 的价值是 portable intent，不是复制 CSS target。
- 在 semantic equivalence 有证据前，Light DOM 既有行为优先保持；Shadow split profile 不得通过修改共享 merge 规则而静默改变其余 Adapter。

## Shadow-local style delivery

仅把 `data-pui-style` 从 host 移到 inner surface 并不足够。Document stylesheet 无法跨 Shadow boundary 匹配内部 attribute，因此候选实现需要：

- 通过 constructable stylesheet / `adoptedStyleSheets` 共享生成的 physical CSS，或在 ShadowRoot 内安装受 owner 管理的 `<style>`；
- 为 inner `[data-pui-style]` 提供与 Light DOM 等价的 box-model baseline；
- 把 theme variable、environment custom property 与其他允许穿透的输入定义为显式依赖；
- 为 consumer customization 选择 CSS custom property、`::part` 或 normalized surface channel，而不是依赖 document descendant selector；
- 确保 stylesheet readiness 与首次 visual reveal 同步，避免未样式化闪烁。

具体选择 `adoptedStyleSheets`、内部 `<style>`、Declarative Shadow DOM 或 SSR/hydration 支持均未决定。

## 生命周期候选

Shadow profile 不要求改变 Proto lifecycle truth：

- Custom Element host 继续作为 component owner 与 Custom Element lifecycle 接点；
- ShadowRoot、稳定 inner surface 与 shadow-local stylesheet 属于 owner-shell lifetime；
- RuntimeSession 属于 Proto instance lifetime；
- committed Template children、view-owned event binding、state selector projection 与动态 style effects 属于当前 view epoch；
- repeatable view detach 应撤销 view-owned effects 并清空 inner render contents，但不必销毁稳定 inner surface 或 stylesheet；
- terminal owner teardown 才销毁 RuntimeSession 与 owner-owned resources；
- detached shell 必须不绘制、不进入 a11y tree/tab order、不保留旧 hit/focus surface；
- 新 view 必须在首次 Template commit、style projection、state selector context 与其他 required view effects 一致后跨过 reveal barrier。

因此 commit target 应从整个 ShadowRoot 收窄为稳定 inner render surface，或采用不会删除 owner-shell nodes 的持久 render range。当前直接 `shadowRoot.replaceChildren()` 的路径需要调整。

## 兼容与迁移政策候选

1. `shadow: false` 与现有 Light DOM profile 的行为保持不变。
2. 现有 `shadow: true` 在正式 guarantee 前继续视为实验入口；不得静默把所有 Root token 迁到 inner surface。
3. 先建立 token-role inventory 与 diagnostic，再引入 split-surface realization。
4. 无歧义 token 可以由 canonical registry 自动兼容；未识别 token fallback 到 surface，并在 split profile 中提供开发期诊断。
5. transform、position、size、display、overflow、visibility、pointer-events 等高风险 group 必须逐组审计。
6. split-surface profile 初期可以只接纳不存在 unresolved Root token 的 Prototype，或明确报告该 Prototype 尚不满足等价 projection 条件。
7. 既有 placement 用法不应被静默重新解释。Dialog centering、overlay fixed/absolute、dropdown/select/tooltip content positioning、scroll surface 等需要重点迁移或交由现有 domain capability。
8. 不通过按字符串猜测 token 意图、复制全部 token 到两个 target、全局 `!important` 或默认 `display: contents` 获得表面兼容。

## 候选实现工作分解（尚未授权）

### Semantic 与 catalog

- 判断是否接纳 `placement` 为独立 host projection role，或仅接纳 surface/placement style application role。
- 定义 Root appearance、internal formatting、external placement 与 geometry synchronization 的边界。
- 修订或补充 `K-HOST-SURFACE-ROLES-0001`、`C-HOST-SURFACE-PROJECTION-0001`，避免把 logical boundary 当成必然布局盒。
- 为 style role、canonical defaults、unknown fallback、composite token、invalid role/token combination 与 qualifier purity 建立 knowledge/decision/contract。
- 决定 Shadow-default profile 是独立 `A-*` profile 还是现有 WC Adapter profile 的 opt-in policy。

### Core / Runtime / style translation

- 把 style token 从 raw string set 提升为携带 role/provenance 的可合并 IR，或证明更小的兼容表示足够。
- 让 semantic merge、Rule intent、runtime patch/suppress 与 export 保留 role。
- 建立 canonical token-role registry 和 development diagnostics。
- 为 collapsed/split target 定义 composite token 的分解与重组。
- 让 Web physical CSS generator 支持 Shadow-local delivery 和 role-aware output。

### Web Component Adapter

- 增加稳定 owner-shell / inner surface，并把 Template commit 收窄到 render surface。
- 让 `HostSurfaceProjection`、owned token applier、normalized surface class/style 与 state selector context 指向正确 surface。
- 保留 canonical state 与 Adapter identity 在 boundary；迁移时只撤销 Adapter-owned style/context。
- 实现 stylesheet lifetime、theme/environment input 与 `part` customization。
- 验证 native slot、Light DOM authored children、event retargeting、focus bridge、a11y target、hit-testing 与 text/image host-owned control 的组合。

### Evidence

- hostile global CSS：document reset、tag/class/attribute selector 不应改变 inner visual surface，但 host-level consumer override 保持可观察。
- parent layout：inline flow、flex/grid item、order/self/grow/shrink、margin、width/height、absolute/fixed、stacking 与 containing block。
- surface visuals：background、border、ring、shadow、padding、internal flex/grid、overflow 与 transform。
- theme/environment：CSS variables、inherited font/color、dark/light 与缺失 theme input。
- lifecycle：首次 reveal、detach/remount、surface replacement、terminal dispose、stylesheet cleanup 与无 stale focus/hit/a11y。
- slot/customization：native slot、slotted child 外部样式、`::part`、normalized surface channels。
- cross-adapter：同一 role-aware Prototype 在 collapsed React/Vue/Light WC 与 split Shadow WC 中保持语义等价。

## 建议的 entity / test graph（候选）

若后续 checkpoint 接纳该方向，可以按最小语义切片考虑：

```text
knowledge: component placement / presentation / logical-boundary roles
  → decision: Shadow WC realization 与 compatibility policy
    → contract: role-aware Root style intent and merge/export behavior
      → Adapter profile: Shadow split-surface Web Component
        → tests: token role + collapsed/split translation + lifecycle + browser CSS isolation
```

该图只描述可能的治理顺序，不预分配最终 entity ID，也不表示每一层都必须新建实体。若现有 entity 可以在不制造冲突的情况下扩展，应优先修订现有语义来源。

## 明确不在本记录内决定

- 不决定最终公共 API 名称、qualifier 标点或 package export。
- 不决定创建第二份 Web Component Adapter 实现。
- 不决定 Shadow DOM 成为默认 WC realization。
- 不决定所有 Prototype 必须增加 wrapper 或 role annotation。
- 不允许 Adapter 把 logical boundary 自动解释为 focus、a11y、hit 或 native target。
- 不承诺完全隔绝外部 CSS、inheritance、custom property 或 host override。
- 不修改现有 spec entity、实现、测试或公开文档。

## 仍需 maintainer checkpoint 的问题

1. 是否认可 Shadow boundary 与 split presentation surface 为两个独立设计轴。
2. 是否认可短期保留现有 `shadow` opt-in、未来可能建立独立公开 Adapter profile但共享实现。
3. 是否需要把 `placementTarget` 接纳为第三个通用 host role，还是只建立 portable placement style semantics。
4. `feedback.style` 是否继续容纳 placement，或 placement 应进入独立 information channel / Module / Host Capability。
5. canonical token-role registry 的首批边界，以及 unknown token 的 surface fallback 是否为 normative behavior 或仅 compatibility policy。
6. 哪些 token 应为 composite，哪些必须要求显式 role，哪些应迁移到 positioning、visibility、hit 或 scroll 等既有 domain。
7. qualifier 最终采用保留的 `surface:` / `placement:` grammar，还是结构化 handle；Template node style 是否参与。
8. Shadow-local stylesheet 的交付、缓存、SSR/Declarative Shadow DOM 与 customization guarantee。
9. 哪些真实下游消费者或 hostile CSS 场景足以支持把实验 profile 提升为稳定 profile。

## 当前推荐 checkpoint

在进入 normative authoring 或 Adapter implementation 前，先接纳一个窄方向：

> Proto UI 可以实验 Shadow split-surface WC realization；Prototype author 不接触 raw host target，但 Root style translation 需要逐步获得 portable `surface` / `placement` 语义。无前缀 token 优先通过 canonical role 实现约定大于配置，未知 token 以 surface 作为兼容 fallback；高歧义和复合 token 必须经 inventory、translation design 与 cross-adapter evidence 后再获得稳定保证。

若该 checkpoint 被接受，下一步应先完成 role inventory 与两类代表 Prototype 的可证伪设计：一个简单视觉/交互 surface（如 Button 或 Toggle），以及一个 placement-sensitive surface（如 Dialog Content 或 anchored Content）。只有二者都能在 collapsed 与 split target 下保持约定行为，才值得确定公开 qualifier 和 Shadow Adapter profile。
