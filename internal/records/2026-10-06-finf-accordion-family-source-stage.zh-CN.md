# Finf Accordion family：独立协议与 source-stage 交接

- 关联：[#872](https://github.com/Proto-UI/Proto-UI/pull/872)
- 独立 topic：`feat/finf-accordion-family`
- Frozen base：`15d864de54210c2eebc4f4b2fec6235324989989`
- 工作日期：2026-10-06；精确 candidate tree、提交身份及集成 head 由交接 receipt 绑定，本文不自证其自身 tree。
- 此记录是工程证据与未完成项，不是规范、发布、稳定准入或九维验收决定。

## 有限协议与复用边界

本批新增 Base Root / Item / Heading / Trigger / Content 五原子，以及 Shadcn、Brutalist、Bootstrap 2.3.2、LiquidGlass 各五个 Base-consuming 投影。

Root 公开 JSON Props 为 `mode`、`openItems`、`defaultOpenItems`、`allowEmpty`、`disabled`、`orientation`、`direction`、`loop`。Item 的 `value` 必填、稳定、非空；Heading 的 `level` 为 1..6；Content 有 `keepMounted`、`region`。请求为 expose signal `openChange`，没有 callback-valued Proto Props。Root 的 `getOpenItems()` 返回防御性副本，`openCount` 计 canonical 键，`requestOpen(value, open, reason?)` 只请求已登记且启用的 Item。

未知 owner/default 键保留休眠以支持逐步挂载；向缺失键请求拒绝。非受控曾登记后移除的选中键退役。只保留当前选中键的已登记信息，避免保留无限 Item 历史。空组不虚构内容。受控空输入不被 minimum 策略重写。disabled 抑制请求，不重写既有展开；启用空的 required 组时通过本地 Item policy 找到首个可用项。

遵循 `D-BASE-PROTOTYPE-INDEPENDENCE-0001`，未消费 Collapsible 或 Tabs 的协议专属 asHook。共享点落在 `asCollection`、`asCollectionItem`、`asTrigger`、`asFocusable`、Anatomy、Context、A11y relationship 与 L1 lifecycle。没有新增 Module、宿主 DOM 逃逸、首页专用替代组件或 Rust kernel 改动。

所有启用 header 保留自然 Tab 顺序；Arrow / Home / End 只移动 header 焦点，不改变 open。横向 RTL 反转，loop 可关闭。导航使用当前 Trigger 的 root-scoped key route，防止同一 global sample 在焦点改变后被第二个 header 重复处理。修复后的 modifier guard 包含 Shift / Alt / Ctrl / Meta。

Heading 与 optional region 对应页面信息层级；关系身份是 item 域中的 `panel` key。默认关闭执行 L1 detach，keepMounted 才保留完整隐藏 view。不承诺 host child/native view 状态保留，也不新增 focus return、autofocus、动画计时或延迟关闭 API。

## 设计参考与独立性

2026-10-06 阅读了 [WAI APG Accordion](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/)、[Shadcn Accordion](https://ui.shadcn.com/docs/components/base/accordion)、[Base UI Accordion](https://base-ui.com/react/components/accordion) 与 [Bootstrap 2.3.2 collapse](https://getbootstrap.com/2.3.2/javascript.html#collapse)。这些是设计对照，并非实现上游或 Proto UI 产品授权。没有复制其实现、callback API、mount flags 或 jQuery 依赖。方向键扩展是本独立 draft 协议的选择，不宣称当前 APG 必须要求。

四风格拥有自身 tokens，交互与 presence 均交给 Base。Compiler 增加有限的通用布局安全 vocabulary：`text-start`、`whitespace-normal`、`break-words`、`overflow-x-auto`、`m-0`、`outline-2`、`outline-offset-2`、`border-t`、`rounded-2xl`。Bootstrap 字号/行高采用既有可缩放 `text-sm` / `leading-5`，Brutalist 使用既有 foreground hard-shadow。

LiquidGlass 当前明确为 opaque source-stage 投影。显式 optical self-rendering 与 adaptive native blur 必须消费共享的不同意图，未使用 backdrop blur 伪装完整 LiquidGlass，也未自造 flags。Bootstrap 与 LiquidGlass 的 package private / release scan 状态不变，CLI 仅显式 workspace-source route 可用。

## 已执行证据

- Base focused：25 tests（含独立只读审查后保留的 10 个 regression probes），包括 single / multiple、controlled 拒绝与同步接受、minimum、空组/休眠键、防御性副本、disabled、Enter/Space、取消按压、modifier、RTL/Home/End、heading/relations、L1/retention、重排/改键/移除/重挂、嵌套与重入。
- 四 Web Adapter：每种实际 framework owner 消费 Base 与四风格 setup，每 family 4 cases，共 80 tests；这不是 native browser 证据。
- Compiler：9 tests，覆盖五 family × 四 facade、source-only gates、完整源码 token 下沉、真实 SVG 状态 glyph 与 caller content 保留。
- 公共 CSS / typography 回归：27 tests。
- Family manifest / actual DemoSpec loader / projection composition：71 tests；四风格显式登记，防止 Bootstrap/Liquid 落到 site 默认主题，接受按钮复用真实同 family Button。
- Runtime runner / registration：121 tests。
- Catalog：201 declaration files / 260 static authoring entries / 200 cataloged P entities，0 debt；新增 25 P + 1 T 都保留 draft。
- `check:spec-authoring --base 15d864de...`：26 changed catalog inputs 通过。
- `check:public-docs`：通过；新增 10 个双语页面、5 个 DemoSpec 与 25 个 lazy prototype loaders。
- Astro check：508 files，0 errors / 0 warnings / 6 hints。
- 实际 www production build：319 pages 完成，含十个 Accordion 路由。
- Base / Shadcn / Brutalist public package 及依赖闭包：15/45 packages build 完成；不构成 npm publication。
- 本地 package-budget diagnostics 通过现有九个受限入口；保留 Node 24.19.0 / esbuild 0.25.12 / Linux x64 / zlib 1.3.2.1-motley-3246f1b。权威组合预算仍应绑定最终 CI head，未提高预算上限。

## 红测与实际修复

1. 第一轮缺少 Context required subscription，owner read 被正确拒绝；补充合法订阅。
2. 直接跨实例调用私有 coordinator 会越过 callback 执行边界；改为 expose-method request 与 Context validation envelope，未放宽 Runtime guard。
3. global key handler 同 sample 随焦点变更二次导航；改为 header root-scoped semantic key route。
4. WC 渐进挂载曾过早清掉后置 defaultOpenItems；只退役曾登记后离开的选中键，保留休眠输入。
5. Compiler 初次真 closure 红测指出未支持 tokens；补上述有限 vocabulary，并把不匹配的字体/阴影写法换成既有合法 tokens。
6. 独立只读审查复现 Shift 修饰键被截获；增加 guard 与回归。
7. required 空组同 callback disabled 变更曾读取旧 effective disabled；Root 检查自身 disabled，Collection metadata 提供本地 policy。
8. Docs 初次生产 build 发现错误 Previewer import；改为项目既有 named entry，之后实际 319 pages build 通过。

原失败不因修复而被追溯标绿。早期包构建的 workspace symlink 指向旧 worktree dist 是本地验证环境问题；改成此 worktree 的本地 package links 后再获得实际 build pass。

## 未完成与下一步

- 新 `demo-accordion-family.browser.test.ts` 已注册标准 sequential browser plan，包含 20 个 family/runtime 原生旅程 + 5 个中文 320px / 200% text 旅程，及双语 warm routes。当前尚未执行。Finf 新 head 的 CI 必须运行并修复实际失败。
- 真图由 `PROTO_UI_ACCORDION_SCREENSHOT_DIR` 或 `PROTO_UI_RUNTIME_EVIDENCE_DIR/accordion` 输出；文件名/JSON manifest 包含实际 checkout SHA、family/runtime/state、viewport、实测 theme/DPR/font-size、区域 rect、ARIA 与 trusted-input 记录。新组件不伪造历史改前图；同 source/runtime/light/viewport 的 Base/四投影及开关/focus 状态可作横向对照。当前没有声称截图已取得。
- 窄屏安全区、字体放大、长标签、溢出、焦点轮廓为共同第 8 维；token/source 或 synthetic DOM 不替代实际 paint 审核。
- GPUI host / transport / native A11y 与事件/焦点/presence 的五原子旅程由共享 owner 接收此接口继续。JSON 可传不等于 GPUI parity。第 9 维尚未完成。
- LiquidGlass optical self-rendering 尚未接入共享材质 schema；不得以 opaque source baseline 或 adaptive blur 结案。
- 此 frozen base 自带 workspace type errors：`packages/modules/focus/test/center.test.ts` 184 / 209 的 reason 字符串推断。Accordion 自身没有新增类型错误；后续 Finf 已知修复需由唯一 owner 在集成时协调。
- 当前 bounded semantic 只读独立审查未发现未解决的高置信度缺陷；最终集成独立审查、CI、真实 native/GPUI 与材质验收尚未通过，所有 completion/acceptance checkbox 继续未勾。
