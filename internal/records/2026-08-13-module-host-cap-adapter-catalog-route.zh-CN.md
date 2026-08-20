# 2026-08-13 Module、host-cap 与 Adapter 编目路线

> Internal record. Not normative. 本记录保存 Module、host-cap 与 Adapter profile 编目的当前工作模型、首批顺序与审查问题。稳定语义应逐步提升到对应 `K-*`、`D-*`、`C-*`、`M-*`、`HC-*` 与 `T-*` 实体；本文不替代这些真相源。

## 背景

Proto UI 的 Module 封装一个协议子领域的逻辑。它同时面对三类使用者，但不向三者公开同一组能力：

- prototype author 通过 runtime 投影到 `def`、`run` 等句柄的 facade 使用受支持的作者语法；
- runtime、其它 module 与特权 `asHook` 通过受限 port 协调内部行为；
- adapter author 通过 wiring 提供 module 要求的 host capability，使协议逻辑可以在具体宿主落地。

因此 Module 编目不能只回答“仓库中有哪些 package”。它需要同时解释作者语法、内部特权边界、宿主要求、Adapter 支持情况、缺失策略与 executable conformance。

## 当前工作模型

### Module 的三类边界

每个 Module pass 至少审计以下三类接口：

1. **Facade**：能够经 runtime 简单封装后进入 prototype author 的 `def`、`run` 或 render/read surface。Facade 应保留阶段限制，不得泄漏 Adapter 或宿主对象。
2. **Port**：提供给 runtime、其它 module 与特权 `asHook` 的内部能力。Port 可以比 facade 更强，但不得因此成为普通作者 API；若作者确实需要使用，只能通过明确策略收窄的特权 `asHook` 暴露。
3. **Host capability**：Adapter 向 Module 提供的原子宿主能力。它表达 Module 落地协议逻辑所需的最低宿主事实或动作，不应机械对应每个 `cap()` token，也不应夹带某个框架或平台的实现对象。

### Adapter 的支持责任

Adapter profile 应明确自己支持、拒绝或降级哪些 Module：

- Adapter 不以接入数量为目标，而应对宿主实际能力保持诚实。
- Web-only 优化，例如 DOM attribute/CSS projection，不应成为非 DOM 宿主的通用要求。
- 当宿主能力低于 Proto UI 的 host-cap 基准时，Adapter 负责翻译、归一化或抹平差异；无法忠实满足时应拒绝支持或产生明确诊断，不得静默形成第二套协议语义。
- 可选 Module 需要定义不接入时的作者可见结果：语法不可用、fail fast、diagnostic、no-op 或允许降级。当前仓库在这一点上并不完整，不能从 package 存在推断所有 Adapter 都已支持。

Props 是所有正常 Adapter 的 required Module。缺失 Props 意味着适配结果无法接受 Maker 通过标准 Props 通路提供的配置，因此本阶段不设计“无 Props Module 但仍是完整 Adapter”的兼容模式。

### Lifecycle 的特殊位置

Lifecycle 没有独立 Module package，也不应为了编目对称性创建 `M-LIFECYCLE-*`。它是 Runtime 与 Adapter 之间的执行协议，负责 instance lifetime、repeatable view epoch、commit completion、update revision、host binding 与 terminal disposal。

后续 Module 的 resource ownership、host-cap attach/reset/rebind 和 cleanup 都应引用 Lifecycle 骨架，而不是分别重新定义生命周期。

## 首批顺序

当前路线为：

1. Props：校准 required Module、facade/port/host-cap 与 Adapter ingress 的表达方式。
2. Event / Default Action：完成第一条 Module -> host-cap -> Adapter -> Test 纵向闭环。
3. Lifecycle：补齐 Runtime -> React/Vue/Web Component 的 conformance，不创建 Module 实体。
4. State：纯协议、instance-owned、无直接 host-cap 的基础 Module。
5. Expose core：先编目 outward registry，再单独处理 Expose State 与 Expose Event 组合层。
6. Context：编目逻辑 instance identity 与 parent resolution 的 Adapter 边界。
7. Feedback：用 mixed resource ownership、EffectsPort、view replay 与 commit/flush 验证 Lifecycle 骨架。
8. 基础组合验收后，再进入 A11y、Focus、Overlay、Positioning、Text Control、Scroll 等外围或宿主协同更强的 Module。

## Props 首轮边界

Props Module 当前负责：

- setup-time prop declaration、default planning 与 watcher registration；
- raw snapshot 的 key-granular classification 与 resolved snapshot；
- raw/resolved watcher diff、coalescing、ordering 与 diagnostic task；
- 向 runtime 提供 host sync、direct raw application、callback-safe task consumption 与 diagnostics port。

Props Module 不负责：

- React props、Vue props/attrs 或 DOM property/attribute 的原始分类；
- Adapter 是否因 props 变化请求 render update；
- host render/commit scheduling；
- 将 raw escape hatch 提升为跨宿主 portable semantics。

当前 `RAW_PROPS_SOURCE_CAP` 表达一个 Adapter-provided raw snapshot source：Module 可以读取当前 adapter-normalized snapshot，并订阅“当前值可能已变化”的失效通知。通知不是 raw snapshot delivery event，也不隐含 watcher 或 render commit；Module 在 runtime 的同步点重新读取和比较 snapshot。

`controller.applyRawProps(nextRaw)` 是另一条 runtime/controller port 路径。它直接向 Props channel 应用 snapshot 并在 callback-safe window 派发 watcher，但不隐式 render。首轮保留两条入口并明确所有权，不把 controller action 误写成 host capability。

## Props 首轮需要验证的关系

- `M-PROPS-0001` 满足 `C-PROPS-0001` 至 `C-PROPS-0014`，并依赖 Props raw snapshot source host capability。
- Props 的哲学来源包括 Maker actor、information channel 与 portability tradeoff knowledge。
- runtime 固定安装 Props Module；official adapters 必须为它提供 raw snapshot source。
- React、Vue 与 Web Component 可以按宿主惯例收集不同输入，但提交给 Props Module 后必须满足相同的 raw/resolved snapshot contract。
- raw source rebind 必须取消旧订阅；terminal disposal 必须取消当前订阅；view detach 不应丢失 instance-owned Props state。

## 暂不定案

- 未来可配置 Runtime 是否允许完全移除 required Module，以及缺失时的统一 fail-fast 机制。
- Adapter profile entity 的正式 schema 与 `provides hostCaps` / `supports modules` 关系。
- `RawPropsSource.subscribe` 是否永远必需，还是未来允许 pull-only / push-only profile 使用更窄的结构。
- official Adapter 是否需要对 raw props normalization 建立独立 baseline contract，而不是只在 Props contract 与 adapter tests 中表达。
- Module facade、port 与 host-cap 是否需要在 schema 中新增结构化字段；首轮先用 criteria、relations、sources 与 test mapping 收集真实需求。

## 完成标准

一个 Module 语义切片只有同时满足以下条件才算完成：

- owner 与 non-owner 边界明确；
- facade、port 与 host capability 均有可追踪定义；
- required/optional 与缺失策略明确；
- host capability 足够原子且不携带单一宿主对象；
- official Adapter 的支持或拒绝有证据；
- `T-*` 映射到 criteria anchors 与真实实现；
- lifecycle/resource ownership 与 cleanup 可验证；
- catalog、implementation、tests 和 public projection 的漂移被解决或显式记录。
