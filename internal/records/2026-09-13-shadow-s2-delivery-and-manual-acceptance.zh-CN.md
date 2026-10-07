# S2：组合交付与人工验收入口

日期：2026-09-13。状态：implemented / machine-verified / ready for manual acceptance，non-normative。尚未获得用户对 S2 的人工验收确认。

承接 `2026-09-13-shadow-s2-approved-goal.zh-CN.md`、`2026-09-13-shadow-s2-h1-approved.zh-CN.md` 和 `2026-09-13-shadow-s2-h1-motion-evidence.zh-CN.md`。H1 已分节点提交：`bb2be7c2`（Core domain 与决策）、`cbe9e4d9`（CLI/WC 动态 recipe 与 native slot continuity）。本节点补齐 S2 设置区、组合浏览器证据和独立消费者验证，不回写旧记录中的历史状态。

## 目标对照

| 批准目标 | 交付与证据 |
| --- | --- |
| 完整 Button 视觉 API 与输入 | 真实 Shadcn Button，六种 variant、四种 size、两种主题；每个 locale 48 个组合，比较三列并独立核对主题 recipe 颜色。真实 pointer hold/release、Tab、Space、Enter、focus ring 与 disabled 通知门控。 |
| Switch Root + Thumb 动态几何 | H1 公共 dist 逐帧脚本比较 204 个样本，覆盖 18px 百分比行程、父缩放、反向和固定边框尺寸变化。设置区另检查原生按住的 0.98 缩放、受控 checked 和快速切换终点。 |
| 实际设置组合与生命周期 | Button、Switch、Checkbox、Badge 组成 Light/split/mixed 三列；混合列包含 split Switch + Light Thumb、Light Checkbox + split Indicator。动态 props、主题、slot、同步 move、不连接期间更新、重连后 Context/glyph/通知均检查。同步 move 保持 generation=1，重连所有六个原型变为 generation=2。 |
| 公共包与 CLI 独立消费 | `scripts/analysis/shadow-s2-public-consumer.mjs` 在无 Astro/Vite、无网站 reset 的空文档中运行同一消费者组合。Bundler 输入验证真实 dist exports、生成 companion 和无 package source alias；验证尺寸、输入、Thumb/glyph、移动与清理/重连。 |
| 精确证据与人工入口 | 新增 `T-WEB-COMPONENT-SHADOW-S2-0001`，分别映射视觉、输入、组合与 public consumer；H1 中间帧仍归 `T-FEEDBACK-STYLE-ROLE-RESOLUTION-0001`。中英 demo-matrix 文档与检测清单同步。 |

## 人工入口与操作

开发服务：`http://127.0.0.1:4321/zh-cn/internal/demo-matrix/#shadow-split-s2`。

页面源：`apps/www/src/components/PrototypePreviewer/ShadowSplitS2.astro` 与 `apps/www/src/components/PrototypePreviewer/shadow-split-s2.ts`。只用正式 Adapter、完整原型与正式 CLI companion，不模拟组件事件或动画。消费者通过 `checkedChange` 回写受控 props；Button 计数只统计 Adapter 的 CustomEvent outward signal，避免将同名 native click 再计一次。

1. 循环 variant/size，包括图标与文字；按住 Button/Switch，检查位移/缩放，Tab/Space/Enter 检查真实焦点与通知。
2. 切换主题、checked、disabled；快速反向观察 Thumb，不应重复施加 transform。S2 主题开关改变整页 document，所有列共享；不同于 S1 的 split-only scheme 控件。
3. 替换 slot，执行同步 move，再移除并重连。受控值保留，通知不重复；generation 区分 move 与真正的 owner 重建。
4. 可继续使用 S1 检测 CSS escape 与 Maker slot 边界；S2 不新增 slot 隔离承诺。

## 验证命令与实际结果

环境：Node 22.23.2、pnpm 10.32.1、macOS Chrome 152.0.7977.83。本次为当前工作区验证，保留原有非本任务 staged/untracked 工作；没有独立审阅、部署或发布证据。

```sh
PROTO_UI_BROWSER_BASE_URL=http://127.0.0.1:4321 corepack pnpm@10.32.1 exec vitest run apps/www/src/content/docs/zh-cn/demo-shadow-split-s2.browser.test.ts apps/www/src/content/docs/zh-cn/demo-shadow-split-s1.browser.test.ts --pool=forks --no-file-parallelism
node scripts/analysis/shadow-s2-public-consumer.mjs
corepack pnpm@10.32.1 exec vitest run packages/spec
corepack pnpm@10.32.1 check:prototype-catalog
corepack pnpm@10.32.1 spec:docs:agent
corepack pnpm@10.32.1 check:agent-doc
corepack pnpm@10.32.1 check:agent-operations
corepack pnpm@10.32.1 check:types:workspace
corepack pnpm@10.32.1 --filter apps-www exec astro check
corepack pnpm@10.32.1 --filter apps-www build
```

- 联合浏览器：2 suites / 9 tests，通过，退出码 0（136.96s）。S1 的 tone/主题/escape/重连回归保留；S2 检查两个 locale、三种组合、精确尺寸/颜色/通知、native focus/hit 与 320px 检测区无溢出。桌面检测区截图另行核对。
- 独立 public consumer：通过，公开 dist 与 CLI companion、无 source alias、无网站 reset；输入与清理/重连通过。
- Spec：61 项；agent operations：58 项；prototype catalog、生成快照与 agent-doc 校验通过。生成的 Agent 理解文件不提交。
- Workspace types 通过；Astro check 199 文件，0 errors/warnings/hints；网站构建成功（238 页）。构建仍报告字体路径、部分 Pagefind 页面结构及 npm 环境提示；不把构建成功解释为这些无关告警已经修复。
- 前一 H1 节点的 633 项聚焦测试、public admission 和 204 帧 motion 已记录在前述 evidence record；本组合节点没有修改 Core/CLI/WC 的实现。未运行根目录完整 `test`、release/publish 流程或全浏览器矩阵。

验证过程中的失败保留：首轮在编辑测试文件及运行 Astro 类型生成时，开发页出现 transient 缺失节点/计数失败；冻结页面后复测通过，不能据此断言根因已经确定。随后默认 Vitest threads 的联合与串行运行均为 9 个用例断言通过、但 Chrome shutdown hook 超时 60s，整轮退出码 1；未改断言、未放宽超时。`--pool=forks --no-file-parallelism` 完整复跑成功，文档采用该命令。不修改全仓库 runner，不声明 threads 下的关闭问题已修复。

## 保留的边界与下一步

- 不新增 author role 前缀、slot API 或 Adapter 包；沿用公开 object split profile，boolean profiles 不变，draft 不升级。
- H1 仅放行批准的精确 Root geometry / hit-testing token；`pointer-events-none` 不归 placement，surface 不重复执行 Root transform。
- 当前完整 Button/Switch 使用固定边框。动态 border-width 过渡仍明确拒绝，其他 unresolved families、任意 raw CSS sizing、native text/image、portal/Tabs-hidden 不在支持范围。
- 网站只撤销同层 split host 的 padding/border reset；没有页面专属尺寸数值补丁。Maker slot 仍在 Light DOM，显式外部样式可以作用于它；不搬移/克隆消费者内容。
- 已达到批准的 S2 人工验收检查点，暂无需要新增语义决定的实现卡点。下一步由用户验证交互与主观观感；不把自动化通过当作人工签收，也不自动扩大到 S3。
- 仅本地分节点提交；不 push、merge、publish 或 release。
