# S4：关闭闪回的 compositor conceal 修复

日期：2026-09-14。性质：人工验收后的工程记录，不是新规范或 S4 全部问题关闭声明。

## 人工报告与范围

在 `demo-matrix/#shadow-split-s4` 中发现两个现象：

- split Content 淡入/缩放期间偶尔停顿约一到两帧，切换设置可能有助于复现。
- Light、split、mixed 在 Switch/Checkbox 不同于默认值时，关闭后可能完整闪回一帧。

用户补充：Codex 内置浏览器和 Chrome 可以复现，Safari 未观察到。此轮确认并修复第二项；第一项仍待定位，不能把两项自动归为同一原因。

沿用 `2026-09-14-shadow-s4-delivery-and-manual-acceptance.zh-CN.md` 的范围，不新增作者 API、动画 token、Adapter profile 或生命周期保证，不扩大 slot 所有权。

## 权威与证据

- `C-LIFECYCLE-0008`（active）D/E/F/J：latest intent、repeatable view epoch、terminal disposal 和 retained shell 的视觉隐藏。
- `C-AS-TRANSITION-0001`（draft）E/G/H：leaving 保留 view、Core delay completion 与过期回调失效。
- `C-AS-OVERLAY-0001`（draft）E/F/K：presence 与 view-owned portal/layer 的回收，以及 logical origin 的保留。
- `D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001`（draft）S/T 和 `D-WEB-COMPONENT-SHADOW-STYLE-0001`（draft）Q：K1 有界几何与动画，不由静态终点推导任意动画支持。

Transition 当前不监听 `animationend` / `transitionend`；未发现子控件冒泡提前完成 Dialog 的证据。

独立公开包页面、实际网站和独立内置浏览器标签分别做过持续 rAF 样式/几何采样。该采样未检出关闭闪回，不能据此否定人工报告。改用真实鼠标路径和 Chromium CDP screencast 后，捕获到：

1. Content 正常淡出，画面已不再显示弹窗。
2. `transitionState=closed`、`open=false`、`data-pui-view-detached` 已存在。
3. portal 返回 origin，view-owned 动画样式被撤销。
4. 实际画面完整出现一帧旧弹窗，然后消失。该帧位置还会受回收后的几何变化影响。

这是宿主隐藏、重定位和动画合成层撤销之间的绘制问题，不是受控模型又写入 `open=true`。逐帧读取计算样式会扰动问题，因此修复验证不能只用这种采样。

对照中，额外 `visibility:hidden`、`opacity:0`、同步几何读取和 `moveBefore` 原子移动均未解决闪回，没有保留这些试验改动。将隐藏和投影回收隔开一次渲染机会后，三种 profile 的闪回不再出现。

## 修复

`packages/adapters/web-component/src/portal-conceal.ts` 为当前实际 portaled 的 owner 提供私有、可取消的隐藏屏障。

- `present=false` 仍立即隐藏 shell，并暂停其事件入口。
- 仅在连接中的实际 portal、可见 document 和具备 rAF 的宿主中，等待两次 rAF 回调，再撤销 view-owned portal/样式。第二次回调让第一次回调之后存在一次渲染机会；它不是固定毫秒延时，也不改变 Transition duration。
- 普通非 portal、后台 document、无 rAF 的宿主不增加此等待；等待期间进入后台也会释放屏障。
- 新 intent 取消旧等待，并重新校验 request version 与 controller generation。等待期间重新打开时，直接揭示仍然挂载的 epoch，不让 focus 排在旧关闭任务后面。
- 真正的 owner 移除取消等待并正常 dispose；不会为了画面屏障延长 terminal owner lifetime。
- commit 不能重新启用隐藏 view 的事件入口；揭示后的入口恢复与 readiness 通知遵循当前 owner 状态。

`portal-mount.ts` 只增加私有 active-projection tracking，不改变 logical parent 或 portal 目的地。

原有 nested-trigger 单测中的第二次鼠标点击改为 `detail: 1`，明确模拟独立 pointer activation，而不是先前 Enter 的零 detail 合成后续 click。保留 epoch 不应靠重建 router 清空 keyboard dedup；未修改 router 的去重规则。

## 可执行回归与验证

环境：Node 22.23.2、pnpm 10.32.1、Chrome 152.0.7977.83。

新增 `portal-conceal.test.ts` 的 6 项确定性测试覆盖：普通 owner/后台快路径、两帧屏障、不同时间的取消、转入后台、快速重新打开不重建 epoch，以及等待中 terminal removal 不复活旧工作。

新增 `scripts/analysis/shadow-s4-paint-browser.mjs` 与网站 `demo-shadow-split-s4-paint.browser.test.ts`：

- Light/split/mixed × 默认/仅 Switch/仅 Checkbox/两者 × 两轮关闭，共 24 条路径。
- 检查消费者受控值的恢复与关闭事实。
- 使用不影响布局的测试 slot 色标和实际 screencast PNG 检查“淡出后重新出现”；关闭期间不读计算样式或几何。
- 错误时保存画面及状态时间线到临时目录。该测试不覆盖每一个显示器扫描帧，也不能证明没有偶发入场性能问题。
- 将测试浏览器收到的屏障模块替换为 no-op 的负向对照，重新检出了 `open=false + detached=true` 下的 opaque frame；证明检测并非只比较属性或永远通过。

最终通过：

```sh
# 83 files / 349 tests：WC 全部测试 + Base Transition
corepack pnpm@10.32.1 exec vitest run packages/adapters/web-component/test packages/prototypes/base/test/as-transition.test.ts --pool=forks

# 2 files / 13 tests
corepack pnpm@10.32.1 exec vitest run packages/runtime/test/contract/overlay.v0.contract.test.ts packages/adapters/base/test/overlay-layer-scheduler.test.ts --pool=forks

corepack pnpm@10.32.1 --filter @proto.ui/adapter-web-component build
corepack pnpm@10.32.1 check:types

# 公开包完整 S4 journey、K1 42 帧、portal 三种 profile + rejected companion
node scripts/analysis/shadow-s4-public-browser.mjs
node scripts/analysis/shadow-s4-admission-browser.mjs
node scripts/analysis/shadow-s4-portal-browser.mjs

# 中英文完整交互 2 tests + 24 条真实画面路径 1 test
PROTO_UI_BROWSER_BASE_URL=http://127.0.0.1:4321 corepack pnpm@10.32.1 exec vitest run apps/www/src/content/docs/zh-cn/demo-shadow-split-s4.browser.test.ts apps/www/src/content/docs/zh-cn/demo-shadow-split-s4-paint.browser.test.ts --pool=forks --no-file-parallelism
```

类型检查最终为 206 个 Astro 文件、0 errors / warnings。最初与公开包构建并行的类型检查受 dist 重建影响，改为构建后串行重跑；新增测试的 unknown expose handle 类型也已修正。S1–S3 完整网站路径本轮未重跑；没有 spec 变更或发布动作。

## 尚未关闭：split 入场偶发停顿

真实网站记录中存在掉帧，但尚未从 Chrome/内置浏览器样式时间线和画面记录中分离出可重复、split 专有的入场停顿原因。未观察到足以确认的内外动画时钟分叉，不能据此宣称所有帧都正常，也不能将普通调度掉帧认定为所报问题。

后续应在本次关闭修复上复验入场；若仍能看到停顿，记录具体控件值、触发方式和录屏，再对齐 compositor 与主线程时间线。此项保持开放，不添加推测性的 token、动画时长或样式补丁。
