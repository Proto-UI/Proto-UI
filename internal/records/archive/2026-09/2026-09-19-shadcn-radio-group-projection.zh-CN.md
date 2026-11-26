# Shadcn Radio Group 投射与验证

日期：2026-09-19。公开基线：`3b756f450e7505e834629e2aef67f7b29afa94e7`，`0.3.0-alpha.0`。

本次承接 [#662](https://github.com/Proto-UI/Proto-UI/issues/662) 的完整三部分投射。Root、Item、Indicator 分别消费已有 Base hook，选值、Collection、roving focus、activation 与 accessibility 继续由 Base 拥有。新增 P/T 实体保持 draft；本记录保存工程观察，不替代规范或稳定化准入。

## 投射与公开消费

Root 使用 `grid gap-3`。Item 提供 16px 圆形边框、primary 前景、focus ring、disabled 与 dark input 底色；Indicator 是 8px 装饰 SVG，通过 Base checked 的 Rule 控制 opacity，不建立另一份选值或 presence 状态。

比较来源固定为 shadcn-ui/ui `f31ed81983653919dd4fe77aee4b4859f610f1dc` 的 `apps/v4/registry/new-york-v4/ui/radio-group.tsx`。独立 Indicator、flex 居中、显式透明背景与不提供 invalid/Form/asChild 等差异在 P 实体及双语页面中说明，沿用包内 upstream MIT notice。

包根与 `@proto.ui/prototypes-shadcn/radio-group` 提供三个对象及 PascalCase/lowercase 别名。CLI 注册三个独立 facade，不注入默认 Indicator；既有 component-preset generator 仍有三个 recipe，样式 token 闭包由 scanner 正规生成。公开页面通过同一个真实 demo 与 Shadcn-only projection manifest 接入当前 Website projection scope，导航和原型库概览可达。

## CLI 闭包发现与修复

初版的 `resolveKnownAsHookStateHandles()` 没有 Radio Group Item/Indicator 映射。独立审查发现，Indicator 虽在运行时持有 `data-[checked]:opacity-100`，生成 manifest 却没有这个 selector。隔离 family 扫描测试在该缺失处失败；补充实际 Base handles 映射后，scanner 与 lowered-hook coverage 共 158 项通过，Shadcn manifest 由 generator 输出 277 个 token。

网站 dev 预览经其它样式路径已经能显示圆点，不能据此证明 CLI 初始化产物完整。用同一夹具、相同输入和运行时 token，在两个独立的真实 WC/Chromium 执行中仅消费 CLI 生成的样式，测得 value=`b`、checked=`true` 时，Indicator opacity 从修复前的 0 变为修复后的 1；两次均无 page error，前后实际组件截图已检查。这不是同一物理 DOM instance 的 identity 测试。

对应持久化覆盖位于 `packages/cli/test/prototype-style-tokens.test.ts` 的 isolated Radio Group case、既有 `lowered-hook-coverage.test.ts`，以及 CLI 初始化 CSS 的 checked-opacity selector 断言。

## 初始焦点入口的前置依赖

公开页面的 WC、React、Vue、Vue 2 均在 non-first selected 初始 Tab 入口断言失败：Comfortable 已 checked，圆点 opacity 为 1，但 Default 是 tabindex=0，Comfortable 为 -1。选中值与焦点入口是不同证据，未将前者通过当作后者通过。

随后在干净公开基线独立执行真实 Base Root/Item + WC：DOM 顺序固定为 `a,b,c`，分别输入 uncontrolled `defaultValue` 或 controlled `value` 的 `a` / `b`。四组都在 Collection count=3 后记录 12 帧，再从前置 App 按钮执行原生 Tab。两个 `b` case 持续呈现 Beta checked、tabindex `[0,-1,-1]`，Tab 后实际焦点进入 Alpha；两个 `a` 对照正常，均无 page error。Base Root/shared blob 与公开基线相同。

[复现源码、原始采样与真实组件图片](https://github.com/HyacinthHaru/Proto-UI/tree/cd4cede77dcd9f30011e5466dd54f8a920514c48/evidence/2026-09-19/radio-group-entry)保存在不会合入产品的独立证据分支。截图中灰色 checked 与绿色原生 focus-visible 是 App 对真实 Base 状态的诊断呈现，没有注入 checked/tabindex/focus。证据是源码解析后的真实组件执行，不冒充 dist/tarball 消费验证。匿名下载、文件哈希、基线和测量已独立核对。

源码推断是 `resolveCurrentItemId()` 优先保留 enabled current，使首次注册形成的 fallback 在非首项 selected 出现后继续保留；尚未把 registration/publish 的逐次顺序写成实测结论。修复必须同时保留规范中已有的 programmatic/navigation current，以及 value 更新不抢焦点的边界。

#662 明确排除 Base 修订，因此已提出[有界前置修复请求](https://github.com/Proto-UI/Proto-UI/issues/662#issuecomment-5741460931)。本记录时尚无该范围决定，没有修改 Base 产品代码，没有通过改 demo 顺序、主动 `focusSelected()` 或移除失败断言绕过它。

## 当前验证状态

| 范围 | 结果 |
| --- | --- |
| Shadcn projection 单元测试 | 8 项通过；不覆盖 non-first selected 的首次 Tab entry。 |
| Scanner / lowered-hook coverage | 158 项通过。 |
| CLI / Website manifest | 28 + 9 项通过。 |
| 完整类型检查 | Workspace 与 223 个 Astro 文件通过，零类型诊断。 |
| 包、manifest、budget | 43 个公共包构建和 manifest 检查通过，全部现有 budget 通过。 |
| 文档构建 | 245 页成功生成。 |
| Catalog / authoring | 143 declaration files、191 entries、142 P 的 catalog 检查通过；4 个新实体 authoring 通过。 |
| 完整 `pnpm test` 尝试 | 非浏览器 477 文件 / 2,359 项通过，原有 3 skipped 文件 / 34 TODO 保留；浏览器 23 文件 / 107 项通过，新增 Radio Group 的 1 文件 / 4 项初始入口断言失败。整体退出码 1。 |

浏览器的后续键盘、pointer、主题与窄屏 journey 仍需在入口前置问题解决后完整执行，不据已有挂载和初始样式观察宣称这些路径通过。完整交付、独立审查和合并尚未完成。

## 同日后续：独立执行交互与视觉路径

首轮完整测试之后，将每个 runtime 的初始入口与后续交互拆成两个 required case，共八个 case。初始入口仍在任何 Item 输入之前严格要求 non-first selected Item 为 tabindex=0，没有重排 demo、注入焦点或改写期望。交互 case 先真实点击 Default、Comfortable，并分别等待 Root expose 的实际值变化，再验证原生 Shift+Tab/Tab 重入，因此不能替代首次入口证据。

2026-09-19 20:20（Asia/Shanghai）的 focused browser 执行结果是四个初始入口失败、四个独立交互通过。通过路径实际执行了双轴方向键及 Home/End、空组 Tab/Enter 不选与 Space 选择、pointer down 与外部 release 不提交、成功 release 提交、item/group disabled、light/dark 切换，以及 320px 窄屏。负断言等待 demo 的 observer/rAF 投影边界后，同时检查 checked facts 和显示值，避免尚未更新的旧文本造成假绿。四个 runtime 均无 page error。

实际测量为 16px Item、8px SVG、12px gap、150ms color/box-shadow transition、键盘焦点的 3px ring，dark input 背景 alpha 为 0.045；主题与宽度变化保留已经选择的 value。截图改为包含 preview 的真实 padding，避免把内容边界外的 focus ring 截掉；窄屏先居中滚动，让整个卡片与值读数进入截图，未改组件样式或隐藏页面元素。

本轮只重跑了修改后的 browser suite，不把上一轮完整 `pnpm test` 的退出码 1 改记为通过。T 实体继续将完整 browser implementation 标为非 passing，同时分别记录已执行的初始入口失败与独立交互通过。Base 前置修复的范围决定仍未到达。

另外以 Node 22 直接消费本地构建后的包根及 `@proto.ui/prototypes-shadcn/radio-group`，确认实际解析到 `dist`、subpath 精确六个 runtime exports、同一入口内的大小写别名指向相同 Prototype，以及三 part 名称一致。此项未使用源码 alias，也不声明 tarball 或 registry 消费验证。

## 同日后续：安装 tarball 后的 CLI 消费

以候选 `a7f231b71604055af162730aa3b04450e21805bc` 的实际源码运行既有 release pack 路径，构建并暂存 43 个 tarball。临时消费者安装的是其中 40 个包构成的声明依赖闭包，所有 Proto UI 包都解析到本地 tarball；未安装的三个包是 adapter-vue2、prototypes-brutalist 和 prototypes-lucide。此过程没有发布到 registry。

在临时项目执行真实 CLI init/add，生成 React、Vue、WC 的三个 Radio Group facade parts，再以 Vite 6.4.1 构建生产页面并由 Chromium 153.0.8010.48 执行。三个 host 均通过具名三 Item group、受控 value 从 `b` 到 `a`、checked 从 `[false,true,false]` 到 `[true,false,false]`、两个显式 Indicator 的实际 opacity 从 `[0,1]` 到 `[1,0]`、disabled facts 及第三项不自动注入 Indicator 的检查，均无 page error。六张前后组件截图已检查；这项消费夹具保留直接文本 children，不替代网站中规范布局、焦点、主题及窄屏的完整交互证据。三个 host 的初始 tabindex 仍为 `[0,-1,-1]`，没有把打包成功记成首次入口通过。

这轮检查还保留了两类环境差异：

- 扩展既有 release consumer smoke 的临时脚本在 React/Vue 的 happy-dom 检查通过，但 WC 报 `base-radio-group-item` provider missing，整体退出码为 1。消费者虽然固定 global-registrator 20.11.0，其传递依赖实际解析到 happy-dom 20.14.5；仓库 Vitest 使用 15.11.7。完全不含 Proto UI 的同一三层离线 customElements 树接入控制实测：15.11.7 与 Chromium 都按 Root → Item → Indicator 调用 connectedCallback，20.14.5 则按 Indicator → Item → Root。源码中的递归连接顺序差异与 provider 尚未建立的错误吻合，但完整 Proto provider 注册/订阅过程未逐次 instrument，也未修复该模拟器。真实 Chromium 中相同的 WC 构造顺序成功，不能覆盖掉模拟器的原始失败。
- 临时多 host Vite dev driver 关闭了 HMR。首次发现 React 依赖时，React 出现 `no active setup context`；之后新发现 Vue Adapter 时，失败转移至 Vue，WC/React 已通过。全部依赖发现完成后，相同脚本、断言及缓存的三个 host 都通过；生产 bundle 的三个 host 也独立通过。当前安装树没有重复的 core/runtime/context 包，最终可达缓存仅发现一份 AsHook stack 定义，不能据错误字符串宣布存在持久重复 core。原失败、增量优化期间的环境混合假说和 warm-cache 成功分别保留，不声明冷启动问题已定位或修复。已有 #663 涉及 Windows/Astro production-source 的类似字符串，尚不能认定同根因。

这些结果补充包消费与执行环境的证据，没有改变 Base、依赖版本、CLI 生成结果或规范期望，也没有重新分类此前完整 `pnpm test` 的失败。

[公开证据包](https://github.com/HyacinthHaru/Proto-UI/tree/980cd72335db1a07dedd69c5857522abf0dc9b8d/evidence/2026-09-19/radio-group-projection)保存于独立证据分支，包含 22 张原始组件截图、观测、保留的失败、可移植复现入口及 SHA-256 清单。准备入口随后实际创建了新的 40 包消费者，production capture 与三个连接顺序 probe 均成功执行；六张新 production PNG 与保存的原图逐字节一致。可移植 helper 的 dev 模式没有在这一轮重新执行。

独立本地审查核对了范围、来源、格式归一化和完整性；提交后，全部 56 个公开文件均通过匿名下载与逐字节回读验证。[进展评论](https://github.com/Proto-UI/Proto-UI/issues/662#issuecomment-5742434829)已补充到 #662，明确保持 partial、首次入口失败及既有 Base 前置范围请求，不声明产品接受或合并完成。
