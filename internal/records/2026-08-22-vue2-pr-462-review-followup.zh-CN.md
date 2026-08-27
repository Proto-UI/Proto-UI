# 2026-08-22 Vue 2 Adapter PR #462 审查收口

> Internal record. Not normative. 本记录保存 PR #462 的审查处理决定；稳定语义仍以 `spec/**` 与适用的 adapter contract 为准。

> 2026-08-26 注：本文保存 2026-08-22 当时的隔离决定；后续 official Adapter admission 见 `2026-08-26-vue2-official-adapter-admission.zh-CN.md`。

## 当前定位

`@proto.ui/adapter-vue2` 继续是 `private: true` 且 `protoUi.release.scan: false` 的 Vue 2.6 feasibility package。它不是正式网站 adapter，也不在共享 Web conformance matrix 的保证范围内。

因此官网的正式 runtime 集合继续由 `AdapterIds = ['wc', 'react', 'vue']` 定义。全局 Adapter Select、首页运行时选择器、Demo Matrix 与 MDX 扫描都只接受该集合；`PrototypePreviewer` 也会过滤调用方显式传入的非正式 runtime。旧 MDX 中的 Vue 2 草稿面板不出现在公开 selector 或生成的官方示例中。这避免把 private package 表述为发布/支持承诺。

后续若要公开 Vue 2，必须在独立 PR 中同时：移除 private/release exclusion、提供自托管的 Vue 2.6 runtime、把 `vue2` 加入每个共享 web-conformance journey，并更新 spec 与公开文档。

## 本轮 adapter 修正

- Owner 与 view wiring 均将 outward expose event 接入 `expose-event` / `EXPOSE_EVENT_SINK_CAP`，并将 expose record sink 更新为 `EXPOSES_RECORD_SINK_CAP`。
- 每个 Vue 2 component instance 持有一个 `ScopedExposesReader`；`getExposes()` 复用其 callable cache，并在 `beforeDestroy`/terminal cleanup 时 invalidate 且清空 invoker。
- Focusable 投射与 React/Vue adapter 对齐：非原生 focus-scope host 不留下 `tabindex=-1`，原生或 programmatic target 则保留可编程聚焦语义。
- 未公开的 Vue 2 Previewer runtime 使用 host epoch guard；异步 loader 返回后只有仍拥有该 host 的 mount 才能 append DOM。回归测试覆盖 pending loader 期间的 unmount。

## 已执行验证

- `corepack pnpm@10.32.1 exec vitest run packages/adapters/vue2/test` — 19 files / 28 tests passed。
- `corepack pnpm@10.32.1 test:web-conformance` — 2 files / 6 tests passed（WC/React/Vue 官方 matrix）。
- `corepack pnpm@10.32.1 check:types` — passed。
- `corepack pnpm@10.32.1 test` — passed（release、类型、catalog 与 runtime suites）。
