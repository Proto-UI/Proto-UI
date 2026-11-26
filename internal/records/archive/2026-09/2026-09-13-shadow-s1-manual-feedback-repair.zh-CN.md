# S1 人工反馈修复与浏览器路径回归

日期：2026-09-13。状态：bounded repair / evidence，non-normative。

承接 `2026-09-13-shadow-s1-delivery-and-manual-acceptance.zh-CN.md`。用户人工验收指出 split-only dark、slot 文本受干扰，以及两列 Badge 红色无法实时切回黄色；随后明确批准一轮修复。保留 draft，不扩大 Adapter API 或隔离保证。

## 分类与修复

- split-only dark 是页面显式只向 split 传入独立 `colorSchemeSource` 的预期结果，受 `D-WEB-COMPONENT-SHADOW-STYLE-0001-E` 约束。按钮现标明“仅 split”，主题变量按钮标明“两列”。
- Badge 的 span 属于消费者 Light DOM；slot 投影不改变节点归属。Document selector 仍能使两列文本变红，split 内部 surface 背景仍被隔离。`D-WEB-COMPONENT-SHADOW-PROFILE-0001-H` 保持原边界，页面现在明确说明预期差异。
- demo 的 tone 列表误用 `default`，而 `P-BRUTALIST-BADGE-TONES` 规定 `accent | info | danger`。依据 active `C-PROPS-0009-D/E/H`，无效值正确回退到 previous valid `danger`；fresh generation 没有 previous valid 才采用默认 `accent`。修复仅将 demo 改为 `accent`，增加导出类型 `BrutalistBadgeTone` 的 `satisfies` 约束；未改 Props、原型或 Adapter。tone 按钮显示当前值，不再用二态 `aria-pressed` 表达三态循环。

前一轮“22 个阶段通过”仍是当时脚本的实际结果，但不足以证明 tone 语义正确：两列共同保留红色也满足 parity-only 断言。本轮明确补上独立的实际颜色预期，不把旧记录的通过结论当作完整语义验收。

## 可重放覆盖

新增 `apps/www/src/content/docs/zh-cn/demo-shadow-split-s1.browser.test.ts`，使用已有 `browser-harness.ts`，自动进入现有 Vitest discovery。全部从真实页面控件和原生浏览器输入推进，不以内部状态写入代替交互。

1. 中、英文页面各执行两轮 `accent → info → danger → accent`；检查实际 RGB、前景、host/surface 尺寸、generation 与按钮当前值。
2. 主题变量 × split 明暗 × checked/mixed 四种组合 × disabled，共 32 种状态；检查实际填色、继承前景、唯一 glyph、16px Root / 14px Indicator、通知数与逐实例 scheme。颜色常量来自 S1 fixture，token 映射来自各原型实体，不作为设计语言的固定 RGB 保证。
3. 四种样式 escape 分别与 tone/主题/slot 更新组合，检查覆盖及撤销后采用最新原型值；slot 文本归属与红色干扰单独断言。
4. tone/主题/dark/mixed/disabled/受限布局/长 slot 组合后同步移动；移除期间继续更新，再连接后检查 fresh generation、实际颜色和原生 Space/Enter、一次通知、320px 布局。

此处是有界、确定性的路径覆盖，不宣称所有排列组合穷尽或随机 fuzz 已完成。原 `scripts/analysis/shadow-split-public-browser.mjs` 也增加 tone 的实际颜色断言，保留其其它交互、reset 与 first-frame 检测职责。T-BRUTALIST-BADGE-0001 与 T-WEB-COMPONENT-SHADOW-PROFILE-0001 仅映射新增证据确实证明的 tone/customization cases。

执行命令：

```sh
PROTO_UI_BROWSER_BASE_URL=http://127.0.0.1:4321 corepack pnpm@10.32.1 exec vitest run apps/www/src/content/docs/zh-cn/demo-shadow-split-s1.browser.test.ts
node scripts/analysis/shadow-split-public-browser.mjs
```

未提供 `PROTO_UI_BROWSER_BASE_URL` 时，测试会启动并清理自己的 dev server；Chrome/Chromium 可通过 `CHROME_PATH` 指定。测试使用独立 browser context，不操作用户现有验收页的状态。

## 验证

环境：Node 22.23.2、pnpm 10.32.1、Chrome 152.0.7977.83。

- 修复前独立 Chrome 复现两列黄→蓝→红→红、重连后黄。另在独立浏览器会话拦截 demo 模块响应，仅把 tone 列表改回旧 `default`；增强后的 public browser script 在第三次点击准确断言失败：actual `rgb(255, 147, 127)` / expected `rgb(255, 216, 61)`。该负向回放没有更改仓库源码或用户页面。
- 新 S1 套件与原 `demo-matrix.browser.test.ts` 联合运行 9/9 passing；最终测试类型修正后另重跑 S1 5/5 passing。既有 matrix 验证包含所有 Adapter mount、320/390px 与 Base Dialog focus。
- `node scripts/analysis/shadow-split-public-browser.mjs`：22 个阶段及实际 tone 断言通过，first-frame Root host/surface 均 16×16。
- `vitest run packages/prototypes/brutalist/test/badge.test.ts packages/adapters/web-component/test/shadow-split-profile.test.ts packages/spec/graph/test/catalog-evidence-integrity.test.ts`：Badge 4 项、public profile 15 项通过；spec 首轮因新增测试尚未加入 Git 索引而报 evidence path 缺失，纳入本轮提交范围后单独重跑 3/3 passing。
- `check:types:workspace` 通过；`apps-www exec astro check` 最终 196 files，0 errors/warnings/hints。首轮发现测试中 `ElementHandle<Node>` 访问 `shadowRoot` 的类型错误，增加 `HTMLElement` narrowing 后通过，无产品代码类型错误。
- `workspace:generate`、`spec:docs:agent`、`check:agent-doc`、`check:prototype-catalog`、`check:agent-operations` 通过，后者 58 tests。生成投影不提交。

未重跑全仓 release-oriented `test`、公共包构建、dist consumer smoke 或静态网站 production build：本轮未修改 package/runtime/Adapter 实现或编译产物。未覆盖其它浏览器引擎、screen reader、随机 fuzz 或全部控件排列。此前记录的 Vue2 广域失败不在本轮检查范围内，不据此宣称已修复。

未授权 push/merge/publish/release；保持原分支及不相关 staged/untracked 文件。人工入口仍为 `http://127.0.0.1:4321/zh-cn/internal/demo-matrix/#shadow-split-s1`。
