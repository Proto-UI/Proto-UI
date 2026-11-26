# 2026-04-13 v0 首次公开发布工作流矩阵

> Internal record. Not normative. 本文将第一次公开发布前的工作拆成具体方向，并为每个方向定义优先级、发版前“做到什么算够”、以及哪些内容应当主动后置。

---

## 1）本文用途

这份矩阵主要回答四个问题：

- 这个工作方向为什么对 v0 有意义
- 它是 `P0`、`P1` 还是 `P2`
- 第一次发布前做到什么程度算“足够”
- 哪些内容应刻意后置，避免范围失控

优先级定义：

- `P0`：发版阻塞项
- `P1`：重要的发版加固项
- `P2`：发布后扩张项

---

## 2）总表

| 工作方向 | 优先级 | 首次发布前“足够”的标准 | 可以安全后置的内容 |
| --- | --- | --- | --- |
| 最小使用场景闭环 | P0 | 一条从文档到跑起组件的官方路径 | 多条 onboarding 路径、更多 DX 打磨 |
| 原型库建设 | P1 | 冻结一套小而可信的官方 prototype 集合 | 大规模组件扩张 |
| 文档建设 | P0 | README + Quick Start + status + contributing + reference 入口全部对齐 | 深度 reference 完整性 |
| 契约编目、契约测试编目 | P1 | 有一份能从 contract 找到实现和测试的索引 | 极致完整的 catalog |
| CLI 开发、测试；npm package 发布与管理 | package 流程是 P0，CLI 本身是 P1 | package 可安装、release 流程可重复执行 | 丰富 CLI 能力 |
| 组织管理、CI/CD 等后勤建设 | P1 | 有基础 PR CI、issue intake 和发版责任落点 | 更重的治理与自动化 |
| 适配器覆盖范围扩充 | P2 | 诚实说明当前覆盖即可 | 新 adapter 家族 |
| 网站运营、社交媒体运营 | P2 | 有首发页与首发消息包即可 | 长期内容运营节奏 |

---

## 3）逐项拆解

### 3.1 最小使用场景闭环（Quick Start 可跑通）

**优先级：** `P0`

**为什么重要**

这是最关键的外部证明。如果一个新用户不能从文档出发，最终在本地真正跑起 Proto UI，那么 v0 的发布叙事就是不可信的。

**当前仓库事实**

- EN / ZH 两套 Quick Start 已经存在
- 但它们明确写着 CLI 还没准备好，不应真的执行
- 首页 demo 已经能展示多个 runtime 下的真实组件行为

**首次发布前做到什么算够**

- 选定一条官方推荐 onboarding 技术栈，优先 React
- 选定一条官方示范路径，建议是 `Button` 加一个复合 / overlay 组件，例如 `Dialog`
- 确保文档里写出来的路径可以原样跑通
- 确保至少存在一个 smoke 级别验证
- 删除所有“未来流程”“暂不可运行”的对外措辞

**发版前具体任务**

- 决定 Quick Start 是 `manual install` 还是 `CLI init/add`
- 产出一条官方最小样例路径
- 在干净环境里重走这条路径
- 把 README 与 docs 口径统一到这条路径上
- 把“前 10 分钟是否顺畅”纳入发版标准

**可以后置**

- 多套框架专属 Quick Start
- 多个 starter template
- 更高级的脚手架体验
- 自动迁移 / 升级流程

**建议规则**

不要发布一条只存在于叙事中的 Quick Start。

只发布我们此刻真的能支持的路径。

---

### 3.2 原型库建设

**优先级：** `P1`

**为什么重要**

第一次发布需要一个可信的 prototype surface，但可信度来自“收敛与稳定”，不是来自“数量很多”。

**当前仓库事实**

当前 base prototypes 至少已经包含：

- button 相关行为工具
- dialog
- dropdown
- hover-card
- select
- switch
- tabs
- toggle
- transition

当前 shadcn prototypes 至少已经包含：

- button
- dialog
- dropdown
- hover-card
- switch
- tabs
- toggle

这已经足够支撑一套体面的 v0 首发集合。

**首次发布前做到什么算够**

- 冻结一套显式命名的官方首发集合
- 首发集合中的每个 prototype 都有通过的测试
- 首发集合中的每个 prototype 都有 docs 或 demo 覆盖
- 文档能明确区分“已首发支持”和“后续补齐”

**建议首发集合**

- headless / base 集合：`dialog`、`hover-card`、`select 或 dropdown`、`switch`、`tabs`、`toggle`、`transition`
- styled / shadcn 集合：`button`、`dialog`、`hover-card`、`switch`、`tabs`、`toggle`

这已经足够讲清楚 Proto UI 的故事。

**发版前具体任务**

- 在 docs 和 release note 中显式标出首发集合
- 审核这批 prototype 的命名、README、测试、demo 可见度
- 去掉任何会让人误解“未支持组件也已经属于 public contract”的暗示

**可以后置**

- 更多设计语言库
- 长尾组件
- 原型库大范围扩张
- 与外部 UI 库追求完全对齐

---

### 3.3 文档建设

**优先级：** `P0`

**为什么重要**

Proto UI 仍然处在一个“解释质量几乎决定发布质量”的阶段。

**当前仓库事实**

当前仓库已经有大量 EN / ZH 文档，包括：

- 首页与状态页
- roadmap
- whitepaper 与 specifications
- build / contribute 指南
- prototype library 页面

当前文档问题不是“没有文档”。

而是“文档之间是否一致”。

**首次发布前做到什么算够**

- README、docs homepage、status、roadmap、Quick Start 说的是同一个故事
- 文档明确说明 v0 是什么、不是什
- 普通用户入口明确
- 贡献者入口明确
- 即使 reference 还不完整，也要有清晰入口
- 文档使用的是实际支持的安装 / 使用路径，而不是未来占位路径

**发版前具体任务**

- 按真实支持路径重写 Quick Start
- 审核 README、status、roadmap、homepage hero、links 的措辞一致性
- 让 package 名称与支持的 adapter 一眼可见
- 增加“如果你只想使用 Proto UI，从这里开始”
- 增加“如果你想参与贡献，从这里开始”

**可以后置**

- 全量 reference 补齐
- 所有深层页面的完全双语同步
- 每个方向都写成长教程

---

### 3.4 契约编目、契约测试编目

**优先级：** `P1`

**为什么重要**

项目已经有大量 contract 与 contract test。当前缺的不是内容本身，而是一张让贡献者与 reviewer 都能迅速回答以下问题的地图：

- 哪个 contract 已经存在
- 它在哪里实现
- 它在哪里被测试
- 哪些地方还是 debt 或未覆盖

**当前仓库事实**

- `internal/contracts` 下已经有大量 v0 文档
- runtime / modules / prototypes / adapters 的 tests 已经覆盖了很多 contract
- 当前还没有一份非常显眼的总索引，能把这些东西串起来

**首次发布前做到什么算够**

- 有一份 contract 家族索引
- 有一份关键 contract-test 索引
- 有一个新增 contract coverage 的最小约定
- 有一份可见的 debt / 明确后置清单

**发版前具体任务**

- 建一页 contract catalog 或 internal record 索引
- 建一页测试目录，映射 major contract 到代表性测试
- 写清楚最小 review 规则：adapter / prototype 变更必须说明涉及哪些 contract 与 tests

**可以后置**

- 每个文件一对一穷尽映射
- 自动 coverage dashboard
- 所有 contract family 的深度 taxonomy 清理

---

### 3.5 CLI 开发、测试；npm package 的发布与管理

**优先级：** package 发布 / 安装路径是 `P0`，CLI 本身是 `P1`

**为什么重要**

用户不是直接“采用一个架构理念”，而是采用 packages 和 commands。

所以第一次公开发布必须有真实安装路径，但不一定必须有功能丰富的 CLI。

**当前仓库事实**

- release scripts 已经存在
- core / modules / runtime / prototypes / adapters 的 package metadata 已经存在
- release scan 仍然会报出 `src/*.ts` exports、README 缺失等发布风险
- 仓库里当前看不到明显的 CLI package
- 当前 Quick Start 却依赖一个尚未发布的 CLI

**首次发布前做到什么算够**

- 明确选择 v0 的 public package 子集
- 让这批 package 的 staging / publish 流程跑通
- 清理这批 package 上的 README / export / metadata 阻塞项
- 文档写清楚官方支持的安装路径

对于 CLI 而言，“够用”的标准是二选一：

1. Quick Start 不依赖 CLI，或者
2. 只发布一个覆盖官方 onboarding 路径的极小 CLI

除此之外的 CLI 能力都不是 v0 必需品。

**发版前具体任务**

- 决定 CLI 是否进入首发故事
- 如果不进：Quick Start 改为 manual install + assembly path
- 如果要进：只做 `init` + 一条 `add` 路径，并做 smoke test
- 定义首发 package 子集，而不是默认所有内部 package 都要一起对外
- 反复跑 release staging，直到这批 package 干净

**可以后置**

- 更丰富的 CLI 子命令
- 更强的 code generation 体验
- 官方路径之外的 package 管理便利性
- 把每个内部 module 都打磨成独立 public surface

**重要判断**

package 现实可用性是硬要求。

CLI 精致度不是。

---

### 3.6 组织管理、CI/CD 等后勤建设

**优先级：** `P1`

**为什么重要**

一旦公开发布，模糊性和无主状态的代价会迅速上升。最小化的项目后勤可以显著减少混乱，但不需要一步到位做成重型治理体系。

**当前仓库事实**

- 已有贡献指南
- 已有 issue template
- 当前看不到明显的 GitHub workflow 文件

**首次发布前做到什么算够**

- PR 上自动跑 type check 与 tests
- docs build 至少在 CI 或 release check 中被验证一次
- release checklist 有明确 owner 或顺序
- adapter / prototype / docs 的 issue intake 仍然清晰

**发版前具体任务**

- 增加基础 GitHub Actions：test + type check
- 如果成本可控，再补 docs build check
- 把 release checklist 落成一套可执行流程
- 定义发布后最小 triage 节奏

**可以后置**

- 自动 changelog pipeline
- 多阶段 release promotion
- 更复杂的治理制度
- 正式 maintainer rotation

---

### 3.7 适配器覆盖范围扩充

**优先级：** `P2`

**为什么重要**

它在长期上很重要，但对第一次公开发布不是必要证明项。

**当前仓库事实**

React、Vue、Web Components 已经足以说明：

- Proto UI 不是框架专属抽象
- adapter 边界是真实成立的
- 同一 prototype 能穿过多个 host 映射继续成立

**首次发布前做到什么算够**

- 维持当前三种 adapter 的健康状态
- 对当前支持程度作诚实说明
- 提供一个最小兼容性 / 覆盖说明

**发版前具体任务**

- 无需大规模扩张
- 只修会阻塞首发路径的现有 adapter 缺陷
- 在文档中写清当前 adapter 支持程度和已知 caveat

**可以后置**

- 新框架 adapter
- 非 Web adapter
- 除非影响首发 demo，否则无需追求更深层 feature parity

---

### 3.8 网站运营、社交媒体运营

**优先级：** `P2`

**为什么重要**

第一次发布需要“有消息可发”，但不需要一整套长期运营体系。

**当前仓库事实**

- 网站与文档已经存在
- 首页已经有 demo 驱动的叙事能力
- project links 已经指向 GitHub、Discord、Discussions 与官网

**首次发布前做到什么算够**

- 首页与关键入口页可用
- 链接正确
- 至少准备一套 release announcement 文案
- 各渠道的一句话定位一致

**发版前具体任务**

- 准备一份首发贴 / thread
- 准备一份 release summary 或 changelog 文案
- 审核首页 CTA 与各类链接

**可以后置**

- 内容日历
- 高频社交媒体节奏
- 多平台增长实验
- 持续性的传播数据分析

---

## 4）推荐发版顺序

### Wave A：先把现实可用性做实

- 决定 Quick Start 路线
- 决定首发 package 子集
- 清理首发 package 的 staging / publish blocker
- 按真实路径重写 docs

### Wave B：再把首发表面做可信

- 冻结首发 prototype 集合
- 建立 contract / test catalog 索引
- 增加基础 CI
- 对齐 README、status、roadmap、homepage 口径

### Wave C：最后准备首发支持物料

- 审核首发页面
- 准备 release note / announcement
- 审核贡献者入口

任何 Wave C 工作都不应抢在未完成的 Wave A 工作之前。

---

## 5）最低交付物清单

第一次公开发布前，至少应该存在以下交付物：

- 一条真实可跑的 Quick Start
- 一份显式命名的首发 package 子集
- 一份显式命名的首发 prototype 子集
- 一轮 README 与 docs site 的口径对齐
- 一份 internal contract / test catalog 索引
- 一条基础 CI workflow
- 一套 release announcement 文案包

除此之外的工作，都允许后移。

---

## 6）仍需拍板的问题

### 6.1 官方首发 onboarding 路径到底是 CLI 路线还是 manual-install 路线？

这是当前最关键的范围决策。

### 6.2 v0 的 public package 子集到底是什么？

release scripts 看到的是一个很大的内部 package 图，但 v0 没必要一次性把所有内部 package 都变成同等成熟的 public promise。

### 6.3 哪些 prototype 被明确标成“首发官方支持”？

它应该是一套被命名的集合，而不是靠外界自行推断。

### 6.4 基础 CI 的最低范围是什么？

建议最低包含：

- type check
- runtime tests
- 如果开销可接受，再加 docs build
