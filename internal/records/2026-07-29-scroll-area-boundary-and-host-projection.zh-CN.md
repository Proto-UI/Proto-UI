# 2026-07-29 Scroll Area 原型边界与跨宿主投影

> Internal record. Not normative. 本记录整理 Scroll Area 编目前的边界判断、跨宿主滚动模型、贡献者 PR 吸收方式与后续实体规划。稳定结论仍应提升到对应的 `K-*`、`D-*`、`C-*`、`M-*`、`HC-*`、`P-*` 与 `T-*` 实体；本文不替代这些真相源。

---

## 1）背景

贡献者通过 #339 与 #343 提供了 Scroll Area shell、Brutalist 投影、宿主滚动 metrics、Thumb ratio 与 pointer drag 的完整探索。两条 PR 证明 Scroll Area 对贡献者与 styled prototype library 都有现实价值，但也暴露了三个需要先于合并解决的问题：

1. Radix UI anatomy 是否应机械对应五个 Base prototype 实体。
2. Web DOM 的 `overflow`、element measurement 与 pointer capture 是否可以定义跨宿主协议。
3. Scroll Area 的宿主协同应由普通 authored asHook、特权 asHook、module、host capability 还是 adapter profile 拥有。

Proto UI 未来需要支持 Flutter 等非 Web 宿主，因此本轮不能把 `HTMLElement`、CSS pixel、ARIA attribute 或浏览器原生滚动条提升为跨宿主本体。

## 2）当前结论

Scroll Area 应成为 Base prototype family，但 Scroll 应单独建模为 host-mediated domain。

跨宿主默认原则不是 Web 意义上的 `native-first`，而是：

> 默认由宿主拥有 scrolling engine、physics、惯性、overscroll 与输入整合；Proto UI 定义逻辑 surface、facts、requests、parts 协同和投影要求。

第一阶段支持两种 chrome projection：

- `system`：宿主拥有 scrolling engine 与系统 scrollbar chrome。
- `composed`：宿主仍拥有 scrolling engine，Proto UI authored `Scrollbar` / `Thumb` 投影自定义 chrome。

完全由 Proto UI 模拟滚动 physics 的实现不属于第一阶段保证，也不得与 `composed` 混为一谈。

## 3）三条相互独立的轴

Scroll Area 不应使用一个 `native | custom` 枚举同时表示所有实现选择。至少需要区分：

1. **engine ownership**：`host` 或未来可能出现的 `synthesized`。
2. **chrome projection**：`system`、`composed` 或由宿主决定的 `auto`。
3. **accessibility projection**：由 A11y host capability 投影到 ARIA、Flutter Semantics 或其他平台 accessibility surface。

第一阶段固定 `engine ownership = host`，只协商 chrome projection。这样 Web adapter 可以用原生 overflow 加系统 scrollbar，也可以保留原生 overflow 并投影自定义 Scrollbar；Flutter adapter 可以用 `Scrollable` / `ScrollController` 配合系统或 authored scrollbar，而无需复制 Web DOM 策略。

## 4）Prototype 边界

本轮采用《原型边界》的信息通路判断，而不是按 Radix anatomy 名称机械拆分。

### 4.1 `P-BASE-SCROLL-AREA`

整体组件与 Root protocol 合并。Root 是 family anchor 和 projection policy 的组合边界，但不直接拥有宿主 scroll offset。

### 4.2 `P-BASE-SCROLL-AREA-VIEWPORT`

Viewport 是 scroll surface 的逻辑 owner，负责声明 axis、接收宿主 facts、发出 scroll requests，并维持与当前 host target/view epoch 对齐的 scroll session。

### 4.3 `P-BASE-SCROLL-AREA-SCROLLBAR`

Scrollbar 是 composed projection 下的独立 scroll control。它拥有 orientation、track/thumb pointer route、page increment 与 drag request；system projection 下可以不 materialize 或不参与交互。

### 4.4 Thumb

Thumb 默认不成为第二个 scroll controller。Pointer input 应由 Scrollbar 的同一语义 route 拥有，Thumb 作为该 route 的 hit subregion 和位置反馈。

如果官方继续稳定暴露 `asScrollAreaThumb` 作为高频 styled authoring entry，可以保留 feedback-only 的 `P-BASE-SCROLL-AREA-THUMB`；其 criteria 必须明确它不拥有 offset、drag session 或独立 accessibility control。

### 4.5 Corner

Corner 当前既没有独立信息通路，也没有必要的动态 feedback。它可以是 host component composition 中的普通视觉结构，但不应仅因 anatomy 命名而拥有 Base prototype 或 `P-*` 实体。现有 #339 Corner shell 应在实现校准阶段降级为宿主层结构。

## 5）Scroll domain 与特权 asHook

不应让整个 Scroll Area 组件身份等同于一个特权 asHook。建议分层为：

```text
Base Scroll Area authored protocols
  -> privileged asScrollSurface() / possible asScrollControl()
    -> Scroll module
      -> Scroll Surface host capability
        -> adapter/compiler projection
```

- `asScrollArea*` 属于 Base prototype protocol authoring entries。
- `asScrollSurface()` 是可供 Scroll Area、Select viewport、virtualized collection 等复用的受限能力。
- Scroll domain 本身不由单个 asHook、State、Event、Expose 或 adapter 独占。
- 特权 asHook 应采用 no-arg once/singleton caller，并通过稳定 handle 提供 setup-time configure、observed facts 与 requests。

## 6）Module 与 host capability 边界

Scroll module 应拥有：

- logical surface/control identity 与 family binding；
- facts/request 的归一化；
- `auto | system | composed` preference 与宿主 capability 的协商；
- view epoch、attach/detach 与 session lease；
- request/fact 因果与冲突诊断。

Scroll host capability 应拥有：

- 把 logical surface/control 解析到当前宿主 target 或 widget/controller；
- 建立、更新和释放有界 scroll session；
- 读取 offset、extent、viewport extent、overflow 与 scrolling activity；
- 接收 `scrollTo`、`scrollBy`、page increment 与 thumb drag 映射后的请求；
- 报告 `system` / `composed` 支持范围及最终 resolved projection；
- 使用宿主单位、布局时机、方向规则、physics 和 accessibility surface 完成投影。

原型作者不得读取 raw `HTMLElement`、Flutter controller 或宿主 geometry object。精确、持续变化的几何值不应被伪装成作者可写 State；它们可以通过 module-owned observed facts、host-local feedback projection 或 bounded diagnostic snapshot 暴露。

## 7）默认协商

建议 adapter profile/session 接受：

```ts
scrollProjection: 'auto' | 'system' | 'composed';
```

默认 `auto`：

- 只有 Root/Viewport 且没有 authored controls 时，优先 `system`。
- styled family 显式组合 Scrollbar/Thumb 时，优先 `composed`。
- preference 可以降级，但 declared requirement 不得静默降级。
- 不支持 required projection 时必须产生结构化诊断。

策略不应首先成为普通 Scroll Area maker prop，因为它描述的是 adapter/host projection policy。未来若真实产品场景需要逐实例覆盖，应另行讨论 preference 与 requirement 的输入位置。

## 8）Accessibility

Base Scroll contract 表达 scrollable surface、axis、range/position facts 与 scroll actions，不写死 ARIA。

- Web `system` 与 native-engine `composed` 优先保留原生 viewport 的滚动与键盘语义。
- 如果 authored Scrollbar 本身成为可聚焦、可键盘操作的 control，Web projection 必须满足 ARIA scrollbar 的 range、value、orientation、controlled target 与 keyboard 要求。
- Flutter projection 应使用平台 Semantics scroll actions，而不是复制 ARIA attribute 模型。

## 9）结构投影断口

host capability 是必要条件，但不足以独自解决 family 结构重写。当前 React/Vue adapter 以单个 prototype 为适配单位，Root、Viewport、Scrollbar 与 Thumb 通常由上层框架分别组合。

因此 system/composed 协商还需要：

- module 向每个 part 发布低频 `resolvedProjection` fact；
- system 模式下对 authored control 的 materialization/interaction suppression 规则；
- adapter/compiler 是否允许多个 logical part 折叠到一个 native widget 的后续契约；
- logical identity 与 host target 不再假定一一对应。

第一阶段可以要求 Web 两种 projection 都保留独立 logical family，只改变 chrome 与 control participation；跨 part 的 native widget collapse 留给后续 compound projection 设计。

## 10）贡献者 PR 吸收策略

采用以下方式保留贡献：

1. 从最新 `main` 建工作分支。
2. cherry-pick #339 中定义 Scroll Area shell 的核心提交，保留原作者署名。
3. 不继承已经被 `main` 取代的 release、Brutalist foundation 与生成文件历史。
4. #343 的 metrics、ratio、drag 和测试作为 `composed` projection 的实现证据选择性吸收。
5. 将直接 DOM measurement、raw element request 与 continuous geometry 状态重构到 Scroll module/host-cap session 后再提交。

这不是为了保护贡献而接受不合理的跨宿主契约，也不是通过重写历史否认已有工作；贡献者的交互探索会继续作为实现与测试基线存在。

## 11）实体规划

建议按一个垂直语义切片新增或修订：

- `K-SCROLL-DOMAIN-0001`：scroll surface、control、facts、requests、engine 与 chrome vocabulary。
- `D-SCROLL-PROJECTION-0001`：host-owned engine 与 system/composed projection 决策。
- `C-SCROLL-0001`：跨宿主 Scroll domain 契约。
- `C-AS-SCROLL-SURFACE-0001`：特权 hook 契约。
- `M-SCROLL-0001`：logical session 与 negotiation owner。
- `HC-SCROLL-SURFACE-0001`：宿主 scroll session capability。
- `T-SCROLL-0001`：module/host-cap conformance cases。
- 修订 `P-BASE-SCROLL-AREA*`，移除空壳 criteria 和无通路 Corner 实体。

所有新实体先保持 `draft`，并通过关系链与 executable tests 形成一个 coherent slice，不按 capability token 数量机械扩张。

## 12）仍需决定的问题

- portable facts 应只保证 normalized ratio/categorical overflow，还是也定义抽象 logical length。
- `asScrollSurface()` 是否同时承担 control registration，还是另设 `asScrollControl()`。
- horizontal RTL、writing mode 与 reversed axis 的规范化模型。
- bidirectional surface 是否允许一个 surface 同时绑定两个 Scrollbar control。
- authored control 的 track click、thumb drag、keyboard control 是否共享同一个 route owner。
- continuous thumb geometry 通过 feedback、adapter style sink 还是新的 host-local projection port 表达。
- scroll restoration、scrollIntoView、virtualization 和 nested scrolling 的归属与阶段。

---

## 参考

- `apps/www/src/content/docs/zh-cn/whitepaper/prototype-boundary.md`
- `spec/contracts/C-AS-HOOK-PRIVILEGED-0001.yaml`
- `spec/contracts/C-FOCUS-0001.yaml`
- `spec/contracts/C-AS-OVERLAY-0001.yaml`
- `spec/decisions/D-BASE-PROTOTYPE-INDEPENDENCE-0001.yaml`
- `spec/host-caps/HC-A11Y-0001.yaml`
- `internal/records/2026-07-04-switch-toggle-prototype-boundary.zh-CN.md`
- `https://github.com/Proto-UI/Proto-UI/pull/339`
- `https://github.com/Proto-UI/Proto-UI/pull/343`
