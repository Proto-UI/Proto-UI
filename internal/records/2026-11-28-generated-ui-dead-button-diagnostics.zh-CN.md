---
kind: investigation
status: active
date: 2026-11-28
baseline: c85b91e9 (compiler IR version 5)
receipts:
  - internal/records/2026-11-28-generated-ui-dead-button-diagnostics-data.json
---

# 生成式 UI 的死按钮诊断：初稿

**提议：**在 `generated` 编译档位里加一个只读诊断：按钮按下去如果没有任何看得见的后果，就把断开的链路报告给生成方 agent。编译产物保持原样，是否修改由 agent 决定。

在 IR 补齐嵌套元素的激活连接和子组件事件之前，诊断只覆盖组件的根按钮，并且只报告、不改写。

## Scope & Limits

- 非规范记录，不修改 `spec/**`。诊断属于作者提示，与 `sourceValid` 分开报告。
- 范围：根按钮的交互闭环，以及一条快照提示。文字含义、布局、意图不在范围内。

## 1. 例子

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

IR 里的链路：

```text
view(button).activate → refresh → write refreshed → （没有读取者）
```

```text
warning[generated/no-observable-effect] 「刷新」按下去没有看得见的后果
  --> orders-refresh.proto.ts:11
  链路：press → refresh → 写入 refreshed → 没有视图、公开状态、Context 或任务读取它
  建议：在视图里展示 refreshed，或让 refresh 启动加载任务
```

## 2. 什么算"后果"

从 `ElementView.activate` 指向的 action 出发，沿 `write`、`start`、`invoke`、`emit` 与 `await` 求传递闭包。到达以下任一即算有后果，不报：

- 写入的状态被视图区域、公开投影或 Context provider 读取（含传递派生）；
- 启动任务，或调用 extern；
- 发出 public event。埋点、通知宿主等交给外部的行为都算后果。

有的分支有后果、有的没有时，诊断指出具体是哪条分支。

## 3. 快照提示

视图读取的值，如果来自对可变 prop、state 或 Context 的初始化读取或 capture，就提示"这里是创建时的快照，之后不会跟着变"，由生成方决定改成 `def.derive` 还是保留。

## 4. 现有 IR v5 的边界

| 现状 | 处理 |
|---|---|
| `activate` 只在根元素为 `button` 且有 `press.commit` 连接时设置（`producer/component.ts`）；`element()` 只处理 `style` 与 `disabled` | 只诊断根按钮。非根按钮无法连接是编译器能力缺口，按 `C-COMPILER-LINT-0001` 归为 compiler-missing，不算作者错误 |
| `ChildView` 没有事件 | 不跨组件追踪 |
| `TextRegion` 只接受 `text` | 不做任何数据来源类检查 |

## 5. 第一步

1. 在 `packages/compiler/src/targets/validation/` 旁写一个只读的 TypeScript 实验 pass，开工前与编译器现任负责人对齐。
2. 用仓库现有三个示例检查误报（它们都是正常代码，应当零警告）；另收集一批真实 LLM 生成的坏例，检查检出率。
3. 记录检出数、误报数和每条警告是否被 agent 采纳。

## 6. 数据

这类问题对应 EvoGenUI-Bench 中的 affordance binding：460 / 2,750 ≈ 16.7%。快照提示对应 derived-state propagation（586 次），只作提示。明细见 receipts。

## 7. 以后

IR 补齐嵌套激活和子组件事件之后，再评估是否扩展到全部按钮与跨组件链路，以及是否值得提供更强的保证。
