---
title: '核心规范'
desp: '可移植协议边界与共享作者模型'
description: '可移植协议边界与共享作者模型'
---

Core 描述 Prototype、语义 Module、Runtime 与 Adapter 共享的可移植边界。它是现有 contract 的导航图，不取代各项能力规范。

> **生命周期提示：**当前 `C-CORE-*` 实体从 0.1.0 起均为 `draft`。它们描述项目已实现并登记的当前方向，但尚不是 `active` 稳定保证。

## 可移植语义与宿主翻译

Prototype 是协议 actor。它声明语义信息通路，但不拥有 React component、Vue component、Custom Element 或特定渲染引擎。Module 提供可复用的语义能力，Host capability 描述环境需要提供或接收的能力，Adapter 则在可移植声明与某个宿主表面之间进行翻译。

因此有两组责任：

- Prototype 与 Module 作者需要保持通路含义、执行时期和跨 Adapter 语义一致。
- Adapter 作者需要在不重解释语义的前提下完成翻译，并把宿主专属机制留在边界上。

当前官方 Adapter profile 均以 Web 为目标；已审计的准确切片见[兼容性](/zh-cn/reference/compatibility/)。

## 三个作者表面

Core syntax 按执行时间把工作分开：

| 表面 | Handle | 职责 |
| --- | --- | --- |
| Setup | `def` | 声明 props、state、event、lifecycle callback、expose、anatomy、a11y 等语义结构 |
| Render | renderer handle | 为一个 Root Node 生成 `TemplateChildren` |
| Callback | `run` | 读取当前输入、更新允许的运行时表面、发出 expose event、查询 anatomy |

Definition object 具有稳定 `name` 与 `setup(def)` 函数。Setup 可以返回 renderer，也可以不返回。Setup 中登记的 callback 会收到 `run`；受 phase 限制的操作不能泄漏到 setup 或 render 阶段。

具体规则请阅读对应规范：[生命周期](/zh-cn/specifications/lifecycle/)、[Template](/zh-cn/specifications/template/)、[Props](/zh-cn/specifications/props/)、[Event](/zh-cn/specifications/event/)、[Expose](/zh-cn/specifications/expose/)、[State](/zh-cn/specifications/state/)、[Context](/zh-cn/specifications/context/)、[Anatomy](/zh-cn/specifications/anatomy/)、[Feedback](/zh-cn/specifications/feedback/)、[asHook](/zh-cn/specifications/as-hook/) 与 [Rule](/zh-cn/specifications/rule/)。

## 信息通路

`K-COMPONENT-ACTOR-0001` 与 `K-INFORMATION-CHANNEL-0001` 给出当前概念模型：component actor 通过声明过的信息通路交换信息，而不是直接进入宿主实现。不同通路的所有权和时机不同——例如 Props ingress 不能与 Expose egress 互换，owned State 也不是任意外部 store。

通路模型解释了为什么一个操作即使语法上存在，也可能在当前 phase 无效；它也允许 Adapter 的机械实现不同，同时保持可观察的协议含义一致。

## 组合边界

Template language 描述的是**一个 Root Node 内部**的结构，不通过在 template 中嵌入另一个 Prototype 来完成 prototype composition（`K-PROTOTYPE-COMPOSITION-0001`）。语义复用通过 Module 与特殊的 `asHook` 原型形态完成；复合结构则使用共享 Anatomy family，并由宿主侧组装各 part。

这一边界让宿主所有权保持明确，也避免某个 framework 的 component tree 变成可移植协议语法。

## 如何理解目录空白

- `draft` 实体可以作为当前正式方向使用，但必须明确标示 draft。
- 尚未被目录登记的行为，不能自动判定为禁止或保证。
- source path 或通过的测试是证据，不能暗中修改与其冲突的实体。
- open question 在目录解决前始终是明确的空白。

需要查看这些表面对应的 API 示例，请继续阅读 [Prototype API](/zh-cn/reference/prototype-api/)；需要理解目录权威性和生命周期，请阅读[规范导读](/zh-cn/specifications/introduction/)。
