# Sprint 6：共享主题、Header 与覆盖登记回归修复

本记录保留 PR #1712 第八候选的修复依据，不改变规范生命周期，也不声明完整 Sprint 6 验收完成。候选父提交为 `050a1ded7726773486fa56211aa1df7820d19919`；本地执行使用该 checkout 加下述明确源码字节，原日志、失败和输入补丁均存入 [回归档案](evidence/2026-11-22-sprint-6/shared-theme-regression/summary.json)。

## 实际失败与责任层

完整 CI `45030540222` 在 `7871a8da3967ae4bb29cd50c655860cf87d374c0` 暴露了本轮共享路径的问题。`createProjectionComposition` 的初始主题参数允许省略，内部为渲染器建立空的样式槽；此前只有非空槽才登记私有所有权，第一次合法主题更新因此抛出 missing renderer-owned theme state。修复在构造时登记已提供的私有槽，继续用 `undefined` 表示只继承主题的作者嵌套节点。

这项修复没有放行显式的空公共主题 `{}`，没有根据类名或作者 `--pui-*` 属性推断所有权。对象样式和字符串/对象混合样式都在同一槽上接收首次、重复更新；嵌套作者样式与原定义保持不变。原“未提供初始主题必须失败”的负控误把合法调用当作损坏，现改为实际移除或替换已登记槽的负控，仍要求拒绝并保留旧值。

Contents、命令图标、Copy 和 Typography 的四份测试 mock 还截断了新增的 `clearProjectionThemeSurfaceStyle` 导出。现在只覆盖原来的主题观察前提，并从实际模块保留其他接口；没有加入假的空清理函数，也没有删减原组件断言。

## Header 后续断言的区分

解除初始化错误后，原 Header 用例继续执行并留下五条失败。原失败、只读观测和补正后的运行分别保存，未用后来的成功覆盖前面的事实。

- Shadcn 四宿主已经完成 Escape 关闭和回焦。实际公共 `focused`、`focusVisible` 均为 true，当前触发器具有 `border-ring ring-3 ring-ring/50`，另一个触发器仍为 resting ghost。原最终断言错误地要求回焦触发器仍为 `border-transparent`。现在先检验公共焦点状态和家族焦点 paint，再通过真实 blur 检验原透明边框、owner 和 DOM identity 恢复。
- Brutalist/Vue 在两个 compact 状态都使用 elevated 外观；静态 token 没有变化，不能证明 equal-props 重投影已提交。实际旧输入位置的当前 owner readiness 为 false。测试沿用既有 Vue adapter 的真实 framework flush 顺序，随后要求当前 owner readiness 为 true，再发送原第一次 focus/Enter。原 open、Escape、回焦和 identity 断言保持；没有任意 sleep、revealing 标志等待或输入重试。

只读诊断保留 `3 pass / 5 fail`，补正诊断为 `8/8 pass`。最终提交用字节去除了两条诊断日志后，又在根树的十二套件组合中真实执行。

## 原断言下的实际验证

| 执行 | 结果 | 边界 |
| --- | --- | --- |
| 同一最终 regression test 对旧生产源码 | 2 failed、1 passed、64 未选 | 两条首次主题更新失败；显式空主题拒绝仍成功 |
| 修复后的 composition 文件 | 67/67 passed，0 pending | 保留作者样式、portal、所有权破坏等既有条件 |
| 最终根树十二套件 | 355/355 passed，0 pending | 包含 Header、Contents、Icons、Copy、Typography、动态子节点与 portal |
| `check:types` 首次本地执行 | exit 134 | 默认 Node 2 GiB 堆在样式生成阶段耗尽，未当作类型成功 |
| 串行 `check:types`，4 GiB 堆 | exit 0 | workspace 与 docs 均执行；docs 1,272 files、0 errors、0 warnings、32 hints |

单独执行 composition 时，HappyDOM 15.11.7 的原弱引用回调问题另使三个 observer 用例失败；原件保留。接入仓库已有的版本锁定 callback keeper，并保留真实 observe/disconnect、过滤和调度后，同一原断言全部通过。该 helper 的既有 GC 负控实际执行 `1/1 pass`。这属于测试环境前提修复，不计真实浏览器 observer 验收。

生产文件 SHA-256 为 `a75d279fb6a2a82dd1ec4fca6ae2a5003efff5475cf171847938d32f1c60cb40`；composition test 为 `6159521daad48801fecccf5d8c836765df8557d7ca6340cde823daa0c01d80ef`；Header test 为 `9ce07fb8ba59af69f801f20ef07a71b3106bde2929cf02b0ee1bb423ce5ceed6`。最终十二套件日志 SHA-256 为 `c84bfdba08e30ca08167f48ee8f670ff39358567b67b310303c892ba7caf3312`，完整类型日志为 `63a50d9406b074b8f340daa1cbbc7b0e790d3d127176425dd650f8df825cf8b2`。

## 覆盖登记与 CI owner

本次还整合 [精确覆盖登记修复](2026-11-22-sprint-6-coverage-source-bindings.md)：Liquid state-controls 明确登记为四宿主测试 facade，native-composition helper 归属测试观察；更新已审查的本轮源指纹。静态 React、复制入口、普通 shell 的负控继续拒绝，两个既有 diagnostic production reach 不获豁免。聚焦检查 `20/20 pass`；完整 source checker 仍 exit 1，保留 hover 的八条 import 和三条既有 source fingerprint 问题，不能写成全仓覆盖检查通过。

父提交 `050a1ded` 已将三条 Bootstrap 和一条 Liquid controls suite 从通用浏览器分片移至其专用 production owner，并接入 Bootstrap workflow call。原 WIP guard、unexpected-skip 拒绝和原生断言保持；本次候选的实际工作流调用及原生结果须按其自己的运行回读。

## 第七候选 DPR 的已执行结果

[frame run 45035686872](https://github.com/Proto-UI/Proto-UI/actions/runs/45035686872) 在 `050a1ded` 实际 success。其五条原选中 release case 全通过，另一个诊断 case 未选，不计成功。两主题 × 四宿主均取得 `1 → 2 → 1` 的实际位图 `466×172 → 932×344 → 466×172` 与逐次 source revision 递增；同 CDP owner 的两次截图前后事实完全相同，两次 metrics cleanup errors 为空。GPU 84 个字节对照、九步集成及旧 program-clear 负控仍执行。

这是包含真实 viewport 通知的 metrics transaction，不是物理显示迁移或纯 DPR 通知证明。本轮 listener p95 为静态 **17.100 ms**、动态 **67.370 ms**；event timestamp p95 为 **17.400 / 67.770 ms**。同次 `49fc3ac` baseline 的 listener p95 为 **16.805 / 45.685 ms**。软件 headless 环境仍未满足 10 ms，也不能据此宣称 120 Hz、input-to-photon 或普遍性能提升。先前第六候选的两个 DPR 失败保持原终态和来源。

## 条件回填与真实消费者

[实际写回记录](evidence/2026-11-22-sprint-6/issue-tracking-787.json) 保留七条原 Issue 与四条父项的十一项真实 connector write/readback。父项 fresh preflight 发现 Sprint 2 / PR #1716 的并发正文后，先完整保全并重新验证请求，再追加已审查的 Sprint 6 证据；#1323 在原七项回读完成后最后写入。没有关闭 Issue 或宣称合入。

真实应用消费者包括 Shenko 与 OpenGreendam/verdant。S4 原有真实 App/compiler 执行证据已在父追踪中保留；本轮没有重新执行或升级这两个 App。完整 Bootstrap/Liquid 家族、Apple 光学剩余条件、真实设备 120 Hz / 10 ms、物理 IME/AT、Compiler 与 GPUI/Qt/Flutter 各路线仍按原条件开放。上述回归恢复与 DPR 局部通过不替代这些验收。
