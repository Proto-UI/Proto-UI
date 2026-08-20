---
title: '编写一个定制的复合原型'
description: '在已批准边界内建模 anatomy、owner、context 与 part responsibilities。'
---

复合 Prototype 不是“把一个大组件拆成更多文件”。它首先是一组经过批准的 protocol subjects、owners 与结构关系，然后才是源码组织。

> 本文解释 compound modeling。新的 Base family 仍需 proposal 与 maintainer checkpoint；实现阶段使用[实现已批准的 Base Semantic Slice](/zh-cn/build/prototypes/implementing-an-approved-base-slice/)。

## 先读 P/T 图，而不是先拆 DOM

Tabs 是当前仓库里的代表性例子。开始前至少检查：

- `P-BASE-TABS` 及 Root-owned selection criteria；
- `P-BASE-TABS-LIST`、`P-BASE-TABS-TRIGGER`、`P-BASE-TABS-CONTENT` 与 `P-BASE-TABS-INDICATOR`；
- 对应的 `T-BASE-TABS-*` 实体与 executable mappings；
- [shared.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/tabs/shared.ts) 和各 `*.proto.ts` 实现；
- `packages/prototypes/base/test/tabs.test.ts`。

这些 P 实体当前都是 `draft`，所以示例表达的是当前编目方向，而不是由 0.2.0 包版本自动产生的稳定保证。

## Tabs anatomy 当前包含五个 roles

`P-BASE-TABS` 的 canonical anatomy 定义：

| Role        | Cardinality | 当前责任                                                         |
| ----------- | ----------- | ---------------------------------------------------------------- |
| `root`      | `1..1`      | selected value owner、context provider 与 anatomy domain anchor  |
| `list`      | `0..1`      | trigger collection 与 roving-focus owner                         |
| `trigger`   | `0..*`      | 使用自身 value 请求 selection                                    |
| `content`   | `0..*`      | 按 value 投射 tabpanel visibility/presence                       |
| `indicator` | `0..*`      | context-driven visual consumer，不拥有 selection、focus 或 event |

旧的四-part 列表遗漏了 Indicator，不能再代表当前 family。

Anatomy 只声明 roles、cardinality 与 `contains` relations；它不会创建 parts，也不会注入行为。源码中的 `def.anatomy.claim()` 让具体 Prototype 声明自己承担哪个 role。

## 按责任划分 owner

好的 compound boundary 不是按 DOM 区域切，而是回答每条信息通路由谁拥有：

- Root 拥有 selected value、controlled/uncontrolled 协调与 context publication；
- List 拥有 collection ordering 和 roving focus；
- Trigger 读取 shared context，并发出 selection request；
- Content 根据 protocol value 管理 current、hidden 与 presence；
- Indicator 只消费 context facts，不成为第二个 selection owner。

如果所有状态仍集中在 Root，而 Parts 只是有名字的视觉壳，或者某个 Part 没有独立责任却被建成新 P identity，都应该返回建模阶段。

## Context 只承接共享 protocol facts

`TABS_CONTEXT` 当前包含 root identity、selected/active value、orientation、activation mode、controlled fact 与 request/validation coordination。它用于 family 内部协作，不应该成为随手放入以下内容的容器：

- 宿主 DOM 或 framework object；
- 私有视觉 token；
- 页面业务状态；
- 不属于 Tabs 的 Form、layout 或 announcement 责任。

Context 的字段和 owner 必须由 applicable P criteria 与测试约束，而不是仅因为传值方便。

## Compound 不等于 prototype-level template composition

`K-PROTOTYPE-COMPOSITION-0001` 明确：core template 描述一个 Root Node 内部结构，不直接嵌套另一个 Prototype。组件间组合发生在宿主、框架或编译层。

因此 anatomy family、context coordination 与应用层 component composition 是三件不同的事，不应混成一个“复合组件语法”。

## 实现与验证闭环

每个新增或变化的 role/criterion 都应形成：

```text
P criterion
→ anchored T case
→ owner or part implementation
→ focused family test
→ Adapter and accessibility evidence
→ exports, CLI, docs, demo
```

需要关注 controlled request、disabled item、empty/duplicate value、动态结构、presence、focus、a11y relationship 与 teardown 等边界；具体范围以获批 Issue 为准。

## 下一步

- 已有 Base family，只增加设计语言：读[基于 Base 长出一个带风格的原型库](/zh-cn/build/prototypes/building-a-styled-library-on-top-of-base/)
- 想沿实体和证据阅读代码：读[参考实现应该怎么看](/zh-cn/build/prototypes/reference-patterns/)
- 准备提交：使用[原型作者检查清单](/zh-cn/build/prototypes/checklist/)
