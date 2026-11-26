# Shadow owner shell implementation checkpoint

日期：2026-09-12。状态：implementation checkpoint，non-normative。本文记录 Web Component Adapter 的 Shadow owner/view lifetime 分离重构；它不把当前 `shadow: true` 提升为新的稳定 profile，也不改变 Root style target。

## 已实现结构

`createShadowOwnerShell(root)` 在 Adapter 内部区分两类 ShadowRoot child：

- owner-lifetime node：未来可承载 shadow-local stylesheet 或其他 Adapter owner resource；
- view-epoch rendered node：当前 Template commit、Text Control 或 Image View 产生的可重复 materialization。

Shell 提供四个内部操作：

- `attachOwnerNode(node)`：把 owner node 安装在当前 rendered nodes 之前；
- `replaceRenderedChildren(nodes)`：只替换上一 view epoch 的 rendered nodes；
- `clearRenderedChildren()`：detach view 时只清理 rendered nodes；
- `hasOnlyRenderedNode(node)`：让 Text Control/Image View 保留既有“同一 native target 不重复移除并插入”的优化。

Shell 本身不会在 ShadowRoot 中插入 comment、wrapper 或 marker，因此已有 `shadow: true` 初次 commit 的可观察 DOM shape 保持不变，例如 slot 仍是：

```html
<slot></slot>
```

## Adapter lifecycle 变化

Shadow mode 的 generic Template commit 现在先在 `DocumentFragment` 中 materialize，再交给 owner shell 替换上一批 rendered nodes。Repeatable view detach 不再执行 `shadowRoot.replaceChildren()`，因此不会删除 owner-lifetime node。Text Control 和 Image View 在 Shadow mode 下也走相同 shell ownership。

这使当前实现更接近 `C-LIFECYCLE-0008-E/J` 的 owner lifetime 与 view epoch 区分：

- Custom Element 与 ShadowRoot 继续属于 owner；
- rendered Template/native target 属于 view epoch；
- detach 清除 view-owned children；
- rematerialize 重新创建/放回 view children；
- owner node 可以跨 repeatable detach/attach 保留。

同步 DOM move 与 terminal owner disposal 的 RuntimeSession 规则没有改变。

## 明确未改变的边界

- generic Root `feedback.style` 仍写入 Custom Element host；
- `boundaryTarget` 与 `surfaceTarget` 的现有解析未改变；
- 未创建 inner presentation surface；
- 未安装 shadow-local stylesheet；
- 未改变 `WebComponentAdapterOptions.shadow` 类型或默认值；
- 未改变 Light DOM commit/slot projection；
- 未公开 owner shell API。

集成测试显式确认 Shadow Template 仍直接成为 ShadowRoot child、Root `data-pui-style` 仍留在 host，以及非 view node 在 hide/show view epoch 之间保持同一 identity。

## 残余风险

Owner shell 通过记录 Adapter 上一批 committed node 来识别 view ownership，而不是依赖 DOM marker。Consumer 若直接操作 open ShadowRoot，移除或移动 tracked node，shell 会在下一次 replacement 中跳过已经离开 root 的节点；未被 shell 跟踪的外部 node不会被 Template commit 删除。当前 profile 尚未把直接修改 open ShadowRoot 定义为 portable customization surface，因此这只是明确的实现边界，不是新的消费者保证。

后续安装 owner stylesheet 时，应通过 `attachOwnerNode()` 建立明确 ownership，并增加 terminal cleanup、跨 Document/adoption 与 stylesheet readiness 证据。创建稳定 inner presentation surface 仍依赖 style-role semantic decision，不能由 owner shell 重构自动推出。
