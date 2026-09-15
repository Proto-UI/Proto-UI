# S5：公共 Web 事件路由性能修复

本记录保存 S5 人工验收发现的性能问题、修复选择与本地证据，不是新的稳定保证。承接 `2026-09-14-shadow-s5-delivery-and-manual-acceptance.zh-CN.md`。用户授权把公共性能修复纳入当前 `codex/shadow-dom-style-role-record` 分支及 S5 进展，不另拆 PR。本节点没有 push、发布、draft 提升或修改独立 Dialog #645。

## 定位与范围

修复前基线为 `e844df6a`。Chrome 152.0.7977.83、Node 22.23.2、pnpm 10.32.1；页面为本地 `/zh-cn/internal/demo-matrix/#shadow-split-s5`。

完整页面中每类相关全局事件约有 1,185 个路由监听器；一次点击让大量无关实例反复解析 composed path，并为路径中的每个节点重新遍历祖先。文本编辑器通常没有 trigger owner，不能提前命中，嵌套 split 路径进一步放大成本。CPU 热点为公共 `web-event-router.ts` 的 ownership 查询及 `instance-tree.ts` 的 `resolveLogicalTriggerEventRouteForTarget`，不是焦点入口观察器或 surface CSS。点击窗口内样式重算约 0.7–1.5ms，未产生 layout。

基线六条路径（独立 Shadcn Textarea / Tabs editor × Light / split / mixed）出现 167–300ms 的帧间隔；有窗口、关闭 CPU profiler 后仍为约 167–283ms。独立 public-dist S5 场景约 17ms；完整页面仅调用原生 `focus()`、不经过鼠标事件时，六条路径均未超过 25ms。临时移除全局 pointer/click fallback 也能消除主要停顿，但会破坏 Portal 投递，因此只作为定位实验，未进入修复。

问题属于公共 Web Adapter 路由，非 Shadow split 独有。React、Vue、Vue 2、WC 都接入同一实现；不据此宣称每种浏览器、每个下游页面均已复现。监听器数量本身也不证明资源泄漏。

## 修复选择

语义边界沿用 `M-EVENT-0001`、`HC-EVENT-BINDING-0001` 及相关 `C-EVENT-*`：registration identity、root/global scope、route ownership、重绑定与 cleanup 不变。未增加 prototype author API、修改 Shadow 参数或新增规范性的帧预算。

1. **一次同步查询内复用已访问祖先。** 同一 composed path 的重复无命中后缀不再反复遍历；Set 不跨查询或事件保留，不需要缓存失效协议。
2. **按实际 semantic 订阅跳过无意义的 fallback 解析。** 保留原生监听顺序、Portal fallback 和 global delivery；不合并 registration。记录精确移除、capture、once、AbortSignal 与 dispose，options 在绑定时取快照。`pointerdown` 保留 press follow-up 状态清理需要。
3. **官方 instance tree 提供即时候选过滤。** 检查物理事件路径和偏离路径的逻辑父链能否到达当前 root。过滤只作排除，不授予投递；命中后仍由原有完整 resolver 决定接受或拒绝。支持 slot 路径、Portal 逻辑链接、activeElement fallback，所有查询实时读取当前映射。

没有跨事件缓存、合并全局原生 listener、停止事件传播或页面样式补丁。全局 native listener 的固定数量仍在；本次减少其昂贵工作，不声称完成全部大规模分发架构优化。

主要实现：

- `packages/adapters/base/src/events/web-event-router.ts`
- `packages/adapters/base/src/platform/instance-tree.ts`
- 四个官方 Web Adapter 的 `src/adapt.ts` 与 `src/platform/instance-tree.ts` 接线

## 可执行证据

新增 `packages/adapters/base/test/event-router-work.test.ts` 共 11 项测试。修复前深路径的祖先读取为 58,735 次，超过线性预算；修复后通过。另一个先失败后通过的断言是：没有相应订阅的全局事件不应进行完整 resolver 查询。还覆盖候选过滤、精确移除、once/abort、options 快照、重复 callback/capture、dispose、Portal 改挂、同一 Event 重派发、slot、superseded trigger surface 与 owner 重绑定。

| 检查 | 本次结果 |
| --- | --- |
| 五个 Adapter 包测试，排除原有暂存 Context integration / catalog-conformance 文件 | 207 文件 / 677 项通过 |
| 首次更大范围测试 | 678 通过、1 失败；见下方基线说明 |
| 公共包构建 | 43/43 通过；options 快照调整后 base 依赖闭包 34/43 再构建通过 |
| `check:types` | 209 Astro 文件 0 error / warning / hint；最后调整后 workspace types 再通过 |
| public-dist / CLI S5 journey | 通过，覆盖编辑、selection、composition 协议、AX、尺寸、focus、Tabs 和重连 |
| 正式 S1–S5 与 demo-matrix 浏览器集合 | 7 文件 / 22 路径通过，523.76 秒；包含 S4 关闭后绘制检查及四 Adapter Dialog focus smoke |

原有暂存的 `packages/adapters/vue2/test/catalog-conformance.test.ts:89` 在 keep-alive 后 Expose method identity 断言失败。通过只读 Vite loader，将本次修改的 10 个实现文件全部替换为 HEAD 原文运行同一测试，仍在同一断言失败。没有修改这项无关测试或其实现；最终排除项明确列出，不声称全仓测试全绿。

类型检查首次与 build 同时运行时遇到生成的 dist declarations 正在替换而缺失；build 完成后串行重跑通过。性能脚本首次等待页面 `load` 超时、未产生采样；已改为 DOMContentLoaded + 全部 previewer 实际挂载就绪，不把外部资源加载完成作为采样起点。最终浏览器验证期间冻结源码和生成产物。

## 性能复测与开发环境因素

正式采样脚本：`scripts/analysis/shadow-s5-performance-browser.mjs`。它使用真实 Chrome 点击和键盘输入，记录 rAF 间隔与 CDP Script / Style / Layout 时间；默认只报告实测，不用机器相关阈值冒充跨平台保证。默认保留 Astro 开发工具栏及审计。

三轮共 18 次点击：各路径最长帧间隔为 **24.9–41.7ms**，其中位值 **25.1ms**；对应 ScriptDuration 中位值约 **19.7ms**。相比基线 167–300ms 的重停顿有明显改善，但不是稳定 60/120fps 的保证。上述为本机小样本，不是 GPU presentation telemetry，也不是发布产物性能基准。

扩展输入测试发现孤立的 107.7ms 峰值；补采 CPU 时 Light Tabs 输入也出现过 229.8ms 峰值。热点集中在 **Astro dev-toolbar 的 a11y audit `lint` / rules / querySelectorAll**。该工具观察 document body 的 childList/subtree；S5 valueChange 更新统计 output 的 textContent 后，会触发延迟整页审计。

仅在一次性浏览器窗口中拦截 Astro audit module、让其 init 不执行，保持 Proto UI 源码、页面 DOM/CSS 和用户设置不变，再做三轮：18 次输入采样的最长帧间隔均不超过 **16.8ms**；点击为约 **24.5–33.3ms**。该 A/B 与 CPU 证据支持将额外输入峰值归为开发审计开销。此隔离不是正式修复；没有关闭仓库审计配置、改用户设置或将它默认关闭在正式采样脚本中。

本地原始样本（临时产物，不进入 Git）：

- 默认审计三轮：`/var/folders/p8/rflqkv857nz2vfl44035731w0000gn/T/pui-s5-performance-C0QcoE/report.json`
- 输入 CPU 补采：`/tmp/s5-final-typing.cpuprofile`
- 一次性无审计对照：`/var/folders/p8/rflqkv857nz2vfl44035731w0000gn/T/pui-s5-performance-GVGBnF/report.json`

## 复跑与人工检查

```sh
PUI_PERF_HEADED=1 node scripts/analysis/shadow-s5-performance-browser.mjs
node scripts/analysis/shadow-s5-public-browser.mjs
corepack pnpm@10.32.1 exec vitest run packages/adapters/base/test/event-router-work.test.ts
```

人工入口仍为 `#shadow-split-s5`。刷新页面后，比较三列独立编辑器与 Tabs 内编辑器的点击、焦点环、连续输入；再检查 Tabs 切换和移除重连。当前是修复后人工复验就绪，不替用户宣告验收完成。所有 split / Text Control draft 边界、真实系统 IME 人工验收及独立 #645 范围保持不变。
