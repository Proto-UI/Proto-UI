# Runtime Box、React reveal 与 browser runner readiness

日期：2026-08-31

本文延续 `2026-08-29-shadcn-demobox-dogfood-followup.zh-CN.md`，记录首页 Runtime Box 的一次实现修复与短期展示边界。它不改变 `spec/**` 的规范语义，也不构成 Flutter、Qt 或 GPUI Adapter admission、实现或一致性声明。

## Context

生产首页从其他 Runtime 首次切换到 React 时，新 host root 会在 rule-driven style token 完整提交前解除 `data-pui-view-pending`。组件因此短暂暴露 base-only presentation；已有 transition 会把这次 token 补齐表现为从中心展开，暗色模式下还会闪过非终态边框。

同一页面的 Runtime Box 使用多层大圆角、重复边框与阴影，弱化了控制器和预览 surface 的层级。两个 Select trigger 也缺少按压位移反馈。页面还没有一个诚实表达 future browser-WASM runner 方向、但又与当前可执行 Adapter 列表严格隔离的区域。

## Current implementation direction

- React Adapter 在首次 host commit 后完成 `CommitSignal.done()`，跟踪 EffectsPort 推送的最新 style revision，并保持新 root pending，直到该 revision 已进入后续 React DOM commit。
- `data-pui-view-pending` 与短暂的 `data-pui-view-revealing` Web guard 同时压制 transition 与 animation；pending 移除后至少经过一个绘制机会才撤掉 revealing guard，且每次 reveal 使用独立 generation，旧 epoch 的延迟回调不能提前撤掉新 guard，避免 `transition-all` 为 visibility reveal 创建新的 CSS transition。
- 首页 renderer 在卸载当前 demo 前先加载目标 demo、Prototype 与 framework runtime；active cleanup 在任何 `await` 前原子取走，旧 generation 的 teardown 或 render completion 不得覆盖或泄漏较新的 mount。Runtime Box 公开 `loading`、`ready`、`error` 状态，但不把 loader 或 host object 提升为 Proto UI portable contract。
- Runtime Box 使用单一 Shadcn Card-like outer surface、紧凑 token radius、扁平 preview stage 与 1px Select press feedback，移除 preview host 上重复的大圆角、边框和阴影。
- Flutter、Qt 与 GPUI 只出现在独立的 `Browser WASM lane` research presentation 中。该列表不可交互，不进入 `RuntimeId`、Adapter preference、`renderDemo()` 或任何 cataloged Adapter profile。

## Boundary and non-goals

当前可执行 Runtime 仍只有 Web Components、React、Vue 3 与 Vue 2。本轮不增加 WIT/schema、WASM loader、Flutter/Qt artifact、Rust host、GPUI fixture、native surface bridge、Adapter identity 或 conformance evidence。

历史 GPUI architecture exploration 仍由 Issue #466 与 draft PR #467 提供上下文；本轮只在二者留下带明确非支持边界的 cross-reference：

- https://github.com/Proto-UI/Proto-UI/issues/466#issuecomment-5467648505
- https://github.com/Proto-UI/Proto-UI/pull/467#issuecomment-5467649178

真实 GPUI/browser-WASM admission 仍需要基于当前 `main` 的独立架构决策、Host Capability 映射、Adapter profile、fixture 与端到端证据。

## Evidence and follow-up

- `packages/adapters/react/test/view-reveal-style.integration.test.ts` 直接采样 pending attribute 被移除时的完整 style tokens。
- `apps/www/src/components/PrototypePreviewer/home-demo-client.test.ts` 通过 deferred teardown 与 deferred render result 覆盖 double-destroy、newer-active clobber 和 stale cleanup。
- `apps/www/src/content/docs/zh-cn/home-demo-runtime.browser.test.ts` 覆盖四个现有 Runtime、暗色 React reveal、Light/Dark 响应式几何、Select press feedback 与 research/executable 分离。
- Issue #568 继续作为站点控件、Runtime demobox 与 dogfood matrix 的聚合 owner；本次修复由 bounded child Issue #575 跟踪，并通过独立 PR 交付。

后续若加入真实 browser-WASM runner，必须先把 research label 转化为受治理的 architecture slice；不得从本记录或当前页面文案推断支持已经存在。
