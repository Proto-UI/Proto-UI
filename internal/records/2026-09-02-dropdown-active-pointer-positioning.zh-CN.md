# Dropdown active-pointer positioning 同步记录

日期：2026-09-02 关联 Issue：#587

本文记录一次实现回归修复及其 authority gap。它不是 Proto UI 规范，不修改 `spec/**`，也不为 drag cadence、placement 动画或 touch dismissal 创建新的公开保证。

## Context

Issue #587 观察到：mobile viewport 中 Dropdown 保持打开时，Trigger 在 pointer drag 期间发生 rendered-geometry 位移，Content 的 positioning 更新与视觉位移不同步；接近 viewport 底部时，collision placement 从 bottom 翻为 top。

## Applicable authority

- `C-ANCHORED-POSITIONING-0001-E` 要求自动更新只存在于 active-view lease 生命周期，idle 默认不得启用逐帧 `animationFrame` polling，并在 detach/dispose 时撤销 observer。
- `C-ANCHORED-POSITIONING-0001-G` 要求默认按 anchor 的实际 rendered geometry 定位；只有显式 `excludeAnchorTranslation` 才排除 anchor 自身 translation。
- `HC-ANCHORED-POSITION-0001` 把测量、collision resolution、坐标写入与相关 geometry observation 归给 host capability。
- `P-BASE-DROPDOWN-MENU-CONTENT-POSITION` 要求 `excludeAnchorTranslation=false` 时使用 Trigger 的实际 rendered geometry。
- `P-BASE-DROPDOWN-MENU-TRIGGER-*` 与 Root request channel 继续拥有 open/close interaction；Positioning host 不拥有 dismissal。

当前没有 `C-*` criterion 规定 active pointer session 必须达到何种逐帧 cadence，也没有实体授权对 collision flip 的 `left/top` 变化做动画。因此本轮不新增 `T-ANCHORED-POSITIONING-0001` case，避免用 Test entity 反向发明规范语义。

## Bounded implementation decision

Web Floating UI host 保持 idle `animationFrame:false`。仅当 active positioning lease 的 anchor 收到 `pointerdown` 时，暂时重启同一 `autoUpdate` lease 为 `animationFrame:true`；在匹配的 `pointerup`、`pointercancel`、window `blur`、target replacement 或 dispose 时恢复 idle policy 并撤销监听。

这只是 host implementation 对实际 rendered geometry 的同步修复：

- 不新增 portable prop、Module API 或 Host Capability identity；
- 不改变 Trigger/Root 的 open、toggle、outside-dismiss 或 focus 语义；
- 不对 placement flip 增加 transition；Positioning 继续直接写 `left/top`，Transition 不取得几何所有权；
- 用 request generation 丢弃重叠 `computePosition()` 的 stale result，避免较旧计算覆盖较新 frame。

## Evidence

实现级单测 `packages/modules/positioning/test/floating-ui-host.test.ts` 覆盖：idle 无 frame loop、pointerdown 启动 tracking、rendered rect 变化驱动 Content 坐标、pointerup/pointercancel/blur 停止、anchor replacement 解绑旧 target 并绑定新 target、active dispose 清理 frame 与监听。

真实 mobile journey 在 390×844 Shadcn Dropdown 页面验证：

- drag session 中菜单保持 open；
- Trigger 每 20px 下移时 Content 每次保持 4px anchor gap；
- offset 320 时 collision placement 从 `bottom` 翻为 `top`，翻转后继续保持 4px gap；
- 未添加 placement animation；outside press dismissal 保持原路径。

## Follow-up

若维护者要把 active-pointer cadence 或 placement-change motion 提升为跨 host 保证，应先单独决定：可移植输入事实、host availability/fallback、性能预算、multi-pointer 规则、placement transition ownership 与对应 `C-*` criterion，再添加 `T-*` mapping。#587 本轮不代替该决定。
