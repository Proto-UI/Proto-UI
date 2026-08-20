# Proto UI 0.2.0-rc.7

> 已于 2026 年 8 月 11 日通过 npm `next` channel 发布。全部 40 个公开 package、`v0.2.0-rc.7` tag、GitHub prerelease 与不可变 spec snapshot 共享这一精确发行身份。

## 已修正与加固

### 连续 Trigger group 与 Dialog 命中范围

- 连续嵌套的 `asTrigger()` 不再描述为向最外层或最内层 Trigger 单向代理事件，而是合并为一个 trigger group，并明确区分默认最外层 anchor、所有 members、默认最内层 interaction surface 与共享 semantic activation route。
- 每个 member 继续保留自身 behavior 声明；语义 activation registrations 汇聚到当前 surface 的共享 target，`host:*` listeners 仍留在各实例自己的宿主 root。
- Pointer activation 现在只有在原生 hit origin 位于当前 surface root 或其内容中时才会进入 group semantic route。命中 anchor 或其他非 surface member 自身多出来的宿主盒会被拒绝，不再被重定向为 surface activation。
- 这修复了 `ShadcnDialogClose > ShadcnButton` 中外层 Close wrapper 宽于内层 Button 时，点击 Button 旁空白仍关闭 Dialog 的问题；相同规则也覆盖 `ShadcnDialogTrigger > ShadcnButton` 的外层空白。
- Web Component、React 与 Vue 的共享 Dialog journey 现在同时验证：外层 Trigger/Close 空白不触发，内层 Button 的 pointer 与 keyboard activation、focus loop 和关闭后的 focus restoration 继续正常工作。
- 新的 group capability 使用 `mergeGroup` 与 `getGroupEventTarget` 命名；旧 route-owner capability 暂时保留 deprecated alias，便于既有 host integration 迁移。

### Shadcn Tabs v4 默认样式还原

- Shadcn Tabs 的默认横向样式现在对齐项目固定的 shadcn/ui v4 基线：Root 使用 `flex flex-col gap-2`，List 使用 `inline-flex h-9 w-fit rounded-lg p-[3px]`，不会再默认铺满容器宽度。
- Trigger 恢复 v4 的尺寸、圆角、文字与 selected、hover、focus-visible、disabled 状态反馈，并移除了不属于该基线的 pressed 缩放、额外 ring offset 与旧版大圆角表面。
- Content 回归 `flex-1 outline-none` 的无装饰内容承载角色，不再由 Tabs 原型强制生成 border、background、padding 和 shadow；需要卡片面板的用法应在消费端内容中显式组合。
- Proto style CSS 编译器新增 `w-fit`、`h-fit`、`flex-1`、`shadow-sm` 与 outline 相关 token 支持，确保上述原型样式可进入 Web 产物而不会退化为 unsupported token。
- 本轮只收敛默认 variant 的横向主路径；`line` variant、垂直布局、显式 dark 分支、SVG 后代规则与完整原生 API/data forwarding 仍保留为后续 parity gap。

### 被动焦点与文档运行时行为

- Web Component、React 与 Vue 现在仅在 prototype 声明真实 focus surface 时写入 `tabindex="0"`。disabled 原生 control 保留 `tabindex="-1"`，passive 非原生 host 则省略该属性，避免 cleanup 或 nested-trigger 投射把它变成 click-focusable surface。
- 文档 ThemeProvider 会在 Starlight 内置移动端 picker 调用前安装 picker bridge，在系统主题变化时保留显式用户偏好，并消除此前 fresh-load 路径上的 `ReferenceError`。
- Base Textarea demo logger 现在只记录归一化的 exposed `CustomEvent` payload；冒泡的原生 `change` event 不会再用重复、未归一化的记录覆盖投射事件。

## 新增与扩展

### Scroll domain 与 Scroll Area

- 新增 draft Scroll knowledge、decision、contract、module、host-capability 与 test 链，明确 host 拥有滚动引擎、物理、惯性与输入集成，Proto UI 拥有逻辑 surface、facts、requests 与 chrome projection negotiation。
- Base Scroll Area 编目 Root、Viewport、Scrollbar 与 feedback-only Thumb。Web 支持 `system` 与 `composed` chrome；family host session 把实际 Thumb 绑定为有界 Move Gesture 命中子区域，并将移动映射为 normalized `control-drag` request，而不创建第二个 scroll-state owner。
- Web Component、React 与 Vue 共用 Scroll runtime，Brutalist 提供 Scroll Area 视觉投射与跨 adapter journey。rc.7 Scroll catalog 仍为 `draft`，不构成已完成的稳定跨宿主保证。

### Base Tooltip 与 Tooltip Group

- Draft Base Tooltip Root、Trigger、Content 与 Group 覆盖延迟打开、hover/focus 协同、Escape owner bridge、anchored overlay/portal 投射，以及带 active-tooltip 协调的 group warm/cold delay window。
- Accessibility relation 投射改为 additive，Tooltip 可以追加自身 `aria-describedby` token，而不会覆盖 host-authored IDREF relation。
- 首轮刻意不增加空 Portal prototype，也不在缺少受治理 arrow-geometry channel 时增加 Arrow；touch long-press 与 input-modality suppression 仍是显式延后项。

### CLI Brutalist preset 与公开原型 package

- `proto-ui init --prototypes brutalist` 是一等 CSS-only style preset。它会写出 Brutalist 主题（`brutalist-theme.css`，包含 Light/Dark 变量与扁平 canary/mint/lavender/coral/sky 强调调色板），以及从官方 Brutalist prototype 源码扫描生成的 Proto UI token closure。
- `@proto.ui/prototypes-brutalist` 已作为 40-package BOM 中的公开 `0.2.0-rc.7` package 发布到 npm `next`，但不属于 launch-commitment tier。其导出的 family subpath 与生成的 `proto-ui add` 条目覆盖已准入的 Button、Badge、Card、Toggle、Switch、Tabs、Hover Card、Dropdown、Select、Dialog、Scroll Area、Separator、Skeleton 与 Textarea surface。

### Separator 协议与 Skeleton 视觉原型

- Base Separator 现已明确横向/纵向 orientation、decorative 与 semantic accessibility 行为、mounted 后的实时投影，并确保 decorative 模式不残留仅属于语义模式的 orientation。
- 公开 Brutalist release candidate 包含 Separator 投影与直接定义的 styled-only Skeleton subpath。Skeleton 是 passive、contentless、aria-hidden 且尺寸由消费端拥有；父级 loading region 继续拥有 busy 状态、announcement、替换时机与焦点连续性。

### Direct Badge 与 Card 视觉原型

- Brutalist Badge 是没有 Base counterpart 的 direct styled-only 被动标签。公开 `accent | info | danger` tone 将平涂 fill 与对应 foreground 配对，同时保持结构性 ink 边框与硬阴影不变；它不拥有 status announcement、activation、pressed、selected、event、state、command 或 method channel。
- Brutalist Card 是没有 Base counterpart 的 direct styled-only 被动分组表面，只保留 Root、Header、Content 与 Footer part。Title 与 description 使用普通内容，action 则组合 Button 或 Link，使这些 child 保留自己的协议。

### 原生 Textarea 协议与 Brutalist 投影

- 新增 typed static module-declaration 基础，使 prototype 可以在 render 前声明 adapter-owned host infrastructure requirement，而无需扩大 Template v0；authored asHook 可以发布冻结 requirements 供 caller definition 显式复用。公开 `@proto.ui/module-text-control` package 使用 host-neutral plain-text/multiline declaration，当前 Web profile 在 Web Component、React 与 Vue 中 lease 一个原生 textarea。
- Base Textarea 拥有一个 contentless logical multiline editor，提供稳定的受控/非受控 value ownership、归一化 input/change/IME payload、composition-safe 受控恢复、selection/cursor-preserving Web property 投影、accessibility，以及物理 focus/blur method。当前验证是同一 Web host 上的 cross-adapter evidence，不声称多宿主 conformance。
- Brutalist Textarea 在同一个 target 上继承完整 Base 协议，只增加方角薰衣草紫/ink、等宽字体与硬阴影视觉样式。它不拥有 form workflow、validation message、auto-resize、rich text、live-region announcement 或第二个 control。

### Live Region 与 Async Region 无障碍边界

- Base Live Region 新增保留内容的 status/alert 边界，通过受治理的 `politeness` 与 `atomic` props 同步投射 `role`、`aria-live` 与 `aria-atomic`，但不拥有 focus、event、command、announcement 时序或替换行为。
- Base Async Region 新增保留内容与焦点的 `busy` 边界，投射 `aria-busy` 且仅暴露受治理的 `busy` state；loading 视觉、announcement、替换状态与聊天语义仍由消费端拥有。
- Web accessibility 投射新增 `live`、`atomic` 与 `busy` state key 到对应 ARIA attribute 的映射。两个 Base family 均拥有公开 package subpath 与 `proto-ui add` 条目，不会向当前 rc.7 BOM 新增 package。

## 构建与发布

### 40 个公开 package 交付可执行产物

- 全部 40 个公开 `@proto.ui/*` package 现在都会在发布前生成 `dist/*.js` 与 `dist/*.d.ts`，package exports 分别指向 JavaScript runtime 与 declaration output，不再把需要 TypeScript loader 的 `.ts` 源码直接作为 npm runtime entry 发布。
- 每个公开 package 现在都有 package-local `build` 与 `prepack` contract；根级 `build:packages` 按生产依赖拓扑构建所选 package 及其上游闭包，验证全部 export targets，并在不加载 TypeScript 的原生 Node ESM 环境中执行 import smoke。
- Release staging 现在复用并复制开发与 CI 已验证的同一份本地 `dist`，不再维护另一条可能漂移的临时编译路径。
- 公开 manifest 通过生成器统一维护 `dist` exports、`files` 白名单和 build scripts。源码与测试保留为仓库输入，但不再进入默认 npm payload；release rehearsal 验证完整的 40-package 集合。

### Bundle、文档与 CI 反馈

- Lucide 固定图标入口与全图标 registry renderer 解耦，代表性单图标 `icons/x` 的 gzip 体积由 119,273 B 降至 1,560 B，避免单个图标传递引入完整 registry。
- Lucide Gallery 改为有限首屏服务端渲染，英文页面原始 HTML 下降约 63%。内部 Demo Matrix 恢复每个 demo 同时并排挂载 Web Component、React 与 Vue，保留快速跨 adapter 人工验收能力；中英文路由均标记为 development-only draft，不再进入生产文档产物与 sitemap。
- CI 现在根据 workspace 生产依赖图计算受影响的公开 package，并为代表性 package entry 固化 gzip budgets；`main` 与手动触发仍执行全量公开包验证。
- 新增可重复的 monorepo analysis snapshot，记录构建、测试、tarball、bundle、文档产物与 package 更新频率，使上述优化可以在相同口径下复查。

### 文档发现体验与贡献治理

- 双语文档搜索改为可通过键盘操作的 Pagefind dialog，提供本地化 idle、loading、empty、pagination 与可重试 failure 状态；timeout 可避免 index 或 runtime 故障停留在无限 spinner。
- UI library landing page 改为卡片式 showcase。Base、Shadcn 与 Brutalist 提供延迟初始化的单列组件总览，Lucide 提供可搜索 icon grid；Badge/Card 合入后的 Brutalist 总览覆盖全部 14 个已准入 preview。
- Information Flow whitepaper 新增一张共享的 User/Maker/Other Component 图，并由本地化周边文字提供等价说明；布局响应式且移除了重复的外层图片卡片。文档共享 GitHub 链接现指向规范的 `Proto-UI/Proto-UI` 仓库。
- 仓库贡献入口现记录 Developer Certificate of Origin 1.1、逐提交 sign-off、来源 provenance、AI assistance disclosure，以及针对其他条件均有效但缺少签署提交的受治理 individual-remediation 路径。
- Release metadata synchronization 会保留已评审的 package README，同时校验精确安装版本与已记录的生产依赖，避免维护型 package 文档与公开 rc.7 package 图静默漂移。

## 验证

- 完整工作区测试通过：280 个测试文件、1,244 个测试通过，另有 3 个按设计跳过的文件与 34 个 todo case。工作区与文档类型检查覆盖 134 个 Astro 文件，错误、警告和提示均为 0；catalog 统计为 117 个 declaration、160 个 static authoring entry、116 个已编目的 P entity、0 个 known debt file 与 1 个 dynamic factory file。
- 40 个公开 package 均通过生产构建、export target 校验、原生 Node ESM import smoke、staging 与 `npm publish --dry-run`。React tarball consumer 实际使用 36/40 个打包产物，CLI multi-host consumer 使用 38/40 个；生产文档构建产出 190 个页面，其中 188 个进入 Pagefind。
- 已在浏览器中对构建后的 Brutalist Textarea showcase 进行 Web Component、React 与 Vue 三适配器实测。每个适配器均只挂载一个原生 textarea；路由保留原生属性与可访问 label/help 关联，支持非受控编辑，并呈现方角薰衣草紫/ink、纵向 resize 与硬阴影视觉表面。
- 受保护的 `publish-all` workflow 已通过 npm Trusted Publishing 从受评审的 `692a6cfa30eae3049017d3c2b9e86d7f216e2176` commit 发布全部 40 个公开 package。Registry 核对确认 40 个精确版本、`next` tag 与 integrity 记录均完整；workflow 随后创建 Git tag、GitHub prerelease 与不可变 snapshot assets。
- Demo Matrix 开发路由实测同时挂载 45 个 demo、135 个 previewer，Web Component、React 与 Vue 各 45 个；生产构建的 190 个页面、sitemap 与 Pagefind index 均不包含其中英文 Demo Matrix 路由。新增的 development-only 与三 adapter 并排 policy 已进入 41 条 release tests。
- 公开 Brutalist library overview 已在真实 Chromium 中完成 14/14 preview 初始化验证，其中包含 Badge 与 Card，且没有 console、page 或 request error。

## 升级提示

- 通过公开 package exports 使用 Proto UI 的消费者无需更改导入方式，但运行时现在会解析到已编译的 `.js`，类型解析到 `.d.ts`。依赖 package 内部 `src/*.ts` 路径或假定 npm payload 包含源码/测试的非公开用法不属于兼容保证。
- 自定义 host integration 应迁移到 trigger-group capability 命名；deprecated route-owner alias 仅用于过渡。

## 仍在验证

- `0.2.0-rc.7` 发布后试用继续发现的安装、运行时、CSS、a11y、bundle、组合与 API 问题将进入后续 release train。
