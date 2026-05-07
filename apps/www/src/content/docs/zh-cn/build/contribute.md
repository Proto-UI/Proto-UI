---
title: '如何参与贡献'
description: 'Proto UI 当前阶段的贡献入口、主要路径与实践建议'
---

## 从这开始

如果你刚接触 Proto UI，最简单的第一步是浏览 [Good First Issue](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22)——每个 issue 都有明确的范围和验收标准。开始前先在 issue 下留言说明。如果对范围或方案不确定，到 [GitHub Discussions](https://github.com/Proto-UI/Proto-UI/discussions) 提问。

## 选择你的路径

### Prototype（原型）

这条路径关注的是**组件应该如何交互**——状态流转、事件进入、反馈表达和交互语义。

**适合：** 组件库开发者、设计系统工程师、Headless 组件作者、无障碍优化者

**常见任务：**

- 为已有原型补足某个明确的交互能力
- 新增一个边界清晰的基础原型
- 改进已有原型的状态 / 反馈表达

**从这里开始：**

- [原型提案 Issue 模板](https://github.com/Proto-UI/Proto-UI/issues/new?template=prototype-proposal.md)
- [Good First Issue：prototype](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22+label%3Aprototype)
- [编写一个定制的单体原型](/zh-cn/build/prototypes/writing-a-custom-primitive-prototype/)
- [原型作者检查清单](/zh-cn/build/prototypes/checklist/)

**提交 PR 前：** 说明交互行为、必要时解释原型边界、尽量附带预览或测试。

---

### Adapter（适配器）

这条路径关注的是**原型如何进入具体宿主**——契约映射、能力补全和宿主原生体验。

**适合：** 框架维护者、平台工程师、熟悉 React / Vue / Web Components / Flutter / Qt / 平台原生 UI 技术的开发者

**常见任务：**

- 为已有宿主补齐某类原型契约的承接能力
- 改进已有原型在宿主侧的还原度
- 为新宿主建立最小可工作的适配器

**从这里开始：**

- [适配器提案 Issue 模板](https://github.com/Proto-UI/Proto-UI/issues/new?template=adapter-proposal.md)
- [Good First Issue：adapter](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22+label%3Aadapter)
- [Adapter 指南](/zh-cn/build/adapter-guide/)（施工中）

**提交 PR 前：** 确认宿主能力映射、如有回退策略需说明、跨宿主场景测试。

---

### Contracts / Tests（契约与测试）

这条路径关注的是**什么才算"真的支持了这个能力"**——验证原型被清楚定义、适配器真正承接了契约。

**适合：** 关注语义边界、行为验证和契约一致性的工程师

**常见任务：**

- 为已有能力补契约测试
- 为已文档化的语义补最小验证
- 找出现有原型 / 适配器中"不一致但还没被约束"的位置

**从这里开始：**

- [契约与测试](/zh-cn/build/contracts-and-tests/)（施工中）
- [Good First Issue：automation](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22+label%3Aautomation)

**提交 PR 前：** 说明契约验证了什么、为什么边界画在这里、确保测试在改动前会失败。

---

### Docs / Demo（文档与示例）

这条路径关注的是**别人能不能看懂 Proto UI**——降低新用户和新贡献者的进入门槛。

**适合：** 技术写作者、教育者、能把抽象概念转化为清晰文档 / 示例 / 图示 / Demo 的人

**常见任务：**

- 修订已有文档，让入口更顺
- 为某个原型补最小示例
- 把抽象概念转成更容易理解的 Demo

**从这里开始：**

- [文档需求 Issue 模板](https://github.com/Proto-UI/Proto-UI/issues/new?template=docs-request.md)
- [Good First Issue：docs](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22+label%3Adocs)

**提交 PR 前：** 说明改动解决了什么理解障碍或空白、确认页面在文档站点正确渲染。

---

### Community / Curation（社区与整理）

这条路径关注的是**把生态中的问题、讨论和共识接住**——让生态保持可导航、新人得到持续回应。

**适合：** 社区组织者、善于归纳讨论 / 维护索引 / 帮别人把想法说清楚的人

**常见任务：**

- 整理重复出现的问题
- 维护 FAQ 或讨论索引
- 把零散讨论沉淀成可引用的结论
- 协助新贡献者找到入口

**从这里开始：**

- [Good First Issue：community](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22+label%3Acommunity)
- [GitHub Discussions](https://github.com/Proto-UI/Proto-UI/discussions)

**提交 PR 前：** 归纳你捕捉到的模式或共识、附上源讨论链接。

---

## 新贡献者工作流

1. 认领一个边界清晰的 [Good First Issue](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22)
2. 开始前先在 issue 下留言
3. 不确定边界时，在 issue 或 [Discussions](https://github.com/Proto-UI/Proto-UI/discussions) 里确认
4. PR 尽量小——最小可讨论结果，而非一次性提交巨大改动
5. 在 PR 描述里说明改了什么、为什么

对于 Prototype 和 Adapter 的改动，最简单的预览方式是接入文档站点。在专门的调试工具成熟之前，这是最直接的反馈回路。

---

## 较大改动先讨论

以下情况建议先讨论再动手：

- 准备新增一个宿主适配器
- 准备扩展原型语法
- 准备修改契约层的既有边界
- 准备引入新的核心能力维度
- 准备做较大范围的重构

这些不是不能做，而是它们会比普通贡献更容易影响主线方向——先讨论远比先写完再解释轻松。

---

## 关于提案接受

提交提案不代表一定会被接受。维护者会根据当前优先级、边界判断和长期生态一致性来评估每个提案。如果你不确定某个想法是否合适，先到 [Discussions](https://github.com/Proto-UI/Proto-UI/discussions) 讨论，再提交正式提案。
