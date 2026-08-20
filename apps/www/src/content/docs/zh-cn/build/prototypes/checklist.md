---
title: '原型作者检查清单'
description: '在提交一个新原型或大改动之前，先过一遍这张清单。'
---

这不是一张形式化模板。  
它的作用是帮你在动手前或提交前，快速判断自己是否已经偏离了 Proto UI 当前更看重的方向。

## 一、我走的是哪条贡献路径？

- 我是在维护已有 P、投射已有 Base，还是实现已批准的 Base slice？
- Issue 是否写明已经决定、可以决定和不得改变的内容？
- Issue 是否允许开始实现，还是仍带有 `needs maintainer design`？
- 如果是新 Base subject，maintainer checkpoint 是否已经记录？

## 二、我是否从适用 Spec 实体开始？

- 我找到了适用的 `P-*` 和 `T-*` 实体吗？
- 我读过 lifecycle、criteria、relations、sources、revisions 和 mapped tests 吗？
- 我有没有把 legacy contract、旧 record 或当前实现误当成高于 P 实体的真相源？
- 如果来源冲突，我是否明确记录了 drift？

## 三、我真的需要新的原型吗？

- 我面对的是新的交互主体，而不只是新的风格吗？
- 现有原型和现有 `asHook` 真的都不够吗？
- 我做的不是把已有能力重新拼一遍吗？

如果这里有明显的“否”，先回到 [为什么你通常不需要新写一个原型？](/zh-cn/build/prototypes/when-not-to-write-a-new-prototype/)。

## 四、边界是否切对了？

- 这个对象是否真的构成独立的交互主体？
- 我有没有把本该拆开的 part 继续塞在同一个原型里？
- 我有没有把没有独立信息通路责任的局部结构硬拆成新原型？

如果这里不确定，回到 [原型边界](/zh-cn/whitepaper/prototype-boundary/)。

## 五、我写的是交互语义，还是宿主实现？

- 我有没有把宿主私有行为写死在 prototype 里？
- 我有没有过早依赖某个框架特有的组织方式？
- 我是不是把某种 adapter 层的补全责任误写回原型了？

## 六、如果这是复合原型，family 是否清楚？

- anatomy family 的 role 是否明确？
- cardinality 和 relation 是否合理？
- root、part、shared 的职责是否分开了？
- context 里放的是共享语义，而不是一堆杂项吗？

## 七、如果这是风格化投射，它是否忠实继承 Base？

- 我是在叠加 `variant`、`size`、style token、rule 吗？
- 我是不是重新定义了本应复用的基础交互？
- 我有没有优先从现有 `base` 原型或 `asHook` 长出来？
- derived P 是否只写 delta criteria，并通过 `inherits.prototypes` 连接 Base？
- negative patch 是否在 P 实体中明确声明？
- unsupported upstream API 和 compatibility boundary 是否明确？
- 如果对象没有 Base 协议，是否应成为 styled-only，而不是制造空 Base identity？

## 八、Authoring entries 是否与编目协议一致？

- 适用 P 实体要求 direct Prototype、authored asHook，还是两者都存在？
- direct 与 authored-asHook entries 表达同一协议时，是否共享实现并记录在同一个 P 实体？
- 我是否避免了仅为 API 对称增加 asHook？
- 我是否避免了让一个 protocol-specific authored asHook 成为另一个 Base protocol 的行为 substrate？
- configurable authored asHook 是否有明确治理契约？

## 九、官网 Demo 是否代表真实安装体验？

- 新增公开 Prototype identity 或 anatomy family 是否已有接入官网入口的可访问页面？
- PR 是否提供了维护者可直接打开的本地预览路由？
- Demo 是否消费真实 public package export，并覆盖适用的 Web Component、React、Vue 预览？
- 自治 Prototype 是否通过自己的 anatomy、trigger、state、event 和 default behavior 工作？
- 是否避免了仅为 Demo 成立而增加的页面 state、无关 Button callback、私有 CSS 或脚本？
- 如果原型没有自然 trigger，或必须演示公开 controls，外部 orchestration 是否保持最小并只使用 public API？
- 例外逻辑是否在 Demo source 与 PR 中说明不会随 package 安装，以及消费者需要自行实现什么？
- 内部 Demo Matrix 是否只被当作补充证据，而不是官网页面的替代品？

## 十、验证是否形成闭环？

- 每个新的或变化的 P criterion 是否有 substantive `T-*` case？
- T case 是否锚定具体 criterion，并映射真实 executable path？
- focused test 是否验证正向结果与必要的 absence assertion？
- package export、CLI、官网页面、Demo 和三 Adapter preview 是否形成完整交付面？
- 生成文件是否通过 generator 更新？
- PR 是否记录了实际运行的命令与手动验证？

普通文档或 Demo 改动不需要制造新的 P/T。只要改变规范语义或可观察保证，就必须在同一 coherent change 中更新适用实体、证据和受影响的投影。
