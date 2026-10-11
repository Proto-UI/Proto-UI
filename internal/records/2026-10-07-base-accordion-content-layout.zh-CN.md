# Base Accordion demo 的跨 Runtime Content 布局

## 实际观察与边界

- 对照 [Finf PR #872](https://github.com/Proto-UI/Proto-UI/pull/872) 的 `cb8807672c2cdbb426cbc7cd99354b48953c68b3`、[native run 37604289235](https://github.com/Proto-UI/Proto-UI/actions/runs/37604289235) 原始 `base-{wc,react}-light-initial-open.png`。两图均为 1280px viewport、light、16px root font、相同默认展开项的实际 crop。
- WC 的 nested group 贴齐外层边界，React 有约 12px inset。原有 desktop activation assertions 通过，不能替代这项视觉比较。
- 四 Adapter 的真实 DemoSpec source fixture 进一步定位：WC open Content 为自定义元素，class 只有 `p-3`，同时带 `data-pui-style="data-[hidden]:hidden"`，但没有 `data-hidden`。`host-display.ts` 对 display utility 只取 variant 的末段，因而撤掉 `pui-host-root` fallback。React/Vue/Vue2 对同一节点使用默认 `div`，仍保持 block。
- 该观察定位到 Base demo 未明确声明 panel formatting context；不据此修改全部 Web Component、Text 或 styled family 的 display policy。`P-BASE-ACCORDION-CONTENT` 仍为 draft，其 presence、hidden 与 relationship 语义不变。显式 consumer surface layout 依照 `C-HOST-SURFACE-PROJECTION-0001-C/F` 与 `C-PROTOTYPE-STYLE-CLOSURE-0001-C/D`。

## 局部修复

`accordion-demo.shared.ts` 的 Base Content class 从 `p-3` 改为 `data-[open]:block p-3`。只在原型已经公开的 open 状态存在时指定 block；不新增 state owner，不改 children 或 presence，不通过固定高度或 overflow clipping 隐藏问题。

不能简单加入无条件 `block`：网站 utilities layer 位于 proto-ui layer 之后，会压过原型的 `data-[hidden]:hidden`，使 `keepMounted` 关闭内容可能仍可见。条件 display 避免覆盖关闭态，原型继续负责隐藏。其他四个 styled family 的原型视觉输入不变。

## 验证设计与结果

- `accordion-demo-layout.test.ts` 使用真实四 Adapter、真实 DemoSpec 与本地框架，仅替换 CDN acquisition。原始 source 下四条 display-input 回归预期失败；修复后五条通过。覆盖默认展开、nested 展开/关闭、retained A/B 切换与还原，以及非 Base family 不注入布局样式。它证明 source/DOM 输入与状态，不证明浏览器 cascade 或像素。
- `base-accordion-layout-parity.browser.test.ts` 为 1280px 与 390px 各新增一条 native journey。每条通过公开 Runtime 控件执行 WC → React → Vue → Vue2 → WC；配对初始、嵌套展开、外层关闭/重开、retained B-only 与还原。记录实际 geometry、computed display/padding/font、截图、source SHA/dirty、viewport 与 page errors，保持 1px 配对容差；断言关闭的 retained panel 仍存在且 display:none。
- 扩展 Base 原型、四 Adapter Accordion 与注册检查，共 7 文件 / 119 tests 通过；scoped TypeScript 与全仓 `check:types` 通过（531 docs files，0 errors，7 hints）。首次全仓检查因未设置临时 XDG 的 telemetry 配置路径失败，按既有环境约束重跑后通过。新增 native 文件静态收集到 2 tests，未启动浏览器。
- 本地 Chromium 已确认受 Unix socket 权限限制，未再次尝试或绕过。新增 native journey 尚未执行。最终发布 head 的官方 CI、四 Adapter 截图与几何复核仍是未完成条件。

## 独立发现：嵌套外层 teardown

扩展 source probe 执行 nested 开关后关闭/重开外层 overview，在 React/Vue/Vue2 各报 duplicate value/part 的未处理错误，合计 21 条。使用原始 `p-3` recipe 的对照同样复现，程序化更新和控件 `.click()` 两条路径均出现；不是本次 display class 导致。所有五条断言通过但有 unhandled errors 的那次运行明确不算绿测。

布局 source suite 限定上述已验证的 initial/nested/retained 范围，不吞掉错误。外层关闭/重开的新增 native journey 仍保留，并要求没有 pageerror，需由后续精确 head 验证和 owning Anatomy/Adapter 调查收口。此记录不宣称该 teardown 已修复，也不宣称原有 320px / 200% text 的 Base +763px、Shadcn +323px、Brutalist +295px overflow 已修复。
