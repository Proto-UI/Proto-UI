> 融合修订稿说明：本稿以作者第五章草稿的“如何避免为每个宿主重造一套跨端框架”为叙事主线，吸收独立对照稿中的 Host artifact、翻译形式、损失边界与证据模型。它用于后续复盘和人工重写，不是 canonical 白皮书正文，也不构成稳定保证。

# II-5 翻译层

> 有了 Prototype，如何将它落地到 React、Flutter、Qt，以及其他我们所熟悉的技术中？

## Prototype 还不是宿主中的组件

截至上一章，我们已经得到了一份接近可执行的 Component 描述。

以 Switch 为例，Prototype 可以说明 Root 接受哪些 Props、保存怎样的 State、响应哪些 Event、向 User 提供什么 Feedback、向 App Maker 暴露什么信息，以及 Root 与 Thumb 如何组成同一个 Anatomy family。它描述了这个交互主体必须履行的义务。

但是 React、Flutter 和 Qt 并不直接认识这些义务。

React 面对的是 component owner、props、commit 与 DOM；Flutter 有 widget、element 和 render object；Qt 则有 widget、property、signal 与自己的事件系统。它们对于结构、状态、输入和生命周期都有各自的表达方式。

Proto UI 把这些具体技术环境称为 Host。把 Prototype 所声明的义务映射到一个 Host 的工作，则由翻译层负责。

```text
Prototype 所声明的义务
          │
          ▼
       翻译层  ◀──── Host 的能力与限制
          │
          ▼
      Host artifact
```

这里的 `Host artifact`，指翻译之后实际存在于目标技术中的产物。它不一定是一份生成出来的代码文件：它可以是运行中的 React component、DOM 与事件绑定，可以是 Custom Element class 及其实例，也可以是平台 widget、controller、样式、注册信息，或者由这些内容共同组成的运行结果。

Prototype 与 Host artifact 并不是同一种东西换了一个名字。前者描述跨技术成立的交互身份与义务，后者则是这些义务在一个具体 Host 中的实现。

## 翻译层的挑战

现在，我们的任务看起来很直接：写一个工具，在语义损耗可控的前提下，把已经明确的 Prototype 映射到不同 Host。

然而，如果每增加一种技术，都要以接近开发 React Native 或 Flutter 的成本重新建设一整套跨端框架，那么 Prototype 的落地性价比就会大打折扣。它可能依然是一套有用的组件分析理论，却很难成为可以持续扩展的工程基础。

因此，翻译层还必须回答另一个问题：怎样把翻译器的开发从一项边界模糊的巨大工程，拆成可以复用、实现和验证的工作？

Proto UI 从两侧控制这件事的复杂度：

- Prototype 一侧尽量保留可分析、可移植的语义，避免把某个 Host 的特殊对象和调度方式写进组件本身；
- 翻译层一侧则把反复出现的语义责任与宿主对接点拆开，使不同翻译器能够复用前者，只实现后者。

这就是 Module 与 Host Capability 发挥作用的地方。

## Module 与 Host Capability

前四章介绍过 Props、Event、Feedback、Context、State 等语义。不同 Host 最终都要让这些语义运行起来，其中的大量逻辑并不需要每个翻译器重新发明。

Proto UI 用 Module 封装可复用的语义实现与责任。例如，Props Module 负责 Props 的声明、默认值与变化处理；State Module 负责 Component instance 内部状态的持有与访问；Event 相关 Module 则负责把输入事件组织成 Prototype 可以处理的形式。

Module 不是前几章概念目录的一一翻版。一个语义领域可能需要多个 Module 协作；有些跨领域的执行秩序由 Runtime 与 Adapter 共同承担，而不是独立的 Module；也有些 Module 只处理 Proto UI 内部的逻辑，完全不需要向 Host 索取能力。

只有当 Module 确实需要接触具体 Host 时，它才会提出 Host Capability。

Host Capability 描述的是翻译层必须从 Host 获得的一项最小事实或动作。它关心“宿主能否完成这件事”，而不是要求所有 Host 提供相同的 API，也不会把 DOM node、Flutter controller 或 Qt object 直接泄漏给 Prototype。

以当前 Context 实现为例，它为了沿逻辑结构寻找信息提供者，需要翻译层回答两个问题：

- 什么 token 能够在当前运行范围内稳定标识一个 Component instance？
- 给定一个 instance token，怎样取得它的逻辑父 Component？

React、Vue 或其他 Host 可以用完全不同的对象和结构回答这两个问题。只要它们提供的事实符合约定，Context 的查找、订阅与更新逻辑就不必在每个翻译器中重写。

反过来，State 保存的是 Proto UI instance 内部的事实，普通 State 并不天然需要 Host 提供另一套状态系统。Lifecycle 也不必为了形式整齐而被包装成一个 Module：它更像 Runtime 与 Adapter 之间关于 instance、view、mount 和 disposal 的执行约定。

因此，翻译器的开发逐渐从“重新实现整个 Proto UI”，变成几个边界更清楚的问题：

1. 这个翻译器准备支持哪些受治理的语义能力？
2. 这些能力需要哪些 Host Capability，目标 Host 将怎样提供它们？
3. Host 的生命周期、输入、结构与公开接口，怎样映射成 Proto UI 的 instance 和最终 artifact？
4. 无法满足的部分在什么边界被拒绝或报告，又用什么证据证明已经满足的部分？

这仍然不是一张“全部打勾就自动正确”的简单清单，但它让翻译器的工作可以被拆分、复用和审查。相近的 Host 还可以进一步共享实现，例如 React 与 Vue 的翻译器可以复用一部分 Web 平台能力，而只分别处理框架自己的组件生命周期与调用惯例。

## 翻译可以发生在不同阶段

翻译层的责任可以用不止一种工程形式完成。

### Adapter

Adapter 在目标 Host 的 runtime 中解释和执行 Prototype。它能够读取本次 Component instance 的真实输入，与 Host 生命周期同步，建立动态事件绑定，并根据当前可用的 Host Capability 完成投影。

这是 Proto UI 当前已经实现并纳入治理的主要翻译路径。现有的 official React、Vue 与 Web Component profiles 都属于 runtime Adapter；它们提供的证据目前主要覆盖 Web family。

### Compiler

Compiler 在程序运行之前分析 Prototype，把已经明确的内容转换为目标代码、结构、样式、注册信息或其他静态 Host artifact。

它是值得探索的未来翻译形式，但目前还不是一项已经完成的 Proto UI 产品保证。静态分析能够提前处理多少，取决于有多少信息在编译时已经确定；只在 runtime 出现的输入、生命周期和动态能力，仍然需要其他机制接手。

### Hybrid

实际工程也可以同时采用两者：让 Compiler 生成静态结构与可预先分析的部分，再由 Runtime 与 Adapter 处理动态 State、Lifecycle、Host binding 与能力协商。

Adapter、Compiler 与 hybrid 回答的是“翻译在什么时候、以什么工程形式发生”。它们并不自动决定翻译质量。Compiler 不会仅仅因为生成了代码就天然更快、更 faithful 或更“原生”；Adapter 也不意味着只能得到低效的间接实现。

## 形式改变不等于语义损失

从 Prototype 到 Host artifact，表示形式几乎必然发生变化，但交互语义不必因此受损。

例如，Component 向 App Maker 发出的同一个 outward signal，在 React 中可以成为 callback，在 Web Component 中可以成为 `CustomEvent`。两边的 API 和 Host artifact 都不同，只要信息方向、触发条件与 payload 义务仍然成立，这次翻译就没有因为“长得不一样”而丢失语义。

不过，Host 之间确实存在不能轻易抹平的差异。翻译结果需要诚实地区分三种情况。

### Faithful

`faithful` 表示在已经声明的 Host、profile 与运行条件下，Prototype 的必需义务都得到了保持。

它不要求内部代码、Host tree 或原生对象完全相同。真正需要相同的是交互身份以及受治理的语义责任。

### Authorized bounded degradation

有些目标媒介无法、也没有必要复制另一种媒介的全部表现。只要 Prototype、Contract 或受治理的 profile 预先说明了可以舍弃什么、在什么条件下舍弃，以及替代后仍然保证什么，这种有明确边界的结果可以称为 `authorized bounded degradation`。

其中重要的是“authorized”和“bounded”：翻译器不能因为实现困难，就自行放宽 Prototype 的要求；被放弃的内容也不能含糊地藏在“兼容性有限”之类的描述里。

### Unsupported

如果 Host 无法保持某项必需义务，又不存在经过授权的替代方案，那么结果就是 `unsupported`。

这不是在批评 Host 或翻译器。明确承认无法支持，往往比生成一个看起来可以运行、实际上已经改变 Component 身份的产物更可靠。

不同义务之间也不能简单取平均分。一个 Switch 即使在视觉上完全还原，如果 activation 无法工作，或者 `checked` 不再由正确的交互主体拥有，它仍然不是 faithful 的 Switch。关键义务的缺失，不能由另一个维度的高保真抵消。

## 以 Terminal UI 为例

假设我们要把一个官方 Prototype 翻译到 Terminal UI。这个翻译器的目标当然不该是复制 GUI 的每一个像素，而应该产生符合 TUI 操作与呈现习惯、并且真正可用的 Component。

但这不意味着 TUI Adapter 可以自行删除任何“不方便实现”的 Feedback。

- 如果 Prototype 本来就为字符界面或非图形媒介声明了等价的呈现方式，并且必需的交互语义仍然成立，那么结果可以是 faithful；
- 如果适用的 Prototype 或受治理 profile 明确允许放弃某一部分视觉表现，并规定了替代形式与剩余保证，那么它属于 authorized bounded degradation；
- 如果某项必需 Feedback、身份或操作义务无法保存，也没有被授权的替代，那么这个 Prototype 对该 TUI profile 就是 unsupported。

因此，评价 TUI 翻译器时不应拿 GUI 像素还原作为唯一尺度；但“符合 TUI 习惯”也不能成为翻译层自行改写 Component 的通行证。目标媒介决定实现可以长什么样，Prototype 与受治理的规则决定怎样的变化仍然算是同一个 Component。

## 四个不要混在一起的问题

讨论翻译器时，有四类判断很容易互相替代。把它们暂时放在一张表里，会更容易看清：

| 问题 | 它回答什么 | 可能的回答 |
| --- | --- | --- |
| translation form | 翻译何时、以什么形式发生？ | Adapter / Compiler / hybrid |
| capability realization | 某项 Host Capability 怎样兑现？ | native / translated / emulated |
| conformance outcome | Prototype 的义务最终是否成立？ | faithful / authorized bounded degradation / unsupported |
| evidence state | 我们凭什么作出上述结论？ | verified / planned / uncataloged / known unsupported |

这不是要求每位读者背诵的术语表，而是四个不能互相回答的问题。

一个 runtime Adapter 可以调用 Host 原生的滚动引擎，但“native”只说明能力怎样兑现，不能直接证明 Scroll Area 的全部义务已经 faithful。反过来，一项能力即使由翻译层 emulated，只要必需义务仍被可靠满足，也不必因此被判断为低保真。

同样，仓库里存在某个 Adapter package，并不等于它对所有 Prototype 都已经 verified。没有经过审查的支持或拒绝，只能说明这部分仍是 uncataloged；也不应该把若干 Module 的通过率合成一个总分，让许多次要能力掩盖一项关键义务的缺失。

能力矩阵依然有价值，但其中每一个格子都需要说明：结论针对哪个 profile、哪项语义或 Host Capability、得到什么结果，以及证据覆盖到哪里。

## 在最早可靠的边界报告问题

如果翻译层已经知道某项义务无法兑现，就不应该一直沉默，直到 User 在运行中碰到一个模糊的 no-op。

不过，“尽早”不等于猜测。有些结论在编译时就能确定，有些要等 Adapter 看见具体 Prototype 才能判断，还有些只有在 Host session 建立、真实能力完成协商之后才会成立。

所以更准确的原则是：在最早的可靠边界报告 degradation 或 inability。

- Compiler 已经拥有全部必要信息时，可以在生成 artifact 之前报告；
- Adapter 在创建 Component instance 时才能确认的问题，应在 setup 或绑定阶段报告；
- 只有实际 Host surface 建立后才能知道的限制，应在该事实变得确定时立即给出诊断。

一条有用的报告至少应说明：哪项义务无法满足、结论针对哪个 Host/profile、是否采用了经过授权的替代，以及替代以后还保留哪些保证。

## 翻译结论需要证据

翻译器能够运行，并不等于翻译责任已经完成。我们还需要证据说明，最终 Host artifact 的可观察行为确实符合对应的 Prototype 或 Contract。

证据必须绑定到具体范围：哪一项义务、哪一个 Adapter profile、哪一段 Host/runtime version，以及验证了哪些结果。React 的测试不能替 Qt 作证，Web Component 的 DOM 结果也不能自动证明 Flutter 会得到相同语义。

Proto UI 当前已经有受治理的 runtime Adapter profiles 和部分 Web-family evidence。Compiler、Qt、Flutter 与更广泛媒介的投放，仍然是翻译模型可以容纳、但尚未被现有证据证明的方向。

## 翻译之后，怎样才算同一个？

翻译层让一份 Prototype 得到了具体的 Host artifact，也让能力边界、翻译损失和证据拥有了可以说明的位置。

接下来的问题是：当两个 Host artifact 使用不同的结构、事件系统与渲染方式时，我们凭什么说它们仍然实现了同一个 Component？一致性应该严格到行为、结构，还是像素？

下一章，我们将讨论 Proto UI 所保证的一致性。

---

### 写作依据（不属于正文）

- 当前 official runtime Adapter profile 的身份、Module support/omission、Host Capability realization 与 profile-bound evidence 依据 active `D-ADAPTER-PROFILE-0001`。
- Module、Host Capability 与 Lifecycle 的边界参考 `internal/records/2026-08-13-module-host-cap-adapter-catalog-route.zh-CN.md`、`internal/records/2026-08-14-lifecycle-official-adapter-conformance.zh-CN.md` 及当前 catalog；记录只提供写作背景，不替代适用 Spec entity。
- Context 例子来自当前 `packages/modules/context/src/caps.ts` 与 `packages/modules/context/src/impl.ts`；Context Module/Host Capability identity 尚未完整 catalog，因此正文只把它作为实现示意。
- Adapter / Compiler / hybrid、四条正交轴、三种 conformance outcome 与最早可靠报告原则来自已接受的 WPD-08 白皮书方向；这些白皮书术语不表示仓库已有完整的通用 outcome schema。
- Compiler 目前不是 Spec schema entity，也不是已经证明的完整产品；Qt、Flutter 与 TUI 例子用于解释模型，不作为当前符合性证据。
