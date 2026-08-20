# Scroll Area 本地预览检查记录

日期：2026-07-29

状态：非规范性工程记录。稳定语义仍以 `spec/**` 为准。

## 背景

在 `codex/scroll-area-domain` 分支上，通过本地文档站与 Web Components、React、Vue 三种 Previewer runtime 对 Brutalist Scroll Area 进行浏览器检查。检查目标是区分首轮 architecture slice 已经闭合的内容与 composed control 仍未闭合的内容，避免仅凭 CI 绿色把 PR 视为已经通过人工验收。

## 已复现并修正的问题

1. Demo 未向 Root 提供调用方尺寸。Root 随内容展开，Viewport 没有形成 overflow。
2. Demo 以相邻字符串表示多行内容；这些文本在 flex column 中成为一个匿名 flex item，仍不足以稳定制造垂直 overflow。
3. Scrollbar 位于普通文档流中，在满尺寸 Viewport 之后被 Root 的 `overflow-hidden` 裁剪。
4. Demo 手工绘制了一个 bottom-right 方块，但当前只有 vertical Scrollbar，并不存在双轴 gutter intersection；该方块不是已编目的 Corner part。
5. feedback semantic merge 把 `border-l-2` / `border-t-2` 误分到 border-color group，导致后续 `border-foreground` 静默覆盖方向性边框宽度。

对应修正包括：由 Demo 显式提供 `h-48 w-80`、把每一行建模为 box、移除伪 Corner、让 directional Scrollbar 绝对贴合 Root，以及为方向性 border width 增加独立 semantic group 与回归测试。

## 浏览器结果

- Web Components：Viewport `188px` 高、内容 `502px` 高；wheel/trackpad 路径可改变 `scrollTop`，resolved projection 为 `composed`。
- React：相同尺寸下 wheel/trackpad 路径可改变 `scrollTop`。
- Vue：相同尺寸下 wheel/trackpad 路径可改变 `scrollTop`。
- 三套 runtime 均能保留 `border-l-2` 与 `border-foreground`，不再丢失结构边框。

## 仍然阻止人工验收的问题

当前 Thumb 是 `flex-1` 的 feedback-only 占位面：它始终填满 track，不反映 `visibleRatio` 或 normalized position。浏览器拖动 Thumb 后 Viewport `scrollTop` 不变。因而当前页面证明了 host-owned scrolling engine 和 composed shell 可以同时存在，但不能证明 composed scrollbar chrome 已经完成。

这不是继续调整 Brutalist CSS 就能解决的问题。后续需要先决定 continuous geometry 的投影通路（feedback、adapter-local style sink 或新的 host-local projection port），并为 Root/Viewport/Scrollbar/Thumb 建立可跨宿主表达的 control binding。完成该决策与实现前，PR 应保持 Draft，文档不得把 Thumb drag、track click 或精确 geometry 描述为 passing guarantee。

## 后续顺序

1. 运行 spec/catalog、type 与完整 test 检查，确认本轮布局和 semantic merge 修正没有引入回归。
2. 由维护者决定当前 PR 是仅作为 architecture slice 合入，还是继续承载 composed geometry/control binding。
3. 若当前 PR 收窄为 architecture slice，人工验收标准应限定为系统滚动路径、normalized facts、projection negotiation 与三套 Web adapter 一致性。
4. 若继续承载 composed controls，则先补 control binding/geometry spec 与 host-cap contract，再实现 Thumb geometry、track request、drag session 和对应浏览器验收。
