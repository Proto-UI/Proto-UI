# S4 交付：完整 Dialog 承载 Tabs 设置

日期：2026-09-14。状态：自动验证通过、待用户人工验收，non-normative；split 仍为 draft。

## 目标与交付

已完成 `2026-09-14-shadow-s4-approved-goal.zh-CN.md` 的阶段目标及后续 K1/同规模决策授权。固定入口为 `/zh-cn/internal/demo-matrix/#shadow-split-s4`（英文同一路径前缀 `/en`）。本机既有 `http://127.0.0.1:4321` 服务已验证可访问，最终浏览器测试也复用了该地址；未发布或推送。

- 完整官方 Shadcn Dialog 的 Root、Trigger、Mask、Content、Title、Description、Close、CloseIcon、Header、Footer，承载 S3 的 Tabs、Button、Switch、Checkbox、Badge。
- Light、split、mixed 三种配置；mixed Dialog 的 Header/Footer/Title 为 Light，其余 split，设置内部复用 S3 mixed 组合。
- 只为 S3 demo 增加可选单 profile/compact 布局，默认 S3 保持原行为。全部实例来自公开 package exports 与真实 CLI companion；页面只拥有消费者状态、组合和布局，不模拟焦点陷阱、dismissal、隐藏或组件尺寸。
- Maker 同步接受/拒绝关闭请求；设置模型跨关闭/重开和 Root 移除/重连恢复。重连明确以关闭状态接入，不承诺任意后代实例或原生状态自动保留。

## 实施与修复节点

1. `8626c007`：批准 K1 与 S4 授权记录。
2. `9593fc82`：K1 精确负半尺寸 root geometry 和同源 fade/zoom 投射，缺失 recipe 的旧 companion 明确拒绝。
3. `bf3e418f`：Escape 同步 owner 回写后不再使用旧 Context snapshot 重新打开 Content。
4. `35804271`：来源树真正断开后撤回 portal 投射，由正常 CE owner lifecycle 清理；同步移动保留 generation。
5. `34000616`：Focus 顺序遍历尊重 navParticipation；S4-L1 可选内部 host sample 保留真实 Tabs/native/empty-panel 入口，Focus 保留 scope 策略；Mask 防止默认聚焦覆盖 Trigger restore。
6. `a9c9bf16`：S3 J1 fixture 校验按自身 `consumesCases` 对齐，独立重入证据不被误算为 fixture 缺失；不改 Context 行为。
7. 本交付节点：S4 scene、双语说明、共享原生 journey、精确 T 映射和本记录。

## 验证结果

环境：Node 22.23.2、pnpm 10.32.1、Chrome 152.0.7977.83，macOS。所有下列最终执行退出码为 0；测试数量有交集，不相加作全仓总数。

- `node scripts/analysis/shadow-s4-public-browser.mjs`：公开 dist / CLI、无 package source aliases；三种 profile 各 15 个 open 请求。实际 AX role/name/description 与关闭排除、entry、双向循环、Details 原生按钮、Empty fallback、disabled 排除、四种关闭入口的接受/拒绝、实际主题/tone/slot、consumer model、同步移动、移除/重连、无重复通知与 480px 几何。
- `node scripts/analysis/shadow-s4-admission-browser.mjs`：42 个自然动画中间帧；enter/leave/reverse、整体几何与 surface 对齐、scale/opacity/clock、真实命中、resize 与换行。Portal 之前/期间/之后的局部→document→局部主题边界。
- `node scripts/analysis/shadow-s4-portal-browser.mjs`：Light/split/mixed 和旧 Content companion 拒绝共四条路径；十个 part 的终止/重建、Shadow 资源、滚动锁与显式关闭清理。
- `corepack pnpm@10.32.1 exec tsx scripts/analysis/shadow-s2-motion-browser.mjs`：204 帧 H1 motion 回归。直接用 `node` 运行该历史 TS-source runner 会因 `.js` 源映射导入失败；使用其要求的 TS loader 后完整通过，不是产品运行时失败。
- `corepack pnpm@10.32.1 exec vitest run apps/www/src/content/docs/zh-cn/demo-shadow-split-s1.browser.test.ts apps/www/src/content/docs/zh-cn/demo-shadow-split-s2.browser.test.ts apps/www/src/content/docs/zh-cn/demo-shadow-split-s3.browser.test.ts --pool=forks --no-file-parallelism`：13 项全部通过，S3 包括两种 keepMounted 与中英文。
- `PROTO_UI_BROWSER_BASE_URL=http://127.0.0.1:4321 corepack pnpm@10.32.1 exec vitest run apps/www/src/content/docs/zh-cn/demo-shadow-split-s4.browser.test.ts apps/www/src/content/docs/zh-cn/demo-matrix.browser.test.ts --pool=forks --no-file-parallelism`：6 项全部通过，含中英文 S4、全矩阵挂载、320/390px 与四 Adapter Base Dialog focus。
- WC 全套 + Focus module/Runtime + Base Dialog + catalog evidence integrity：86 文件、366 项通过；React/Vue/Vue2 focus、Base Tabs、Shadcn Dialog 另 24 项通过。
- `corepack pnpm@10.32.1 exec vitest run packages/spec`：22 文件、61 项全部通过，包含已修复的 J1 fixture 校验。
- `check:prototype-catalog`、`workspace:generate`、`spec:docs:agent`、`check:agent-doc`、`check:agent-operations`、`check:types` 与 `git diff --check` 通过；Astro 205 文件无 error/warning/hint。生成物由 generator 更新，未提交忽略的 workspace/Agent/CLI 投影。

精确证据归入 `T-FEEDBACK-STYLE-ROLE-RESOLUTION-0001`、`T-AS-OVERLAY-0001`、`T-BASE-DIALOG-CONTENT-0001`、`T-BASE-DIALOG-MASK-0001`、`T-FOCUS-0001` 与 `T-FOCUS-SCOPE-0001`。未运行完整根级 `pnpm test`，未宣称全库每一测试或全浏览器均通过。

## 人工主路径

1. 分别用鼠标/键盘打开三个 profile；观察遮罩、整体淡入缩放、居中、窗口缩窄与文字换行。
2. Tab/Shift+Tab 应留在弹窗并循环；Tabs 方向键跳过禁用页，Details 和 Empty 的入口均可到达。
3. 修改设置，切换主题、tone、slot、disabled；关闭再打开，检查最新绘制和值。
4. 分别使用 Escape、Close、右上角图标、遮罩关闭；关闭后焦点回到 Trigger。勾选“拒绝关闭请求”时只增加请求，取消勾选后恢复关闭。
5. 打开时同步移动 Root，计数不应重建；移除 Root 应清除弹窗、遮罩与滚动锁，再从原卡片重连并重新打开，通知不重复。

## 不变边界

只覆盖同一 document、默认 body portal、单层普通 modal、open Shadow。Portal 采用物理目的地主题，不传输来源祖先变量；slot 归 Maker。S4-L1 是本阶段决策代号，不改变既有 L1 view lifetime 语义。任意外部 DOM `focus()` 不被该顺序导航机制拦截。

不新增作者 role/slot API、不拆出新 Adapter、不提升 lifecycle；不承诺嵌套/Alert 专项、closed/cross-document、任意 portal target、任意 CSS/transform/keyframes、native-control 原型准入或完整 upstream parity。用户尚未对 S4 作人工确认。工作区无关 staged/unstaged/untracked 变更全部保留。
