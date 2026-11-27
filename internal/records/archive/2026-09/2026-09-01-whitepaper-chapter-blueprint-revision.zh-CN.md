# 白皮书章节蓝图修订：七章结构与收束安排

日期：2026-09-01

本文记录对 `2026-08-28-whitepaper-chapter-blueprint.zh-CN.md` 所作的章节结构复审。它为后续手稿规定章节职责和依赖顺序，不以尚未归档到当前 base/head 的正文草稿作为成立依据。它是维护者人工起稿使用的时点蓝图，不是白皮书正文、Spec 实体、稳定保证、产品路线图或公共发布计划。

本文替代旧蓝图中的以下部分：

- “序章 + 三部九章 + 结语”的阅读架构；
- 原第二部第四至第七章的拆分；
- 原第三部第八、九章的拆分；
- 由上述编号派生的例子、插图和手稿顺序。

旧蓝图的序章和第一部三章仍然适用；其中已经形成的来源追踪、证据标签、反驳、negative boundary 与写作纪律也继续适用。本文不重写旧记录来掩盖结构怎样变化。

## 1. 为什么需要修订

这次调整不是单纯为了降低作者的写作负担。复审采用的判准是：读者尚有哪些不可跳过的问题、每章是否推进新的主张、内容是否属于白皮书而不是 Spec、路线图或工程指南，以及相邻章节的计划职责是否发生重复。

按照这些判准，当前结构存在三个可以直接从章节职责中检查的重叠：

1. State、Anatomy 与 Lifecycle 可以在同一章内沿“事实怎样保存、结构怎样成立、语义何时运行”连续推导；把 Lifecycle 单独成章会重复建立前提。
2. 翻译层一章必须解释 Host artifact、Adapter/Compiler/hybrid、翻译结果、能力边界、诊断和证据；原一致性章节若再次承担这些职责，就会重复建立翻译前提。
3. 原“设计约束”与“在实践中逼近”两章存在明显重叠：负边界只有放入可证伪、可修正的反馈循环中，才不会变成静态禁令；反馈循环也只有带着明确边界，才不会成为无限扩张的借口。

本轮写作讨论中，作者对后续章节信息新增量的担忧只是一项仓库外背景观察，不是删减章节的证据。独立于这项感受，按上述职责进行复审仍会得到同一结论：一致性与实践修正各有一条不可替代的主张，但没有必要维持原来的四个后续章节。

## 2. 修订后的阅读架构

采用“序章 + 三部七章 + 结语”。FAQ 继续作为非线性参考，不计入主论证章节。

| 顺序 | 部分 / 章节（工作标题） | 唯一不可缺少的推进 | 相对篇幅权重 |
| --- | --- | --- | --: |
| 0 | 序章：重复消失不了 | 跨技术生命周期反复重建相似交互责任，使“是否存在可移植不变量”成为值得检验的问题。 | 7 |
| I-1 | 代码之前的组件 | 一个组件可以先作为可辨认的交互主体被讨论，再表现为某种 Host 实现。 | 8 |
| I-2 | 从交互关系出发 | 参与者、方向和语义责任共同导出 information channel，而不是 API 名称导出通路。 | 10 |
| I-3 | 组件的边界 | 独立参与者关系决定 Component/Prototype 边界，feedback-only 保留粒度例外。 | 12 |
| II-4 | 通路之外的语义 | State、Anatomy 与 Lifecycle 分别补上内部连续性、复合结构和时间秩序，使 Prototype 接近可执行。 | 16 |
| II-5 | 翻译层 | Module 与 Host Capability 降低翻译工程的重复成本；翻译形式可以不同，但必须说明语义结果、能力边界和证据。 | 18 |
| II-6 | 一致性的条件 | 一致性是在两个已声明 realization context 之间的条件比较；共享且受控的基础越多，要求越严格。 | 12 |
| III-7 | 在边界中逼近 | Proto UI 以明确非目标约束近似，再让理论/内核、原型库与翻译证据共同修正它。 | 10 |
| 8 | 结语：为过去与未来保留交互知识 | 长期目标是让交互知识不再被单一技术生命周期独占，而不是冻结技术或宣称已经找到终极本质。 | 7 |

权重总计为 100，只表达论证注意力，不是字数配额。第六章应明显短于第五章；第三部也不应重新扩张成项目全景介绍。

### 三部的叙事责任

- 第一部“寻找不变量”回答我们在寻找什么、如何观察它、怎样划定交互主体。
- 第二部“使近似可执行”回答 Prototype 怎样保存事实、形成结构、进入时间、被翻译，并在不同 realization 之间接受比较。
- 第三部“在实践中逼近”只回答两件事：这份近似在哪里停止，以及失败证据怎样推动它被明确修正。

贯穿问题保持不变：

> 为了仍然成为同一交互主体，什么必须保持不变；什么可以随着实现、时间、媒介或 Host 合理变化？

## 3. 第一部与第二部前两章的计划职责

为避免第六章重复前文，当前蓝图把第四、第五章应当承担的边界记录如下。这些是手稿的前置约束，不证明对应正文已经存在或已经接受。

### 第二部 · 第四章：通路之外的语义

**Reader question**

如果 information channel 已经组织了 Component 与外界的关系，为什么一份 Prototype 仍然不能只靠这些通路运行？

**一句话主张**

Information channel 只说明信息在参与者之间怎样交换；State、Anatomy 与 Lifecycle 分别补上内部连续性、复合结构和时间秩序，使 Prototype 接近可执行，同时不把 Host 的状态方案、组件组装和 framework lifecycle 写成跨技术本体。

**继承前提**

第一部已经把 Component 视为交互主体，用 information channel 描述其外部关系，并用参与者关系划定独立 Prototype 边界；但这些结论尚未说明内部事实怎样持续、多个独立 part 怎样属于同一 family，以及语义何时成立。

**推导动作**

1. 回到 Switch 的通路关系图，指出 Event、Feedback、Props、Expose 与 Context 能说明信息从哪里来、到哪里去，却没有地方保存当前 `checked`。
2. 用 State 表达一个 Component 在前后交互之间持续存在的内部事实；同时明确 State 的变化不会自动决定 Feedback、Expose 或 Context 怎样更新。
3. 从第三章拆出的 Switch Root/Thumb 与 Select parts 推导 Anatomy：它声明 family、role、relation 与结构范围，但不创建 part、不替 Maker 组合 UI，也不替 Context 交换信息。
4. 引入 Lifecycle，说明 State、Anatomy part 和通路义务都需要时间秩序；重点区分一次 `setup` 与持续到 dispose complete 的 `runtime`，并说明暂时 detached 不等于 instance 已销毁。
5. 用一份 TypeScript 风格 Switch 教学伪代码串起 Props 声明、State、Anatomy、Event、Expose、Context、Feedback 与 Lifecycle，使“接近可执行”成为可观察推进，而不是停在概念列表。
6. 用一次 activation 收束：Root 保存或请求新的 `checked`，显式发出 outward signal、更新 Context 并请求 Feedback；Thumb 接收 Context 后只保存派生展示事实。

**例子推进**

- Switch 是主例：Root 是 `checked` 的 value owner，Thumb 是同一 Anatomy family 的独立 part，并通过 Context 获得派生事实；伪代码不得在 Root 内创建 Thumb。
- Select 只用于说明复杂 family：Root、Trigger、Content 与 Item 可以拥有稳定结构身份，但真实组合仍由 Maker、上层系统与 Host 建立。
- 不在本章引入第三个完整组件案例。

**证据状态**

- maintainer theory direction：WPD-05、WPD-06 与本轮 State/Anatomy/Lifecycle 合章决定；
- draft：`C-STATE-0001`、`C-ANATOMY-0001`、`C-LIFECYCLE-0001`、`K-PROTOTYPE-COMPOSITION-0001` 及其适用的后续 criteria；
- current implementation/test evidence：Switch Root/Thumb 的 State、Anatomy、Context、Lifecycle 与 RuntimeSession 局部证据；
- teaching projection：本章伪代码只演示已经介绍的语义，不是稳定 Core API 或完整官方 Switch source；
- current limitation：这些 draft entities 和 Web-heavy evidence 不能证明所有 Host 已有完整映射。

**最强反驳**

State、结构树和 lifecycle 都是现有框架早已提供的实现工具；把它们写进 Prototype 只会重新发明一个更抽象、能力更弱的框架。

**本章必须正面承认**

Host 的状态、结构和生命周期机制仍然真实且必要。Proto UI 不要求所有技术采用同一实现，而只表达保持交互主体所需的可移植事实、结构身份和相对时间义务；具体 Host 无法映射时，边界留给翻译层报告。

**Negative boundary**

- 不把本章写成完整语法或句柄参考；
- 不展开 Rule、`asHook`、Focus、Accessibility、`meta` 或具体 `def` / `run` API；
- 不把 Anatomy 写成 Prototype composer、assembler、实例注册表或 Context 的替代品；
- 不声称 State 变化会隐式完成 render、Feedback refresh、Context update 或 Expose emission；
- 不把 `setup` 等同于编译期、模块加载期或任意 framework hook；
- 不把一次 Host view unmount/detach 自动等同于 Component disposal；
- 不因合并章节而承诺所有 Adapter 的完整 Lifecycle 符合性。

**插图机会**

优先使用一张时间与语义分层图：上方是一次 `setup` → 持续 `runtime` → dispose complete，下方将 Switch 的 State owner、Anatomy Root/Thumb 与通路更新放到相应阶段。若图面过载，Anatomy family 关系改用旁侧小图，不再增加独立概念总览。

**通向下章的 bridge**

至此，Prototype 已经能够表达外部关系、内部事实、复合结构和时间秩序；但 React、Flutter、Qt 等 Host 并不会直接执行这些义务。下一章需要说明谁负责把它们变成具体技术中的产物。

**私有 source / entity map**

- `internal/records/2026-08-28-whitepaper-rewrite-maintainer-decisions.zh-CN.md` WPD-05、WPD-06；
- `C-STATE-0001`、`C-ANATOMY-0001`、`C-LIFECYCLE-0001` 及适用后续 criteria；
- `K-PROTOTYPE-COMPOSITION-0001`（draft）；
- `P-BASE-SWITCH`、`P-BASE-SWITCH-THUMB` 与对应 Tests；
- `P-BASE-SELECT*` 只用于复杂 family 例子；
- 旧 `execution-semantics.md` 只作历史解释来源。

**相对篇幅约束**

权重为 16，是全篇第三重的章节。State、Anatomy、Lifecycle 必须形成一条连续推导；Switch 伪代码用于证明模型已经接近可执行，但不得扩张成 API 教程或逐行实现说明。

### 第二部 · 第五章：翻译层

**Reader question**

有了接近可执行的 Prototype，怎样把它落到 React、Flutter、Qt 或其他 Host，而不为每种技术重新建造一套边界模糊的跨端框架？

**一句话主张**

翻译层负责把 Prototype 及其所需语义义务降低到目标 Host：Module 复用可移植责任，Host Capability 定义最小对接点，Adapter、Compiler 与 hybrid 决定实现形式；无论采用哪种形式，翻译都必须说明 Host artifact、能力边界、语义结果和证据。

**继承前提**

按照第四章的计划职责，Prototype 将具备外部通路、内部事实、复合结构和时间义务，同时明确这些语义不决定 Host 怎样管理状态、创建结构、调度 lifecycle 或生成最终产物。

**推导动作**

1. 区分 Prototype、Host 与 Host artifact：Prototype 描述跨技术身份和义务，Host 提供具体结构、输入、生命周期和渲染条件，Host artifact 是翻译后在目标技术中真实存在的实例、代码、类、绑定或组合产物。
2. 从“每个翻译器是否要重写全部逻辑”的工程风险出发，引入 Module 与 Host Capability。Module 封装可复用语义责任；只有需要 Host 事实或动作时才提出最小 Capability，它们不与前文概念机械一一对应。
3. 用 Context 的 instance token 与 logical parent 需求说明相近 Host 可以共享 Module 逻辑，同时用 State/Lifecycle 反例说明并非所有语义都需要 Host Capability 或独立 Module。
4. 区分 Adapter、Compiler 与 hybrid：Adapter 是当前受治理的 runtime 主路径，Compiler 是未来静态形式，hybrid 可以拆分静态与动态责任；翻译形式不能自动推出性能、保真度或原生质量。
5. 区分表示形式变化与语义损失，并定义 faithful、authorized bounded degradation 与 unsupported。关键义务缺失不能被其他维度的高保真抵消，只有 Prototype、Contract 或受治理 profile 可以授权有边界降级。
6. 展开四条正交轴：translation form、capability realization、conformance outcome 与 evidence state；禁止用 `native`、package 存在、通过率或 Compiler 身份替代符合性结论。
7. 要求在最早可靠边界报告 degradation 或 inability，并把结论绑定到具体义务、Host/profile、runtime range 和证据范围。

**例子推进**

- Context 是模块化例子：不同 Host 可以用不同 token/parent 机制提供相同最小事实，不需要重写 Context 的全部查找与订阅语义；该例只说明工程切面，不声称 Context Module/Host Capability 已完整 catalog。
- Scroll Area 是主要扩展：Host 保留滚动 engine、physics 与 geometry，Prototype 只表达 portable logical surface、facts、requests 与经过授权的 projection；Web `overflow`、Flutter controller 或 Qt widget 都不是跨 Host 本体。
- Switch 用一句回扣：相同 outward signal 可以在 React 中成为 callback，在 Web Component 中成为 `CustomEvent`，API 形式不同并不自动构成语义损失。
- Terminal UI 只作 bounded degradation thought experiment，不能写成当前 official profile 或已验证实现。

**证据状态**

- maintainer theory direction：WPD-08；
- active：`D-ADAPTER-PROFILE-0001` 与 current official Web Adapter identities 已编目的局部 slice；
- draft/current implementation evidence：现有 Module、Host Capability、Adapter 与 Scroll 纵向切片，读取各自 lifecycle 和关系后使用；
- governance gap：通用 conformance outcome/diagnostic schema、完整 capability matrix 与若干 Module/Host Capability identity 尚未全部 catalog；
- future/hypothetical：Compiler 产品、Qt、Flutter、TUI 与一般非 Web Host；uncataloged 不等于 supported，也不等于 unsupported。

**最强反驳**

异质 Host 的能力、输入、结构和渲染模型差异过大；即使拆成 Module 与 Host Capability，每个翻译器最终仍可能接近重新实现一个跨端框架，所谓共享语义只会退化成空洞最低公分母。

**本章必须正面承认**

翻译层仍然可能昂贵，而且有些 Prototype/Host 组合确实会 unsupported。Proto UI 不承诺任意组合都能落地；它只尝试复用能够成立的语义责任，并让支持、合法损失、拒绝和未知都成为可说明、可验证的结果。

**Negative boundary**

- 不把 Module 列表或 Host Capability checklist 当作翻译器已经正确的证明；
- 不把 Adapter package、测试文件或 abstract Host 名称自动当作支持证据；
- 不把 `native` realization 自动等同于 faithful，也不把 emulated 自动等同于低保真；
- 不因采用 Compiler 就承诺性能、保真度、“更原生”或无 runtime；
- 不让翻译器自行授权 degradation，也不以其他维度高保真抵消 identity-critical 义务缺失；
- 不声称任意 Prototype library 接入 Proto UI 后已经自动获得可靠 accessibility；
- 不把当前 Web-family evidence 外推为 Qt、Flutter、TUI 或一般非 Web Host 的符合性证明；
- 不在本章建立完整 outcome schema、capability matrix 或编译器设计。

**插图机会**

主图展示 `Prototype / Modules → translation layer → Host Capabilities → Host artifacts`，并标出 Adapter/Compiler/hybrid 是翻译形式而非质量等级。若篇幅允许，再用一张四轴表说明 translation form、capability realization、conformance outcome 与 evidence state 不能互相替代。

**通向下章的 bridge**

翻译层可以回答一次 realization 履行了哪些义务、发生了何种损失、证据覆盖到哪里；但它还没有回答两个不同 realization 之间应当一致到行为、结构还是像素。第六章只处理这项条件比较。

**私有 source / entity map**

- `internal/records/2026-08-28-whitepaper-rewrite-maintainer-decisions.zh-CN.md` WPD-08；
- `D-ADAPTER-PROFILE-0001`（active）与 current official `A-*` Web profiles；
- current Module/Host Capability entities 与 executable evidence，按实际 lifecycle 使用；
- Context implementation 只作模块化示意，不据此宣称完整 catalog identity；
- `K-SCROLL-0001`、`C-SCROLL-0001`、`M-SCROLL-0001`、`HC-SCROLL-SURFACE-0001`、`P-BASE-SCROLL-AREA*` 与相关 Tests；
- `internal/records/2026-07-29-scroll-area-boundary-and-host-projection.zh-CN.md`；
- 旧 `translation-layer.md` 只作历史来源。

**相对篇幅约束**

权重为 18，是全篇最重的一章。篇幅优先用于“为什么翻译可被拆分、怎样诚实描述结果与证据”，而不是罗列 Adapter API、Module inventory 或未来 Compiler 设计；第六章不得重复本章术语教程。

## 4. 第二部 · 第六章：一致性的条件

**Reader question**

当两个 Host artifact 使用不同的结构、事件系统和渲染方式时，我们凭什么说它们仍然实现了同一个 Component；又应要求它们一致到行为、结构还是像素？

**一句话主张**

一致性不是某个 Host artifact 独自拥有的属性，而是在两个已声明 realization context 之间对受治理语义进行的条件比较：共享且受控的基础越多，可比较的输出层越多，允许的无解释差异越小。

**继承前提**

第五章负责说明每次翻译可能得到 faithful、authorized bounded degradation 或 unsupported 的结果，并且结论必须绑定到 Host/profile 和证据范围。第六章只消费这一计划前提，不重新定义它。

**推导动作**

1. 从“两个实现都 faithful，是否就必须长得一样”开始，说明单个 conformance outcome 仍不足以决定两个 realization 之间的比较强度。
2. 定义 realization context：至少包含 Prototype revision 与输入、交互媒介、Adapter/Host capability profile、投影策略、渲染参数，以及经过说明的 tolerance/exclusion。
3. 给出所有声称实现同一 Prototype 的结果都必须保持的底层义务：Prototype identity、information channel 方向与责任、State transition、Lifecycle order 和 Prototype 授权的替代分支。
4. 区分 Host 对原始输入的识别与 Prototype 对交互语义的治理。click synthesis、按下/抬起时间差、touch slop 和误触阈值可以由 Host 不同处理，除非 Prototype 或可移植 recognizer 明确接管这些参数。
5. 说明不同交互媒介之间的等价形式由具体 Prototype 决定。翻译层不能仅因平台惯例或实现便利，把 dropdown 自行替换为 picker。
6. 说明共享条件怎样逐层提高比较强度：同一 Prototype identity 是最低共同前提；相同媒介和相近 Host family 可以比较更多行为与结构；viewport、单位、字体 shaping、颜色、rasterization 等输入均受控时，像素比较才可能成为最高强度要求。
7. 用一小段收束证据边界：比较 profile 的 tolerance/exclusion 必须事先说明并可审阅，不能在看到差异后临时添加；现有 Web evidence 不能替非 Web Host 作证。

**例子推进**

- Switch 是主例：在相同 Prototype revision、相同输入、键鼠媒介、受控 viewport/单位/字体与同属 Web family 的条件下，React 与 Web Component realization 可以接受严格的 Feedback、normalized DOM 和图像比较；底层 click synthesis 的微小差异仍可能属于 Host 输入识别。
- Select 是唯一必要扩展：键鼠 dropdown 与触屏 picker 是否仍是同一 Select，不由 Adapter 自行判断，必须来自 Select Prototype 对媒介分支的授权。当前缺少该完整受治理分支时，只能把它写成设计问题或 thought experiment。
- Scroll Area 不作为第三个完整案例；只有在需要一句说明 system/composed chrome 的 projection 差异时才出现。

**证据状态**

- maintainer theory direction：`2026-08-28-whitepaper-rewrite-maintainer-decisions.zh-CN.md` WPD-07；
- draft：`K-DESIGN-TRADEOFF-0001` 与相关 Prototype identities；
- active partial evidence：`D-ADAPTER-PROFILE-0001` 和 current official Web Adapter profiles 已编目的局部证据；
- governance gap：comparison profile、normalized DOM 与 image evidence 还没有完整治理身份；
- hypothetical projection：Qt、Flutter、TUI 与完整跨媒介 Select 对照。

**最强反驳**

如果每次比较都允许声明大量 context、tolerance 和 exclusion，那么任何不一致都可以在事后被解释掉，使“一致性”变得不可证伪。

**本章必须正面承认**

该风险真实存在。Context 不是免责条款；每个 tolerance/exclusion 都必须在比较之前有明确理由、适用范围和证据责任。无法解释的差异不能因为 Host 不同就自动合法。

**Negative boundary**

- 不重复第五章的 Adapter/Compiler/hybrid、Module/Host Capability、三种翻译结果或 evidence-state 教程；
- 不承诺所有 Host、媒介或输入设备产生相同像素和操作细节；
- 不把“语义一致”降为“功能大概可用”；
- 不把未经治理的 native chrome、font 或 rasterizer 差异算成 Prototype 自身输出，也不在事后随意排除；
- 不把 HTML 字节相同当作 Web 结构一致；使用 normalized DOM projection 的设想仍须标明治理缺口；
- 不把当前 Web-family evidence 外推到 Qt、Flutter 或一般 native Host；
- 不在本章建立完整 comparison-profile API 或测试规范。

**插图机会**

优先使用一张“条件一致性包络”：核心为 identity/channel/state/lifecycle，向外依次增加相同媒介、相近 Host family、受控渲染参数与像素比较。图必须表达“共享前提增加，比较层增加”，不能画成由低级到高级的固定质量等级。

另一个可选图是两个 Switch realization context 的并列表：左侧列共同输入与受控条件，右侧列可比较输出和已声明 exclusion。若正文与主图已经说清，不再增加第二张图。

**通向下章的 bridge**

一致性只有在边界清楚时才可检验；但这些边界不是永恒真理。下一章需要回答 Proto UI 如何既不把所有现象吞入核心，又允许失败证据修正当前近似。

**私有 source / entity map**

- `internal/records/2026-08-28-whitepaper-rewrite-maintainer-decisions.zh-CN.md` WPD-07；
- `K-DESIGN-TRADEOFF-0001`（draft）；
- `D-ADAPTER-PROFILE-0001` 与 current official `A-*` Web profiles；
- `P-BASE-SWITCH*`、`P-BASE-SELECT*`，必要时一句引用 `P-BASE-SCROLL-AREA*`；
- 旧 `execution-semantics.md` 与 FAQ 的一致性段落只作历史来源；
- 已知缺口：comparison profile、normalized DOM、image evidence。

**相对篇幅约束**

正文建议控制在第五章的约二分之一至三分之二。它只需完成“比较对象—不变量—条件增强—媒介边界—可证伪性”五步，不需要再建立一套翻译治理术语。

## 5. 第三部 · 第七章：在边界中逼近

**Reader question**

如果 Prototype 只是当前近似，Proto UI 如何避免一边把所有 GUI 问题无限吸入核心，一边又把早期抽象固化成不可反驳的教条？

**一句话主张**

Proto UI 的可信度来自两种约束同时成立：它明确拒绝把所有现象伪装成可移植语义，又让 theory-and-kernel、prototype-library、translation-layer-and-ecosystem 产生的失败与使用证据显式修正当前近似。

**继承前提**

第二部依次负责说明 Prototype 怎样执行、翻译和接受一致性比较，并暴露未支持 Host、未经治理差异和错误抽象都可能出现。

**推导动作**

1. 重申经验前提的边界：Proto UI 只假设一类重要交互逻辑值得跨技术保存，不主张所有 GUI 属性都天然可移植。
2. 给出最少的非目标：Proto UI 负责 Component 级交互语义，不负责业务接合、完整应用组合和框架级调度；Host-specific 能力可以重要，但不自动进入 portable core。
3. 把原“设计约束”改写成可检验的所有权问题：每项限制必须说明它保护了哪项 identity、translation 或 evidence 责任，而不能以“保持纯粹”为理由无限禁止需求。
4. 区分三条工作主线：理论与内核维护表达和治理基础；原型库逐个探索 Component identity；翻译层与生态检验这些近似能否被不同 Host 承接。
5. 展示反馈循环：提出近似 → 编写 Prototype → 经 Core/Runtime 和 translation 落地 → 收集 conformance、失败与使用证据 → 判断问题属于 implementation drift、translation capability 缺失、Prototype 错误还是理论过度普遍化 → 显式仲裁修正对象。
6. 说明白皮书、Spec 与实践的方向关系：实践可以推动修正，但不能静默覆盖白皮书或 Spec；record、draft entity、active guarantee 和 executable evidence 也不能互相替代。

**例子推进**

以 Switch 作整篇回顾：从 Switch/Toggle/Checkbox identity、Root/Thumb 边界、State/Lifecycle、Web translation 到未来非 Web 对照，展示同一个近似怎样逐层获得证据，也怎样可能被新 Host 反例修正。Select 的媒介分支和 Scroll Area 的 Host-owned mechanics 只各用一句说明不同失败可能要求修正不同层。

**证据状态**

- maintainer direction：WPD-01、WPD-09 与本轮章节复审；
- current project evidence：Spec graph、Prototype/Test/Adapter 的局部纵向切片；
- current limitation：executable evidence 仍主要集中在 Web family；
- open test conditions：可信非 Web realization、新参与者关系、新 information channel 或“没有外部关系却必须成为 Component”的反例。

**最强反驳**

在非 Web 证据和大规模使用不足的情况下，所谓反馈循环可能只是让一套 Web 抽象不断自我解释，而不是检验普遍性。

**本章必须正面承认**

当前证据确实不能证明一般跨平台成功。非 Web 实现不是装饰性路线图，而是检验理论边界的重要条件；在证据出现前，白皮书只能陈述假设、当前方法和可反驳条件。

**Negative boundary**

- 不展开版本路线、Host 数量目标、工具链发布时间、社区政策或商业化方向；
- 不把 Proto UI 写成应用框架，也不把“官方 core 不拥有”写成“生态不得实现”；
- 不把可序列化、Author 便利取舍或任何当前约束写成未经限定的永恒原则；
- 不用 draft entity、测试数量或 package 数量代替理论成熟度；
- 不把使用反馈自动放在白皮书或 Spec 之上，冲突仍需显式仲裁；
- 不重复第三章 split rule、第六章 comparison context 或第五章翻译 outcome。

**插图机会**

一张三主线证据反馈环：theory-and-kernel、prototype-library、translation-layer-and-ecosystem 并行指向 realization；失败与使用证据回到四个可能的修正分支：实现、翻译能力、Prototype、理论。图中不画版本时间轴或项目组织架构。

**通向结语的 bridge**

如果这条循环能够长期运行，Proto UI 保存的就不只是一代组件代码，而是一份能够继续被新技术检验、承接和修正的交互知识。

**私有 source / entity map**

- `internal/records/2026-08-28-whitepaper-rewrite-maintainer-decisions.zh-CN.md` WPD-01、WPD-09；
- `spec/README.md` 的 lifecycle、relation、source-of-truth 与 evidence 规则；
- `K-DESIGN-TRADEOFF-0001`、`K-PROTOTYPE-COMPOSITION-0001`（draft）；
- `P-BASE-SWITCH*`、`P-BASE-SELECT*`、`P-BASE-SCROLL-AREA*` 与对应 Tests；
- `D-ADAPTER-PROFILE-0001` 与 current official Adapter profiles；
- 旧 `design-constraints.md`、`evolution-path.md` 只作历史来源，不继承阶段承诺。

**相对篇幅约束**

第三部只有这一章。正文不应超过第四或第五章任一章的篇幅，也不承担完整项目介绍。若某段不能直接服务于“边界怎样接受证据修正”，应移出主线。

## 6. 结语：为过去与未来保留交互知识

**Reader question**

即使 Proto UI 自身没有成为主流，这项工作还可能留下什么？

**一句话主张**

Proto UI 想让组件的交互知识不再被某一代框架、平台或实现形式独占；Prototype 是当前可执行近似，真正需要长期保留的是可被未来技术重新检验、翻译和修正的责任边界。

**推导动作**

1. 回到序章的技术时间轴，区分冻结旧实现与保留可迁移语义。
2. 用蓝图为第一至第七章安排的链条回望经验假设，不引入新概念。
3. 保留开放结论：未来证据可能证明某些 Component 不可移植、某些通路分类错误或某些 Host 差异不该被抹平。
4. 用长期公共基础设施愿景结束，不使用版本承诺、采用规模或贡献号召代替结论。

**例子推进**

Switch 最后一次出现：不再列 API，而是强调未来技术仍然可以询问同一组责任是否保持，以及新证据如何推翻旧近似。

**Negative boundary**

- 不复述完整理论；
- 不宣称历史必然走向 Proto UI；
- 不以 stars、采用、商业成功或贡献号召收尾；
- 不用宏大愿景掩盖当前 Web-heavy evidence。

## 7. 从旧蓝图移出的内容

下列内容并非不重要，只是不再属于白皮书线性主论证：

| 原内容 | 新位置 |
| --- | --- |
| 语义一致、User、Maker、Author 的完整优先级教程 | Spec/设计文档；白皮书只在发生真实取舍时引用必要部分 |
| 可序列化的完整规则与 escape hatch | Spec、Core/Runtime 文档或独立设计说明 |
| Prototype 组合 API 与框架边界细节 | Spec、FAQ 或工程文档 |
| v0/v1、Web→native 的阶段路线 | 路线图、milestone 或项目计划 |
| 可视化工具、Playground、调试工具计划 | 产品与工具链路线图 |
| 社区 Prototype/Adapter 政策 | FAQ、贡献与治理文档 |
| entity lifecycle、record、active/draft 的完整使用教程 | Spec introduction 与贡献者文档 |
| 详细 comparison profile、normalized DOM 和 image-test 设计 | 独立 Spec/测试治理事项 |

FAQ 仍可回答定位和常见误解，但不得承担正文第一次定义“一致性”或“可修正近似”的责任。

## 8. 修订后的例子与插图线路

### Switch

| 位置         | 任务                                                     |
| ------------ | -------------------------------------------------------- |
| 序章         | 展示跨技术重复责任                                       |
| I-1          | 从实现之前的还原预期进入交互主体                         |
| I-2          | 映射五条 information channel                             |
| I-3          | 解释 Root/Thumb 与 feedback-only 边界                    |
| II-4         | 串起 State、Anatomy、Lifecycle 与接近可执行的伪代码      |
| II-5         | 展示 Prototype 义务怎样形成 Host artifact 与翻译 outcome |
| II-6         | 在明确 realization context 下说明一致性强度              |
| III-7 / 结语 | 回顾近似怎样被证据修正，以及交互知识怎样跨技术保留       |

### Select

只保留两个定点用途：I-3/II-4 的复杂 family，以及 II-6 的跨媒介替代边界。不要让它发展成第二条贯穿主线。

### Scroll Area

主要留在 II-5 解释 Host-owned mechanics 和有边界损失；II-6 与 III-7 只在确有必要时各用一句回扣。

### 插图优先级

1. I-2 information channel 有向关系图；
2. I-3 Prototype boundary 决策树；
3. II-4 setup/runtime 与 instance lifetime 图；
4. II-5 translation responsibility 与四轴图；
5. II-6 conditional consistency envelope；
6. III-7 三主线证据反馈环。

第六章优先只制作一张主图。第三部也只保留一张反馈环，避免结尾阶段重新增加认知负担。

## 9. 计划手稿顺序

本文不以任何正文草稿的存在作为蓝图成立前提。实际完成状态由后续独立 checkpoint 记录；手稿按以下职责依赖推进：

1. 先按历史蓝图与本文第 3 节起草、复审 I-1 至 II-5，确认每章只承担自己的计划职责。
2. 在 II-5 已经解释 translation outcome、evidence state 与 Host Capability 的前提下，按本文第 4 节起草 II-6；先写 realization context 与 Switch 对照，不从术语表开始。
3. 对照 II-5 删除 II-6 中重复的翻译层解释。
4. II-6 接受后起草 III-7，用一条反馈循环吸收原“设计约束”和“在实践中逼近”的必要内容。
5. 回读 I-1 的开篇问题，确认 II-6 给出直接答案。
6. 最后写序章与结语，使经验问题、可证伪前提和长期愿景首尾对应。
7. 主线接受后再去重 FAQ，并在中文章节接受后制作英文 conceptual-parity 版本。

## 10. 复审触发条件

出现以下情况时，应再次新增较新的 record，而不是静默扩张正文：

- 第六章无法在不重复第五章的情况下给出独立主张；
- realization context 或 tolerance/exclusion 的写法使一致性不可证伪；
- 第七章必须依赖具体版本路线才能成立；
- 真实非 Web implementation 推翻当前 consistency 或 translation 边界；
- 新参与者关系、新 information channel，或“没有外部关系却必须成为 Component”的可信反例出现；
- 适用 Spec entity lifecycle 或白皮书/Spec 权威关系发生变化。

## 11. 主要来源

- 历史蓝图：`internal/records/2026-08-28-whitepaper-chapter-blueprint.zh-CN.md`
- 当前维护者方向：`internal/records/2026-08-28-whitepaper-rewrite-maintainer-decisions.zh-CN.md`
- record policy：`internal/records/README.md`
- authority 与 entity lifecycle：`AGENTS.md`、`spec/README.md`
- 条件一致性：WPD-07、`K-DESIGN-TRADEOFF-0001`（draft）
- 翻译治理：WPD-08、`D-ADAPTER-PROFILE-0001`（active）与 current official `A-*` Web profiles
- 核心例子：`P-BASE-SWITCH*`、`P-BASE-SELECT*`、`P-BASE-SCROLL-AREA*`（读取各自 lifecycle）
- 旧公开页面：`apps/www/src/content/docs/{zh-cn,en}/whitepaper/design-constraints.md`、`evolution-path.md`、`faq.md`，仅作历史来源与迁移清单

## 明确不授权

本记录不授权公共白皮书替换、英文版本、插图生成、Spec/entity 变更、comparison profile 创建、Issue/PR 外部写入、发布或路线图承诺。
