# 2026-04-15 v0 首发 Prototype 覆盖、Demo 支撑能力与 Icon 路线决策

> Internal record. Not normative. 本文用于收敛 Proto UI v0 首次公开发布前，Prototype 覆盖范围应按什么原则冻结，哪些补充项值得在首发前推进，以及 icon / SVG 能力应采用什么路线。

---

## 1）背景

在前一轮首发范围讨论中，仓库已经形成了一个较清晰的共识：

- Proto UI 首次公开发布要证明的是“首个官方使用闭环”和“工作模型成立”
- 它不需要在首次发布时证明一个很大的生态广度
- 原型库建设应以“小而可信的官方集合”为目标，而不是继续无限扩张

但在继续梳理原型库时，新的情况变得更明确了：

- 当前仓库中，已经存在一批可用的 base / shadcn prototypes、测试和 demo
- 一旦某类交互已经形成 prototype 代码形态与测试套路，继续扩充相邻原型的成本会显著下降
- 在有 AI Agent 协助的情况下，这种“相邻原型扩张”的边际成本还会进一步下降

因此，首发前真正需要处理的问题，已经不再是“还能不能再做更多原型”，而是：

> 在很多原型都变得可做、甚至很好做的前提下，首发范围应如何收口，避免重新滑向生态完整度竞争。

与此同时，另一个需求也变得越来越明确：

- Proto UI 首发后的理想状态，不是“可直接投入关键生产环境”
- 但至少应达到“不能直接上生产，但写 demo 已经足够顺手”的程度

这意味着，Prototype 覆盖范围除了服务于“证明工作模型”，还需要服务于“避免 demo 编写在非常常见的交互场景中卡死”。

---

## 2）已观察到的事实

### 2.1 当前仓库已经具备一批足以支撑首发叙事的核心原型

当前 `packages/prototypes/base` 中已存在：

- `button`
- `dialog`
- `dropdown`
- `hover-card`
- `select`
- `switch`
- `tabs`
- `toggle`
- `transition`

当前 `packages/prototypes/shadcn` 中已存在：

- `button`
- `dialog`
- `dropdown`
- `hover-card`
- `switch`
- `tabs`
- `toggle`

其中相当一部分已经拥有测试与文档或 demo 可见度，因此 Proto UI 当前并不缺少首发叙事的起点。

### 2.2 当前最关键的首发判断，不是“原型数量够不够”，而是“是否已经覆盖关键语义类别”

从现有原型可见，Proto UI 已经能够覆盖至少以下几类关键能力：

- 基础激活交互，如 `button`
- overlay / boundary / anatomy 协同，如 `dialog`
- collection / item / active navigation / typeahead，如 `dropdown`
- value presentation 探针，如 `select`
- state 与 visual feedback 协同，如 `switch` / `toggle`
- family 结构与部分联动，如 `tabs`
- presence / transition 相关执行语义，如 `transition`

这意味着 Proto UI 首发前已经不是“完全缺能力”，而是“需要决定是否还要补足少数会明显影响 demo 体验的空白”。

### 2.3 有一批原型虽然看起来像扩张，但实际上是低阻力、高回报补充

在当前阶段，下列原型并不构成明显架构阻塞，且实现路径已经较顺：

- `radio`
- `checkbox`
- `slider`
- `tooltip`
- `tooltip group`

这类原型的共同特点是：

- 相邻交互已经存在先例
- 测试套路与 authoring 形态可以复用
- 对 demo 编写有直接帮助
- 它们的价值更多体现在“降低展示阻力”，而不在于重新证明 Proto UI 的底层成立性

### 2.4 `input` 的地位已经发生变化

此前，`Input / TextArea` 曾被明确列为“当前阶段不建议过早触碰”的对象，主要因为它们会过早引入：

- `run.update`
- value 回显
- 原生输入模型
- IME / selection / composition
- native / non-native 路线分叉

这些复杂度会把“值呈现机制是否成立”与“宿主输入模型如何映射”纠缠在一起。

但当前新的前提是：

- 数据回显和 `update` 流程已经不再构成主要阻塞
- 首发前可以先不追求 `native input` 的全面兼容
- 可以先推进一个 Proto UI 体系内、自洽的 `input` 原型

在这个前提下，`input` 的性质已经从“过早问题”变为“很值得在首发前补齐的 demo 能力项”。

### 2.5 icon / SVG 已经接近“公共展示能力缺口”，而不是单个原型需求

当前很多 demo 与 prototype page 都天然需要 icon 才能达到合理的可展示状态，例如：

- dropdown / select 的 chevron
- dialog / overlay 类场景中的 close icon
- checkbox / radio 的视觉符号
- button / navigation / status 类 demo 的辅助 icon

如果没有 icon 支撑，很多 demo 虽然可以勉强跑通，但观感会明显停留在“半成品展示”。

与此同时：

- v0 当前的 adapter 范围优先支持 Web 宿主
- Web 宿主对 SVG 本身普遍有成熟支持
- 这意味着 SVG 支持更像是“宿主已有能力尚未完成接线”，而不是一个高风险的新语义发明

因此，`SVG template support` 更接近一项“高收益的能力补齐”，而不只是一个附属细节。

---

## 3）问题定义

当前需要收敛三个问题：

1. 当很多相邻原型已经不难实现时，首发前 Prototype 覆盖范围应按什么原则收口？
2. 哪些新增 Prototype 应被视为“首发前高回报补充”，哪些应明确后置？
3. icon / SVG 这类公共展示能力，应如何以低风险方式进入首发前范围？

如果这三个问题不被明确下来，项目很容易掉进两种相反但都不理想的状态：

- 过度克制，导致 Proto UI 首发后虽然能讲理论，但 demo 编写仍然处处别扭
- 过度扩张，因为“很多原型都很好做”，重新滑向无限扩展的组件库工程

---

## 4）决策

### 4.1 首发前 Prototype 覆盖范围应按“三类价值”收口，而不是按“难易度”收口

从本决策起，首发前的 Prototype 判断应优先区分以下三类：

#### A. 叙事支柱型

这类原型的价值在于：

- 它们定义 Proto UI 首发到底在证明什么
- 它们直接承载“工作模型成立”的叙事

当前建议继续作为核心的包括：

- `dialog`
- `select`
- `transition`
- `input`

其中：

- `dialog` 负责证明 overlay / boundary / anatomy 协同
- `select` 负责证明 value presentation 与 family boundary
- `transition` 负责证明执行语义与 presence / update 路径
- `input` 负责避免 Proto UI 在 value entry 场景中整体退出舞台

#### B. Demo 补洞型

这类原型的价值不在于重新证明底层模型，而在于：

- 降低官方 demo 编写阻力
- 避免非常常见的交互类别出现显眼空白
- 让原型库对外观感更接近“足够能用来展示”

当前建议作为首发前高回报补充候选的包括：

- `radio`
- `checkbox`
- `slider`
- `tooltip`
- `tooltip group`
- `textarea`

它们应被理解为：

- 很值得做
- 可以进入首发前冲刺
- 但不应反过来成为首发是否成功的主判断标准

#### C. 能力补齐型

这类工作不等于再做一个 prototype，而是补足多个 prototype 与 demo 共同依赖的底层能力。

当前最典型的就是：

- `SVG template support`
- 最小 icon 支撑方案

这类工作具有如下特征：

- 它们会同时提升多个 demo 与 prototype 的表现力
- 它们对当前 Web adapter 范围来说宿主风险较低
- 它们的收益往往大于继续增加一个单体原型

### 4.2 `input` 应从“可后置项”上调为“首发前优先补齐项”

在当前新的前提下，`input` 的角色调整如下：

- 它仍不是唯一的发版阻塞项
- 但它已经属于首发前最值得补齐的原型之一

原因不是“组件库完整度”，而是：

- 没有 `input`，登录、搜索、筛选、表单等最自然的 demo 场景会明显受限
- 没有 `input`，Proto UI 很容易给人留下“擅长选择与开关，但一到文本输入就退回原生宿主”的印象
- 有了 `input`，Proto UI 对“值输入型交互主体”才算有一个正式起点

因此，`input` 应被视为：

- 对“工作模型证明”来说的 `P1`
- 对“demo 足够可写”来说接近 `P0.5`

### 4.3 首发前允许继续补充“低阻力、高回报”的常见原型，但必须受收口原则约束

从本决策起，首发前继续补充 Prototype 并不被视为范围失控本身。

真正的问题不在于“继续做”，而在于“是否仍符合以下条件”：

- 能明显提升 demo 编写顺手度
- 能复用已有交互先例，而不是重新打开全新架构议题
- 不会把项目主叙事从“工作模型成立”转向“组件广度竞争”

因此，诸如 `radio`、`checkbox`、`slider`、`tooltip` 一类原型可以进入首发前范围，但它们的定位应始终保持为：

- 高回报补充项
- 不是首发成败的唯一门槛

### 4.4 `SVG template support` 应作为首发前高优先级能力项推进

`SVG template support` 的定位应当是：

- 首发前高优先级的能力补齐项
- 优先级高于很多单体 prototype 扩张

原因包括：

- Web 宿主本身已经具备成熟 SVG 能力
- 现有 adapter 范围与 SVG 的天然相性较好
- 这更像是“接线”而不是“重发明”
- 它会直接提升大量 demo 与 prototype 的展示质量

### 4.5 Icon 路线优先采用 `lucide-static` 依赖 + 本地生成包装层

对于 icon 支撑方案，本轮决策如下：

- 优先采用 `lucide-static` 作为上游静态资源来源
- Proto UI 侧实现一个带有本项目前缀的 icon 包或 icon 原型库
- 该包应明确说明资源来自 Lucide，且为 Proto UI 侧的非官方实现
- 如有必要，可通过脚本从 `lucide-static` 生成 Proto UI 语法下的包装代码

当前不建议首发前优先采用以下路线：

- 手工维护一套自有 icon 资源
- 把 Lucide 资源当作 Proto UI 自研资产对外表述
- 在没有明确生成链路的情况下，手写大规模转写 Lucide 图标

更稳妥的理解是：

- 上游视觉资产来自 Lucide
- Proto UI 提供的是适配本项目 template / prototype / adapter 体系的消费层
- Proto UI 包名、README 与文档应清楚声明“资源来源”和“非官方实现”身份

### 4.6 对 Lucide 的标注要求应以“真实、清楚、不过度夸张”为准

当前建议的最小合规口径如下：

- 包名使用 Proto UI 自身前缀，不冒充 Lucide 官方包
- README 首页说明资源来源于 Lucide
- 明确写出“非 Lucide 官方实现”或含义等价的说明
- 保留上游许可证与必要 attribution
- 说明本包的职责是为 Proto UI 提供 icon consumption layer，而不是重新声明图标著作归属

当前不必为了避免风险而额外采用过重做法，例如：

- 在每个单独 icon 文件头部写冗长声明
- 把对上游来源的说明写到压倒产品本身
- 在所有页面重复堆叠法律式文案

也就是说，本项目应做到：

- 真实
- 明确
- 持续可维护

而不是通过过量声明制造新的维护负担。

---

## 5）为什么这样决定

### 5.1 Proto UI 当前的风险已经不再是“做不出更多原型”

随着原型 authoring 形态、asHook 复用方式、测试套路与 AI 协作效率逐渐成形，越来越多原型已经进入“可以做，而且不算难做”的阶段。

在这种阶段下，继续用“难不难做”作为首发范围判断标准，会失去约束力。

因此必须换成另一条线：

> 它是否提升了工作模型说服力、demo 可写性、或公共展示能力？

### 5.2 `input` 是 demo 能力与工作模型之间的关键桥梁

如果没有 `input`，Proto UI 仍然可以讲清一部分重交互故事。

但它很难在最日常的页面级 demo 中显得“可用”。

因此，`input` 的价值比普通“多一个组件”更高，它既是：

- value entry 的正式起点
- 也是 demo 编写顺手度的重要分水岭

### 5.3 Icon / SVG 的收益是乘数型，而不是单点型

很多看似不同的 demo，其实都会依赖同一类 icon / SVG 能力。

因此，补齐这部分能力的收益并不会只落在一个 prototype 上，而会扩散到：

- 原型库页面
- 首页 demo
- Quick Start 示例
- shadcn 风格库的对外观感

这使它在首发前具有比“再加一个单体原型”更稳定的回报。

### 5.4 `lucide-static` 比手工 vendoring 更适合作为首发前路线

优先依赖上游静态资源并建立生成链路，有几个明显好处：

- 升级路径更干净
- 资源来源更清楚
- 更容易维持与上游的一致性
- 避免把大量第三方资产手工散落进仓库

这比一开始就走全面 vendoring 更符合“低风险、可维护”的首发策略。

---

## 6）明确后置或降级处理的内容

以下内容当前不建议挤入首次公开发布门槛：

- 为 `input` 立即追求 `native input` 的全面兼容度
- 在 `input` 首发时同步解决全部 IME / selection / composition 复杂场景
- 过早扩张到 `combobox` / `autocomplete` / `command palette`
- 追求一个非常完整的 icon 产品线
- 把 icon 方案做成独立于 Proto UI 首发目标的大型资源工程

这些方向当然重要，但它们更适合作为：

- 首发后的扩张项
- 或在首发前仅保留最小可用路径

---

## 7）后续动作

基于本决策，首发前后续工作建议按以下顺序推进：

1. 冻结一份按“叙事支柱型 / Demo 补洞型 / 能力补齐型”分类的原型与能力清单。
2. 将 `input` 明确纳入首发前优先补齐范围，并控制其目标为“Proto UI 自洽的最小可用输入原型”。
3. 评估并推进 `SVG template support` 的最小接入实现。
4. 设计一个最小 icon 支撑方案，优先验证 `lucide-static` + 本地生成包装层。
5. 为 icon 包或原型库草拟 README 口径，明确：
   - 资源来源于 Lucide
   - 非 Lucide 官方实现
   - 许可证与 attribution 的保留方式
6. 根据 demo 需求与相邻交互复用度，视时间补充 `radio`、`checkbox`、`tooltip`、`slider` 等高回报原型。

---

## 8）结论

Proto UI v0 首发前的 Prototype 范围，不应再按“还能做多少组件”来收口，而应按以下三条线收口：

- 是否提升工作模型的说服力
- 是否显著降低 demo 编写阻力
- 是否补齐多个 demo 共同依赖的展示能力

在这个标准下：

- `input` 应上调为首发前优先补齐项
- `radio`、`checkbox`、`slider`、`tooltip` 等属于高回报 demo 补洞项
- `SVG template support` 与最小 icon 路线属于高优先级能力补齐项
- icon 方案优先采用 `lucide-static` 作为上游静态资源来源，并由 Proto UI 提供清晰标注、带项目前缀的非官方消费层

从现在开始，首发前继续补原型并不被视为问题本身。

真正需要被持续约束的是：

> 每一项新增内容，是否仍然服务于 Proto UI 的首发目标，而不是把项目重新拖回“先把组件库做大”的路径。
