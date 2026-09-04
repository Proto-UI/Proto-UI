# 白皮书重写的维护者方向与写作边界

日期：2026-08-28

本文记录 [Issue #473](https://github.com/Proto-UI/Proto-UI/issues/473) 所属白皮书重写企划在正式起稿前完成的维护者仲裁。它汇总 WPD-01 至 WPD-10 的决定，供章节蓝图、人工写作、后续 Spec 对账和审阅使用。

本文是 `internal/records/**` 下的时点记录，不是白皮书正文、Spec 实体或新的稳定保证。对于当前仓库和产品语义，仍应按照 `AGENTS.md` 与 `spec/README.md` 读取适用 Spec 实体及其 lifecycle。若本文中的理论方向与适用实体、实现证据或未来实践发生冲突，应显式进入维护者对账，而不是让任一层自动覆盖另一层。

## 背景与当前状态

旧白皮书早于现有 Spec 实体体系，是 Proto UI 许多核心概念的思想来源。随着 Prototype、Module、Runtime、Adapter、Host Capability 和机器治理体系逐渐形成，旧白皮书在论证节奏、术语、边界精度和当前证据状态上已经不足以承担下一阶段的理论传播。

本轮工作没有直接修订旧页面，而是先完成三个动作：

1. 对旧白皮书、当前 Spec graph、实现记录和公开投影进行来源核对；
2. 由维护者逐项仲裁权威关系、写作方式、理论边界、一致性、翻译责任和叙事结构；
3. 决定如何保留 [PR #550](https://github.com/Proto-UI/Proto-UI/pull/550) 中有价值的审计证据，而不让其成为新白皮书的自动写作基线。

截至本文记录时：

- WPD-01 至 WPD-10 均已由维护者决定；
- 旧的中英文白皮书页面仍保持原状；
- 尚未修改任何 Spec 实体或实现保证；
- PR #550 已于 `dc081c57168f1e58517557eb9ed9a909c59c514b` 关闭而未合并；
- [Issue #473](https://github.com/Proto-UI/Proto-UI/issues/473) 与 [Issue #478](https://github.com/Proto-UI/Proto-UI/issues/478) 仍保持 open。

## 决策摘要

| 决策 | 结论 |
| --- | --- |
| WPD-01 | 白皮书是哲学与方向来源；Spec 是其可机器治理的工程细化。冲突必须显式仲裁。 |
| WPD-02 | 核心理论、结构、最终措辞和插图由维护者负责；AI 可参与查证、质疑、润色辅助和校对。 |
| WPD-03 | 从空白重新起稿；旧白皮书只作为来源和历史材料，不作为逐行修订骨架。 |
| WPD-04 | `Maker` 是一般角色，`App Maker` 是较窄的软件制作侧身份；正式术语为 `information channel`。 |
| WPD-05 | 五条通路是当前核心可移植集合而非穷尽集合；State、lifecycle、Anatomy 等非通路概念保持独立分类。 |
| WPD-06 | 以参与者可辨认的信息通路关系判断 Component/Prototype 边界，并保留 feedback-only 附属结构这一工程例外。 |
| WPD-07 | 一致性采用条件一致性包络：共享基础越多，可比较层越多，允许的无解释差异越小。 |
| WPD-08 | Adapter、Compiler 与 hybrid 是同一翻译责任的不同实现形式；实现形式、能力实现、符合性结果和证据状态彼此正交。 |
| WPD-09（含前期 WPD-09A/B） | 以“跨技术变化寻找交互不变量”为主线，采用序章、三部和结语的推导结构。 |
| WPD-09C | Switch 为贯穿示例，Select 与 Scroll Area 为定点扩展；每章必须先通过蓝图评审。 |
| WPD-10 | PR #550 不合并；保留并致谢其中可核验的中性审计贡献，由维护者 record 接管后续方向。 |

## 1. 白皮书、Spec 与实践的关系（WPD-01）

采用有方向的细化关系：

`白皮书的哲学与方向 → Spec 的机器治理和工程细化 → 实现与可执行证据`

白皮书不是由 Spec 自动生成的说明书。它负责解释 Proto UI 为什么存在、相信什么、如何理解人机交互中的稳定抽象，以及这些思想如何导出工程体系。Spec 则把其中能够成为工程约束的部分细化为带 lifecycle、关系、criteria 和证据边界的可机器治理实体。

这不意味着白皮书可以直接覆盖当前 Spec，也不意味着实现漂移能够修改白皮书或 Spec。具体实践可以暴露错误、遗漏和错误的普遍化，从而推动维护者修正理论、Prototype、Spec 或翻译边界；修正必须被明确记录和审阅。

白皮书重写完成后，应另行研究是否在 Spec graph 中提供适合挂接 canonical 白皮书附件、理论出处或基础准则的治理位置。在该设计完成前，不创建临时实体来假装关系已经解决。

## 2. 人工写作与 AI 协助边界（WPD-02、WPD-03）

新白皮书从论证和手稿重新开始。旧白皮书可以作为来源、历史材料和反例清单，但不作为逐段替换的编辑骨架；旧八页的篇幅、章节切分和顺序都不预先继承。

维护者负责：

- 经验前提、理论主张和价值判断；
- 总论证、章节边界、例子选择和修辞节奏；
- 中文最终措辞；
- 插图的表达意图和最终验收；
- 对 AI 编辑建议的逐项取舍。

AI 可以用于来源追踪、事实核验、反例搜索、最强反驳、术语一致性、中英文语义对照、润色备选和校对。允许从维护者人工草稿出发获得润色建议，但维护者会重新打字和改写最终文本，而不是把模型输出直接作为正文来源。这里追求的是对思想、结构和最终表达的明确负责，而不是形式化统计每一个按键由谁产生。

中文版本是主要的理论写作表面。英文版本应在中文章节被接受后制作，以概念对等为目标，不能把机械翻译或 AI 语气重新引入为新的论证来源。

## 3. 总论证与 Proto UI 的核心假设（WPD-09）

白皮书不应从“组件是一种协议”直接起步。协议化不是最初前提，而是从问题和抽象需求中推导出的实现方法。

拟采用的总论证是：

1. 在人机交互、尤其 GUI 中，至少有一部分组件逻辑能够跨实现技术和技术生命周期保持可辨认、可抽象和可复用；
2. 现实中的框架与平台不断把这些交互逻辑重新绑定到各自的代码、渲染、生命周期和无障碍机制中，造成长期重复劳动；
3. Proto UI 从交互主体、参与者关系、责任和可观察语义中寻找组件的可移植身份，而不是从代码形式或视觉树切块中寻找；
4. `Prototype` 是 Proto UI 对这份交互“本质”的当前可执行近似，而不是对本质已经完成的终极定义；
5. 当这份近似必须由多个独立实现共享时，就需要明确角色、方向、时序、义务、兼容边界和符合性证据，因此整体呈现出可执行交互协议的性质；
6. Core/Runtime 和翻译层把近似投放到具体 Host，实际使用再暴露语义损失、宿主约束、缺失责任和错误的普遍化；
7. 维护者根据证据修正 Prototype、相关 Spec、翻译边界或更高层理论，持续逼近更可靠的跨技术交互基础设施。

这个经验前提尚未被严格证明，因此白皮书必须保持可证伪：它只主张在有边界的一类交互问题中存在重要的稳定逻辑，不主张所有 GUI 属性都天然可移植。Radix 等生态内的成功尝试可用于证明问题真实存在和局部复用有价值，但不能单独证明 Proto UI 的全部理论。

Proto UI 当前至少有三条并行主线：

- `theory-and-kernel`：理论模型、协议语法、机器治理、Core 与 Runtime；
- `prototype-library`：逐个探索组件身份并维护可执行近似；
- `translation-layer-and-ecosystem`：Adapter、Host Capability、翻译工具、符合性证据与生态接入。

原型库维护是一项重要的探索工作，但不是 Proto UI 的全部。

## 4. 术语、信息通路与相邻概念（WPD-04、WPD-05）

`Maker` 是消费、组装或配置 Component 的人、系统或代码的总称，可包括开发者、设计师、产品经理、上层系统和 AI Agent。`App Maker` 是在软件制作语境、特别是 Props/Expose 端点中更窄且更容易理解的身份。不能把所有 `Maker` 机械改名为 `App Maker`。

`information channel` 是正式理论术语；“信息流动”或 `information flow` 只是描述信息交换的措辞，不构成第二套模型。具体通路由以下内容共同定义：

- 谁向谁传递信息；
- 允许的方向或方向集合；
- 该关系承担的语义责任。

方向是具体通路身份的一部分。否则 Props 与 Expose 会坍缩为同一组 Maker/Component 关系，Event 与 Feedback 也会坍缩为同一组 User/Component 关系。Context 的双向性则是明确允许双向交换，而不是没有方向。

Props、Expose、Event、Feedback 和 Context 是当前已推导、已接纳的核心可移植通路，不是所有可能的信息通路。已知的 Host/Component 双向交换确实存在，但因为与 Host 强耦合，目前被有意排除在 v0/v1 Prototype 的核心可移植表达之外。未来只有在参与者关系、方向或语义责任无法被现有通路吸收时，才有理由接纳新通路；新的 API 或实现便利本身不足以构成新通路。

信息通路是组织 Prototype 的骨架，但不能解释全部现象：

- State 保存交互过程中的状态；
- lifecycle 组织语义在时间中的秩序；
- Anatomy 组织复杂 Prototype 中多个 part 的协作和关联。

这些是必要的非通路一级维度。与其相邻但应区别处理的概念包括：

- Rule 是语义明确、可分析的声明式/静态语义语法。它可以给解释器带来类似编译期分析的优化机会，但不能据此推断 Compiler 的额外运行时收益；
- `meta` 在哲学上可能接近一级概念，但现有工程证据不足，应暂不升级，白皮书若提及必须标为 provisional；
- `asHook` 与 Prototype 相邻而非隶属于 Prototype 的拆解维度。它是剥离独立交互主体后的逻辑复用形式，仍受 Prototype 约束，并带有额外的复用约束。

## 5. Component 与 Prototype 边界（WPD-06）

Proto UI 从人机交互参与者可察觉的现象判断 Component 身份。若一个结构不能被 User 察觉或影响，不能被 Maker 配置或观察，也不与其他 Component 交换信息，那么当前理论没有理由把它视为 Component。这个判断保持开放：如果未来找到满足上述所有“不可察觉”条件却仍必须拥有 Component 身份的实例，它将成为修正理论的真实反例。

当前边界规则为：

| 通路情况 | 分类与后果 |
| --- | --- |
| 不启用任何可移植信息通路 | 不是独立 Component/Prototype；作为 Host scaffold 或实现细节处理。 |
| 仅启用 Feedback | 允许作为父 Prototype 的附属子结构，也可在存在可靠复用边界时拆分。 |
| 启用 Event、Props、Expose 或 Context 中任一项 | 已形成独立参与者关系，必须拆为独立 Prototype。 |
| 仅存在 Host channel | 属于宿主相关结构，不因此进入当前可移植 Prototype core。 |

Feedback-only 例外是工程上的粒度妥协。否则 HTML `span`、`div`、Flutter `Stack` 等凡是产生布局或样式 Feedback 的结构都会被强制拆成极细的 Prototype。附属子结构可以设置 Feedback，但不能偷偷获得独立的 Event、Props、Expose 或 Context。

适合解释这一例外的设计案例是：气泡类组件中不可独立寻址的视觉尖角，或 Select 中固定且不可定制的下拉 caret。一旦 Maker 可以独立配置、替换或观察这个结构，或它启用了 Event/Context，就应拆为类似 `Select Arrow` 的独立 Prototype。父 Prototype 的 presentation prop 改变内部视觉，并不自动意味着内部结构拥有自己的 Props；关键在于它是否成为独立寻址的参与者。

当前官方 Prototype catalog 尚没有干净、稳定的附属 feedback-only 实例。`P-BASE-SWITCH-THUMB` 订阅同域 Context，是独立 Prototype，不能作为 feedback-only 示例；`D-TOOLTIP-PROTOTYPE-BOUNDARY-0001` 仍把 Tooltip Arrow 的几何和定位 Feedback 留作后续。因此上述尖角和固定 caret 只能作为解释性设计案例，不能写成现有官方实现事实。

State、lifecycle、Anatomy、Rule 和 `asHook` 不直接建立参与者关系，不能单独作为拆分判据。

## 6. 条件一致性包络（WPD-07）

Proto UI 要保持的是 Prototype 所声明的交互语义，Feedback 也是 Component 向 User 传递信息的通路，不能被降为语义之外的装饰层。

一致性应在两个明确的 realization context 之间比较。比较上下文至少应说明 Prototype revision 和输入、交互媒介、Adapter/Host capability profile、投影策略、渲染参数以及允许的 tolerance/exclusion。共享且受治理的基础越多，可直接比较的输出层越多，允许的无解释差异越小。

因此：

- 对所有声称支持的实现，Prototype identity、通路义务、State transition、lifecycle order 和被允许的替代分支保持相同；
- Host 对原始输入的识别细节，如点击合成、按下/抬起时间、touch slop 和误触阈值，可以不同，除非 Prototype 或可移植 recognizer 明确治理这些参数；
- 键鼠、触屏等不同媒介采用何种等价交互形式，由具体 Prototype 决定，翻译层不能自行把 dropdown 替换为 picker；
- 当媒介、viewport/device metrics、单位映射、字体与 shaping、色彩与 rasterization、native chrome 等相关输入均被明确控制时，像素一致可以成为最高强度的要求；
- Web-family 的结构一致性应比较 normalized DOM projection，而不是 HTML 字节或未经排除的 renderer artifact。

这些是理论上的比较规则，不等于当前所有 Adapter 已经拥有相应的 profile 和证据。未 catalog、已知 unsupported 或未经验证的目标不能自动继承一致性声明。

## 7. 翻译层、Adapter、Compiler 与损失（WPD-08）

翻译层的责任是把受治理的 Prototype 及其所需 Module 降低到目标 Host，同时保持已声明的交互语义、报告能力边界并产生 profile-bound evidence。它不只是语法转换。

Runtime Adapter、静态 Compiler 和 hybrid lowering 是非互斥的实现形式：

- Adapter 是当前已治理和实现的主要路径，负责 Runtime lifecycle、动态 Host binding、Module 支持/省略和 Host Capability 提供；
- Compiler 是未来可能的静态或 ahead-of-time 形式，适合在信息已知时分析并生成 Host artifact；当前它不是 Spec schema 的实体类型，也不是已经证明的完整 Prototype 产品；
- hybrid 可以编译静态部分，同时保留 Adapter/Runtime 处理动态语义、生命周期和 capability negotiation。

不能因为采用 Compiler 就自动宣称性能、保真度或原生质量更高。以下四个维度必须正交表达：

1. translation form：Adapter / Compiler / hybrid；
2. Host Capability realization：native / translated / emulated；
3. conformance outcome：faithful / authorized bounded degradation / unsupported；
4. evidence state：verified / planned / uncataloged / known unsupported。

只有 Prototype、Contract 或受治理 profile 可以授权有边界的 degradation。丢失 identity-critical 或其他必需义务属于 unsupported，不能用另一个维度的高保真来抵消。翻译实现应在最早可靠边界报告 degradation 或 inability。

白皮书可以解释完整的翻译解空间，但必须诚实说明：当前 `A-*` runtime Adapter profiles 是受治理的主路径；Compiler 是未来方向；React、Vue 与 Web Component 的现有证据只属于 Web-family，不能充当 Qt、Flutter 或其他非 Web Host 的符合性证明。

## 8. 新白皮书的叙事结构与例子（WPD-09、WPD-09C）

主线是：从真实的重复建设问题出发，提出有边界的交互不变量假设，推导 Proto UI 如何给出并执行近似，检验近似能否跨 Host 翻译，最后说明证据如何反过来修正近似。

拟采用以下结构：

| 部分 | 叙事任务 |
| --- | --- |
| 序章 | 用跨技术生命周期的重复劳动和生态内成功但受限的尝试建立问题，不把案例当作理论证明。 |
| 第一部：寻找不变量 | 讨论交互主体、参与者与 information channel，以及 Component/Prototype identity boundary。 |
| 第二部：使近似可执行 | 讨论 Prototype、时间语义、Core/Runtime、翻译层、Host capability、损失和符合性证据。 |
| 第三部：在实践中逼近 | 讨论约束、合法差异、非目标，以及理论/内核、原型库、翻译生态和证据反馈循环。 |
| 结语 | 回到面向过去与未来技术的长期交互基础设施愿景，同时保留明确的能力和证据边界。 |
| FAQ | 作为非线性参考，不再充当主论证的最后一章。 |

贯穿问题是：为了仍然成为同一交互主体，什么必须保持不变；什么可以随着实现、时间、媒介或 Host 合理变化？

例子策略如下：

- Switch 是主要贯穿案例，用于讨论跨框架重复实现、Switch/Toggle/Checkbox identity、信息通路、State、lifecycle、Root/Thumb Context 边界、可视投影和 Web-family 证据；
- Select 只在跨媒介替代形式和复杂结构处出现；
- Scroll Area 只在 Host-owned mechanics、capability negotiation 和有边界损失处出现；
- Radix 用于序章中的生态边界动机，不作为 Prototype identity 的模板或理论证明；
- Qt、Flutter 等尚未实现和验证的投放只能作为明确标注的 thought experiment。

每章在正文起稿前必须先完成并接受一份 private authoring blueprint，至少包含：reader question、不可缺少的一句话主张、从上章继承的前提、推导动作、例子推进、证据状态、最强反驳、negative boundary、插图机会、通向下章的 bridge、私有 source/entity map 和相对篇幅权重。准确字数只能在全部章节的主张和桥接关系通过蓝图评审后设定。

## 9. PR #550 的处置与贡献保留（WPD-10）

`cyjin-yl` 在 PR #550 中投入了多轮审计和修正工作。以下成果仍然有用，应在后续核验时保留其贡献来源：

- 旧页面的 claim inventory；
- sidebar 顺序与 footer link graph；
- 重复论证和阅读断点；
- 术语漂移；
- 中英文语义差异；
- 白皮书主张到 Spec 实体的 source mapping。

这些材料是研究证据，不自动决定新白皮书的理论或结构。PR 中建议的旧页面手术式修订路线、把特定一致性要求统一降为 aspiration 的判断，以及把 Rule、Anatomy、`asHook` 作为同一类 missing transition 的安排，均已被本轮更细的维护者裁决取代。

因此，PR #550 已在发布一份感谢与边界说明后关闭而未合并。PR discussion 与 commits 继续保留为有归属的研究历史；本文以重新核验和重新表述的方式记录仍有用的中性结论，并明确感谢 `cyjin-yl` 的审计贡献。关闭原因是任务方向与写作责任发生变化，不是否定审计工作的价值，也不要求贡献者继续替维护者修正理论。

## 明确不包含的决定

本文不授权或完成以下事项：

- 直接修改、删除或发布旧白皮书页面；
- 由 Agent 生成最终理论正文；
- 因白皮书措辞自动修改、晋升或覆盖 Spec 实体；
- 声称当前已经证明 Qt、Flutter 或一般非 Web Host 的一致性；
- 把解释性 feedback-only 案例写成现有官方 Prototype 事实；
- 合并 PR #550 或采用其中正文；
- 决定最终出版形式、发布时间或长期兼容承诺。

## 后续工作

### 章节蓝图

先为序章、三部各章和结语分别完成 blueprint。蓝图需要证明每章只推进一个不可缺少的主张，并清楚区分 current evidence、historical motivation、external evidence 和 hypothetical projection。

### 维护者手稿

维护者从空白开始写中文草稿。AI 继续承担查证、质疑、反例、编辑备选、术语和一致性审阅，但不直接形成最终理论正文。插图在对应章节的论证需求明确后再设计。

### Spec 对账

白皮书决定不会自动成为 Spec 变更。起稿和审阅期间应单独收集可能需要治理的事项，例如：

- 如何表达白皮书的 principle-source authority 与 Spec 的 operational adjudication；
- 是否为 Component/Prototype split rule 建立或调整适用实体；
- 是否需要明确的 comparison profile、normalized DOM 和 image evidence；
- 何时为 Compiler 建立独立身份与证据模型；
- `meta` 是否获得一级 lifecycle，或继续保持 provisional；
- 如何挂接 canonical 白皮书、理论出处和基础准则。

只有当其中某项形成独立、受审阅的工程保证时，才进入 K/D/C/P/T 或 schema 变更。

### 对等版本与发布

中文章节接受后，再制作英文 conceptual-parity 版本并做人工语义审阅。公共页面替换、导航迁移、旧 URL 兼容和独立出版应分别形成有明确验收边界的后续工作。

## 复审触发条件

出现以下任一情况时，应新增较新的 record 或进入对应 Spec 决策，而不是悄悄改写本文：

- 章节蓝图证明当前总论证存在断裂或需要新的主线；
- 找到没有任何参与者或 Host 信息关系，却仍必须成为 Component 的可信反例；
- 新通路满足正交的参与者关系、方向或语义责任；
- 非 Web Host 的真实实现推翻当前 translation 或 consistency 边界；
- 适用 Spec lifecycle 或保证发生变化；
- 维护者改变人工写作、例子或出版策略。

## 主要来源

- 仓库权威与 record policy：`AGENTS.md`、`spec/README.md`、`internal/records/README.md`
- 旧白皮书：`apps/www/src/content/docs/{zh-cn,en}/whitepaper/**`
- 组件与参与者：`spec/knowledge/K-COMPONENT-INTERACTION-0001.yaml`、`spec/knowledge/K-COMPONENT-ACTOR-0001.yaml`
- 信息通路与取舍：`spec/knowledge/K-INFORMATION-CHANNEL-0001.yaml`、`spec/knowledge/K-DESIGN-TRADEOFF-0001.yaml`、`spec/contracts/C-CORE-CHANNEL-0001.yaml`
- 核心相邻概念：`spec/contracts/C-STATE-0001.yaml`、`spec/contracts/C-LIFECYCLE-0001.yaml`、`spec/contracts/C-ANATOMY-0001.yaml`、`spec/contracts/C-RULE-0001.yaml`、`spec/contracts/C-AS-HOOK-0001.yaml`
- 翻译层治理：`spec/decisions/D-ADAPTER-PROFILE-0001.yaml`
- Switch 例子边界：`spec/prototypes/P-BASE-SWITCH.yaml`、`spec/prototypes/P-BASE-SWITCH-THUMB.yaml`、`internal/records/2026-07-04-switch-toggle-prototype-boundary.zh-CN.md`
- Scroll Area 边界：`internal/records/2026-07-29-scroll-area-boundary-and-host-projection.zh-CN.md`
- Tooltip Arrow 状态：`spec/decisions/D-TOOLTIP-PROTOTYPE-BOUNDARY-0001.yaml`
- 企划与审计历史：[Issue #473](https://github.com/Proto-UI/Proto-UI/issues/473)、[Issue #478](https://github.com/Proto-UI/Proto-UI/issues/478)、[PR #550](https://github.com/Proto-UI/Proto-UI/pull/550)
