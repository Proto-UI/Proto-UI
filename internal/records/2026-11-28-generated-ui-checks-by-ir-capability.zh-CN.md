---
kind: investigation
status: active
date: 2026-11-28
baseline: c85b91e9 (compiler IR version 5); PR #2021
receipts:
  - internal/records/2026-11-28-generated-ui-checks-by-ir-capability-data.json
---

# 生成式 UI 检查路线：在封闭因果图上做结构验证

**结论：**Proto 把组件编译成一张显式的因果图：谁触发、写了哪个状态、谁在读、任务如何开始和结束，都是 IR 里的边。只要源码里没有绕开这张图的隐藏通道，编译器就能在有限图上机械地判断"这个交互能否影响任何可观察的东西"。

第一阶段的只读验证器已经实现。IR 每补齐一类连接边，就再解锁一类检查。

## Scope & Limits

- 本记录与同一 PR 中的规范修订配套：`C-COMPILER-FOUNDATION-0001` 的 `CAPTURES`、`VALUES`、`EQUALITY` 与 `SOURCE-COMPATIBILITY` 修订堵住了隐藏的可变通道，是下文因果图成立的前提。记录本身仍是非规范的。
- 验证器只保证**结构完整性**：无意的断链、漏接的分支、死写、误用的快照。它不判断业务意图，也挡不住刻意的敷衍，比如空函数或写死的文案。功能是否正确，交给驱动 `def.expose` 状态与 action 的契约测试。
- 文字含义、布局与用户意图不在任何阶段的范围内。

## 1. 因果图为什么可信

在 React 里，`onClick={handler}` 背后可以是任意闭包，状态可以藏在局部变量或共享对象里，静态分析看不全。Proto 用三条语言规则把这些通道收进 IR：

| 规则 | 作用 |
|---|---|
| `PHASES` | 视图与派生只能读，不能写状态或发起效果 |
| `CAPTURES` + `VALUES` | 没有跨段存活的可写闭包变量，也没有对复合值的原地修改；跨动作的数据必须经过 `def.state` 或 Context |
| `EXTERNS` | 对外部世界的读写只能经过声明的 extern 或 public event |

在这三条成立的前提下，IR 因果图是运行时影响关系的**健全过近似**：

> 如果一个交互在 IR 图上到达不了任何可观察的汇点，它在运行时就不可能产生可观察的后果。

可观察的汇点包括：视图区域、公开投影、Context provider、任务、extern 调用、失败，以及 public event。

验证器不求解条件的真假，把每条分支都视为可达。组件的声明、行为和基本块都是有限的，CFG 无环，所以每项检查都在多项式时间内结束。过近似的代价是保守：某些逻辑上永远不会走到的分支也会被计入。

## 2. 第一阶段：已实现的只读验证器

`validateComponent(ir, { verifyGenerated: true })` 运行 `targets/validation/generated.ts`；默认关闭，并且从不改写 IR。

| 发现 | 严重度 | 含义 |
|---|---|---|
| `generated/dead-control` | error | 根按钮没有连接动作，或被激活的元素在所有路径上都没有后果；开启选项时拒绝该组件 |
| `generated/unobserved-branch` | warning | 有一条路径没有后果，并且决定走上这条路的条件对用户不可见 |
| `generated/dead-store` | warning | 写入的状态没有流进任何可观察的效果 |
| `generated/snapshot-read` | info | 视图读取的是创建时从会变化的输入里拍下的值 |
| `generated/unconnectable-control` | info | 里层按钮在 IR v5 中无法连接动作，属于 compiler-missing |

每条发现都附带见证路径，例如：

```text
error[generated/dead-control] button activates "refresh"
  refresh:entry return without consequence
```

**可见条件的解释规则：**一条路径在某个分支上变成"之后再也不可能产生后果"，这个分支的条件如果出现在视图、公开投影或 Context 中（比如公开的 `disabled`），这次空操作就有解释，不报告。受控 Toggle 的 `disabled` 守卫就属于这种情况。

**判定依据：**状态是否"被观察"按数据流不动点计算。值流进写入可观察状态、emit 的载荷、extern 或任务的参数，或者流进有效行为的条件，才算被观察。只给自己计数的状态会报 dead-store。

**测试：**现有的 Badge、受控 Toggle 和两个 Tabs 导出都没有任何发现。坏例覆盖了全路径死按钮、未连接的根按钮、里层按钮、不可解释的空分支、死写和快照读取。

## 3. 后续阶段

| 阶段 | 需要的 IR 能力 | 解锁的检查 | 对应的生成失败 |
|---|---|---|---|
| 2 | 父组件连接子 prototype 的 public event | 跨组件的交互闭包 | 按钮没接线 |
| 3 | 作者无法伪造的任务结局类型 | "已完成"必须来自真实结局 | 与外部状态矛盾（部分） |
| 4 | 带类型的展示区域 | 展示值的来源：系统数据还是写死 | 编造数据（部分） |

在 EvoGenUI-Bench 的 2,750 次失败中，按钮没接线 460 次，派生状态不同步 586 次，与外部状态矛盾 289 次。最后这一类只有一部分涉及展示的结局或数据，所以阶段 3、4 只是部分覆盖。明细见 receipts。

**里层的裸按钮：**IR v5 只能在组件根元素上连接激活。里层的 `renderer.el('button')` 无法接动作，而父组件连接子组件事件的写法也尚未定义。因此在阶段 2 落地之前，验证器把这类元素报为 info 级的 `generated/unconnectable-control`，归入 compiler-missing，不算作者错误。

## 4. extern 的边界

extern 按效应的本质分两类，而不是按"视觉还是业务"：

- **纯查询**：读取宿主信息，不改变任何东西（如测量尺寸、读取时间）。单独出现不算交互的后果。
- **带类型的能力效应**：改变宿主或外部状态，并声明自己触达的能力域与失败类型（如 focus、scroll、clipboard、网络请求）。算作可观察的后果。

没有声明效应的不透明 extern，就是静态保证终止的边界。目前 IR v5 的 extern 只有一种效应类别 `after-state-commit`，全部按能力效应处理。纯查询类别需要在 `EXTERNS` 中先定义。
