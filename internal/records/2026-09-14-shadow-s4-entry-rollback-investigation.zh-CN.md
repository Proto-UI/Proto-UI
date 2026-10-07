# S4：入场后几何回缩的录像分析与诊断入口

日期：2026-09-14。性质：人工验收问题的工程调查；不是修复完成或规范晋升。

## 观察与边界

承接 `2026-09-14-shadow-s4-compositor-conceal-repair.zh-CN.md`。关闭后的 opaque 闪回已由 `651277de` 处理；本轮不修改该屏障，也不将残余入场问题与它自动归为同一原因。

用户提供的录像包含 141 帧、约 4.67 秒，标称 30fps。第二次入场有明确的非单调画面变化：

- 帧 62–63（2.037–2.070 秒）已经接近/达到最终尺寸。
- 帧 64–72（2.103–2.370 秒）回缩，测量同一空白横带的白色宽度从约 756px 降到 718px，比例约 95%；表面保持白色、不透明的外观。
- 帧 73（2.403 秒）恢复最终尺寸。

这些像素来自等比例解码后的图像，不是 DOM/CSS px。约 0.30 秒是**文件时间轴**上的跨度，录像是否变速尚未确认。录屏无法单独证明动画时钟重启、compositor 回退或主线程阻塞。录像页面计数为 setup=5、mount=85、unmount=85、dispose=4，最近关闭来源是 outside.press；之前仅使用新页面与 Escape 的自动路径不能代表这一历史。

比例与当前 `zoom-in-95` 起始操作数吻合，是排查线索，不是归因结论。Safari 仅有人工报告的掉帧，尚无同一回缩证据，继续单独看待。

## 权威与实现映射

- `D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001` S/T（draft）：K1 半尺寸位移、整体 geometry 与 surface paint 的同源协调。
- `D-WEB-COMPONENT-SHADOW-STYLE-0001` Q（draft）：有界 Dialog recipe，不扩大任意 keyframe/动画组合。
- `C-AS-TRANSITION-0001` D/G/H（draft）：mounted 后 entering、Core delay、旧完成失效。
- `A-WEB-COMPONENT-0001` 的一般 profile 为 active；不能据此把 draft K1 晋升为稳定保证。
- `packages/prototypes/shadcn/src/dialog/content.proto.ts` 定义 200ms 与 `animate-in fade-in-0 zoom-in-95`。
- `packages/cli/src/services/proto-style-css.ts` 将 host geometry 与 surface opacity 分解为不同 CSS Animation；已有同源时长/条件与 fill-mode。
- `internal/contracts/prototype-base/transition.v0.md` 是 Transition 的解释投影；没有子元素 animationend 提前完成 Dialog 的实现路径。

## 本轮实验

实际网站、独立 Chrome 152 窗口、742×1000 viewport、deviceScaleFactor=2；没有修改用户标签、浏览器设置或 Adapter/CSS 实现。

| 路径 | 数量 | 结果 |
| --- | --: | --- |
| 入场末段移入 Switch | 24 | 未检出展开后的回缩 |
| 入场末段按住 Switch 300ms 后松开 | 12 | 未检出回缩 |
| 同一实例反复打开、点击外侧关闭 | 100 | 未检出回缩；没有复刻录像中四次 terminal 重连的完整历史 |
| 不使用 screencast、改用 Performance 截图与动画轨迹 | 12 | 450 张轨迹截图未定位到同一回缩；Content enter 每轮只有一次启动记录 |
| animationstart 后约 140ms 人为阻塞主线程 300ms | 8 | 未产生同样的回缩；不能推导所有主线程负载都无关 |
| 动画结束后显式注入 95% transform 的正向对照 | 2 | 两次均检出；是人为注入，不是自然复现 |

Performance 轨迹出现约 20–77ms 的部分事件处理任务及约 70ms 的部分样式更新任务。采样/追踪本身有开销；这只说明存在可继续分析的性能成本，不能解释本次录像中的非单调缩放，也不能直接解释 Safari。

所有未复现结果都是有限路径的阴性观察，不是通过验收或证明问题不存在。

## 可重复诊断入口

新增 `scripts/analysis/shadow-s4-entry-browser.mjs`。它复用已启动的网站，在独立 Chrome 中校准一次固定浅色 S4 设置场景，然后：

1. 使用实际 screencast 像素检测“已经完整绘制后又缩小”，排除白色文档背景、普通渐入、关闭和不同 open epoch 的证据混用。
2. 正常逐帧期间不读计算样式或布局；记录受限长度的状态与 native animation 事件。
3. 发现候选时才读取当前 boundary/surface 动画时间、计算样式、几何和当前 open/phase。`observedAt` 明确表示这个读取晚于画面，不能当作异常帧的同时快照。
4. 保存最多 96 张前后画面及 JSON；无异常仅保存有界日志。单轮进程最长观察约 180 秒（不含初始化/收尾）。

```sh
# 浅色 split 的 12 次自动外侧关闭/重开路径；结果是 not-observed 或 candidate-captured
node scripts/analysis/shadow-s4-entry-browser.mjs

# 在新 Chrome 窗口手动开关弹窗、交互 Switch/Checkbox；Ctrl-C 收尾
S4_ENTRY_MANUAL=1 node scripts/analysis/shadow-s4-entry-browser.mjs

# 显式人工注入，用于验证捕获链路；报告标明 syntheticProbe=true
S4_ENTRY_PROBE=1 S4_ENTRY_ROUNDS=2 node scripts/analysis/shadow-s4-entry-browser.mjs

node --test scripts/analysis/shadow-s4-entry-detector.test.mjs
```

可用 `PROTO_UI_BROWSER_BASE_URL`、`PUI_CHROME_EXECUTABLE`、`S4_ENTRY_PROFILE`（light/split/mixed）、`S4_ENTRY_ROUNDS`（1–120）调整诊断；`S4_ENTRY_HEADLESS=1` 用于无头运行。合成 probe 仅适用于 split/mixed。

采样横带要求保持校准时的 viewport、浅色主题、Tab 与内容布局；不支持暗色、resize、任意 slot/内容变化或 terminal 重连。该工具捕获的是**候选异常**，不是通用动画正确性测试，也不保证覆盖显示器的所有扫描帧。它没有接入 CI 的随机通过门禁或新增 `T-*` 完整性声称。

## 当前结论与下一份关键证据

未确定自然回缩的 owning cause；不更改 token、动画时长、显式终点、will-change、生命周期或样式隔离边界来掩盖现象。下一份关键证据仍是自然回缩当次的像素、open/phase、动画事件与延后读取的动画时间，区分重复启动和画面回退。工具已支持在相同路径继续采集，不能用已完成的正常轨迹替代这份证据。
