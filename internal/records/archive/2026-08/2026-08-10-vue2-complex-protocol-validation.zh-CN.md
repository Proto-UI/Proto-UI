# 2026-08-10 Vue2 复合组件验证记录

> Internal record. Not normative. 本文记录 `@proto.ui/adapter-vue2` 在 Vue 2.6 中执行真实 Proto UI 复合组件的验证结果；稳定能力仍以 `spec/**` 为准。

## 已验证可运行的复合路径

- Tabs：Root / List / Trigger / Content 的 context、anatomy、默认 slot、ARIA、点击切换与 `keepMounted`。
- Select：Root / Trigger / Value / Content / Item 的 collection、ARIA、键盘导航、commit value 与关闭。
- HoverCard：Trigger 和 Content 在 Root 持有的 open/close delay 下协作。
- Dialog：Root / Trigger / Content / Close 的真实 open/close 链路；文档站 `demo-base-dialog` 也通过 Vue2 runtime、demo renderer 与 Adapter 运行。
- Textarea：声明的 host textarea、属性投射、输入回传、Vue2 `data.on` listener 与类型层 `onX` listener。
- Scroll Area：Root / Viewport / Scrollbar / Thumb 的 anatomy 组合与 composed projection 选择。

对应 executable evidence 位于 `packages/adapters/vue2/test/` 的 `tabs`、`select`、`hover-card`、`dialog`、`textarea.integration`、`scroll-area` 与 `previewer-dialog.demo` 测试。

## 已验证的宿主能力

### 物理 Portal 挂载

`base-dialog-content`、`base-dialog-mask`、`base-select-content` 与 `base-hover-card-content` 都会声明 `portal: true`。Vue2 Adapter 的 `createVue2OverlayGlobalMount()` 会在原位置插入 comment anchor，再将 overlay host 移到 `document.body`；逻辑父级投射仍由 `setProtoParent()` 保持。

`overlay-portal-ownership.test.ts` 验证 detached mounting、anchor 回收与 logical parent projection。`previewer-dialog.demo.test.ts` 验证实际文档 Dialog demo 打开后内容脱离 preview host 并可关闭。浏览器验收了文档 Select：切换 Vue2 后打开菜单，选项位于 `document.body`，选择值后菜单关闭并清理。

`HC-PORTAL-0001` 当前仍为 draft，因此这条记录是实现与测试证据，不将其表述为稳定规格保证。

## 已标记的覆盖边界

### Template v0 的显式边界

以下不是 Vue2 特有转换失败，而是当前 Template v0 已拒绝的输入：`PrototypeRef`、具名 slot、多 slot、scoped slot，以及带 children/style 的 slot node。Vue2 普通 `$slots.default` 的 VNode[] 已被支持；若 Proto UI 将来需要从 slot child 反向读取 render-time 参数，必须先扩展 Template contract，而不是让 Adapter 猜测 VNode 私有字段。

### 仍需浏览器验收的布局能力

Scroll 的真实 geometry/拖动、Overlay 的 anchored positioning 与焦点 trap 依赖布局、焦点和 pointer capture，happy-dom 单测不能充分证明。它们目前不是“不可转换”，但必须在 Vue2.6 浏览器环境增加交互验收后才能提升为已验证能力。

### 文档示例覆盖（历史，已被后续隔离决定取代）

本段保存 2026-08-10 当时的文档接入观察，不再表示当前公开网站边界。当时 Select、Button、Tabs 的文档 code map 已提供 Vue2 Adapter 示例，对应 Previewer 曾允许选择 `vue2`；Dialog、HoverCard、Tooltip、Transition、Textarea 等复合 demo 也曾计划通过首页 Demo Matrix 的 Vue2 runtime 运行。

`2026-08-22-vue2-pr-462-review-followup.zh-CN.md`、`2026-08-23-vue2-internal-runtime-isolation.zh-CN.md` 与 `2026-08-24-vue2-pr-462-remediation-scope.zh-CN.md` 随后记录了隔离阶段。2026-08-26 的后续 admission 已由 `2026-08-26-vue2-official-adapter-admission.zh-CN.md` 取代该隔离方向；稳定范围以 `A-VUE-2-0001` 为准。
