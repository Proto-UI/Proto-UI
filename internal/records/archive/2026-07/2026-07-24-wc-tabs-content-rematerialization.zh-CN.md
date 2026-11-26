# Web Component Tabs Content 重物化缺陷记录

日期：2026-07-24

## 现象

Web Component Adapter 下的 `shadcn-tabs-content` 在默认 `keepMounted=false` 时可以完成首次切换，但已经显示过的 content 在执行 `current -> inactive -> current` 后仍带有原生 `hidden` 属性。此时 Proto instance、`current` state 和新的 view epoch 均已恢复，宿主却继续被浏览器隐藏，表现为 content 消失。

## 引入范围

该回归由 commit `c20eae99`（`fix(adapters): merge nested trigger host surfaces`）引入，并包含在 `v0.2.0-rc.3` 的准备分支中。该提交让 WC a11y 与 focus 共用经过 `isViewReady()` 限制的 trigger surface target；限制对 focus 是必要的，但阻止了重物化首帧在 reveal barrier 内完成 a11y 快照投射。

## 根因

WC owner 使用 `data-pui-view-detached` 作为 L1 detached shell 与新 view epoch 首次 commit 前的视觉屏障。重物化时：

1. Tabs context 先把 content 的 `hidden` state 更新为 `false`，再请求 `setPresent(true)`。
2. 新 view epoch 在视觉屏障仍存在时完成 render/commit。
3. a11y projector 将 `isViewReady() === false` 解释为没有 target，因此没有把最新 `hidden=false` 投射到宿主。
4. Adapter 随后移除视觉屏障，但 a11y target 没有再次变化，旧 view epoch 留下的原生 `hidden` 属性因此持续存在。

这违反 `C-LIFECYCLE-0008-J`：新 view 在揭示前应完成 view effects，而不是等到揭示后才允许投射。

## 修复

WC view modules 将 target readiness 分为两层：

- a11y 使用已连接的 logical trigger surface，可以在 reveal barrier 内投射首帧语义与属性；
- focus 继续要求 `isViewReady()`，避免 detached 或尚未揭示的 view 提前参与焦点交互。

新增两层回归覆盖：

- 通用 L1 测试验证重物化前更新的 a11y state 会在揭示前重放；
- Shadcn Tabs WC 集成测试验证 `A -> B -> A` 后 content 恢复、移除 `hidden` 且保留内容。
