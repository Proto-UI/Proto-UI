# S3：完整 Tabs 设置场景交付

日期：2026-09-13。状态：机器验证完成、可人工验收。阶段性交付记录，non-normative。人工验收仍待用户确认；不提升 draft，不宣称发布完成。

## 目标与实现节点

沿用 `2026-09-13-shadow-s3-approved-goal.zh-CN.md` 的完整 Tabs + S2 设置目标，以及用户对 J1 和同等规模后续决策的授权。

- `31453912`：I1 exact hidden/relative 职责、CLI 同源 host recipe、旧 artifact fail-closed。
- `a5d89d8a`：有界 nowrap flex 内在尺寸 recipe；不准入任意 CSS sizing。
- `3e85aa0b`：J1 同 provider generation/key 按提交顺序同步交付 Context 通知，当前值立即提交；错误、注册/注销和 owner generation 边界见批准记录与 draft entity。
- `bd255440`：WC descendant-first entry 随后代焦点就绪刷新 fallback，解决重显 Settings 时多出的面板 Tab 停靠点。
- 本交付节点：正式 demo-matrix 接入、共用原生浏览器路径、双语说明和 T 映射。

收口自检额外覆盖显式 `asFocusable()` 与 entry 的既有优先级：当显式 focus target 从 disabled 变为 enabled，或改成 programmatic-only 时，旧 entry observer 不得覆盖 tabindex。新增测试修复前失败、修复后通过；WC 在接收显式 focus-target 投射时停止旧 observer，不改变 Module 语义。

## 人工入口

`/zh-cn/internal/demo-matrix/#shadow-split-s3`；英文为 `/en/internal/demo-matrix/#shadow-split-s3`。

三列分别为 Light、完整 split 和 mixed。mixed 为 split Root/Trigger/Content + Light List；设置中 split Switch + Light Thumb、Light Checkbox + split Indicator、split Button 与 Light Badge。全部使用公开完整 Shadcn Tabs、Button/Switch/Checkbox 与 Brutalist Badge，不删 token、不替换简化原型。

推荐路径：

1. 默认模式下用方向键、Home/End、Tab、Shift+Tab，确认 disabled skip、Settings 首控件、Details 后代按钮和 Empty fallback。
2. 切换 manual/automatic、loop 和横/纵方向，检查焦点与选择的区别；vertical 只承诺本阶段键盘规则，不据此声称完整 upstream 纵向视觉等价。
3. 比较默认 L1 与 keepMounted 的 Content setup/mount/unmount/dispose。多次切换后，在 Settings 不显示时更新 checked、disabled、主题、tone 和 slot，再返回。
4. 同步移动应保留计数；终止移除并重连创建新实例，恢复消费者模型且不重复通知。状态保留属于 demo 的受控模型，不扩大为任意后代/native 状态保留。

## 同等规模的集成决策

英文标签在 320px 检测列中自然超宽。采用消费者自己的 `.s3-tabs-scroll` 原生横向滚动容器，包裹 List；不改变组件 intrinsic sizing、hidden、键盘或 canonical role。仍只撤销网站 reset 的 host padding/border 干扰，不加入组件尺寸补丁。这个 wrapper 不是 Proto UI 新能力。

页面测试等待整页各 Adapter preview 真正挂载完成后再开始 S3 键盘输入，与现有 matrix smoke 就绪边界一致。测试在独立 headless context 中执行，不导航用户的人工浏览器。AX 断言通过 CDP backend DOM identity 绑定 S3 面板，排除同页其他 Tabs 的干扰，同时验证每个 inactive 面板的实际 AX 排除。

一次中间矩阵运行在中文默认模式的 disabled → Tab 处失败，单独重跑未复现。最终测试将坐标点击前的 disabled/tabindex、滚动后实际命中面板、点击后的 disabled 都作为硬断言，目标滚动到 sticky header 下方；不以重试焦点或补写属性绕过断言。共享旅程在失败路径也通过 finally 释放 CDP session，避免一次断言失败污染浏览器关闭阶段。此处记录测试诊断边界，不将未复现现象归因为已证明的生产缺陷。

另一次并行检查时，S3 首项恰在 Astro 内容同步附近失败，先前已经累积的 valueChange 回到 0；S1 也有一次 mixed 断言失败并伴随关闭超时。最终暂停生成器和 Astro check，把三套浏览器测试放入同一个串行进程：13 项全部通过、没有关闭超时，S3 的意外导航检查也通过。后续复现应避免在 native journey 运行中重建/生成/检查网站产物；需要区分 dev 页面重新初始化与组件状态错误，不能把失败批次标为通过。

## 机器证据

环境：Node 22.23.2、pnpm 10.32.1、Chrome 152.0.7977.83。

- WC/Focus：最终 80 文件、333 测试通过（包含显式 focus target 优先级新增用例），命令见 `2026-09-13-shadow-s3-focus-entry-refresh.zh-CN.md`。
- Context reentrancy/contract、React/Vue/Vue2 的 Context 与 Tabs、Base/Shadcn Tabs：10 文件、38 测试通过。WC Context 已包含在前项。不是四框架原生浏览器 controlled Tabs 保证。
- `node scripts/analysis/shadow-s3-public-browser.mjs`：正式 dist + 实际 CLI companion，无 package src alias，Light/split/mixed × L1/keepMounted 全部通过。检查真实键盘/鼠标、AX/display/geometry、Thumb/glyph、disabled hit/Tab、slot 所有权、重复 view、组合更新、移动与重连单活 owner/view。
- `demo-shadow-split-s1.browser.test.ts` 5 项与 `demo-shadow-split-s2.browser.test.ts` 4 项通过。首次 S1 运行曾因并行 CLI 生成导致 dev 页面重载中断；生成结束后完整重跑 S1 通过，未放宽断言。
- 最终同一串行命令运行 S1/S2/S3：3 文件、13 测试全部通过（388.52 秒）；其中 S3 4 项为中英文 × 两种 view 策略，每项均覆盖 Light/split/mixed、320px 零溢出与无意外导航。关闭阶段正常。
- `node scripts/analysis/shadow-s3-controlled-audit.mjs`：最终 J1 原生回写 12 组组合通过。
- Spec graph/关系：7 文件、13 测试通过；prototype catalog、58 项 agent operations、workspace types 与 Astro 202 文件检查通过。

页面测试命令（复用已启动服务时使用环境变量，否则测试自行启动）：

```sh
PROTO_UI_BROWSER_BASE_URL=http://127.0.0.1:4321 corepack pnpm@10.32.1 exec vitest run apps/www/src/content/docs/zh-cn/demo-shadow-split-s3.browser.test.ts --pool=forks --no-file-parallelism
```

最终联合回归使用同一命令额外列出 `apps/www/src/content/docs/zh-cn/demo-shadow-split-s1.browser.test.ts` 和 `apps/www/src/content/docs/zh-cn/demo-shadow-split-s2.browser.test.ts`。运行期间不并行执行网站生成器或 Astro check。

## 保留边界

- 这是 Chrome 原生机器证据与人工入口，不是读屏器软件、其他浏览器或人工验收通过声明。
- 不扩展 Dialog/portal、任意 closed Shadow 树遍历、native text/image、动态 border-width、任意 overflow/CSS sizing 或 token 准入。
- Slot 仍归 Maker；整根隐藏覆盖 slot 可见性，不转移节点/文字样式所有权。
- J1 记录中无关暂存 `packages/modules/context/test/catalog-boundary.test.ts` 的 10 项 baseline 失败已用修复前 Center 复现，未改动；本轮不宣称全仓 `test` 通过。
- 无关暂存/未跟踪文件保留，仅本地提交本阶段路径；没有 push、merge、publish、release。
