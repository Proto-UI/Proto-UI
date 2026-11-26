# Sprint 2 / #1096：Bootstrap 高度运动的四宿主最终观察

执行者：OpenAI Codex。2026-11-24（北京时间）。

## 结果与版本

原生 Chromium 四 Web 的 Collapsible / Accordion 原 40 条完整旅程本次为 **40 pass / 0 fail，exit 0**。实际运行于 parent 3d64911f980957ab78bfb616cdd5b523b5f4482c 加唯一 fixture 修改；fixture SHA-256 为 f061d42f58be9c0118cbf8c3e145d7deb08af6376ca325e2a0caeb1e71f6dd02。日志保留 dirty source 事实，不能改称测试发生在后来的提交上。

执行窗口为 2026-11-23 23:45:57–23:47:46 UTC。Node 24.22.3、Chromium 145.0.7632.6，真实浏览器 sandbox 启用；960 × 720、light、en。每个 WC / React / Vue / Vue2 宿主分别接受两个实际 authored Bootstrap 组件，各五条旅程；页面错误为零。运行前后全部 guarded source 和实际 bundle 输入哈希相同。

## 修复原因与独立对照

旧 fixture 为读取 hidden / open / transitionState 调用 DemoRuntimeApi.call。该 API 对 React / Vue / Vue2 的命令执行后请求宿主 update，导致每次动画帧观察额外触发三次更新。本次只把 fixture 改为从同一个公开 getExposes 对象读取同一公开 State getter；产品的 DemoRuntimeApi.call 及交互写入路径不变。

独立原生浏览器对照在每个实际宿主执行五次新观察和五次旧三-getter调用。临时计数器转发真实 public instance.update 并恢复原 descriptor，不替换 Runtime、State、几何或时钟。四宿主读值、owner 与 body 身份一致；清理后 child 数为零，页面错误为零。

| 宿主  | 新观察额外 update | 旧观察额外 update |
| ----- | ----------------: | ----------------: |
| WC    |                 0 |                 0 |
| React |                 0 |                15 |
| Vue   |                 0 |                15 |
| Vue2  |                 0 |                15 |

本次完整 40 条继续使用原 350ms 动画、520ms 观察窗、1,000ms guard、至少三个真实中间帧、同 owner / body 身份，以及关闭零高度必须先于退休的原生 endpoint oracle。没有放宽断言或延长交互超时。

## 历史失败保留

6b6462 原整轮为 39 pass / 1 fail，React Collapsible 的 cold-open-retained-close 缺少足够的中间帧；该红色记录和完整帧序列保留。首次对照脚本在 esbuild 缺少 CSS 输出路径时失败于浏览器启动之前；失败日志及原脚本也保留。第二版只修正对照脚本的 bundle 输出路径，取得 4/4 对照，再执行原 40 条完整旅程。

本轮不是对过去失败结果的重标记，也不是将单项重试相加作为一棵树的完整通过。此前 Runtime 产品修复、零高度 oracle 及五个破坏变体的接受继续引用各自原始来源。

## 可读取原件

[逐文件清单](./evidence/2026-11-24-sprint2-bootstrap-observer/manifest.json)、[结果摘要](./evidence/2026-11-24-sprint2-bootstrap-observer/summary.json)及[全部本轮原始输入、输出、日志、原图](./evidence/2026-11-24-sprint2-bootstrap-observer/execution.tar.xz)随本提交保存。

归档包括旧 39/40、首次对照工具失败、实际 4/4 对照、新 40/40、各自完整输出与八张本轮原图、原始和候选 fixture、未修改的 driver / endpoint oracle、执行 wrapper 和 spec。每个成员均从 archive 解压读回并匹配 SHA-256。归档 SHA-256：3dc0e565f3c8d1a4f1fc79cb3e9a62b0c46dfb5265fddb51949879e3d4c96cca；2281188 bytes；56 个原始成员加一份内嵌清单。

## 原 Issue 边界

这份证据接受 Bootstrap 两个披露组件在所列四宿主、状态旅程与环境中的高度运动、反转、受控更新和清理。未选实验家族、其他主题 / viewport / zoom、平台 IME、真实辅助技术、物理触摸 / 笔、Compiler / 非 Web 目标仍按各自原条款接受。该 40/40 不是 #1096 全部条件或整个 Sprint 2 的关闭结论。
