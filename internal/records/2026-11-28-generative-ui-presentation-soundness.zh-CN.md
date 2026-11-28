---
kind: investigation
status: active
date: 2026-11-28
baseline: c85b91e9 (compiler IR version 5; C-COMPILER-FOUNDATION-0001 / C-COMPILER-LINT-0001, draft)
receipts:
  - internal/records/2026-11-28-generative-ui-presentation-soundness-sources.json
---

# 生成式 UI 的死控件检查：初稿

**提议：**在 `generated` 编译档位里加一个只读检查：可激活的控件按下去，要沿组合连到一个看得见的后果。

- 每条可达路径都断开：编译为 `disabled`。
- 部分路径断开：保留原样，把精确到分支的诊断交给生成方 agent。

另有一条只给提示的快照检查。唯一的改写是语义状态 `disabled`；结果单独报告、与 `sourceValid` 分开；运行时零开销。

## Scope & Limits

- 非规范记录，不修改 `spec/**`，不新增语言规则。
- 只覆盖"按了没反应"这一类问题；文字含义、布局、是否符合用户意图都不检查。
- 第 4 节列出的 IR 缺口会限制检查范围，文中如实标注。

## 1. 一个写坏的例子

```ts
import { definePrototype, tw } from '@proto.ui/core/authoring';

export default definePrototype({
  name: 'orders-refresh',
  setup(def) {
    const refreshed = def.state.define<boolean>('refreshed', { initialize: () => false });
    const refresh = def.action('refresh', (run) => {
      run.set(refreshed, true);
    });
    def.event.on('press.commit', refresh);
    return (renderer) => renderer.el('button', { style: tw('orders-refresh') }, ['刷新']);
  },
});
```

在 IR 里，这条链是断的：

```text
view(button).activate → refresh → write refreshed → （没有任何读取者）
```

`refreshed` 不出现在任何视图区域、公开投影、Context provider 或任务的 `dependencies` 里。按钮看起来能按，按了什么都不会发生。

```text
提示[generated/no-observable-effect] 「刷新」按下去没有任何看得见的后果
  --> orders-refresh.proto.ts:11
  链路：press → refresh → 写入 refreshed → 没有读取者
  修法：在视图里展示 refreshed，或让 refresh 启动真正的加载任务
  当前结果：所有路径都没有后果，编译为 disabled
```

修好后，视图读取由 `refreshed` 派生出的文字（或者 `refresh` 启动一个任务），链路就闭合了，检查不再改写任何东西。

## 2. 检查什么

**保证（会改写）：交互闭环。**每个渲染出来的 `button`，要么按下后在某条可达路径上产生看得见的后果，要么编译为 `disabled`。

"看得见的后果"按传递闭包计算，以下任一即算：

- 写入的状态被视图区域、公开投影或 Context provider 读取（含传递派生）；
- 启动任务，且任务内有外部调用或同样满足本条的写入；
- 组合根发出的 public event。根以外的事件必须继续追到最终消费者，父级接了空函数不算。

**分支规则：**只有在所有可达路径上都没有后果时才改写为 `disabled`。有的分支有后果、有的没有时，不改写、不插运行时标记，只给出精确到分支的诊断。

**提示（不改写）：快照误用。**视图读取的值，如果来自对可变 prop、state 或 Context 的初始化读取或 capture，就提示"这里是创建时的快照，之后不会跟着变"。生成方决定改成 `def.derive`，还是保留。这只是信息，不附带任何强制。

## 3. 在现有 IR v5 上怎么做

这个检查直接读 `produceComponentIR` 的产物，不依赖前端尚未完成的 effect/ownership 分析。

1. 用每个 behavior 的 `dependencies` 建反向索引：每个 state 被哪些视图区域、投影、provider、任务读取。
2. 从 `ElementView.activate` 指向的 action 出发，沿 `write`、`start`、`invoke`、`emit` 和 `await` 求闭包，判断是否到达第 2 节定义的后果。
3. 路径级判断沿用 CFG 的 `branch`/`match` 边。
4. 改写：新增一个返回 `true` 的 pure behavior，填入该元素的 `disabled`。后端照常发射，不需要任何改动。

## 4. 现有 IR 的缺口

| 缺口 | 现状 | 影响 |
|---|---|---|
| 只有根按钮能被激活 | `component.ts` 仅在根元素为 `button` 且有 `press.commit` 连接时设置 `activate`；`component-view.ts` 的 `element()` 只处理 `style` 与 `disabled` | 非根位置的按钮在 v5 中必然判为死控件；要么补上嵌套元素的激活连接，要么暂时只检查根按钮 |
| 子组件事件无法上传 | `ChildView` 只有 props | 跨组件的闭包追不下去 |
| 展示区域只接受文本 | `TextRegion` 的值必须是 `text`，拼接或格式化后类型丢失 | 无法区分"展示数据"与"文案"，因此不做任何数据来源类检查 |
| 没有不可伪造的任务结局类型 | 尚无作者可读、仅 scheduler 能产生的结局值 | "已完成"防伪暂缓，等该接口确定后再加入保证 |

后三项本来就是多组件组合迟早要补的接口。

## 5. 明确不做的

- **字面量染色和「AI 生成」标注**：`count + 1`、分页默认值这类正常常数会被大面积误伤；而且 `TextRegion` 只接受文本，定位不到"数据位"。
- **往界面插入「非最新」等文字**：Proto 只管语义，外观归宿主主题；编译器不应插入可见文本。快照问题只给提示。
- **按分支插运行时标记**：会破坏零开销。部分路径有后果的控件，统一交给诊断。

## 6. 零运行时开销

唯一的改写是给"所有路径都没有后果"的按钮填上 `disabled`。这是 IR 内的静态改写，产物就是人会手写的普通代码。

`disabled` 是语义状态，外观由宿主主题决定。没有发生改写时，IR 原样交给后端，产物不变。

## 7. 第一步

1. 在 `packages/compiler/src/targets/validation/` 旁边，用 TypeScript 写一个只读的实验 pass，只做"交互闭环"和"快照提示"。开工前与编译器现任负责人对齐。
2. 输入：仓库现有三个 authoring 示例，加若干份真实 LLM 生成的坏例。
3. 记录：抓到的真实死控件数、误报数、改写率。
4. 误报和改写率可接受、方向确定之后，再讨论形式化加固。

## 8. 数据口径

- 这项保证针对 EvoGenUI-Bench 的 affordance binding：460 / 2,750 ≈ 16.7%。
- derived-state 的 586 次失败只得到提示，不在保证内。
- 任务结局接口落地后，再加上 external grounding（289 次，本身只是部分相关）。即使整类全部计入，上界也只有约 27.2%。
- 上一版写的 48.5%，是把标为"部分相关"的类别整类计入、且包含已撤下的条款后得出的理论上界，现已作废。

## 9. 未决问题

- 组合根的 public event 交给宿主后是否真被处理，目前只能作为假设。
- 快照提示的误报率需要实测。
- 只在部分状态下有后果的控件，能否编译为基于现有响应式条件的 `disabled`，而不引入新的运行时状态。v1 不做。
