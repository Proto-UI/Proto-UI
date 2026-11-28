---
kind: investigation
status: active
date: 2026-11-28
baseline: c85b91e9 (compiler IR version 5)
receipts:
  - internal/records/2026-11-28-generated-ui-checks-by-ir-capability-data.json
---

# 生成式 UI 检查路线：随 IR 能力解锁

**结论：**Proto 的 IR 把交互语义写成显式指令：谁触发、写了什么、谁在读、任务怎样结束。因此编译器可以对 LLM 生成的组合做精确的语义检查，这是对任意 `onClick` 函数做静态分析很难达到的。

IR 每补齐一项能力，就解锁一类检查。第一步是根按钮的死链诊断，现有 IR 就能做。所有检查只把诊断交给生成方 agent，编译产物与界面保持原样。

## Scope & Limits

- 非规范记录，不修改 `spec/**`。诊断与 `sourceValid` 分开报告，档位（`generated`）由宿主选择。
- 检查从 IR 推断，不需要人工标注。文字含义、布局与用户意图不在任何阶段的范围内。

## 1. 为什么 Proto 能做

```ts
const refreshed = def.state.define<boolean>('refreshed', { initialize: () => false });
const refresh = def.action('refresh', (run) => {
  run.set(refreshed, true);
});
def.event.on('press.commit', refresh);
return (renderer) => renderer.el('button', { style: tw('orders-refresh') }, ['刷新']);
```

IR 中这条链是显式的，并且断在最后一步：

```text
view(button).activate → refresh → write refreshed → （没有视图、投影、Context 或任务读取）
```

在 React 里，`onClick={handler}` 背后可以是任意函数，静态分析很难判断它是否改变了用户能看到的东西。在 Proto IR 里，action 是由 `write`、`start`、`emit`、`await` 组成的 CFG，读取关系记录在 `dependencies` 中，后果可以用传递闭包算出来。

## 2. 路线

| 阶段 | 需要的 IR 能力 | 解锁的检查 | 对应的生成失败 | 现状 |
|---|---|---|---|---|
| 1 | 根按钮的 `activate`（已有） | 根按钮死链 | 按钮没接线（部分） | 现在可做 |
| 2 | 父组件连接子组件的 public event | 跨组件死链：子 Button 发出的事件父级是否处理 | 按钮没接线 | 缺口 |
| 3 | 作者无法伪造的任务结局类型 | "已保存""已完成"必须来自真实结局 | 与外部状态矛盾（部分） | 缺口 |
| 4 | 带类型的展示区域 | 展示数据的来源：系统数据还是模型写死 | 编造数据 | 缺口 |
| 提示 | `capture` 与初始化读取（已有） | 快照误用 | 派生状态不同步 | 现在可做 |

在 EvoGenUI-Bench 的 2,750 次失败中，按钮没接线占 460 次，派生状态不同步占 586 次，与外部状态矛盾占 289 次。数据见 receipts。

阶段 2 到 4 需要的接口，本来就是多组件组合迟早要补的；这条路线为"先补哪一项"提供具体的使用场景。

## 3. 第一步：根按钮死链诊断

从 `ElementView.activate` 指向的 action 出发求传递闭包，到达以下任一即算有后果，不报：

- 写入的状态被视图区域、公开投影或 Context provider 读取（含传递派生）；
- 启动任务或调用 extern；
- 发出 public event（埋点、通知宿主都算）。

部分分支有后果时，诊断指出具体是哪条分支。

```text
warning[generated/no-observable-effect] 「刷新」按下去没有看得见的后果
  链路：press → refresh → 写入 refreshed → 没有读取者
  建议：在视图里展示 refreshed，或让 refresh 启动加载任务
```

交互由 prototype 拥有：可按的部分应是子 prototype（如 Button），由父级连接它的事件，而不是裸的 `renderer.el('button')`。因此里层的裸按钮报告为"缺少交互 owner，请改用交互 prototype"；父级连接子事件的写法尚未定义，属于阶段 2 的缺口。

**快照提示：**视图读取的值如果来自对可变 prop、state 或 Context 的初始化读取或 capture，就提示"这是创建时的快照"，由生成方决定改成 `def.derive` 还是保留。

## 4. 验证方式

1. 在 `packages/compiler/src/targets/validation/` 旁写一个只读的 TypeScript 实验 pass，开工前与编译器现任负责人对齐。
2. 现有三个 authoring 示例都是正常代码，用来测误报，应当零警告；另收集一批真实 LLM 生成的坏例，用来测检出率。
3. 记录检出数、误报数，以及每条警告是否被 agent 采纳。

后续阶段在对应 IR 能力落地后，用同样的方式各自验证。
