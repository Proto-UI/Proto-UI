# Move Gesture 基础能力与 Scroll Thumb 首个消费者

日期：2026-07-29

状态：非规范性工程记录。稳定方向应提升到 `spec/**` 中的 Move Gesture 与 Scroll composed-control 实体。

## 背景

Scroll Area 的被动 composed chrome 已经能够从宿主 facts 投射 Thumb 尺寸与位置。下一步 Thumb drag 需要连续输入所有权、宿主捕获/识别、坐标采样、取消与 replacement/dispose 清理。Proto UI 未来还会遇到 Slider、Resize、movable surface、selection box、sortable collection 与 Drag and Drop，因此不应把 Web `setPointerCapture()` 直接写成 Scroll 的跨宿主协议。

## 本轮决定

抽象一个小于 Drag and Drop 的 **Move Gesture**：它只表示 primary contact 被宿主接受后形成的有界连续移动会话。

- portable/internal vocabulary 只包含 axis hint、immediate activation、start/move/end/cancel 生命周期、host-local position/delta/totalDelta sample 与取消原因。
- Web 使用 Pointer Events、pointer capture、`touch-action`、selection suppression 与 DOM detach observation 实现。
- Flutter 等宿主可以使用 GestureRecognizer/Gesture Arena；portable contract 不出现 pointerId、HTMLElement、CSS pixel 或 capture API。
- Scroll composed-control session 把 Move sample 与 track geometry 映射为 normalized `control-drag` request；真实 Thumb position 仍只从宿主 scroll facts 回报。
- Move 不拥有 Scroll range、Slider value、Resize constraints、Drop payload、drop target、collision、preview、collection reorder 或 accessibility widget semantics。

## 与 Event 的关系

现有 Event v0 把 `pointer.*` 定义为 optional medium event，并明确暂不提供 gesture abstraction。Move Gesture 不通过四个普通 prototype callback 拼装：它需要 target replacement、输入所有权与 host cancellation，并可能使用不等价于 Web pointer capture 的宿主识别机制。

Move 仍属于 User → Component 的交互输入解释，但本轮先作为 host capability 与内部 session 使用，不修改 Event v0 的作者 API，也不发布 `asMove()` / `asDrag()`。

## 为什么暂不创建公共 Module/asHook

Scroll Thumb 是第一个消费者，只能验证 immediate primary-contact move。公共能力还需要第二个独立消费者验证至少以下问题：

- move 与 press/activation 的竞争与 commit suppression；
- immediate、distance threshold 或 long-press activation；
- keyboard move 是否属于同一作者能力；
- 多组件 recognizer/gesture arena ownership；
- velocity/coalesced samples 是否是共同保证。

因此本轮先编目 K/D/C/HC/T 垂直切片，并把 Core types 与 Web host implementation 做成可复用内部基础。第二消费者出现后，再决定是否提升为 `M-MOVE-GESTURE` 与 privileged `asMove()`。

## Drag and Drop 伏笔

未来 Drag and Drop 应组合而不是膨胀 Move：

```text
Move Gesture
  + source/payload ownership
  + drag preview projection
  + Boundary/Hit based drop target discovery
  + collision and acceptance policy
  + collection reorder semantics
  + keyboard and accessibility alternative
  = Drag and Drop
```

这条分层允许 Scroll Thumb、Slider 与 Resize 复用 Move session，而不会被迫携带无关的 drop 语义。

## 当前实现范围

- 新增 host-neutral Move Gesture types。
- 新增共享 Web Move Gesture host。
- Web Scroll host 接受注入的 Move host，为每个 composed Thumb 建立/reconcile lease。
- Thumb-local press offset 加入映射，避免从 Thumb 中部抓取时跳变。
- move/end 映射到现有 `control-drag` request；cancel 不写入第二套 position。
- track page press、wheel forwarding、RTL/reversed-axis、press arbitration 与完整 Drag and Drop 继续分阶段推进。

## 编目与验证证据

本轮把方向分别提升为 `K-MOVE-GESTURE-0001`、`D-MOVE-GESTURE-0001`、`C-MOVE-GESTURE-0001`、`HC-MOVE-GESTURE-0001`、`T-MOVE-GESTURE-0001`，并以 `C-SCROLL-COMPOSED-CONTROL-0001` / `T-SCROLL-COMPOSED-CONTROL-0001` 约束首个 Scroll 消费者。没有创建 `M-MOVE-GESTURE`：当前只有一个领域消费者，尚不足以证明公共 Module/asHook 边界。

可执行验证覆盖：

- Web Move host 的 primary/concurrent contact、ordered sample、pointer capture、host cancel、lost ownership、target replacement/detach、dispose 与样式恢复；
- Web Scroll host 的 local press offset、normalized `control-drag`、无 overflow 拒绝、attachment replacement 与 dispose；
- Brutalist Scroll Area 经官方 Web Component adapter 形成真实 family attachment 并完成 pointer drag；
- 本地文档 demo 通过浏览器分别验证 Web Component、React、Vue：Thumb 尺寸不占满 track，drag 同步改变实际 viewport offset 与 Thumb projection，并保持无 `role=scrollbar`、无独立 Tab stop。

当前实现作为 Draft PR #351 的增量范围继续推进。PR 描述需要从“被动 composed chrome”更新为“Move Gesture 基础能力 + 首个 composed control”，同时明确 track page press、keyboard scrollbar、RTL/reversed axis 与完整 Drag and Drop 仍未包含。
