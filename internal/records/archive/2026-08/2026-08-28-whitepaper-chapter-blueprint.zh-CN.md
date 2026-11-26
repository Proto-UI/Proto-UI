# 白皮书重写章节蓝图（历史候选）

日期：2026-08-28

状态：本文保留最初的“序章 + 三部九章 + 结语”候选结构及其来源追踪，便于审阅结构如何演进。当前写作架构由较新的 `2026-09-01-whitepaper-chapter-blueprint-revision.zh-CN.md` 修订；后续手稿不得继续把本文中被替代的章节编号、篇幅权重或顺序当作当前约束。

本文把 `2026-08-28-whitepaper-rewrite-maintainer-decisions.zh-CN.md` 中已经接受的总论证、三部结构和例子策略展开为逐章写作蓝图。它服务于维护者人工起稿前的结构评审，不是白皮书正文、Spec 实体、稳定保证或公共路线图。

本文中的章节标题均为工作标题。其候选章节主张、顺序、例子和桥接关系只在未被较新蓝图修订的范围内保留历史参考价值；若后续手稿证明当前蓝图的某条桥接不成立，应新增较新的 record 说明调整，而不是让正文悄悄改变论证。

## 1. 蓝图要解决的问题

旧白皮书已经覆盖 Component、information channel、Prototype boundary、执行、翻译、约束、演进和 FAQ，但它从“组件作为协议”开始，把协议化放在了经验问题和抽象假设之前；State、lifecycle、Anatomy、Rule、`asHook` 等维度也缺少清楚的相互位置。旧八页适合作为来源和反例清单，不适合作为新稿的章节骨架。

新稿需要让读者沿一条不可逆的推导链前进：

```text
长期重复劳动
  → 有边界的交互不变量假设
  → 交互主体与参与者关系
  → information channel
  → Component / Prototype 边界
  → 可执行近似与时间秩序
  → 翻译责任、能力边界与损失
  → 条件一致性与符合性证据
  → 实践反馈修正近似
```

其中，“协议”不是开篇前提。只有当一份可执行近似需要被多个独立实现共同遵守时，角色、方向、时序、义务、兼容边界和证据才共同导出它的协议性质。

## 2. 阅读架构

推荐采用“序章 + 三部九章 + 结语”的线性主论证。FAQ 保留为非线性参考，不计入主论证章节。

| 顺序 | 部分 / 章节（工作标题） | 唯一不可缺少的推进 | 相对篇幅权重 |
| --- | --- | --- | --: |
| 0 | 序章：重复消失不了 | 跨技术生命周期反复重建相似交互责任，使“是否存在可移植不变量”成为值得检验的问题。 | 7 |
| I-1 | 代码之前的组件 | 一个组件可以先作为可辨认的交互主体被讨论，再表现为某种宿主实现。 | 8 |
| I-2 | 关系让主体显形 | 参与者、方向和语义责任共同导出 information channel，而不是 API 名称导出通路。 | 10 |
| I-3 | 从主体到 Prototype | Prototype 是交互主体“本质”的当前可执行近似；独立参与者关系决定边界，feedback-only 保留粒度例外。 | 12 |
| II-4 | 通路之外的语义 | 通路是骨架而非全集；可执行近似还需要保持 State、Anatomy、Rule、`asHook` 等正交维度。 | 9 |
| II-5 | 主体如何在时间中存在 | 交互语义包含义务何时成立；`setup`、`runtime` 和 lifecycle 把同一主体组织在时间里。 | 10 |
| II-6 | 翻译是一种责任 | 翻译层要保持受治理语义、报告能力与损失并产生证据；Adapter、Compiler、hybrid 只是不同实现形式。 | 12 |
| II-7 | 同一不等于处处相同 | 一致性必须在明确的 realization context 之间比较；共享基础越多，可比较层越多，容许的无解释差异越小。 | 12 |
| III-8 | 约束定义能够走多远 | 可移植性不仅来自表达能力，也来自对组合、宿主特例和不可分析输入的主动拒绝或隔离。 | 9 |
| III-9 | 在实践中逼近 | theory-and-kernel、prototype-library、translation-layer-and-ecosystem 必须共同接受证据反馈，持续修正近似。 | 7 |
| 10 | 结语：为过去与未来保留交互知识 | Proto UI 的长期价值在于让交互知识不再被单一技术生命周期独占，而不是冻结技术或宣称已经找到终极本质。 | 4 |

权重总计为 100，只表示章节之间的相对注意力，不是字数或页数。准确篇幅应在全部章节主张和桥接关系接受后再定。

### 三部的叙事责任

- 第一部“寻找不变量”只回答“我们在寻找什么、如何观察它、如何划定它”，不急于解释运行时架构。
- 第二部“使近似可执行”回答“这份近似如何在结构、时间、翻译和验证中成为可运行的共同约束”。
- 第三部“在实践中逼近”回答“为什么必须有负边界，以及项目如何让失败证据反过来修正理论与工程”。

### 贯穿问题

每章都应推进同一个贯穿问题，但不得重复上一章的答案：

> 为了仍然成为同一交互主体，什么必须保持不变；什么可以随着实现、时间、媒介或 Host 合理变化？

## 3. 证据标签

蓝图和后续手稿使用四类证据，不得互相冒充：

| 标签 | 含义 | 写作要求 |
| --- | --- | --- |
| current project evidence | 当前 catalog、实现和测试已经表达的 Proto UI 事实 | 必须带 lifecycle；局部 profile 不得写成完整支持矩阵。 |
| historical motivation | 旧白皮书、项目历史或长期重复建设形成的动机 | 可以说明问题如何出现，不能单独证明理论。 |
| external evidence | ARIA、Radix 或其他技术生态的公开经验 | 用于证明局部问题、约束或已有尝试，不能自动证明 Proto UI 的答案。 |
| hypothetical projection | Qt、Flutter、未来 Compiler 或尚未实现的对照 | 必须显式称为 thought experiment、方向或待验证假设。 |

基础理论和大多数核心 Prototype 实体当前仍为 `draft`。`C-PROPS-0001` 与 `D-ADAPTER-PROFILE-0001` 等 active slice 只能证明它们各自拥有的范围，不能替整套理论背书。

## 4. 逐章蓝图

### 序章：重复消失不了

**Reader question**

框架、平台和组件库一直在进步，为什么人机交互还需要另一层基础设施？

**一句话主张**

跨技术生命周期反复重建相似的交互、状态、反馈与无障碍责任，说明这里存在一个尚未被稳定承载的问题；它足以支持我们检验“部分交互语义可以跨实现保持”的经验假设，但不足以预先证明该假设。

**继承前提**

无。读者只需要有使用或制作 GUI 的经验。

**推导动作**

1. 用若干技术世代中的 Switch 重写说明“代码不同，但责任清单反复出现”。
2. 区分“问题重复存在”与“抽象已经成立”。
3. 用 Radix 等生态内尝试说明局部复用确实有价值，同时指出它们受框架、平台和生态边界限制。
4. 提出可证伪的经验假设：并非所有 GUI 属性都可移植，但至少有一类重要交互逻辑值得寻找稳定表达。

**例子推进**

Switch 第一次出现，只展示重复责任：二值状态、输入、反馈、焦点、无障碍和对 Maker 的输出。此处不展示 Proto UI API。

**证据状态**

- historical motivation：跨技术重写和旧白皮书的问题意识；
- external evidence：Radix 等生态内无样式组件库的局部成功及生态边界；
- current project evidence：Proto UI 已经有多个 Web Adapter 与 Prototype 探索，但不能把它们写成假设证明。

**最强反驳**

所谓重复可能只是不同平台恰好使用同一组界面隐喻；抽象层只会把成本转移到翻译层，并不能消除劳动。

**本章必须正面承认**

该反驳可能在某些组件或媒介上成立。Proto UI 是一项通过 Prototype 与真实翻译证据逐步检验边界的工程研究，不是从前提直接推出成功的证明。

**Negative boundary**

- 不主张所有 GUI 都有同一种本质；
- 不把跨端本身当作唯一目标；
- 不宣称无障碍或一致性会因增加一层抽象而自动获得；
- 不把 Radix 当作 Proto UI 理论的原型模板。

**插图机会**

一条跨技术时间轴：每一代实现形式变化，但相似的交互责任反复被重写。图中应把“重复”画成观察，把“不变量”画成问号，而不是既成结论。

**通向下章的 bridge**

如果代码形态不是稳定对象，那么跨实现仍被认作“同一个组件”的究竟是什么？

**私有 source / entity map**

- `internal/records/2026-08-28-whitepaper-rewrite-maintainer-decisions.zh-CN.md` WPD-09；
- Issue #473 的独立技术写作目标；
- 旧 `component-as-protocol.md` 中“组件预期先于实现”的历史论证；
- `P-BASE-SWITCH` 及其实现、测试只作为当前探索证据。

### 第一部 · 第一章：代码之前的组件

**Reader question**

当 class、function、DOM、widget 或渲染树都改变后，我们凭什么仍说两个实现是同一类组件？

**一句话主张**

组件首先可以被理解为一个在外部关系中保持可辨认身份的交互主体；代码、节点和控件是它在具体 Host 中的实现形态。

**继承前提**

序章已经证明问题值得研究，但没有证明不变量是什么。

**推导动作**

1. 从“还原得对不对”这一日常判断说明实现之外存在可比较的预期。
2. 将这份预期收紧为交互主体，而不是视觉轮廓或功能清单。
3. 用 Switch、Toggle、Checkbox 的邻近但不同身份说明“可辨认”不等于“看起来相似”。
4. 把“本质”限定为可执行研究中的近似对象，避免形而上学承诺。

**例子推进**

Switch 开始承担身份对照：它是持久 on/off value control，不是一次性 command，也不因外观像 checkbox 就获得同一身份。

**证据状态**

- current project evidence：draft `K-COMPONENT-INTERACTION-0001`、draft `P-BASE-SWITCH`；
- external evidence：Switch/Toggle/Checkbox 的公开平台与无障碍分类可在起稿时补充核验；
- general argument：还原判断是论证入口，不是 catalog 保证。

**最强反驳**

所谓组件身份只是社区约定，没有独立于实现的“真实本质”。

**本章必须正面承认**

Proto UI 不需要证明超越实践的终极本质；它只需要找到足够稳定、能够预测实现义务并接受反例修正的工作性身份。

**Negative boundary**

- 视觉形状、DOM 边界、文件边界和 API 名称都不能单独决定身份；
- “交互主体”不等于必须拥有复杂行为；
- 本章不定义 Prototype 语法或 Host。

**插图机会**

三个不同 Host 的 Switch 外形围绕同一个“交互主体”轮廓，外围列出可比较责任，内部不画代码。

**通向下章的 bridge**

交互主体不是孤立物；如果它只能在关系中被辨认，我们需要先问它正在和谁交换什么。

**私有 source / entity map**

- `K-COMPONENT-INTERACTION-0001`（draft）；
- `P-BASE-SWITCH`（draft），特别是 on/off value、semantic owner 和 Button 对照 criteria；
- 旧 `component-as-protocol.md` 作为历史来源。

### 第一部 · 第二章：关系让主体显形

**Reader question**

不从某个框架的 API 列表出发，怎样系统地描述一个组件与外界的关系？

**一句话主张**

Proto UI 先按参与者身份、信息方向和语义责任识别关系，再从这些关系导出 information channel；通路不是对现有 API 的重新分组。

**继承前提**

上一章已经把组件限定为交互主体，但还没有给出观察主体的结构。

**推导动作**

1. 定义一般角色 `User`、`Maker`、`Other Component`；在 Props/Expose 端点再收紧到 `App Maker`。
2. 同一对参与者必须结合方向和责任才能形成通路身份。
3. 推导当前五条核心可移植通路：Event、Feedback、Props、Expose、Context。
4. 说明 Context 的双向性是被明确允许的方向集合，而不是“没有方向”。
5. 说明五条是当前已接纳集合，不是穷尽证明；Host/Component 交换存在但默认不属于 v0/v1 核心可移植主轴。

**例子推进**

把 Switch 放入五条通路：User activation 进入 Event，状态和可感知变化通过 Feedback 返回，App Maker 通过 Props 配置并通过 Expose 观察，Thumb 通过 Context 与 Root 协作。

**证据状态**

- draft：`K-COMPONENT-ACTOR-0001`、`K-INFORMATION-CHANNEL-0001`、`C-CORE-CHANNEL-0001`、Event/Feedback/Expose/Context；
- active slice：`C-PROPS-0001`；
- open question：核心清单如何在 catalog 中长期枚举仍未稳定。

**最强反驳**

User、Maker 和 Component 仍是 Proto UI 自己选择的分类；换一套角色表就可能得到另一套通路。

**本章必须正面承认**

分类是否有解释力要由它能否稳定区分方向、责任和跨 Host 义务来检验。新通路只有在现有参与者关系、方向或责任无法吸收时才成立。

**Negative boundary**

- 不把 State、lifecycle、Anatomy、Rule 或 `asHook` 称为通路；
- 不因出现 AI Agent 就自动增加新角色，AI 可以在具体关系中成为 Maker、User 或其他既有身份；
- 不把 information flow 另立为正式模型名称；
- 不把五条通路写成永远封闭的数字。

**插图机会**

以 Component 为中心的有向关系图；每条箭头同时标参与者、方向和责任。Host channel 使用虚线置于核心可移植包络之外。

**通向下章的 bridge**

通路告诉我们关系如何发生，却没有回答一棵视觉树中究竟存在一个还是多个交互主体。

**私有 source / entity map**

- `K-COMPONENT-ACTOR-0001`、`K-INFORMATION-CHANNEL-0001`、`C-CORE-CHANNEL-0001`；
- `C-EVENT-0001`、`C-FEEDBACK-0001`、`C-PROPS-0001`、`C-EXPOSE-0001`、`C-CONTEXT-0001`；
- `P-BASE-SWITCH`、`P-BASE-SWITCH-THUMB` 的 Props/Expose/Event/Context 责任。

### 第一部 · 第三章：从主体到 Prototype

**Reader question**

视觉树中的 Root、Thumb、caret、Arrow 和普通容器，哪些是独立组件，哪些只是一个组件的附属结构？

**一句话主张**

Prototype 是 Proto UI 对交互主体“本质”的当前可执行近似；一个结构一旦形成可独立寻址的参与者关系，就需要独立 Prototype，而 feedback-only 结构可以为避免无意义碎片化附属于父 Prototype。

**继承前提**

上一章已经给出参与者关系和通路，因而可以用关系而非视觉切块判断主体边界。

**推导动作**

1. 排除按 DOM、widget、文件或视觉区域机械切分。
2. 给出边界测试：没有可移植通路的结构不是独立 Component；Event、Props、Expose、Context 任一独立关系要求拆分；feedback-only 允许附属。
3. 解释附属子结构只能设置 Feedback，不能暗中获得其他通路。
4. 说明独立 Prototype 与 Anatomy role、稳定 authoring entry、复用价值有关，但任何单一名称都不能代替通路判断。
5. 从可独立比较的 Prototype 推导协议化：多个实现要共享同一近似，就必须声明义务、时序、兼容边界和证据。

**例子推进**

- Switch Root/Thumb 是主要真实案例：Thumb 虽不拥有 activation/value，却订阅 Context，因此是独立 Prototype，不能冒充 feedback-only 例外；
- Select 固定、不可定制的 caret 是 feedback-only 解释案例；Maker 一旦可替换或配置它，就应拆为独立 Arrow 类 Prototype；
- Tooltip Arrow 只作为 deferred catalog 边界证据，不写成当前官方实现。

**证据状态**

- current project evidence：draft `P-BASE-SWITCH`、`P-BASE-SWITCH-THUMB`、`D-TOOLTIP-PROTOTYPE-BOUNDARY-0001`；
- maintainer theory direction：完整三段式 split rule 当前没有单一 governing entity；
- hypothetical design case：Select caret 和一般气泡尖角。

**最强反驳**

这套规则要么把每个产生视觉影响的节点都拆碎，要么依赖 feedback-only 例外而失去形式统一。

**本章必须正面承认**

Feedback 确实是通路；例外是公开的工程粒度妥协。规则的目标不是最小化结构，而是让独立参与者责任可识别，同时保持人类可维护的原型粒度。

**Negative boundary**

- 不把普通 HTML `div`、Flutter `Stack` 或任何命名节点自动提升为 Component；
- 不把所有 Anatomy role 自动变成独立 Prototype；
- 不把父 Prototype 的 presentation prop 自动解释为内部结构拥有 Props；
- 不把 `asHook` 当作 Prototype 下的子结构；
- 不把尚未 catalog 的 split rule 写成 active Spec 保证。

**插图机会**

一个边界判断决策树，配三个并列小例：无通路 scaffold、feedback-only caret、Context-driven Switch Thumb。

**通向下章的 bridge**

我们已经知道协议在描述谁；但只有外部通路还不足以让这个主体成为可执行对象。

**私有 source / entity map**

- `K-COMPONENT-INTERACTION-0001`；
- `P-BASE-SWITCH`、`P-BASE-SWITCH-THUMB`；
- `C-ANATOMY-0001`、`K-PROTOTYPE-COMPOSITION-0001`；
- `D-TOOLTIP-PROTOTYPE-BOUNDARY-0001`；
- `internal/records/2026-07-04-switch-toggle-prototype-boundary.zh-CN.md`；
- 已知治理缺口：完整 Component/Prototype split rule。

### 第二部 · 第四章：通路之外的语义

**Reader question**

如果 information channel 已经组织了组件与外界的所有关系，为什么 Prototype 还需要别的一级概念？

**一句话主张**

通路只组织主体与参与者之间的信息关系；可执行近似还需要把内部连续性、结构关系、声明式条件和无主体复用分别交给正交语义维度，而不是把所有能力伪装成新通路。

**继承前提**

第一部已经确定 Prototype 身份和通路骨架。

**推导动作**

1. 用 State 解释交互主体如何保存内部连续性，而不产生信息发送者/接收者。
2. 用 Anatomy 解释 compound family 的 role/relation，而不创建 part、组合 Prototype 或替代 Context。
3. 用 Rule 解释“条件 → 意图”的声明式关系，而不创造信息来源。
4. 用 `asHook` 解释去除独立主体后的继承式逻辑复用；其效果归属调用者 Prototype。
5. 把 `meta` 保持为 provisional：哲学直觉不能替代工程证据。

**例子推进**

Switch Root 的 checked State、Root/Thumb Anatomy、Root→Thumb Context 和 `asSwitchRoot` / `asSwitchThumb` authoring entry 同时存在，但承担不同问题。Rule 只用于说明状态条件如何导出明确意图，不要求本章罗列完整 API。

**证据状态**

- draft：`C-STATE-0001`、`C-ANATOMY-0001`、`C-RULE-0001`、`C-AS-HOOK-0001`；
- current implementation evidence：Switch 的 State、Anatomy、Context 和 authored asHook；
- gap/provisional：`meta` 没有足够实体和工程证据。

**最强反驳**

不断增加正交维度会让“用关系解释组件”的理论失去简洁性，最终仍然变成一份功能清单。

**本章必须正面承认**

信息通路从来不是万能钥匙。理论简洁性来自每个概念拥有不可替代的责任和负边界，而不是强迫所有现象使用同一分类。

**Negative boundary**

- 不把本章写成语法参考手册；
- 不把 Anatomy 写成 Prototype composer、assembler 或实例注册表；
- 不把 Rule 写成第六条通路；
- 不把 `asHook` 写成普通函数组合或独立 runtime instance；
- `meta` 只允许作为开放问题短暂出现。

**插图机会**

一个“骨架与相邻维度”分层图：通路构成外部关系骨架，State 表示内部连续性，Anatomy 表示结构关系，Rule 表示条件到意图，`asHook` 表示附着式复用。

**通向下章的 bridge**

State 让主体能够连续，但连续性仍需要时间秩序：声明、运行、挂载、脱离和销毁不能混成一个时刻。

**私有 source / entity map**

- `C-STATE-0001`、`C-ANATOMY-0001`、`C-RULE-0001`、`C-AS-HOOK-0001`；
- `P-BASE-SWITCH`、`P-BASE-SWITCH-THUMB`；
- 旧 information-flow / prototype-boundary 页面仅作遗漏与重复对照。

### 第二部 · 第五章：主体如何在时间中存在

**Reader question**

同一份 Prototype 在初始化、响应输入、反复挂载和最终销毁时，怎样仍保持一套可翻译的语义？

**一句话主张**

交互语义不仅规定“做什么”，还规定义务在何时成立；`setup` 负责实例物化期间的声明和计划，`runtime` 覆盖实例直到 dispose complete，lifecycle 再细分运行中的秩序。

**继承前提**

上一章已经区分 State 等内部维度，但没有给出这些维度何时可用。

**推导动作**

1. 区分定义行为与执行行为，说明混合两者会破坏可理解、可翻译和可验证性。
2. 明确 `setup` 是每个 Proto instance 的一次物化时期，不是模块导入或全局编译期。
3. 明确临时 detached/unmounted 不会结束 instance runtime。
4. 说明 lifecycle callback 和 checkpoint 只能细分 runtime，不能重新定义 setup。
5. 用一次 Switch activation 串起声明、输入、State transition、Context/Feedback/Expose 更新和最终 disposal。

**例子推进**

Switch 在 setup 声明 Props、State、Event、Expose、Context 与 lifecycle plan；运行中 activation 请求改变 checked，Root 同步 outward signal 和 Context，Thumb 更新派生展示；反复 view epoch 不产生第二个 value owner。

**证据状态**

- draft：`C-LIFECYCLE-0001` 及相关 lifecycle contracts；
- current implementation/test evidence：Switch Root/Thumb lifecycle 和 RuntimeSession；
- open question：`SystemCaps.execPhase()` 的公开/实现边界尚未完全收敛。

**最强反驳**

React、Vue、Flutter、Qt 都已有生命周期；增加一套时期模型只是在发明最低公分母。

**本章必须正面承认**

宿主 lifecycle 仍然真实且必要。Proto UI 只治理 Prototype 义务的可移植时间关系，Adapter 负责把宿主时机映射到这份关系，无法映射时必须报告边界。

**Negative boundary**

- 不把 `setup` 等同于编译期、模块加载期或任意框架 setup hook；
- 不把 host view 的一次 unmount 等同于 Component disposal；
- 不把当前 `setup/render/callback/unknown` guard 细节提升为白皮书主模型；
- 不在本章承诺各 Adapter 的完整生命周期符合性。

**插图机会**

时间轴：一次 setup → 持续 runtime → 多次 mount epoch / detached interval → disposing → dispose complete；在时间轴上标注 Switch State owner 始终是同一 instance。

**通向下章的 bridge**

Prototype 的结构和时间义务已经明确，下一步不是把语法换成另一种语法，而是让具体 Host 对这些义务负责。

**私有 source / entity map**

- `C-LIFECYCLE-0001`（draft），特别是 A–F criteria 和 open question；
- `C-STATE-0001`；
- `P-BASE-SWITCH`、`P-BASE-SWITCH-THUMB` 的 lifecycle/State/Context 证据；
- 旧 `execution-semantics.md` 作为历史解释来源。

### 第二部 · 第六章：翻译是一种责任

**Reader question**

为什么把 Prototype 落到 React、Web Components、Qt 或 Flutter 不是普通代码生成，翻译失败又该如何描述？

**一句话主张**

翻译层负责把受治理的 Prototype 与 Module 义务降低到目标 Host，忠实兑现或显式拒绝能力并产生 profile-bound evidence；Adapter、Compiler 和 hybrid 只决定翻译发生的形式与时机。

**继承前提**

前两章已经给出需要被翻译的结构、内部维度和时间语义。

**推导动作**

1. 区分 Prototype 语义、Module owner、Host Capability 和具体 Host artifact。
2. 用 accessibility semantic object 说明翻译不是抄写宿主属性：Prototype 声明 identity、role、name、state、action 和 relation，Adapter 再投影到 ARIA、平台 accessibility API 或其他 Host surface。
3. 说明 Adapter 是当前受治理的 runtime translation 主路径；Compiler 是未来静态形式，hybrid 可以拆分静态和动态责任。
4. 展开四条正交轴：translation form、capability realization、conformance outcome、evidence state。
5. 定义 faithful、authorized bounded degradation 和 unsupported 的边界；关键义务丢失不能被其他高保真维度抵消。
6. 要求在最早可靠边界报告 degradation 或 inability。

**例子推进**

Scroll Area 用于展示 Host-owned mechanics：Prototype 表达 logical surface、normalized facts 和 requests；Host 保留 scrolling engine、physics 和 geometry。Web `overflow`、Flutter controller 或 Qt widget 都不能成为跨 Host 本体。Switch 用于回扣相同协议义务和 accessibility role/name/checked facts 如何进入现有 Web translation。

**证据状态**

- active：`D-ADAPTER-PROFILE-0001` 与当前 official Web Adapter identities 的已编目 slice；
- draft/executable slice：`C-A11Y-0001`、`HC-A11Y-0001` 与当前 Web projection tests；
- draft/current evidence：Scroll knowledge/contracts/Module/Host Capability/Prototype/Test chain；
- hypothetical projection：Qt、Flutter 和完整 Compiler 产品；
- uncataloged 不等于 unsupported，也不等于 supported。

**最强反驳**

异质 Host 的能力、输入和渲染模型差异太大，所谓共享语义最终只会成为空洞最低公分母。

**本章必须正面承认**

有些 Prototype 在某些 Host 上确实可能 unsupported。Proto UI 的目标不是保证任意组合都可实现，而是让支持、合法损失和拒绝成为可说明、可验证的结果。

**Negative boundary**

- 不把 Adapter package、测试存在或 abstract Host 名称自动当作支持证明；
- 不把 `native` realization 自动等同于 faithful；
- 不因采用 Compiler 就承诺性能、保真度或“更原生”；
- 不声称任意 Prototype library 只要接入 Proto UI 就已经自动获得可靠 accessibility；可靠性仍取决于 Prototype 声明、Host capability、Adapter projection 和 profile-bound evidence；
- 不把 Web Components Context 等旧页面示例写成已 catalog 的当前保证，除非另有准确证据；
- Qt/Flutter 只能明确标注为 thought experiment。

**插图机会**

主图展示 `Prototype / Modules → translation layer → Host Capabilities → Host artifacts`；副图使用四轴矩阵，说明 translation form、realization、outcome 和 evidence 不能互相替代。

**通向下章的 bridge**

翻译层可以报告“实现了什么”，但我们还需要回答：两个 realization 在什么条件下才算保持了同一个交互主体？

**私有 source / entity map**

- `D-ADAPTER-PROFILE-0001`（active）；
- `C-A11Y-0001`、`HC-A11Y-0001` 与 `T-A11Y-0001`（draft semantic/projection slice and executable evidence）；
- 当前 `A-REACT-18-19-0001`、`A-VUE-2-0001`、`A-VUE-3-0001`、`A-WEB-COMPONENT-0001`；
- `K-SCROLL-0001`、`C-SCROLL-0001`、`M-SCROLL-0001`、`HC-SCROLL-SURFACE-0001`、`P-BASE-SCROLL-AREA*`、相关 `T-*`；
- `internal/records/2026-07-29-scroll-area-boundary-and-host-projection.zh-CN.md`；
- 旧 `translation-layer.md` 只作为历史来源。

### 第二部 · 第七章：同一不等于处处相同

**Reader question**

跨框架、跨平台、跨交互媒介时，“一致”究竟应严格到行为相似、DOM 相同还是像素相同？

**一句话主张**

一致性是在两个已声明 realization context 之间比较受治理语义：共享并受控的基础越多，可比较的输出层越多，容许的无解释差异越小。

**继承前提**

上一章已经建立翻译 profile、能力和证据边界，因而可以描述比较双方。

**推导动作**

1. 定义 realization context 至少包含 Prototype revision/input、交互媒介、Adapter/Host profile、投影策略、渲染参数和 tolerance/exclusion。
2. 给出所有受支持实现必须保持的底层：identity、通路义务、State transition、lifecycle order 和 Prototype 授权的替代分支。
3. 区分 Host 输入识别细节与 Prototype 语义，例如 click synthesis、touch slop 和误触阈值。
4. 说明跨媒介替代必须由 Prototype 授权，翻译层不能自行把 dropdown 变成 picker。
5. 在控制 viewport、单位、字体 shaping、颜色和 rasterization 等输入后，允许把像素比较作为最高强度要求；Web family 比较 normalized DOM projection，而不是字节相同。
6. 把每个比较结论绑定到 evidence state，拒绝从 uncataloged target 推导一致性。

**例子推进**

- Switch：同媒介、同尺寸/字体/单位和等价 Web projection 下，Feedback 可以接受严格图像与 normalized DOM 比较；原始点击阈值仍可能由 Host 识别；
- Select：键鼠 dropdown 与触屏 picker 是否等价必须由 Select Prototype 的媒介分支决定，不能由 Adapter 便利决定；
- Scroll Area：system/composed chrome 可以不同，但 logical surface、facts、requests 和授权 projection 必须保持。

**证据状态**

- draft theory：`K-DESIGN-TRADEOFF-0001` 与本轮维护者条件一致性方向；
- active partial profiles：现有 Web Adapter identity 与已绑定测试；
- governance gap：当前没有完整 comparison profile、normalized DOM 或 image-evidence entity；
- hypothetical：非 Web Host 的严格对照。

**最强反驳**

如果每次比较都要声明大量上下文，一致性就可能变得不可证伪：任何差异都可以被归入新的 exclusion。

**本章必须正面承认**

Tolerance 和 exclusion 本身必须受治理并有理由，不能由实现临时添加。比较 profile 的价值正是把可比条件和允许差异变成可审阅输入。

**Negative boundary**

- 不承诺所有 Host 或媒介像素相同；
- 不把“语义一致”降为“功能大概可用”；
- 不把未经治理的 native chrome、font、rasterizer 差异算作 Prototype 自身输出；
- 不把当前 Web evidence 外推到 Qt、Flutter 或一般 native Host；
- 不把本章提议的 comparison profile 写成已经存在的 Spec 实体。

**插图机会**

嵌套的一致性包络：最内层为 identity/channel/state/lifecycle，向外依次增加媒介、Host family、渲染参数与像素比较；每增加共享前提，就增加可比较层。

**通向下章的 bridge**

越强的一致性要求越依赖清楚的负边界；如果核心层什么都允许，它就没有可比较的稳定输出。

**私有 source / entity map**

- `K-DESIGN-TRADEOFF-0001`（draft）；
- `D-ADAPTER-PROFILE-0001` 与 current official Adapter profiles（active partial evidence）；
- `P-BASE-SWITCH*`、`P-BASE-SELECT*`、`P-BASE-SCROLL-AREA*`（draft examples）；
- 旧 `execution-semantics.md` 的一致性段落作为历史来源；
- 已知治理缺口：comparison profile、normalized DOM、image evidence。

### 第三部 · 第八章：约束定义能够走多远

**Reader question**

为什么 Proto UI 不开放任意函数、宿主对象、Prototype 组合和所有平台特例，让作者自行决定可移植性？

**一句话主张**

跨 Host 协议的能力不仅来自“能表达什么”，也来自“拒绝把什么伪装成可移植语义”；清楚的负边界为翻译、分析和证据留下共同基础。

**继承前提**

第二部已经说明翻译和一致性依赖受治理输入及可报告边界。

**推导动作**

1. 从语义一致性优先的取舍顺序解释约束不是随意禁令。
2. 说明 Prototype 只描述交互主体，不接管业务接合、最终 UI 组合和框架级调度。
3. 说明可序列化是长期方向约束，而不是当前所有 surface 的绝对无例外口号。
4. 说明 Host-specific 能力可以重要，但默认被隔离于核心可移植主轴。
5. 说明社区可以在更强假设下扩展，官方 core 则必须保持可比较边界。

**例子推进**

Select 的 Root、Trigger、Content、Item 在 Host/上层系统中组合；core template 不因此成为应用框架。Scroll Area 保留 Host-owned physics。Switch presentation 可以被 design language 扩展，但不能把 raw DOM 或 framework object 写成 Prototype 身份。

**证据状态**

- draft：`K-DESIGN-TRADEOFF-0001`、`K-PROTOTYPE-COMPOSITION-0001`、Host/environment exclusion；
- active slices：Props 的 portable-data 约束等局部规则；
- gap：更广泛的“不做框架”和社区治理没有单一 governing entity。

**最强反驳**

这些约束可能只是当前实现能力不足的合理化；过早收紧会阻止真实需求暴露。

**本章必须正面承认**

约束不是永恒真理。它们必须能说明保护了哪项可移植责任，并在真实反例出现时接受修订；escape hatch 和 Host-local extension 也需要明确归属。

**Negative boundary**

- 不把“官方 core 不拥有”写成“生态不得实现”；
- 不把可序列化描述成所有层级、所有版本的无例外稳定保证；
- 不贬低 Host-specific 能力，只说明它不自动进入核心承诺；
- 不重复第三章的 split rule 或第七章的一致性细节。

**插图机会**

分层边界图：portable Prototype core、translation/Host capability、Host-local extension、App/framework composition；箭头显示允许穿越的受治理信息，不把外围画成“低级”或“不重要”。

**通向下章的 bridge**

这些边界都只是当前最好的近似；项目需要一套让实现失败和使用反馈真正修改近似的工作方式。

**私有 source / entity map**

- `K-DESIGN-TRADEOFF-0001`、`K-PROTOTYPE-COMPOSITION-0001`；
- `C-PROPS-0003` 等 portable-data 证据只在实际起稿时精确引用；
- `K-COMPONENT-ACTOR-0001-D`、`K-INFORMATION-CHANNEL-0001-D`、`C-CORE-CHANNEL-0001-D`；
- 旧 `design-constraints.md`、FAQ Q1/Q4 作为历史来源。

### 第三部 · 第九章：在实践中逼近

**Reader question**

如果 Prototype 只是近似，Proto UI 如何避免把早期抽象永久固化，或者把原型库误当成项目全部？

**一句话主张**

Proto UI 通过 theory-and-kernel、prototype-library、translation-layer-and-ecosystem 三条主线共同探索，并让 profile-bound evidence 和真实使用反馈显式推动 Prototype、Spec、翻译边界或更高层理论的修正。

**继承前提**

前一章已经承认约束可被实践修正，但还没有说明谁探索、什么证据能触发修正。

**推导动作**

1. 区分三条主线的责任，避免把“做更多组件”写成唯一进度。
2. 展示一个反馈循环：提出近似 → 实现 Prototype → 通过 Core/Runtime 与 translation 落地 → 收集符合性/失败证据 → 仲裁修正对象。
3. 区分实现 drift、Prototype 错误、translation capability 缺失和理论过度普遍化。
4. 明确 record、draft entity、active guarantee 和 executable evidence 的不同角色。
5. 给出可证伪触发条件：新参与者关系、新通路、无关系却必须独立的 Component、非 Web Host 反例等。

**例子推进**

以 Switch 从邻近 Button/Toggle 边界、Root/Thumb Context、Web Adapter evidence 到未来非 Web 对照的演进为贯穿回顾；Select 和 Scroll Area 分别补充跨媒介与 Host-owned mechanics 如何暴露新问题。

**证据状态**

- current project evidence：Spec graph、Prototype/Test/Adapter slices 和本轮维护者 record；
- current limitation：主要 executable evidence 仍集中在 Web family；
- hypothetical/future：非 Web evidence、Compiler identity 和更完整 comparison governance。

**最强反驳**

在缺少非 Web 实现和大规模使用前，这仍然可能只是一个自洽的 Web 抽象实验。

**本章必须正面承认**

当前证据确实不能证明一般跨平台成功。项目应把这一缺口当作结论强度的边界和未来检验条件，而不是用愿景性语言补齐。

**Negative boundary**

- 不写版本路线图、Host 数量目标或“工业级”空泛承诺；
- 不把 draft entity 数量当作理论成熟度；
- 不让实现或测试静默修改 Spec；
- 不把白皮书写成 Spec 的替代裁判；
- 不暗示使用反馈天然比理论或 governed evidence 更高权威，冲突仍需显式仲裁。

**插图机会**

三条建设主线汇入同一证据反馈环：理论/内核、原型库、翻译生态并行向 Host realization 输出，再由失败与使用反馈回到不同修正分支。

**通向结语的 bridge**

如果这条循环成立，Proto UI 保存的就不只是一代组件代码，而是一份能够继续被新技术检验和承接的交互知识。

**私有 source / entity map**

- `internal/records/2026-08-28-whitepaper-rewrite-maintainer-decisions.zh-CN.md` WPD-01、WPD-09；
- `spec/README.md` 的 lifecycle、relations 和 evidence 规则；
- `P-BASE-SWITCH*`、`P-BASE-SELECT*`、`P-BASE-SCROLL-AREA*` 及对应 Tests；
- `D-ADAPTER-PROFILE-0001` 与 current official Adapter profiles；
- 旧 `evolution-path.md` 只作历史方向来源，不继承阶段承诺。

### 结语：为过去与未来保留交互知识

**Reader question**

即使 Proto UI 自身没有成为主流，这项工作还可能留下什么？

**一句话主张**

Proto UI 想让组件的交互知识不再被某一代框架、平台或实现形式独占；Prototype 是当前可执行近似，真正需要长期保留的是可被未来技术重新检验、翻译和修正的责任边界。

**继承前提**

主论证已经给出经验假设、近似方法、执行与翻译机制、证据边界和反馈循环。

**推导动作**

1. 回到序章的技术时间轴，区分“冻结旧实现”与“保留可迁移语义”。
2. 回答项目失败假设：理论、反例、协议边界和验证方法仍可独立有用。
3. 保留开放结论：未来证据可能证明某些组件不可移植、某些通路分类错误或某些 Host 差异不应被抹平。
4. 用长期公共基础设施愿景结束，而不是使用、贡献或宣传号召。

**例子推进**

Switch 最后一次出现：不再强调它的 API，而是强调未来技术仍可以询问同一组责任是否保持，以及新的证据如何推翻旧近似。

**证据状态**

愿景与写作价值判断，不是工程保证。

**最强反驳**

没有被采用的协议无法形成基础设施，长期价值可能只是作者愿望。

**本章必须正面承认**

采用规模是基础设施影响力的一部分，但清楚描述问题、失败边界和可检验模型本身也可以产生独立技术价值；白皮书不预支任何一种成功。

**Negative boundary**

- 不宣称历史必然走向 Proto UI；
- 不以 stars、采用或贡献号召收尾；
- 不把愿景写成版本承诺；
- 不用宏大措辞掩盖当前 Web-heavy evidence。

**插图机会**

可选。若使用，可把序章时间轴改为开放结尾：过去和未来 Host 围绕一组可修正的交互责任，而不是围绕 Proto UI logo。

**回到序章的 bridge**

序章观察到的是一再消失又重现的劳动；结语把目标收紧为让其中可辨认的交互责任不再随每次技术替换一起失忆。假设是否成立，继续交给未来 realization 和反例检验。

**私有 source / entity map**

- Issue #473 的“即使 Proto UI 最终失败仍值得阅读”标准；
- WPD-01 的白皮书 / Spec / 实践关系；
- 本文前述全部章节的结论，不引入新实体或保证。

## 5. FAQ 的位置

FAQ 不再承担“第十章”或主论证收尾。它是可从任意公共页面进入的非线性参考，并尽量链接回负责完整论证的章节，避免再次复制正文。

建议第一轮问题池：

1. Proto UI 是框架、跨端框架还是组件库？
2. 为什么把 Prototype 称为近似和协议，而不是标准或最终定义？
3. 五条 information channel 是否完备？Host channel 在哪里？
4. 为什么 feedback-only 可以附属，Switch Thumb 为什么又必须独立？
5. 为什么不在 Prototype template 中组合其他 Prototype？
6. 一致性是否要求 DOM、行为或像素完全相同？
7. Proto UI 如何帮助无障碍，而不会自动保证无障碍？
8. 社区 Prototype 与 Adapter 如何和官方保证区分？
9. 白皮书、Spec 和实践冲突时谁来裁决？

FAQ 可以保留社区与项目定位信息，但不得承担首次定义核心概念的责任。

## 6. 例子线路

### Switch：贯穿主线

| 位置 | Switch 承担的任务 | 不应承担的任务 |
| --- | --- | --- |
| 序章 | 展示跨技术重复责任 | 证明不变量或展示 API |
| I-1 | 区分 Switch / Toggle / Checkbox identity | 用外观决定身份 |
| I-2 | 映射五条通路 | 把 State 当作通路 |
| I-3 | 解释 Root/Thumb Context 边界 | 解释 feedback-only 附属结构 |
| II-4 | 区分 State、Anatomy、Context、asHook | 罗列全部语法 |
| II-5 | 串起 setup、runtime、State transition 和 view epoch | 把框架 mount 当作 instance lifetime |
| II-6 | 回扣现有 Web translation evidence | 假装已有 Qt/Flutter Switch |
| II-7 | 展示条件严格的 Web-family 对照 | 无条件要求所有 Host 像素相同 |
| III-8 | 展示 presentation 扩展与 core 边界 | 把 design language 写进 Base identity |
| III-9 / 结语 | 回顾近似如何被证据修正 | 把当前 draft Prototype 写成终局 |

### Select：定点扩展

Select 只用于两个 Switch 无法自然解释的地方：

- I-3：固定不可定制 caret 的 feedback-only 设计案例，以及可配置后应拆分的边界；
- II-7：desktop dropdown 与 touch picker 是否属于 Prototype 授权的媒介替代。

复杂 Select Root/Trigger/Value/Content/Item family 可以在 I-3 或 II-4 作为 Anatomy/多主体补充，但不能展开成第二条贯穿主线。

### Scroll Area：定点扩展

Scroll Area 只用于翻译责任和 Host-owned mechanics：

- II-6：logical scroll surface、normalized facts/requests、Host-owned engine 与 system/composed projection；
- II-7：外观 projection 可以不同，但 surface semantics 和授权策略仍需比较；
- III-9：真实工程如何迫使理论区分 engine ownership、chrome projection 和 accessibility projection。

## 7. 插图计划边界

蓝图只定义“哪里需要图”和“图必须证明什么”，不在本阶段生成最终插图。推荐优先级：

1. I-2 information channel 有向关系图；
2. I-3 Prototype boundary 决策树；
3. II-5 instance lifetime 时间轴；
4. II-6 translation responsibility 与四轴图；
5. II-7 conditional consistency envelope；
6. III-9 三主线证据反馈环。

序章时间轴、I-1 主体对照、II-4 正交维度和 III-8 分层边界可以在正文草稿证明纯文字不足时再制作。所有图必须有可替代的附近正文或 alt text，不用颜色作为唯一编码，并在窄 viewport 上保持可读。

## 8. 建议的手稿顺序

阅读顺序不等于维护者最省力的起稿顺序。推荐：

1. 先写 I-1、I-2、I-3，固定“主体—关系—边界”；
2. 再写 II-5、II-6、II-7，固定“时间—翻译—一致性”；
3. 回写 II-4，把相邻概念放入已成立的具体问题中，避免术语清单；
4. 写 III-8、III-9，明确负边界和证据反馈；
5. 最后写序章与结语，使开头提出的问题和结尾实际回答的问题严格对应；
6. 主线接受后再整理 FAQ；
7. 每章中文最终文字接受后，才制作英文 conceptual-parity 版本。

## 9. 本轮建议接受的最小仲裁

为了开始第一章人工草稿，建议维护者先接受或调整以下四点：

1. 采用“序章 + 三部九章 + 结语”，不继承旧八页边界；
2. 第二部采用“正交维度 → 时间 → 翻译 → 一致性”的顺序，而不是把一致性继续塞在执行语义页面里；
3. `meta` 不获得独立章节或一级并列位置，只在 II-4 作为 provisional 边界一句带过；
4. FAQ 脱离主论证，只做去重后的非线性参考。

这些仲裁只接受写作架构，不会授权公共页面替换、Spec 变更、英文版本、插图生成或发布。

## 10. 已知治理缺口与复审触发

以下问题可以在手稿中诚实标注，但不能由白皮书代替 Spec 决定：

- 完整 Component/Prototype split rule 尚无直接 governing entity；
- comparison profile、normalized DOM 和 image evidence 尚无完整治理身份；
- Compiler 尚无 schema entity identity；
- canonical 白皮书与 principle-source authority 尚未挂接到 Spec graph；
- `meta` 工程证据不足；
- 非 Web Host 的真实 translation/conformance evidence 仍不足。

如果章节草稿发现其中任何缺口使一句话主张无法成立，应暂停该章正文，形成单独的维护者 decision 或 Spec 对账项，而不是用更含糊的文字绕开。

## 11. 主要来源

- 当前写作方向：`internal/records/2026-08-28-whitepaper-rewrite-maintainer-decisions.zh-CN.md`
- record 与 authority policy：`AGENTS.md`、`spec/README.md`、`internal/records/README.md`
- 旧白皮书：`apps/www/src/content/docs/{zh-cn,en}/whitepaper/**`
- 旧页面审计 provenance：PR #550，commit `dc081c57168f1e58517557eb9ed9a909c59c514b`
- 基础理论：`K-COMPONENT-INTERACTION-0001`、`K-COMPONENT-ACTOR-0001`、`K-INFORMATION-CHANNEL-0001`、`K-DESIGN-TRADEOFF-0001`、`K-PROTOTYPE-COMPOSITION-0001`
- 通路与相邻维度：`C-CORE-CHANNEL-0001`、`C-EVENT-0001`、`C-FEEDBACK-0001`、`C-PROPS-0001`、`C-EXPOSE-0001`、`C-CONTEXT-0001`、`C-STATE-0001`、`C-LIFECYCLE-0001`、`C-ANATOMY-0001`、`C-RULE-0001`、`C-AS-HOOK-0001`
- accessibility translation：`C-A11Y-0001`、`HC-A11Y-0001`、`T-A11Y-0001`
- 翻译治理：`D-ADAPTER-PROFILE-0001` 与 current official `A-*` Web profiles
- Switch：`P-BASE-SWITCH`、`P-BASE-SWITCH-THUMB`、`internal/records/2026-07-04-switch-toggle-prototype-boundary.zh-CN.md`
- Select：`P-BASE-SELECT*`
- Scroll Area：`K-SCROLL-0001`、`C-SCROLL-0001`、`M-SCROLL-0001`、`HC-SCROLL-SURFACE-0001`、`P-BASE-SCROLL-AREA*`、`internal/records/2026-07-29-scroll-area-boundary-and-host-projection.zh-CN.md`
- 企划与验收语境：Issue #473、Issue #478
