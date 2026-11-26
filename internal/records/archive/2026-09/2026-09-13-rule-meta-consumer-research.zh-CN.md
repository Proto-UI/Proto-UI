# Rule Meta 消费者、重评估与后续边界研究

日期：2026-09-13。基线：`a3ed9d7d2301d9569a82c6d7af875f34ae7c3ebd`，`0.3.0-alpha.0`。

本文是 #639 的非规范研究记录，依据[维护者研究授权](https://github.com/Proto-UI/Proto-UI/issues/639#issuecomment-5617765254)提交审查。推荐结论尚需维护者接受；本文不修改 API、实现行为或实体 lifecycle。

## 结论与请求的决定

建议继续推迟通用 Meta API 的命名与稳定化，保留现有两类生产消费：Shadcn 主题规则，以及 Transition 的 reduced-motion 时长读取。继续推迟的理由是 owner、订阅、作用域、跨 Adapter 等价性和迁移仍未确定，不能再用“只有主题一个真实消费者”作为完整盘点的结论。

本次还复现了一个可供下一步决策使用的具体需求：Shadcn Button 的 prop + meta 规则在主题翻转后保留旧配方，直到该实例发生交互、触发 Rule 重新求值。建议把**现有 colorScheme 规则的主题变更重评估与 Web 样式等价性**作为下一个有界提案，先确定通知与生命周期边界，不据此接纳任意环境 key 的通用订阅 API。

请求维护者接受本研究的消费者清单、证据与上述 continue-deferred 结论，并判断是否推进该主题重评估提案。#639 的研究合并不自动授权后续实现。

## 权威与证据边界

| 来源 | 当前状态与本研究的用途 |
| --- | --- |
| `D-RULE-META-NAMING-0001` | draft；主题能力已实现，扩展命名与通用环境抽象仍未定；治理期间保留主题行为。 |
| `C-RULE-WHEN-0002-E` | draft；host/environment 输入仍是二级或待治理抽象。 |
| `M-RULE-0001` | draft；Rule core 的编目不扩大 Meta、Context 或 state intent 的支持。 |
| `M-RULE-EXPOSE-STATE-WEB-0001` | draft；描述有条件的 State/Meta 到 Web selector 优化，不能据此推断所有 Rule 都由 CSS 执行。 |
| `C-AS-TRANSITION-0001-N`、`P-BASE-TRANSITION-REDUCED-MOTION` | draft；已规定 `reducedMotion=reduce` 时以 0ms 调度 fallback completion，保留 phase/event/ViewIntent 顺序。 |
| `P-BASE-TRANSITION-Q-REDUCED-MOTION-SOURCE` | 最终环境来源归属和重评估边界仍开放。 |
| `T-RULE-WHEN-0002#spec-meta-secondary-boundary` | planned；所列 `packages/spec/graph/test/meta-secondary-boundary.test.ts` 尚不存在，不能当作已执行的治理检查。 |

`internal/records/2026-09-08-rule-catalog-boundaries.zh-CN.md` 记录了主题侧的编目背景，不是完整 Meta 消费清单。`internal/contracts/_debt/rule.deferred-semantics.md` 提供命名债务解释；Transition 的消费还见 `internal/contracts/prototype-base/transition.v0.md`。本研究保持这些历史记录不变。

当前有 `@proto.ui/module-rule-meta` package、`RuleMetaModuleDef`、`RULE_META_GET_CAP` 和公开的源码类型，但没有独立的 `M-RULE-META-*` 或 `HC-META-*` catalog identity。包和类型存在不构成新的稳定环境保证。

## 完整的仓内生产消费清单

对 `packages/**`、`apps/**`、`spec/**`、`internal/**` 的 `when.meta`、`w.meta`、`run.meta`、`RULE_META_GET_CAP`、`createDefaultMetaGetter` 与具体 key 交叉搜索，在本基线找到以下 authored 消费：

| 消费者 | 代码 | 输入及解释 |
| --- | --- | --- |
| Shadcn Button | `packages/prototypes/shadcn/src/button/button.proto.ts` | 5 个 `colorScheme === dark` 条件，均与 `variant` prop 组合，部分还依赖 hovered/focusVisible；影响 outline 与 destructive 配方。 |
| Shadcn Checkbox Root | `packages/prototypes/shadcn/src/checkbox/root.proto.ts` | 1 个 dark 条件，选择 Checkbox 的展示配方。 |
| Shadcn Switch Root | `packages/prototypes/shadcn/src/switch/root.proto.ts` | 2 个 dark 条件，分别与 checked false/true 组合。 |
| Shadcn Textarea Root | `packages/prototypes/shadcn/src/textarea/root.proto.ts` | 1 个纯 dark 条件，选择输入表面的展示配方。 |
| Base `asTransition` | `packages/prototypes/base/src/transition/as-transition.proto.ts:90` | 直接读取 `currentRun?.meta?.get('reducedMotion')`，决定 fallback completion 的有效时长。 |

九个生产 `when.meta` 调用全部使用 `colorScheme`。`reducedMotion` 是同一 Module facade 的真实非主题消费，但它走直接 getter，不是第二种 Rule 条件。没有发现第三种生产 Meta key；这不是外部消费者或动态生成代码的穷尽性声明。

`asTransition` 的读取通过以下七个 Base 入口传播：Transition 本体、Select Content、Dropdown Content、Tooltip Content、Hover Card Content、Dialog Content、Dialog Overlay。对应源码分别位于 `packages/prototypes/base/src/{transition,select,dropdown,tooltip,hover-card,dialog}/`。Shadcn/Brutalist 的相关 compound 再复用这些 Base 入口；它们没有因此产生新的 Meta key，也不能被算作七种独立环境需求。

以下匹配没有被算作需求：Collection 的 `getMeta`/item metadata、Overlay/Focus/Boundary 的 request metadata、`import.meta`、包与 release metadata、测试里的自定义 getter、CLI 的 `colorScheme === light` 负向提取样例，以及与 Meta 无连接的 CSS media query。仓内暂无明确消费者要求通过 Meta 取得 viewport、locale、network、forced-colors 或任意环境对象；这些名字不应仅因常见而进入接口。

## 生产、读取、样式与生命周期

### Web 事实来源

`packages/adapters/base/src/platform/web-preferences.ts` 是四个官方 Web Adapter 的共同默认生产者：

- `colorScheme` 先检查 document root 的 `data-theme` 与 `dark`/`light` class；dark 条件在代码中先判断。没有明确标记时读取 `prefers-color-scheme: dark`，没有 Web 环境时返回 light。
- `reducedMotion` 读取 `prefers-reduced-motion: reduce`，缺少 Web 环境时返回 no-preference。
- 未识别的 key 返回 `undefined`。此 getter 不注册 media-query listener 或 MutationObserver。

`packages/adapters/{web-component,react,vue,vue2}/src/platform/meta.ts` 都复用这个 getter。各自 `src/adapt.ts` 在创建适配后的组件类型时选择 `opt.getMeta` 或默认 getter；各自 `src/runtime/modules.ts` 将同一 getter 接入 logical owner 与 view 两条 wiring。getter 从当前宿主读取事实；组件实例没有复制一份主题真相。

默认 getter 的范围是 document root，而不是一个已定义的逐子树主题域。CSS selector 可以受到祖先 class/attribute 影响；自定义 `getMeta` 也可能与 DOM 主题标记不同。现有证据没有建立这些组合的普遍等价性。本次浏览器证据使用默认 getter 和 Website theme owner，不覆盖任意自定义 provider。

### Rule 的默认执行路径

```text
when.meta(key) -> Meta dependency / When expression
              -> rule-meta beforePlan 提供 readMeta
              -> Rule evaluator 严格相等比较
              -> Feedback style plan -> Adapter/宿主样式
```

`packages/modules/rule-meta/src/create.ts` 注册一个 `beforePlan` extension。如果调用方已有 `ctx.readMeta`，它保留该 reader；否则在求值时解析当前 `RULE_META_GET_CAP`。直接 facade `get()` 也在每次调用时读取当前 capability，缺少 capability 时返回 `undefined`。

`packages/modules/rule/src/when-builder.ts` 记录任意 string key；`eval.ts` 按严格相等语义求值。缺少 reader 得到 `undefined`，不能泛称所有缺失 Meta 条件都为 false。

`packages/modules/rule/src/impl.ts` 在 mounted/updated 阶段求值，并只为 State dependencies 安装 watches。它没有 Meta-key subscription；Props 及 callback 同步可能引起后续工作，但改变宿主偏好本身不等于一个已接纳的 Rule invalidation 通道。`RuntimeController.getRuleStyleTokens()` 是显式调用 evaluator 的诊断读取；已有 `rule.meta.v0.contract.test.ts` 用第二次调用取得新值，不能由此证明自动 push。

### Web 优化和 CSS repaint

`packages/modules/rule-expose-state-web/src/create.ts` 只收集 State/Meta dependency、支持的 equality/conjunction 和 `feedback.style.use(tw(...))`。`colorScheme === dark` 可降为 `dark:`；Prop/Context dependency、不支持的表达式或 intent 留在默认执行路径。优化还要求实际 Web binding 或 native-variant policy，不能把 CSS token 发给没有相应执行器的宿主。

被优化的规则从默认 evaluator 输入中排除。CLI 的 `prototype-style-tokens.ts` 保证可识别形式的 token 提取；`proto-style-css.ts` 产生明确 dark 标记选择器及无明确标记时的 system media fallback。主题 CSS 变量还有自己的值解析。于是“颜色变了”可能来自 CSS 变量、dark selector 或 Rule 重评估，三者必须分别观察。

Button 的五条 Meta 规则都依赖 `variant` prop，不能通过当前 State/Meta-only candidate 门槛。其源码关于 dark 优化的注释表达了方向，但不能替代这一实际 eligibility 条件。Checkbox、Switch 和 Textarea 的相应规则可使用当前 Web lowering 路径。

### 资源与变更时点

| 路径 | 当前可观察边界 | 尚未接纳的推论 |
| --- | --- | --- |
| getter / Rule Meta extension | instance Module；按需解析 capability；无自身订阅资源。Rule terminal disposal 清空 extension 与 evaluator references。 | 任意 key 的统一缓存、通知、scope 或 provider replacement 事件。 |
| Rule driver | mounted/updated 时求值；State watch 触发求值；detach/unmount 停 driver、解除 watches、移除当前 runtime style，remount 重建；terminal dispose 清理规则与 State handle 表。 | Meta 变化必然在同一个时点触发所有消费者。 |
| Web lowering | detach/unmount/dispose 清理贡献和 optimized IDs；mounted、caps epoch、render commit 可重新尝试。 | 动态 provider/selector policy 更换时与默认计划完全等价。 |
| Transition | `run.meta` 转接同一 facade；machine 开始 phase 的 fallback 时读取有效 duration；dispose 取消 machine 工作并清空 `currentRun`。 | 正在等待的 fallback 会因偏好改变而自动重定时，或所有 CSS/宿主动画因此获得完整 reduced-motion 保证。 |

四个 Adapter 共享 Web 默认生产者，这是四个框架路径上的 Web 证据。没有 Flutter、Qt、GPUI 等非 Web provider、值域、订阅或时钟等价性证据。getter 的无 DOM fallback 也不代表整个 Adapter 或应用获得 SSR 保证。

## 可复现的浏览器观察

环境：Node 22.23.2、pnpm 10.32.1、macOS、Chromium 152.0.7977.83、1280×900。使用现有公共文档页面及其真实 Proto exports，没有复制组件 DOM、替换 getter、修改业务行为或关闭动画来制造结果。

[观察脚本](./evidence/2026-09-13-rule-meta/browser-observations.mjs)记录 4 个 Button journey、12 个其他控件 journey、6 个 Transition journey；[原始 JSON](./evidence/2026-09-13-rule-meta/observations.json)包含实际 tokens、computed paint 和可见状态标签变化。paint 在宿主 effects 与有限 CSS transitions 完成后读取；状态时序保留原始观测时间。

### Button：主题事实变化后，旧配方仍在

Web Component、React、Vue3、Vue2 的结果一致：

| 步骤                                      | destructive token   | 稳定背景 alpha |
| ----------------------------------------- | ------------------- | -------------: |
| 浅色挂载                                  | `bg-destructive/10` |            0.1 |
| 改成深色，不与该 Button 交互              | `bg-destructive/10` |            0.1 |
| 点击该 Button，再点击标题使其回到静态状态 | `bg-destructive/20` |            0.2 |
| 改回浅色，不与该 Button 交互              | `bg-destructive/20` |            0.2 |
| 再次交互后回到静态状态                    | `bg-destructive/10` |            0.1 |

主题 CSS 变量中的 destructive 色值已变化，但 alpha 配方未同步；后续 State 变化让默认 Rule 才读到新的 Meta。`P-SHADCN-BUTTON-COLOR-SCHEME-STYLES` 和实际 Button 规则提供 light/dark 配方依据。该 P criterion 仍为 draft，没有明确自动主题通知或刷新时限；`C-RULE-WHEN-0002-D` 要求各输入说明依赖变化是否、何时、如何触发重评估。本研究将观察归为具体主题刷新／视觉一致性需求，不把它写成已经接纳的稳定 Meta 自动订阅契约违约，也不在这里发明修复协议。

已逐张检查下面四对截图。它们展示同一个深色页面中交互前后的实际填充变化；截图不是另一套页面实现：

- [WC 交互前](./evidence/2026-09-13-rule-meta/wc-dark-before.png) / [交互后](./evidence/2026-09-13-rule-meta/wc-dark-after.png)
- [React 交互前](./evidence/2026-09-13-rule-meta/react-dark-before.png) / [交互后](./evidence/2026-09-13-rule-meta/react-dark-after.png)
- [Vue3 交互前](./evidence/2026-09-13-rule-meta/vue-dark-before.png) / [交互后](./evidence/2026-09-13-rule-meta/vue-dark-after.png)
- [Vue2 交互前](./evidence/2026-09-13-rule-meta/vue2-dark-before.png) / [交互后](./evidence/2026-09-13-rule-meta/vue2-dark-after.png)

交互式浏览器手工操作也复现了 WC 的 `/10 → /20` 差异。Button 页面通过 `prototype-modules.ts` 导入真实 Shadcn Button 源入口。

### 其他主题控件：无需交互即可 repaint

同样的 Light→Dark→Light 刺激下，四运行时的 Checkbox、Switch、Textarea 都在未与控件交互时改变背景，并在返回 Light 后恢复。JSON 同时保留 conditional tokens；这与当前 CSS lowering 路径一致，不证明存在 Meta subscription。

### Transition：第二类真实读取

现有 Transition 公共页面开放 WC、React、Vue3 三个运行时。本次没有把该页面当作 Vue2 或非 Web 的浏览器证据。

普通偏好下，可见标签从 leaving 到 closed 约 201–204ms，从 entering 到 entered 约 301–303ms；`reducedMotion=reduce` 下，对应观察间隔约 5–11ms。浏览器采样包含调度与 DOM 更新开销，不能将该间隔写成“精确 0ms”。精确的 0ms fallback、before/after 顺序和 ViewIntent sequencing 由 `packages/prototypes/base/test/as-transition.test.ts` 的 `AS-TRANSITION-2900` 验证。

## 三种方向的比较

| 方向 | 与真实需求的关系 | 所有权与迁移成本 | 本次建议 |
| --- | --- | --- | --- |
| 保留实验 surface | 同时容纳主题 Rule 与 Transition 的直接读取；无需改写现有消费者。 | 明确 pull、重评估、CSS lowering 的差别；修复需求仍应按消费者提出。 | 当前保留，并继续推迟通用稳定化。 |
| 聚焦主题 API | 可把主题来源、scope 和失效通知说得更明确，直接回应 Button 需求。 | 不能替换掉整个 Meta facade；必须另行保持 reducedMotion 路径，并决定默认 getter、自定义 provider、CSS selector 的等价边界。 | 值得在下一个有界提案比较；尚不选具体接口或 owner。 |
| 更广环境抽象 | 两个生产 key 提供了比“主题一个例子”更多的信息，但读法和更新时点不同。 | 需要确定 key/value 契约、scope、缺失值、订阅去重、owner/view lifetime、provider replacement、跨宿主生产者和兼容迁移。现有 `unknown` getter 不提供这些保证。 | 当前证据不足以稳定化；不从测试样例或常见环境字段补需求。 |

命名并非唯一问题：把 `meta` 换一个名字不会自动解决 Button stale recipe，也不会决定 Transition 是否应重定时。主题配方继续由 Prototype 解释，perceptual phase 与 ViewIntent 继续由 Transition/Runtime 各自解释；环境来源不应因此接管 State 写入或组件协议。

## 下一份有界提案的输入

建议下一步只围绕已有 `colorScheme` 消费，比较默认 Rule invalidation 与受限 Web lowering 的修复路径。需要维护者决定的边界是：谁发出有效主题变化通知、哪些实例/阶段订阅、如何保持默认 getter 与 Web selector 的一致性，以及自定义 provider 的支持范围。

本轮完整 Issue/PR/comment 扫描没有找到专门拥有该 prop + meta 配方滞留机制的 child。#568/#420 仍是既有 dogfood 总体入口；#573/#578 的 Website CSS closure、复制主题变量、renderer `surfaceStyle` 缓存及作用域修复没有改动这条 Button/Rule/Meta invalidation 路径。后续 child 应链接已有总体入口，并在认领前重新排重；本研究不替代这些进行中的任务，也不重新讨论 #454/#458 的 destructive 配方与对比度决定。

提案的验收应使用本次 Button 的 Light→Dark→Light 静态配方 journey，连同 Checkbox/Switch/Textarea 作为相邻消费者，覆盖首次挂载、detach/remount、terminal cleanup、重复订阅防护、显式主题与 system fallback。若允许自定义 provider 或子树主题，需要单列其与 CSS lowering 的等价条件；不能用默认 Website 的成功代替。

该提案不应顺带让所有 Meta key 获得响应式语义，也不重定时现有 Transition fallback。潜在规范修订沿现有 `D-RULE-META-NAMING-0001`、`C-RULE-WHEN-0002`、`M-RULE-0001`、`M-RULE-EXPOSE-STATE-WEB-0001` 和四 Adapter profile 追溯；是否需要新的 owner/HC 由独立决定解决，本研究不预建空实体。

## 验证与复现

运行观察脚本：

```sh
corepack pnpm@10.32.1 exec tsx internal/records/evidence/2026-09-13-rule-meta/browser-observations.mjs
```

它复用现有 browser harness 启动 docs server，或使用 `PROTO_UI_BROWSER_BASE_URL` 指定的既有开发服务；结果写到输出中给出的临时目录。复核截图与 JSON 后原样复制本目录中的九份生成文件。脚本是本次研究的观测工具，没有加入 CI，也不把当前实验性缺陷固定成新 contract。

已执行的 focused 验证为 12 个文件、64 项测试通过：Web preferences、Runtime Meta、Rule Web catalog、Base Transition、Shadcn Button/Checkbox/Switch/Textarea，以及四 Adapter 的 Rule Web integration。上述 planned Meta governance path 未执行，也未计入通过数。

`check:types` 通过，198 个 Astro 文件零错误、警告或提示；`check:agent-doc` 通过。完整 `pnpm test` 通过：461 个非浏览器文件、2,193 项测试通过，保留原有 3 个 skipped 文件和 34 项 TODO；18 个浏览器套件、82 项测试全部通过；release 脚本阶段 52 项测试通过。Scoped Prettier 与 `git diff --check` 通过。

独立 Agent 的本地事实审查未发现可操作问题，结论为 partial/ABSTAIN；它不构成正式批准。公开文档与产品实现未变，本研究没有单独执行本地 docs production build 或发布 package。当前观察和推荐的接受仍以维护者对实际 PR head 的 review 为准。

## #639 验收对应

| 验收 | 本记录中的交付 |
| --- | --- |
| 主题生产者、订阅、Rule 和样式证据 | 生产/读取/生命周期章节，默认执行与 CSS lowering 分离，现有源码与实际浏览器观察。 |
| 额外消费者或无扩展需求的明确结论 | 已确认 reducedMotion 是第二类生产读取；未发现第三种生产 key；没有据此提前接纳通用环境抽象。 |
| 当前实验、聚焦主题、广义方向比较 | 三种方向表与具体迁移代价。 |
| ownership、lifetime、命名、移植性与迁移 | 生命周期表、Web/profile 限制、自定义 provider/scope 未证实边界。 |
| 接受的后续提案或继续延期 | 请求接受本次 continue-deferred 推荐，并将已复现的主题重评估需求用于下一份有界提案；最终接受以维护者 review 为准。 |
