---
title: '第二章：从交互关系出发'
description: '从 User、Maker、Other Component 以及关系方向出发，说明 information channel 如何由参与者身份与语义责任共同推导。'
---

> 不从某个框架的 API 列表出发，怎样系统地描述一个组件与外界的关系？

## 未实现的组件该如何描述？

上一章把组件暂时看作一个相对稳定的交互主体。我们已经发现，虽然组件不能真的脱离实现运行，但在我们决定使用 React、Flutter 或其他技术实现组件之前，通常已经能描述它的一部分交互预期了。

如果这样的思路成立，我们自然会想要找到一种方式，把这些预期尽量清楚地记录下来。

这个问题其实可以拆成两部分：

- 用什么语言来记录？逻辑需要语言作为载体
- 按照怎样的方式组织这些要记录的内容？怎样去梳理这些先于实现的逻辑？

第一个问题最终肯定要回答。不过我们现在还没正式引出 Prototype 概念，也没必要一上来就决定一份组件定义最终要长什么样子。所以我们会先悬置这个问题，在第四章末尾，我们会给出较为完整的描述示例。

这一章先讨论第二个问题：如果不按照 React props、Flutter widget 或某个框架的具体模型来分类，我们还能按照什么方式去描述组件？

Proto UI 选择从交互关系出发。

## 组件都在和谁交互？

当我们把 Component 看作交互主体时，它所承载的属性和行为就不再是平白无故出现的：有些是给使用者看的，有些要接受调用者的配置，有些用于把结果报告给上层应用，还有些用于和其他组件协作。

所以关键问题是：Component 都在和谁发生关系？

Proto UI 当前首先区分三类参与者：

- User：实际感知或操作组件的一方，也就是 UI 的用户
- Maker：消费、组装或配置组件的一方。它可以是开发者、设计师、产品经理、上层系统或 AI Agent。在软件制作的语境里，我们还会使用 App Maker 这个词，指利用组件制作应用的一方。
- Other Component：与当前 Component 交换信息、共同完成交互的其他组件。

这些词描述的是一段交互关系里的角色，不是人的职位，也不是固定的身份。同一个人可以先作为 Maker 配置一个组件，再作为 User 使用它；AI Agent 也可以在一些场景里制作 UI，在另一些场景中使用 UI。我们关心的是它此刻怎样与 Component 发生关系。

## 从关系得到信息通路

只列出参与者还不够。

比如说，User 和 Component 之间至少有两个方向：User 可以操作 Component，Component 也可以把状态和结果反馈给 User。App Maker 和 Component 之间同样如此：App Maker 可以配置 Component，Component 也可以向 App Maker 报告变化或能力。

如果去掉方向，前两种关系都会变成含糊的“User 与 Component 交互”，后两种也会变成“App Maker 与 Component 交换信息”。这样的描述不足以告诉我们，谁负责发送信息、谁负责接收信息，这次交换又是为了什么。

因此，Proto UI 按照三个方面来识别一条关系：

1. 谁在和谁交换信息；
2. 信息朝什么方向传递；
3. 这次交换承担什么语义责任。

Proto UI 把这样识别出的关系称为 `information channel`，也就是“信息通路”。

信息通路不是实际存在的数据管道，也不专指事件总线、数据流或某一种 API。它更像是一种组织组件交互关系的方式：不管一项能力在具体框架里表现为参数、回调、对象方法、样式还是别的形式，我们先看它究竟在连接哪些参与者、信息朝哪里传递，以及它在完成什么责任。

在 Proto UI 当前仍待实践检验的工作模型中，这种方式导出了五条核心可移植信息通路：

| 信息通路   | 方向                  | 主要责任                               |
| ---------- | --------------------- | -------------------------------------- |
| `Event`    | User → Component      | 传递用户发起的操作、输入与交互意图     |
| `Feedback` | Component → User      | 让用户感知组件的存在、状态、变化与结果 |
| `Props`    | App Maker → Component | 配置组件                               |
| `Expose`   | Component → App Maker | 对外提供值、状态、方法和变化信号等能力 |
| `Context`  | Component ↔ Component | 让组件之间交换协作信息                 |

可以看到：Event 和 Feedback 连接的都是 User 与 Component，但因方向和责任不同，它们是两条不同的通路；Props 和 Expose 也是同样的关系。

Context 的双向箭头也不是说它“没有方向”，而是说 Component 之间明确允许双向交换信息。在一次具体的 Component 协作中，我们仍需要说明哪个 Component 提供什么，哪个 Component 接收什么。

一个新的 API 需求不会自动变成新的信息通路。只要它仍然是让 App Maker 配置 Component，就可以被 Props 通路吸收；只要它仍然在让 User 感知 Component，就仍然属于 Feedback。新的通路需要对应现有通路无法吸收的、稳定且重要的参与者身份或关系方向，并承担可以独立辨认的语义责任。

<details>
<summary><strong>拓展：Host 和 Component Author 放在哪里？</strong></summary>

Component 当然还会和 **Host/environment** 发生关系。这里的 Host 可以是框架、平台、设备以及最终让组件运行起来的环境。组件可能从 Host 获得布局、输入或平台能力，也可能把请求和结果交给 Host。

这些关系确实存在，而且 Proto UI 的翻译层也离不开 Host Capability。不过它们通常和具体 Host 强耦合，很难直接作为跨 Host 的共同语义。因此，Host 与 Component 的交换目前默认放在核心可移植通路之外。这里排除的是它作为“核心可移植通路”的身份，不是说 Proto UI 不使用或不支持宿主能力。

**Component Author**，也就是直接编写组件定义的人，同样是真实存在的角色。不过它主要和 Prototype definition、authoring API、注释及工具链发生关系。正在运行的 Component 并不会因为作者阅读了它的代码，就多出一条面向作者的信息通路。因此，这一章不把 Component Author 列为运行时 Component 的交互对象。

</details>

## 把 Switch 放进这张关系图

现在再来看看 Switch。我们可以先用一小段关系伪代码，把它放进刚才的分类里：

```text
# 这不是 Proto UI 语法，只是一张关系草图

App Maker   --Props { checked, disabled }--> Switch
User        --Event { activate }-----------> Switch
Switch      --Feedback { on / off }--------> User
Switch      --Expose { checkedChange }-----> App Maker
Switch Root --Context { checked, disabled }-> Switch Thumb
```

每一行只是在声明一条关系，并不表示它们必须按照从上到下的顺序执行。

前四行分别表示：App Maker 配置 Switch，User 尝试操作 Switch，Switch 向 User 呈现当前的状态，以及 Switch 把变化报告给 App Maker。最后一行则表示 Switch Root 与 Switch Thumb 之间的组件协作。Thumb 从它之外的另一个 Component（也就是 Root）读取 `checked` 和 `disabled`，并由此派生自己的展示状态，所以它属于 Context，而不是 App Maker 需要手动去配置这些状态。

这张草图也能说明，宿主 API 的外形不等于通路。在某个框架里（例如 React），配置值和用于承接变化通知的回调入口可能都出现在一个名为 props 的对象中；但配置语义是 App Maker → Component，由回调承接的变化通知则是 Component → App Maker，所以它们仍然属于不同的通路。

Switch 在交互过程中通常还要保存状态。不过 State 本身并不是信息通路：保存一个值，并没有新的参与者向 Component 发送信息或从它接收信息。State 会参与这些关系怎样运转，但其并非信息通路，它有自己的语义责任。这类并非信息通路但仍然必要的概念，我们会在第四章展开讲解。

## 这只是一副骨架

信息通路给了我们一副组织组件外部关系的骨架，但它不需要也不能解释组件的一切。第四章会集中讲解“通路之外的语义”。

当前工作模型中的五条通路也不是预设好的永久上限。如果实践中出现一种无法由现有参与者、方向和责任解释的重要关系，这套模型仍然可以继续修正。

现在，我们已经有了用于梳理交互关系的方法。不过它没直接告诉我们：每一个 Component 应该如何切分？从哪里开始，又从哪里结束？

比如说：Switch 的 Root 和 Thumb 可以通过 `Context` 协作，看起来像两个交互主体；但一层只用于布局、绘制背景或增加装饰的结构，似乎又未必需要成为独立 Component。如果一棵视觉树里有很多节点，我们怎样判断其中存在一个、两个，还是更多组件？

这就是下一章要继续处理的问题，也是信息通路特别擅长处理的一类问题。
