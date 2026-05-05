---
title: '如何参与贡献'
description: 'Proto UI 当前阶段的贡献入口、主要路径与实践建议'
---

## 这篇文章是做什么的？

这一页面向的是想要参与 Proto UI 生态建设的人。

它不会替代仓库里的开发说明，也不会展开白皮书中的理论细节。  
它主要回答的是更直接的问题：

- 现阶段 Proto UI 最需要哪些类型的贡献？
- 我适合从哪一类事情开始？
- 贡献之前需要先了解什么？
- 现在最简单的预览方式是什么？
- 怎样的贡献更容易被接住、被继续维护？

如果你还不确定自己适不适合参与，先读完这一页通常就够了。

---

## 现阶段最需要的贡献是什么？

Proto UI 还处在早期阶段。  
现在最重要的不是“什么都同时推进”，而是先把最核心的几条路径打通。

当前最有价值的贡献通常集中在这些方向：

- **Prototype（原型）**
  - 扩充官方原型库
  - 补足常见组件的交互能力
  - 提高原型表达的保真度与可复用性

- **Adapter（适配器）**
  - 为新宿主建立接入能力
  - 改善已有宿主对原型契约的承接程度
  - 提高不同宿主之间的一致性与还原度

- **Contracts / Tests（契约与测试）**
  - 为现有能力补齐契约约束
  - 提高原型与适配器的可验证性
  - 为“官方支持质量”建立更稳的基础

- **Docs / Demo（文档与示例）**
  - 帮助别人更快理解 Proto UI
  - 降低新贡献者的进入门槛
  - 把已有能力展示得更清楚

- **Community / Curation（社区与整理）**
  - 整理问题与讨论
  - 沉淀共识与索引
  - 协助新贡献者找到入口

对大多数第一次参与的人来说，**原型、文档、测试** 通常是更容易进入的方向。  
**适配器** 会更偏向深水区，但也非常重要。

---

## 贡献之前，建议先看什么？

不需要把整套白皮书背下来，但最好先建立一个最小理解模型。

建议至少先读这些内容：

- [Start Here / 你刚刚看到的是什么？](/zh-cn/start-here/what-you-saw/)
- [Start Here / 它是怎么工作的？](/zh-cn/start-here/how-it-works/)
- [Start Here / Why Proto UI](/zh-cn/start-here/why-proto-ui/)

- [Whitepaper / 组件作为协议](/zh-cn/whitepaper/component-as-protocol/)
- [Whitepaper / 信息通路模型](/zh-cn/whitepaper/information-flow-model/)
- [Whitepaper / 原型边界](/zh-cn/whitepaper/prototype-boundary/)
- [Whitepaper / 执行语义](/zh-cn/whitepaper/execution-semantics/)

对于想写适配器的人，再继续读：

- [Whitepaper / 翻译层：Adapter / Compiler](/zh-cn/whitepaper/translation-layer/)
- [Whitepaper / 设计约束](/zh-cn/whitepaper/design-constraints/)

这并不是为了提高门槛，  
而是为了避免在动手之后，才发现自己写的东西和 Proto UI 的边界判断完全不在同一层上。

---

## 你可以从哪些路径参与？

Proto UI 的生态并不是单一路径。  
不同类型的贡献，解决的是不同层面的问题。

### Prototype（原型）

这条路径主要关注的是：

> **一个组件应该如何交互。**

Prototype 方向更关心组件本身的交互语义，例如：

- 状态如何流转
- 事件如何进入
- 反馈如何表达
- 原型边界应当如何切分
- 哪些能力值得进入官方原型库

如果你平时更接近这些工作：

- 组件库开发
- 设计系统
- Headless 组件
- 交互设计落地
- 无障碍体验优化

那 Prototype 往往会是更自然的入口。

比较适合作为起点的事情包括：

- 为已有原型补足某个明确的交互能力
- 新增一个边界清晰的基础原型
- 帮已有原型补齐更合理的状态 / 反馈表达
- 让某个原型在更多场景下保持更高保真

**相关模板与入口：**

- [原型提案 Issue 模板](https://github.com/Proto-UI/Proto-UI/issues/new?template=prototype-proposal.md)
- [Good First Issue：prototype](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22+label%3Aprototype)
- [编写一个定制的单体原型](/zh-cn/build/prototypes/writing-a-custom-primitive-prototype/)
- [原型作者检查清单](/zh-cn/build/prototypes/checklist/)

---

### Adapter（适配器）

这条路径主要关注的是：

> **原型如何进入具体宿主。**

Adapter 方向需要处理的问题通常包括：

- 原型契约如何映射到某个宿主
- 宿主缺失的能力如何补全
- 哪些反馈和交互可以直接承接
- 哪些地方需要宿主化处理
- 最终产物如何更符合该宿主的使用习惯

如果你对某个宿主更熟，例如：

- React
- Vue
- Web Components
- Flutter
- Qt
- 平台原生 UI 技术

并且你平时更常处理：

- 框架底层能力
- 渲染模型
- 事件系统
- 状态与引用组织
- 平台约束与性能问题

那么 Adapter 很可能更适合你。

比较适合作为起点的事情包括：

- 为已有宿主补齐某类原型契约的承接能力
- 为一个已有原型改进宿主侧还原度
- 为新宿主建立最小可工作的适配器
- 补足某类宿主缺失能力的承接方案

**相关模板与入口：**

- [适配器提案 Issue 模板](https://github.com/Proto-UI/Proto-UI/issues/new?template=adapter-proposal.md)
- [Good First Issue：adapter](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22+label%3Aadapter)
- [Adapter 指南](/zh-cn/build/adapter-guide/)（施工中）

Adapter 会比 Prototype 更偏深水区，  
但它也非常关键，因为 Proto UI 最终能否进入真实项目，取决于翻译层是否可靠。

---

### Contracts / Tests（契约与测试）

这条路径主要关注的是：

> **什么才算“真的支持了这个能力”。**

在 Proto UI 里，契约与测试并不只是补充质量保障。  
它们直接关系到：

- 一个原型是否已经被清楚定义
- 一个适配器是否真的承接了原型契约
- 所谓“官方支持质量”是否有明确边界
- 社区实现和官方实现之间如何形成可验证关系

如果你更关心：

- 语义边界是否清晰
- 行为是否被稳定验证
- 契约与实现是否一致
- 一个能力是否真的“成立”而不是“看起来差不多”

那么这条路径会很适合你。

比较适合作为起点的事情包括：

- 给已有能力补契约测试
- 为文档里已经明确的语义补最小验证
- 帮现有原型 / 适配器找出“不一致但还没被约束”的位置
- 把已有共识整理成可验证的契约

**相关模板与入口：**

- [Good First Issue：automation](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22+label%3Aautomation)
- [Good First Issue：prototype](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22+label%3Aprototype)（部分涉及测试的 prototype issue）
- [契约与测试](/zh-cn/build/contracts-and-tests/)（施工中）

---

### Docs / Demo（文档与示例）

这条路径主要关注的是：

> **别人能不能看懂 Proto UI。**

Proto UI 目前的理论密度不低，  
而文档、示例和 Demo 会直接影响：

- 新使用者是否能快速理解
- 新贡献者是否知道从哪开始
- 原型和适配器是否能被更清楚地展示
- 讨论是否能基于同一组最小共识展开

如果你更擅长：

- 写清楚一件复杂的事
- 把理论转成更容易读的文档
- 把抽象概念变成例子、图示或 Demo
- 识别“别人会在哪一步看不懂”

那么 Docs / Demo 是很好的入口。

比较适合作为起点的事情包括：

- 修订已有文档，让入口更顺
- 为某个原型补最小示例
- 把某个抽象概念转成更容易理解的 Demo
- 补充 FAQ、导读、贡献入口等生态文档

**相关模板与入口：**

- [文档需求 Issue 模板](https://github.com/Proto-UI/Proto-UI/issues/new?template=docs-request.md)
- [Good First Issue：docs](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22+label%3Adocs)

---

### Community / Curation（社区与整理）

这条路径主要关注的是：

> **把生态中的问题、反馈和共识接住。**

Proto UI 的成长不只来自代码。  
它也来自：

- 问题有没有被整理出来
- 重复讨论有没有被沉淀
- 社区原型 / 社区适配器有没有被更清楚地看见
- 新人提出的问题有没有得到稳定回应

如果你更擅长：

- 归纳问题
- 整理讨论
- 维护 issue / discussions
- 帮别人把想法说清楚
- 连接不同方向的参与者

那么这条路径会非常适合你。

比较适合作为起点的事情包括：

- 整理重复出现的问题
- 帮忙维护 FAQ 或讨论索引
- 把一些零散讨论沉淀成可引用的结论
- 协助新贡献者找到适合自己的入口

**相关入口：**

- [Good First Issue：community](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22+label%3Acommunity)
- [GitHub Discussions](https://github.com/Proto-UI/Proto-UI/discussions)

---

## 如果我还不知道自己适合哪条路径怎么办？

一个简单的方法是看你更自然会问哪类问题。

如果你更常问：

- “这个组件应该怎样交互？”
  - 更接近 Prototype

- “这个宿主怎么把它实现出来？”
  - 更接近 Adapter

- “这个行为有没有被清楚定义和验证？”
  - 更接近 Contracts / Tests

- “别人能不能看懂这件事？”
  - 更接近 Docs / Demo

- “这些讨论有没有被整理好？”
  - 更接近 Community / Curation

如果还是拿不准，最稳的方式通常是：

> 先从文档、小原型、或一个清晰的小测试开始。

这些入口的风险最低，也最容易得到反馈。

---

## 现阶段推荐的参与顺序

对于第一次参与的人，最稳的方式通常不是上来就写一整套东西，而是：

1. **先认领一个清晰的小范围问题**
2. **先在 Discussions 或社群里确认边界**
3. **再开始真正动手**
4. **优先提交最小可讨论结果，而不是一次性提交巨大改动**

Proto UI 目前的理论与工程都还在逐步收敛。  
越早对齐边界，后面的返工就越少。

### 从 Good First Issue 开始

我们维护了一批专门为新贡献者准备的 [Good First Issue](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22)，每个 issue 都包含了明确的目标、范围、验收标准和参考资料。

这些 issue 按分类标记，方便你快速找到感兴趣的方向：

- [prototype](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22+label%3Aprototype) — 原型相关
- [adapter](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22+label%3Aadapter) — 适配器相关
- [docs](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22+label%3Adocs) — 文档相关
- [community](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22+label%3Acommunity) — 社区相关
- [automation](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22+label%3Aautomation) — 自动化 / 测试相关

找到感兴趣的 issue 后，在 issue 下留言说明你想接手。  
如果对范围或方案不确定，直接在 issue 里提问 —— 在写代码之前先对齐边界，能省下大量时间。

此外，如果你想提出新想法，也可以通过 Issue 模板提交：

- [原型提案](https://github.com/Proto-UI/Proto-UI/issues/new?template=prototype-proposal.md)
- [适配器提案](https://github.com/Proto-UI/Proto-UI/issues/new?template=adapter-proposal.md)
- [文档需求](https://github.com/Proto-UI/Proto-UI/issues/new?template=docs-request.md)

需要说明的是：提交提案不代表一定会被接受。  
Proto UI 目前仍处于早期收敛阶段，维护者会根据当前优先级、边界判断和生态一致性来评估每个提案。  
建议在提交正式提案之前，先在 [Discussions](https://github.com/Proto-UI/Proto-UI/discussions) 或社群里讨论方向。

---

## 现阶段最简单的预览方式

由于目前 Adapter 和 Prototype 的开发还没有额外的调试工具辅助，  
最直接的预览方式通常是：

> **把它们接入官网，然后直接在官网里预览。**

这也是当前阶段最推荐的做法。  
原因很简单：

- 官网已经是 Proto UI 的主要展示与验证入口
- 它天然适合对比不同宿主下的表现
- 新增的 Prototype / Adapter 可以在更接近真实展示环境的地方被观察和讨论

Proto UI 会提供把新 Adapter 和新 Prototype 接入官网的方式。  
因此，现阶段很多贡献的最短反馈回路会是：

1. 写出最小可工作的 Prototype / Adapter
2. 接入官网
3. 直接在官网中预览与调整
4. 再继续补文档、契约或测试

在专门的调试工具成熟之前，这会是最现实的一条路径。

---

## 怎样的贡献更容易被接住？

Proto UI 目前更容易接住的，通常是这些类型的贡献：

### 1. 边界清晰

最容易被继续维护的贡献，通常不是“做了很多”，  
而是“解决了一个边界明确的问题”。

例如：

- 为一个已有原型补足某个明确的交互能力
- 为一个已有宿主补上某一类契约承接
- 为某个文档补齐明显缺失的入口说明

相比之下，“顺手一起重构很多层”的提交，在现阶段更难 review，也更难稳定合入。

### 2. 能在官网预览

现阶段最有价值的贡献之一，是能快速进入官网进行预览和讨论。

对 Prototype 和 Adapter 来说，  
能不能尽快接入官网，通常会直接影响大家能否理解这份贡献到底解决了什么问题。

### 3. 有最小文档说明

即使只是很小的一项贡献，  
也建议至少说明：

- 它解决的是什么问题
- 它落在哪一层（原型 / 适配器 / 契约 / 文档）
- 为什么这样做符合当前 Proto UI 的边界判断

这会极大降低沟通成本。

### 4. 愿意接受继续修正

Proto UI 现阶段不是一个“规则已经完全冻结”的系统。  
很多贡献即使方向正确，也仍然可能需要继续调整。

这不是否定贡献本身，  
而是因为生态、边界和工程约束仍然在收敛中。

---

## 哪些事情更适合先讨论，再动手？

下面这些情况，通常更适合先讨论：

- 你准备新增一个宿主适配器
- 你准备扩展原型语法
- 你准备修改契约层的既有边界
- 你准备引入新的核心能力维度
- 你准备做较大范围的重构

这些事情不是不能做，  
而是它们会比普通贡献更容易影响主线判断。  
先讨论，会比先写完再解释轻松得多。

---

## 社区贡献和官方维护是什么关系？

Proto UI 欢迎社区原型和社区适配器的存在。  
官方并不打算垄断原型或适配器的编写权。

官方更希望做的是：

- 维护一份相对中立、稳定的公共基建
- 为关键宿主尽量提供至少一套官方承接方案
- 为成熟的原型与适配器建立更高的质量保障

这意味着：

- 社区可以走得更激进、更垂直
- 官方会更强调边界、稳定性和长期一致性

两者不是竞争关系，  
更像是生态中不同位置的角色分工。

---

## 从哪里开始？

一个比较稳的起点通常是：

- 先看 [Build / 概览](/zh-cn/build/)
- 再根据自己的兴趣选择：
  - [Runtime 架构](/zh-cn/build/runtime-architecture/)
  - [Adapter 指南](/zh-cn/build/adapter-guide/)
  - [契约与测试](/zh-cn/build/contracts-and-tests/)

如果你还不确定从哪里开始，  
先从一个小问题、一个小原型，或者一段文档修订开始，往往是更好的方式。

浏览已开放的 [Good First Issue](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22)，找到和你兴趣匹配的带 scope 的任务。

---

## 还有别的问题？

这一页只负责说明“如何进入”。  
更具体的流程、规范和仓库协作细节，会放在对应仓库的开发文档里。

如果你对贡献方向、边界判断或当前优先级还有疑问，  
欢迎继续到 [GitHub Discussions](https://github.com/Proto-UI/Proto-UI/discussions) 或社群里交流。  
很多问题只要先对齐方向，后面的推进会轻松很多。
