---
title: '参考实现应该怎么看'
description: '从 P/T 规范实体切入阅读源码、测试、包导出与文档，快速掌握 Proto UI 的实现模式。'
---

阅读仓库中的参考实现时，推荐从规范实体切入，再一路追到源码、测试与公开交付面：

```text
适用的 P-* 生命周期与准则
→ 关联决策、继承关系与契约说明
→ 对应的 T-* 测试用例与测试文件
→ Prototype 实现与聚焦单测
→ 包导出、CLI、文档与 Demo
```

先看规范再读代码，能更快理解每行实现背后的设计意图；如果发现源码与规范不一致，就能一眼识别出需要修复的偏差。

## 1. 定位对应的 `P-*` / `T-*` 实体

先按名称、实体 ID 或准则 ID 检索：

```sh
rg -n "<prototype name|entity id|criterion id>" spec packages/prototypes apps/www internal/records
```

重点看清五件事：

- `P-*` 实体当前的生命周期状态（`draft`、`active`、`deprecated` 或 `removed`）；
- 与当前任务直接相关的准则；
- 直接原型、`asHook` 与各个 Part 如何在实体中编目；
- `inherits.prototypes`、依赖关系与关联决策；
- `T-*` 用例映射到了哪些可执行测试文件。

`internal/contracts` 与 `internal/records` 可以补充历史背景，规范规则仍以适用的 `spec/**` 实体为准。

## 2. 阅读单体原型

`Button` 是一个紧凑的单体垂直切片：

- `P-BASE-BUTTON`；
- `T-BASE-BUTTON-0001`；
- [button.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/button/button.proto.ts)；
- `packages/prototypes/base/test/as-button.test.ts`。

阅读时重点追踪每条准则如何落到 props、state、无障碍属性、事件、expose 以及边界测试上。

可以同时对比 `Toggle`，观察另一个独立的 Base 协议：

- `P-BASE-TOGGLE` 与 `T-BASE-TOGGLE-0001`；
- [toggle.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/toggle/toggle.proto.ts)。

注意两者虽然都导出了 `asHook`，但各自只服务于自身协议，互不作为对方的底层实现。

## 3. 阅读复合原型家族

阅读 `Tabs` 这类复合组件时，建议把 Root 与各个 Part 结合起来看：

- `P-BASE-TABS` 及 List、Trigger、Content、Indicator 实体；
- 对应的 `T-BASE-TABS-*` 测试实体；
- [shared.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/tabs/shared.ts)；
- [root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/tabs/root.proto.ts)；
- [list.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/tabs/list.proto.ts)；
- [trigger.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/tabs/trigger.proto.ts)；
- [content.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/tabs/content.proto.ts)；
- [indicator.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/tabs/indicator.proto.ts)。

阅读重点放在状态归属、`Context` 共享字段、`def.anatomy.claim()` 声明、集合与焦点职责以及对应的家族测试上。

## 4. 阅读设计语言风格组件

`Shadcn Button` 是基于 Base 继承的典型小切片：

- `P-SHADCN-BUTTON` 与 `T-SHADCN-BUTTON-0001`；
- 继承自 `P-BASE-BUTTON` 的基础准则；
- [Shadcn Button 源码](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/shadcn/src/button/button.proto.ts)；
- `packages/prototypes/shadcn/test/button.test.ts`。

重点核对五点：

- 风格层 `P-*` 实体只记录相对 Base 的增量；
- 源码先调用对应的 Base `asHook`；
- 样式 `Rule` 基于继承来的协议状态，而不是把宿主选择器当作第二套状态源；
- 明确不支持的上游 API 有记录且有对应的测试验证；
- 包导出、CLI facade、官网 Demo 与 `P-*` / `T-*` 表面一致。

也可以进一步对比 Shadcn Switch 与 Tabs，观察不同规模组件的风格层组织方式。

## 5. 检查完整的公开交付面

看完源码和测试后，最后沿公开交付面走一遍：

- 包子路径与根入口导出；
- CLI 注册表与生成的 facade；
- component preset 与样式 Token 闭包（如适用）；
- 中英文文档与真实包导出 Demo；
- Web Component、React 与 Vue 预览；
- 通过 generator 生成的 workspace 与派生文档文件。

> 注：本页列举的 Base Button、Toggle、Tabs 与 Shadcn Button 规范实体当前均处于 `draft` 阶段，具体细节请以对应规范文件为准。

## 延伸阅读

- [维护已有 Prototype](/zh-cn/build/prototypes/maintaining-an-existing-prototype/)
- [从 Base 投射风格化 Prototype](/zh-cn/build/prototypes/projecting-base-into-a-design-language/)
- [实现受治理的 Base Semantic Slice](/zh-cn/build/prototypes/implementing-an-approved-base-slice/)
