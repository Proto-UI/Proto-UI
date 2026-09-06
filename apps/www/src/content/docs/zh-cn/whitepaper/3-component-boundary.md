---
title: '第三章：组件的边界'
description: '通过独立参与者关系与 feedback-only 例外，判断 Component 与 Prototype 的边界。'
---

> 视觉树中的 Root、Thumb、Caret、Arrow、Content、Trigger……和普通容器，哪些是独立组件，哪些只是一个组件的附属结构？

## 组件应该怎么拆分？

如果我们问“组件什么时候需要拆分”，大概能得到许多种答案：按照代码量、逻辑复杂度、功能的原子性，或单纯按照团队习惯。毕竟组件拆分一直是个仁者见仁、智者见智的话题。

我们也可以从一些优秀的 Headless 组件库里找找线索。比如说，它们常常把 Switch 拆成 Root 和 Thumb，把 Dialog 拆成 Trigger、Content、Close 等组成部分。这些设计经过了大量使用，在定制组件时也确实很好用。

不过，流行组件库的 part 清单只能证明某种拆分在实践中有价值，不能直接成为普遍规律。不同组件库可能公开不同的 part；一个结构也不会只因为在某个库里叫作 Root、Portal 或 Arrow，就自动成为独立组件。

Proto UI 想再往前一步：这些结构为什么值得被拆出来？如果我们能够找到一个更稳定的判断方式，就可以把它用在更多组件上，而不必每次都照着某个框架或组件库的 API 重新猜一遍。

上一章介绍的信息通路，刚好可以作为判断这个问题的起点。

## 用信息通路判断组件边界

对于一个可能被拆成组件的子结构，我们不先看它有多少行代码，也不先看它在视觉树里占据了多大面积，而是看它是否以自己的身份和外界建立了关系。

在当前仍待实践检验的工作模型中，这个判断可以先归纳成三种情况：

| 子结构启用的信息通路 | 当前判断 |
| --- | --- |
| `Event`、`Props`、`Expose`、`Context` 中任意一条独立成立 | 必须拆成独立 Component |
| 只有 `Feedback` | 可以附属于父 Component，也可以选择拆分 |
| 没有任何可移植信息通路 | 不应当作为独立 Component |

为了避免你需要返回上一章查看每条信息通路的定义，我们可以先把存在信息通路时的判断拆开来看：

- User 的操作是否以它为独立的 `Event` 语义目标？如果是，它已经拥有自己的 `Event`。
- 它能被 Maker 作为一个独立对象配置吗？如果可以，它已经拥有自己的 `Props`。
- 它会向 Maker 暴露自己的信号、状态、常量或方法吗？如果会，它已经拥有自己的 `Expose`。
- 它会和其他 Component 交换信息吗？比如分发或订阅 `Context`？如果会，它已经参与了独立的 `Context` 关系。
- 特别地，它有独属于自己的、向 User 展示的效果吗？如果有，说明它有自己的 `Feedback`；但如果它仅有 `Feedback`，没有上述其他关系，则不必然拆成独立组件。

除 `Feedback` 外的四类关系中，只要有一类独立成立，就说明这个子结构不再只是父组件内部的一层实现。User、Maker 或其他 Component 已经能够以它为对象进行交互，它开始拥有自己的责任边界。

这里的“独立”很重要。

例如，父组件接受一个 `color` 参数，然后把内部某个节点画成指定颜色，并不意味着这个节点拥有自己的 `Props`。Maker 配置的仍然是父 Component，内部节点只是父 Component 完成 `Feedback` 的方式。

只有当 Maker 能够把这个子结构本身作为对象进行配置、替换或观察时，它与 Maker 的关系才真正独立出来。

如果以上条件都不满足，这类子结构则不应该被拆成独立 Component。它无法被 User 感知或影响，无法被 Maker 配置或观察，也不和其他 Component 协作——换句话说，它没有和任何交互参与者建立可移植的关系。

它可能仍然是某个具体技术实现中不可缺少的容器或辅助节点，但“实现需要它”并不等于“它是一个组件”。

## 为什么 feedback-only 可拆可不拆？

`Feedback` 也是当前工作模型中的一条信息通路。所以如果只追求形式上的整齐，只要一个子结构产生了独立的视觉、听觉或其他可感知效果，它就应该被拆成独立的 Component。

只是，如果真的那么做，组件很快就会变得非常零碎：

- 这个子结构启用了 flex 布局，拆！
- 这个子结构设置了背景颜色，拆！
- 这个子结构设置了字号，拆！

按照这个节奏，即使只是实现一个 Switch，也可能拆出许多只承担一点样式或布局的组成部分。它们在形式上确实更细了，但对于人类作者来说，整份定义反而更难阅读和维护。

因此，Proto UI 对 feedback-only 结构做了一个明确的工程妥协：如果一个子结构只帮助父 Component 向 User 呈现信息，它可以继续附属于父 Component，不强制拆分。

相应地，这个例外也有明确的边界。附属结构可以设置 `Feedback`，但不能偷偷拥有自己的 `Event`、`Props`、`Expose` 或 `Context`。一旦其中任意一种独立关系出现，它就不再符合 feedback-only 这项要求，从而应该从父 Component 中拆分出来。

## 运用上述规则

### Switch 开关

Switch 通常可以被拆分成 Root 和 Thumb 两个部分。

Root 是整个 Switch 的 semantic owner 和 value owner。它负责接受 Maker 的配置，划定 User 可以操作的区域，持有 on/off value，向外暴露必要的状态和变化信号，同时向同一 Switch domain 中的其他部分提供 `Context`。

Thumb 则是一个视觉指示器。它不拥有 Switch 的 value，不负责 activation，也不应该成为另一个可以独立聚焦的开关控件。不过在当前的 Switch 设计中，Thumb 会订阅 Root 提供的 `Context`，从中获得 `checked` 和 `disabled` 等信息，再据此呈现自己的状态。

```text
User        --Event-----------------------> Switch Root
App Maker   --Props-----------------------> Switch Root
Switch Root --Expose----------------------> App Maker
Switch Root --Context { checked, disabled }--> Switch Thumb
Switch Root / Switch Thumb --Feedback-----> User
```

所以，Thumb 虽然以 `Feedback` 为主要工作，却并不是 feedback-only。它已经通过 `Context` 与另一个 Component 建立了协作关系，需要拥有独立的组件边界。

把 Thumb 拆出来，并不表示 Switch 中存在两个开关。Root 仍然是唯一的 semantic owner 和 value owner，Thumb 只是依赖 Root 的 indicator。两个 Component 可以共同组成一个完整的 Switch，但承担不同的责任。

<details>
<summary><strong>拓展：Switch 能不能只有一个独立 Component？</strong></summary>

可以。在一种追求极简拆分的设计中，Switch 可以只有 Root 一个独立 Component。Thumb 只是 Root 内部的 feedback-only 结构：它不订阅 `Context`，也没有自己的配置或暴露能力，而是由 Root 直接改变内部布局，例如通过 `padding` 把它“挤来挤去”。

这种设计并不违反前面的规则。如果组件没有二次开发或独立定制 Thumb 的需要，就没有必要为了尚未出现的关系提前拆分。

但需要注意，父 Component 提供一个“修改内部 Thumb 颜色”的参数，仍然不一定表示 Thumb 拥有自己的 `Props`。只有当 Maker 可以把 Thumb 作为独立对象配置、替换或观察，或者 Thumb 自己参与 `Context` 等关系时，它才真正越过附属结构的边界。

不过，这种极简设计在可扩展性上存在张力。如果后续出现大量 Thumb 定制需求，越来越多参数就需要经由 Root 转交给内部 Thumb。此时我们需要重新判断：是否应当把 Thumb 识别为可由 Maker 直接配置的独立 part。

当前 Proto UI 的 Switch Thumb 设计就属于后一种情况：它订阅同域 `Context`，并拥有明确的 authoring entry，所以不能作为 feedback-only 示例。

</details>

### Select 下拉框

拆分 Select 比拆分 Switch 复杂一些。

当前 Base Select 的探索中，Root、Trigger、Value、Content 和 Item 都被识别成了不同的 Component。不过这里没必要把它们的全部能力逐项列完，我们只看几个对理解边界判断有帮助的对照。

Trigger 是 User 打开 Select 的操作目标，它会响应点击和键盘操作，也会从 Root 的 `Context` 中获得 `open`、`disabled` 等信息。因此它同时拥有 `Event` 与 `Context`，显然不是普通内部节点。

Value 在视觉上经常位于 Trigger 内部，但它同样会从 Select `Context` 中取得当前选中内容；当前设计里，它还有自己的 `placeholder` 配置与对外 display state。它看起来像一段文本，却已经与 Maker 和其他 Component 建立了独立关系。

Content 和 Item 也是类似的情况：Content 要根据 Root 的状态决定浮层何时出现，负责焦点导航，并在需要关闭时向 Root 提交请求；Item 能被 User 选择，也要把选择意图交还给 Root。它们承担的不是单纯布局，而是各自独立的交互责任。

特别值得看的，是 Trigger 中常见的下拉 Caret：

如果 Caret 是一个固定、不可独立定制的图形，只负责向 User 提示“这里可以展开”，那么它只有 `Feedback`，可以继续附属于 Trigger。

如果 Maker 可以把 Caret 作为独立对象替换、配置或观察，或者它还需要订阅 `Context` 决定自己的状态，那么它就不再是单纯的附属图形，应当被识别为类似 Select Arrow 的独立 Component。

这里的 Caret 只是用于解释边界的设计案例，不是在给当前 Base Select 增加一个正式组成部分。如果类似扩展以后进入设计，仍然需要按照同样的关系逐项判断，而不能因为其他组件库有同名 part 就直接照搬。

## 从 Component 到 Prototype

到这里，我们一直在判断的都是 Component：一个视觉结构什么时候开始以自己的身份与 User、Maker 或其他 Component 建立关系。

一旦这种独立关系成立，Proto UI 就需要把这个交互主体单独记录下来。Proto UI 把这份记录称为 `Prototype`，中文可以称为组件原型，简称原型。

Prototype 是 Proto UI 对一个可移植 Component 身份给出的当前可执行近似。它记录我们希望在不同实现中保持的交互责任与依赖，但不是一份足以自动适配所有技术的万能施工图。具体实现仍然需要翻译层、Host Capability 和目标环境共同完成。

## 骨架、边界，然后是内部规则

白皮书的第一部分“原型”，还剩下一章。

到目前为止，我们先把组件看作交互主体，再用信息通路描述它与外界的关系，接着利用这些关系划定 Component 的边界，最后把 Proto UI 对这些主体给出的可执行近似称为 Prototype。

不过，要让 Prototype 进一步接近可执行，还需要许多不直接构成信息通路、却会影响这些关系如何成立的语义，比如：

- 保存交互状态的 State
- 组织时间秩序的 Lifecycle
- 描述复合 Prototype family 中各 part 角色与结构关系的 Anatomy

下一章我们会集中讨论这些通路之外，但一份接近可执行的 Prototype 仍需要表达的语义。
