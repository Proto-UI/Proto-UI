---
title: '第六章：一致性的边界'
description: '说明一致性为何是 realization context 之间的条件比较，以及不同上下文应采用怎样的比较强度。'
---

> 当两个 Host artifact 使用不同的结构、事件系统和渲染方式时，我们凭什么说它们仍然实现了同一个 Component，又应要求它们一致到行为、结构还是像素？

## Prototype 是一致性的第一把尺度

还记得第一章的业务案例吗？一个移动端 App 同时使用 Flutter 和 WebView，其中的 Switch 分别由 Flutter 和 React 实现，但产品希望它们的行为和表现保持一致。

如果需求进一步要求“像素级一致”，我们通常还需要补充一些前提：两个实现需要运行在同一台设备上，使用相同的尺寸、单位、字体和渲染条件。缺少这些前提，像素差异可能来自 Component，也可能只是屏幕参数或字体 shaping 不同。

即使视觉结果已经非常接近，组件在具体操作时仍可能出现可感知的细小差异。例如，Host 对点击的合成方式和触屏误触阈值可能不同；对于 Scroll Area，滚动阻尼和 physics 也可能不同。

这些现象看起来都在问同一个问题：翻译器应该怎样处理 Prototype 没有说明的部分？

在讨论翻译器该对一致性负什么责之前，我们可以先确认一下 Prototype 到底承诺了什么。

对 Switch 来说，Prototype 可以规定 Root 拥有 `checked`，activation 怎样触发 State transition，变化又怎样通过 Feedback、Context 和 Expose 到达各个参与者。这些义务不能因为落到 React、Flutter 或 Qt 就改变；Host tree 使用什么对象、outward signal 表现成 callback 还是平台事件则可以不同。

Prototype 是判断一致性的第一把尺度：它先决定为了仍然成为同一个 Component，哪些语义必须保留。

## Prototype 没有说明意味着什么？

Proto UI 希望 Prototype 尽可能完整地描述一个 Component 的交互语义。但“尽可能完整”并不等于把所有物理细节都写进去。

当某件事没有被 Prototype 说明时，至少需要区分三种情况：

- **本来应该说明，却遗漏了。** 这意味着该 Prototype 还不完整，需要根据真实使用或翻译证据继续修正补全。
- **Prototype 有意不治理。** 这项差异不影响当前 Component 的身份，或者缺乏跨 Host 的意义，可以交给 Host、Adapter 或更具体的 profile 处理。
- **Proto UI 想说明，却暂时表达不了。** 这暴露的是理论模型、Core 或 Prototype 语法的能力缺口，而不只是某一份 Prototype 少写了一项配置。

翻译器不能仅凭实现方便自行分类。它可以报告能力不足或结果不明，但 Prototype 是否遗漏、是否有意留白，以及是否需要扩展原型体系，仍需明确仲裁。

还有一些要求来自 Prototype 之外。比如某个产品明确要求 Flutter 与 React 的 Switch 像素级一致，或者某套 design system 要求所有官方 Adapter 使用相同的尺寸和 motion。它们可以在通用 Prototype 的基线上继续收紧约束，却不必因此把所有产品级细节都写进 Switch 的公共身份。

反过来，如果 Prototype 把某一种 Host 的输入模型、渲染参数和控件习惯全部写成必要义务，它就可能过拟合；其他 Host 无法自然承接这些细节时，可移植性反而会下降。

所以，Prototype 不是说得越多越好。更准确的目标是：

> 对自己拥有的交互语义足够严格，对缺乏跨 Host 意义的实现细节保持克制。

## Prototype 关心哪些细节？

上面的那种克制，并不意味着 Proto UI 只追求“功能大概一样”。从前几章介绍过的语义中，可以看到 Prototype 怎样在不同问题上划定自己的责任。

- **Lifecycle** 关心语义成立的相对秩序。`setup`、持续 `runtime` 和最终 disposal 不能任意颠倒，但不同 Host 不必用相同的物理时间完成它们。
- **Event** 可以表达 activation intent，也可以表达 `pointer.down` 等媒介输入；click synthesis、touch slop 等默认可能由 Host 识别，除非 Prototype 或可移植 recognizer 明确接管。
- **Feedback** 关心 User 必须感知什么、不同状态怎样被辨认；具体单位映射、字体 rasterization 或 native chrome 是否受约束，则取决于 Prototype 与适用 profile 的实际声明。

State transition、information channel 的方向和 Component identity 同样属于不可随意改变的基础。Feedback 也不是被排除在“语义”之外的装饰：如果一个 Switch 的 on/off 无法被 User 区分，就不能因为它仍能接受点击而宣称一致。

Prototype 对物理细节保持克制，不同 Host 的产物仍可能非常接近。React、Vue 和 Web Component 共享 Web 基础，官方 Adapter 也可能采用共同的 projection policy。只是这种接近可能来自 Prototype、Adapter/profile 约束，也可能只是当前实现恰好相同；只有明确治理的部分才是稳定要求。

## 共同条件越多，比较越细

Prototype 决定了不可失去的语义底线，但它还不能独自回答两个 Host artifact 应该相似到什么程度。这个问题取决于我们正在比较的两个 realization context。

realization context 至少要说明 Prototype revision 与输入、交互媒介、Adapter/Host capability profile、projection policy、渲染参数，以及允许的 tolerance 和 exclusion。屏幕、viewport、单位、字体等都属于其中需要明确的条件。它不是使用 Component 时要填写的表格，而是让“一致”拥有明确的比较对象。

假设 React 和 Flutter 都声称支持这份 Prototype，却运行在不同设备、使用不同字体和交互媒介，我们首先能够严格比较的是 Prototype identity、information channel、State transition、Lifecycle order 和已经声明的媒介分支。

如果两边都使用键鼠，并且运行在相同的 viewport、单位和字体条件下，输入行为和 Feedback 就可以接受更细的比较。再进一步，如果 React 与 Vue 同属于 Web family，并且适用 profile 明确共享受治理的浏览器结构、事件、样式基础与 projection policy，那么排除 Adapter 必要且已说明的 wrapper 或标记后，它们的 normalized DOM projection 也应该高度接近。

当 device metrics、单位比例、字体 shaping、色彩和 rasterization 都受到控制时，像素比较才可能成为最高强度要求；无法解释的偏差不能只用“框架不同”带过。

跨交互媒介时则要更谨慎。Select 在桌面上使用 dropdown、在触屏设备上使用 picker，是否仍属于同一个 Select Prototype 的等价形式，应由 Prototype 对媒介分支作出声明。Adapter 可以实现这种选择，却不能因为平台习惯或实现方便自行替换交互形式。

比较条件不能成为事后的免责条款。tolerance 和 exclusion 必须预先拥有理由和范围：字体渲染差异可以解释边缘像素，却不能解释 Switch Thumb 移动方向相反；Host wrapper 可以影响物理 DOM，却不能改变 Root 与 Thumb 的逻辑关系。

因此，一致性拥有两层边界：

1. Prototype 及其适用 profile 决定什么必须保持不变；
2. 两个 realization context 共享且受控的条件，决定我们还能够把行为、结构与表现比较到多细。

这既不要求所有平台无条件一模一样，也不允许把“语义一致”降成“功能大致可用”。两个实现之所以仍是同一个 Component，是因为它们保留了同一 Prototype 的身份和必要义务；共享条件越多，剩余差异越需要被解释。

这里描述的是比较原则，不代表当前所有 Adapter 或 Host 都已经具备相应的 comparison profile 与证据。当前可靠证据仍然主要来自 Web family，comparison profile、normalized DOM 与 image evidence 也尚未形成完整的治理身份；未 catalog 或未经验证的目标不能自动继承一致性结论。

到这里，白皮书的第二部分“翻译”就结束了。下一章是白皮书的第三部分“演化”，我们将会找到一条能够在实践中不断推动原型与翻译层发展的演化路线，也会讨论那些 Proto UI 没有选择，但仍颇具魅力的路线。
