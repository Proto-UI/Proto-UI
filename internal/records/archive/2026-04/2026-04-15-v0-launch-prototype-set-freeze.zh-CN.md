# 2026-04-15 v0 首发 Prototype 集合冻结

> Internal record. Not normative. 本文用于回应“v0 首发 prototype 子集冻结”相关 issue，明确哪些 base / shadcn prototypes 被视为首次公开发布时的官方支持集合，哪些可以作为不阻塞发布节奏的补充项继续推进。

---

## 1）背景

首次公开发布前，Proto UI 不需要继续扩大 prototype 覆盖面来证明自己“像一个更完整的组件库”。

首次公开发布真正需要的是：

- 冻结一套小而可信的官方支持集合
- 让文档、demo、测试与实现承诺范围保持一致
- 避免“仓库里有实现”被误读成“已经进入公开支持承诺”

与此同时，当前项目又出现了另一种现实：

- 一部分相邻原型已经变得很好实现
- 在已有交互先例、测试套路和 AI Agent 协助下，继续扩充附近原型的边际成本越来越低

因此，本轮决策既要明确“首发到底承诺什么”，也要允许一部分“可以做”的 prototype 继续推进，只要它们不拖累发布主线。

---

## 2）已观察到的事实

### 2.1 当前仓库已经具备足够形成一套可信首发集合的原型储备

当前 `packages/prototypes/base` 已存在：

- `button`
- `dialog`
- `dropdown`
- `hover-card`
- `select`
- `switch`
- `tabs`
- `toggle`
- `transition`

当前 `packages/prototypes/shadcn` 已存在：

- `button`
- `dialog`
- `dropdown`
- `hover-card`
- `switch`
- `tabs`
- `toggle`

因此，当前问题不是“有没有 prototype 可发”，而是“哪些 prototype 应进入公开承诺范围”。

### 2.2 当前公开可见度并不均匀

从当前 docs / demo 可见度看，已经相对稳定的公开页面包括：

- base: `dialog`、`hover-card`、`select`、`transition`
- shadcn: `button`、`dropdown-menu`、`hover-card`、`switch`、`tabs`、`toggle`

还有一些 prototype 虽然已有实现与测试，但公开承诺面还不够稳定，例如：

- base `dropdown`
- base `switch`
- base `tabs`
- base `toggle`
- shadcn `dialog`

这些 prototype 当前更适合被视为“已存在实现储备”，而不是自动进入 v0 首发官方支持集合。

### 2.3 首发范围的关键，不是“能不能再做”，而是“承诺是否会膨胀”

在当前阶段，很多 prototype 已经进入“如果要做，也不是很难”的状态。

但首次公开发布时最需要避免的风险仍然是：

- 文档看起来像支持更多
- demo 暗示了更多
- 实际测试、文档和维护承诺却还没跟上

所以，首发 prototype 范围的冻结，重点不是压制开发，而是压制**承诺膨胀**。

---

## 3）问题定义

当前需要明确三个问题：

1. 哪些 base / shadcn prototypes 被正式视为 v0 首发官方支持集合？
2. 哪些 prototype 可以在首发前继续推进，但不进入发布门槛？
3. 如何在文档里清楚区分“首发支持”和“后续补齐”，避免对外误解？

---

## 4）决策

### 4.1 v0 首发官方支持集合冻结为一套“小而可信”的双层库组合

本次冻结的官方支持集合如下。

#### Base 官方支持集合

- `dialog`
- `hover-card`
- `select`
- `transition`

#### shadcn 官方支持集合

- `button`
- `dropdown-menu`
- `hover-card`
- `switch`
- `tabs`
- `toggle`

这组集合应被视为：

- v0 首次公开发布时的官方支持 prototype 子集
- docs、demo、release note 与 launch 文案应保持一致提及的范围
- 首发前必须保证测试与 docs/demo 可见度的对象

### 4.2 不在上述集合中的 prototype，不自动进入首发承诺

即使仓库中已经存在实现、测试甚至局部 demo，下列类型的对象仍不应自动被视为首发官方支持：

- 已有实现但公开 docs/library page 尚不稳定的 prototype
- 仍在调整边界或命名的 prototype
- 还没有明确进入 launch 文案与 docs 导航的 prototype

因此，下列 prototype 当前默认不进入首发承诺：

- base `button`
- base `dropdown`
- base `switch`
- base `tabs`
- base `toggle`
- shadcn `dialog`

如果其中任一对象想在发布前升格为“官方支持”，必须重新满足首发准入条件，而不是因为仓库里“已经有代码”就自动算入。

### 4.3 首发准入条件采用“测试 + docs/demo 可见度 + 口径稳定”三条线

一个 prototype 想进入 v0 首发官方支持集合，至少需要同时满足：

1. 有测试
2. 有 docs 或 demo 可见度
3. 文档口径已经稳定，不会让人误解其支持边界

这意味着：

- “只有实现”不够
- “只有测试”不够
- “只有 demo”也不够

必须至少形成一个对外可信的最小闭环。

### 4.4 允许存在“首发前可继续推进，但不阻塞发布”的补充集合

为了避免冻结范围被误解为“现在开始什么都不能再做”，本次决策明确增加一个单独层级：

> `可做但不阻塞发布的补充集合`

这类 prototype 的定位是：

- 有现实价值
- 做出来会提升 demo 体验或展示完整度
- 跟得上就带上，跟不上就后置
- 不应反向拖累 Quick Start、package、docs 对齐等首发主线

当前建议纳入这一层级的包括：

- `input`
- `radio`
- `checkbox`
- `slider`
- `tooltip`
- `tooltip group`
- `textarea`

其中：

- `input` 属于首发前优先推进的补充项，但仍不应成为拖慢发布主线的前提条件
- `radio` / `checkbox` / `slider` / `tooltip` 更适合作为高回报 demo 补洞项
- `textarea` 可以跟进，但当前优先级低于 `input`

### 4.5 “可做集合”只有在满足首发准入条件后，才可升格为官方支持

如果补充集合中的 prototype 在首发前顺利补齐了：

- 测试
- docs/demo
- 稳定口径

则它可以被单独评估，决定是否升格为首发官方支持。

但默认规则仍然是：

- 没补齐，就不升格
- 不升格，也不影响发布

这条规则的目的，是保证原型扩张不再直接绑定首发节奏。

---

## 5）为什么这样决定

### 5.1 首发成功依赖的是“可信集合”，不是“更大集合”

首次公开发布时，真正能建立信任的不是一个很长的 prototype 名单，而是一组：

- 文档能说明
- demo 能展示
- 测试能支撑
- 发布口径能自洽

的 prototype 集合。

因此，首发集合必须优先服务“可信度”，而不是优先服务“广度”。

### 5.2 当前官方支持集合已经足够讲清 Proto UI 的故事

当前冻结下来的首发集合已经足以覆盖：

- 基础 styled 入口，如 `shadcn-button`
- overlay / compound anatomy，如 `dialog`
- hover / floating 交互，如 `hover-card`
- value presentation，如 `select`
- state / toggle 交互，如 `switch`、`toggle`
- family / tabs 结构，如 `tabs`
- transition / presence 探针，如 `transition`

这已经足够支撑 Proto UI v0 的对外叙事，不需要再靠继续扩张 prototype 数量来证明“不是玩具”。

### 5.3 继续做原型不是问题，问题是不要把“能做”误写成“已承诺”

当前仓库已经进入一个阶段：

- 不少相邻原型都可以继续做
- 做出来通常也真的有帮助

所以问题不在于“做不做”，而在于：

> 文档与发布叙事是否把这些工作错误地升级成了公开承诺。

通过单独引入“可做但不阻塞发布的补充集合”，可以把这两件事拆开：

- 开发可以继续推进
- 发布承诺保持稳定

### 5.4 `input` 等 prototype 值得推进，但不应吞掉发布主线

像 `input` 这样的 prototype，确实会明显改善 demo 编写能力，也值得首发前推进。

但即便如此，本轮仍然建议把它放在“优先补充集合”而不是“默认首发承诺集合”，原因是：

- 首发主线首先要确保 Quick Start、package、docs 口径和当前核心 prototype 集合真正闭环
- 如果把每个高价值补充项都自动升级为发版门槛，发布节奏又会重新失控

所以更稳妥的方式是：

- 鼓励推进
- 允许升格
- 但默认不绑定发布门槛

---

## 6）文档执行口径

从本决策起，文档与发布物料应遵循以下口径：

### 6.1 对外文档必须明确区分两层

至少要清楚区分：

- `v0 首发官方支持`
- `后续补齐 / in progress / post-launch candidates`

不得继续使用会让人误解为“仓库里有实现 = 已被官方支持”的模糊写法。

### 6.2 UI library 页面、README、release note 应与冻结名单一致

凡是被写入：

- README
- docs library landing pages
- 首发说明
- release note

的 prototype 名单，应与本决策中的官方支持集合保持一致。

### 6.3 补充 prototype 可以展示，但必须避免误导

如果首发前或首发后展示某些“补充集合”中的 prototype，应通过文案明确其状态，例如：

- exploring
- in progress
- post-launch candidate
- not part of v0 launch support

具体措辞可以后续统一，但边界必须清楚。

---

## 7）后续动作

基于本决策，后续建议按以下顺序推进：

1. 在 docs / release planning 中引用本冻结名单作为首发 prototype 口径依据。
2. 对照官方支持集合，审计每个 prototype 的测试与 docs/demo 可见度是否齐全。
3. 在相关页面中增加清晰的“首发支持 / 后续补齐”区分。
4. 将 `input`、`radio`、`checkbox`、`slider`、`tooltip` 等纳入补充集合管理，而不是纳入发版阻塞清单。
5. 若补充集合中的 prototype 在发布前补齐全部准入条件，再单独决定是否升格。

---

## 8）结论

Proto UI v0 首次公开发布的 prototype 范围，应冻结为一套小而可信的官方支持集合，而不是继续随着仓库实现增长而自然膨胀。

本轮冻结的首发官方支持集合为：

- base: `dialog`、`hover-card`、`select`、`transition`
- shadcn: `button`、`dropdown-menu`、`hover-card`、`switch`、`tabs`、`toggle`

同时，项目明确允许继续推进一批“可做但不阻塞发布”的补充 prototype，例如：

- `input`
- `radio`
- `checkbox`
- `slider`
- `tooltip`
- `tooltip group`
- `textarea`

这些工作可以继续做，也值得做。

但在没有补齐测试、docs/demo 可见度与稳定口径之前，它们不应自动进入 v0 首发官方支持承诺。
