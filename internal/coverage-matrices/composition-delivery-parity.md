# Proto-UI 公开 Composition、首页、Demo 与安装交付一致性审计

日期：2026-10-25。状态：静态源代码与交付契约审计、实施方案。未执行第三方源码，未作新的浏览器实测，本文不是独立验收或 CI 通过证明。

## 0. 决策摘要

问题不是 Checkbox 必须自带纯文本，也不是打开 slot 模式就会变好。问题是：同一原型的正确语义组合没有成为三种消费方式共同遵循的公开推荐契约。

应同时保留两层公开能力：

1. **原子原型/零件**：Checkbox Root 与 Indicator、独立 Label、Field 等，允许高级消费者合法重组。
2. **推荐 composition**：明确零件、关联、默认状态与内容边界的可复用组合，首页、文档 demo、真实安装产物共同消费；不用页面点击转发、重复状态或强写 ARIA 补全。

“相同”指公共定义、必要组合关系与可观察行为相同，不指共享运行时实例，不要求所有页面布局/业务值相同，也不允许为复用把应用业务塞入 Base/Compiler。

本报告提出真实依赖栈：S0 公开组合契约与支持矩阵 → S1 一个 Label+Checkbox 推荐组合 → S2 该组合的真实 packed/install 闭包；S3 首页/demo 消费依赖 S1，只有安装一致性声明依赖 S2。Field Select、Textarea、Switch 必须复用已有在途语义/投影项，不能另造重复实现。Theme Toggle 与 Brutalist Tabs 换行是独立支线，不强塞 Checkbox 的依赖。

## 1. 基线、覆盖与证据分级

### 1.1 固定版本

- main：`7181a93a5ec5cad43936a72e31d5477d5488733a`。
- 首片实现的真实 stack parent：[#955](https://github.com/Proto-UI/Proto-UI/pull/955)，branch `dot/finfv2-rhea-textarea-954`，head `b01cd33661850db5d8cba37122d732384c472083`，tree `ce3a36e016b6fe2b52b36d72eba28c19793b2023`。仅在该完整父树上追加本片三文件，不用 main 覆盖父分支其他改动。
- 2026-10-25 05:23 UTC 发布准备复核：[#997](https://github.com/Proto-UI/Proto-UI/pull/997) 已由维护者于 05:13:35 UTC 合并；main 已前进到 `4d0751dc0499dcd574be8ada56a314a533c2d85a`。本文全仓审计仍绑定旧 `7181a93` snapshot，不自动等价于新 main 的全仓结论。两项代码目标在新 main 的 blob 未变，新文档尚不存在；此观察不代表旧 #997 检查全绿，也不是本片主动合并。
- 首页在途分支：[#984](https://github.com/Proto-UI/Proto-UI/pull/984)，head `1dcd9545d6dadeb0e04491653d51124aaff1a467`。
- 相关 Issue/PR 与文件 claim 在 2026-10-25 05:07–05:08 UTC 重读。全仓开放基线为 136 Issues、23 PRs，其中 21 Draft；后续写入/合并前仍须重查最新状态。
- main 固定树：[源码](https://github.com/Proto-UI/Proto-UI/tree/7181a93a5ec5cad43936a72e31d5477d5488733a)。本文相对源码路径默认指此 main，明确标“在途”者除外。

### 1.2 覆盖深度，不把扫描冒充全验收

- 索引级扫描：六个原型包，main 共 851 个 `.proto.ts`，以及文档目录的 264 个 `.demo.ts`。263 个 demo 文件内容哈希与固定 main 一致；另一个 Liquid Glass Collapsible 文件未作为 main 实现证据。
- 内容级核对：五族表单命名/Label 消费、全体 Select demo 属性修补、Checkbox/Switch/Input/Textarea、推荐 preset、主路径 registry/materializer/renderer、首页原有 28 类功能面，以及 CLI 安装链专项。
- 264 个 demo 不是 264 个独立组件，包含不同模式、状态与复用入口。直接搜索没有 `controlLabel` 不等于无关联：Label demos 经共享 helper 使用该关联，Field 经 anatomy 关联。
- 表中“事实”是明确源码/导出证据；“候选”是需继续对照定义和实测的风险，不按缺陷处理；“合理业务”不迁入基础原型；“在途”不等于 main 或可安装。
- 本轮不声称已逐行审核 851 个原型的所有算法，不声称发现了仓库所有缺陷。提供完整类别与交付入口索引，以及优先问题的可实施切片；后续每片须增加其精确 head 证据。

### 1.3 对上一份审计的重要限定

上一份首页审计同时比较 main 与 #984，Select 小节的“已有 FieldSelectTrigger”应读为**在途依赖链能力**，不能读为 main 或已安装能力。精确 main：Base Field 已导出 FieldTextarea，但尚无 FieldSelectTrigger；Shadcn Field 仍为原有六部件。相关 Textarea/Select/Switch 的 family 扩展分别在现有 PR 链中。该差异现在按“main / 在途 / 安装”分开，不用工作分支的能力替 main 作保证。

## 2. 官方 shadcn 契约：直接回答组件与 slot 问题

### 2.1 固定 New York 基线

仓库 `spec/prototypes/P-SHADCN-CHECKBOX.yaml` 固定比较基线为 shadcn-ui/ui `f31ed81983653919dd4fe77aee4b4859f610f1dc` 的 `apps/v4/registry/new-york-v4/ui/checkbox.tsx`。已读取该固定源码，不只看最新网页。

- 官方 Checkbox 实现封装 CheckboxPrimitive.Root 和 Indicator，并在 Indicator 内放 CheckIcon。没有默认 label 文本参数，也没有“文字模式/slot 模式”开关。
- 同 revision 官方示例把 Checkbox 与独立 Label 配对，用 id/htmlFor 关联。另有外层 Label 包 Checkbox、标题与说明的卡片式示例。可见内容不是 Checkbox 内部固定字符串。
- Proto-UI 的 Checkbox admitted anatomy 明确只有 Root 与 Indicator。独立推荐组合可以引用 Label，但不应把 Label/Group 偷加为 Checkbox 的内部 anatomy。
- Proto-UI 明确不支持 upstream `asChild`；不能把普通 children/Proto slot、Radix Slot 的替换宿主能力、推荐 composition 当成同一个概念。

固定来源：

- [官方 Checkbox 定义](https://github.com/shadcn-ui/ui/blob/f31ed81983653919dd4fe77aee4b4859f610f1dc/apps/v4/registry/new-york-v4/ui/checkbox.tsx)，blob `f5a7e433f3795b82a00c5c06a1fc6decf116a84a`。
- [同版本官方组合示例](https://github.com/shadcn-ui/ui/blob/f31ed81983653919dd4fe77aee4b4859f610f1dc/apps/v4/registry/new-york-v4/examples/checkbox-demo.tsx)，blob `4cdae4210dc738b05778f17e4b72e2063e6ffcf3`。
- [Proto-UI Checkbox 定义](https://github.com/Proto-UI/Proto-UI/blob/7181a93a5ec5cad43936a72e31d5477d5488733a/spec/prototypes/P-SHADCN-CHECKBOX.yaml)。

### 2.2 当前官方版本不等于仓库选定版本

检索时通用 Checkbox 文档 URL 已重定向 Base UI 页面；官方同时提供 Base UI、Radix UI 等版本。当前 Radix 文档推荐用 Field 与 FieldLabel 组合，用 FieldContent/FieldDescription 承载帮助文字。这支持公开组合方向，但不能据此把仓库固定 New York 比较基线悄悄迁至 Base UI。

- [当前 Radix Checkbox 文档](https://ui.shadcn.com/docs/components/radix/checkbox)
- [当前 Base UI Checkbox 文档](https://ui.shadcn.com/docs/components/base/checkbox)
- [当前 Base UI Checkbox 源码](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/bases/base/ui/checkbox.tsx)
- [当前 Field 文档](https://ui.shadcn.com/docs/components/base/field)

两种 Checkbox wrapper 都是 Root + Indicator，不是内置文本。Radix 与 Base UI 的 primitive API、渲染定制方式和底层行为不能混用；新版 family style profile 的局部采用也不等于整个语义基线升级。新增组合应记录对应的上游 revision、路径、变体、采用项与有意差异。

### 2.3 rich children 与 interactive children

标签内容可以是文本、强调、被标为装饰性的图标等合法富内容，不应限制成一个 string。但不能无条件承诺“任意子原型”。必须区分：

1. 内容属于名称：由 Label 参与 accessible name；装饰 Icon 不应重复朗读，必要的文字替代须明确。
2. 内容属于说明/错误：使用独立 Description/Error 关系，不把全部长文拼入名字，也不强制整段禁止选择。
3. 内容自身可交互：链接、Button、输入控件、可编辑内容应保留自身动作；其点击不能同时切换旁边 Checkbox。优先放在相邻说明区；需要合法嵌入时必须有输入边界测试。
4. Label 不能嵌套另一个 Label；不能随意塞入另一独立 labelable control。原生 label 内容模型与实现输出标签须一致。上游卡片示例的布局代码不是允许任意 HTML/任意子组件的通行证。
5. 禁用/只读的内部控件仍拥有自身输入边界，不能因为不响应业务动作就让点击穿透激活外部目标。

[HTML Label 规范](https://html.spec.whatwg.org/multipage/forms.html#the-label-element)规定交互后代命中的 Label activation 不应执行；[Radix Label](https://www.radix-ui.com/primitives/docs/components/label)基于原生标签关系。Proto-UI main `packages/modules/control-label/src/web.ts:3–39,257–265` 已有 interactive 元素/角色与 composedPath 边界，不应在页面重新实现，更不能绕开。

## 3. 推荐 composition 必须公开什么

| 契约面 | 推荐做法 | 禁止或明确不保证 |
| --- | --- | --- |
| 原型身份 | 引用已有 family Root/Indicator/Label；所有入口同一来源 | 同名另写一份状态机；网站专用 Checkbox |
| 每实例关联 | 公开 opaque association、作用域隔离、dispose/rebind | 全局固定字符串造成跨实例绑定 |
| 名称与激活 | 短名称 Label 命名+激活；naming-only 是显式选项 | 把 ariaLabel 文本副本当真实 Label |
| 默认部件 | 默认 Indicator，可按现有 replaceable-default-part 替换/省略 | 把 Indicator 替换入口称作“标签 slot 开关” |
| 富内容 | 类型/输出语义允许的非交互内容；声明装饰与命名边界 | 任意交互子原型点击全被吞并 |
| 长说明 | 独立 copyable Description，有真实描述关系时再声明 | 全行 select-none、清空用户 Selection |
| 状态 | Checkbox 自己拥有 checked/mixed/disabled/controlled | Label 或 composition 再存第二份 checked |
| 外观 | family 拥有可复用尺寸/状态/必要布局 recipe | Compiler 按 prototypeId 或路径分支 |
| 宿主 | Adapter 负责物理事件/焦点/文本关系落实 | 页面 `.click()` 转发、DOM 强制 checked |
| 消费 | 首页、docs、安装示例调用同一公开组合构造 | 三处复制相似树并手工保持“看起来一致” |
| 原子入口 | 保留 raw atoms、清楚标记高级手动组合 | 为默认组合强制所有 raw Checkbox 带标签 |
| 支持矩阵 | 逐 family/target 标记 workspace、packed、installed | 解除 sourceOnly 或拿 monorepo alias 冒充安装 |

实现 API 尚需 S0 定义评审：可由现有原型库公开的 recipe/construction surface 承载，但不直接把网站 DemoSpec 当全平台公共 AST。应优先扩展现有 source-governed metadata，而非维护第二份手写 registry。图标、标题、说明等调用方内容是 composition 输入，不是 Compiler 的组件知识。

## 4. 确定问题与正向对照

以下文档路径以 `apps/www/src/content/` 为前缀，除另注均与 main blob 对齐。

| ID | 级别/分类 | 位置与证据 | 根因及正确切片 |
| --- | --- | --- | --- |
| C01 | 事实，交付缺口 | Shadcn `src/component-presets.ts` 仅 Checkbox/Switch/Dialog 三个 replaceable-default-part；Checkbox preset只Root+Indicator | 现有 convenience facade不是Label+Control推荐组合；S0/S1 |
| C02 | 事实，行为组合漂移 | `docs/zh-cn/demo-shadcn-checkbox.demo.ts:13–27`；Brutalist/Bootstrap对应文件；首页 gallery 使用独立Label关联 | 同原子、不同必要组合，修公开组合消费，不造新activation；S3 |
| C03 | 事实，作者示例偏差 | `docs/demo-base-checkbox.demo.ts` checkboxRow 把文字放Root内并加select-none | 可作为低层示例但不能充当推荐Label+Control一致性；保留raw并明确标记 |
| C04 | 事实，命名补丁 | `docs/zh-cn/demo-base-select.demo.ts:5–18`、Shadcn同段、Brutalist:5–14 | MutationObserver恢复aria-label，非真实字段名称组合；依赖现有FieldSelectTrigger链 |
| C05 | 事实，跨族同根因 | `docs/demo-bootstrap-2-3-2-select.demo.ts:130–139`、LiquidGlass同段 | 同一Select命名补丁跨五族存在；避免每族另造语义机制 |
| C06 | 事实，Input可见名不关联 | `docs/zh-cn/demo-shadcn-input.demo.ts:11–15,28–32`；其他Input demo同类需逐场景验收 | 普通box与ariaLabel副本，名字存在不代表点可见label能聚焦；优先复用ControlLabel |
| C07 | 事实，Textarea首例无显式标签关系 | `docs/zh-cn/demo-shadcn-textarea.demo.ts:11–28` | 标题只是box；首例未提供显式ariaLabel/关联。实际accessible name须浏览器确认，不据静态断言已测空名 |
| C08 | 事实，Switch展示不一致 | `demo-shadcn-switch.demo.ts` Root内sr-only；`demo-brutalist-switch.demo.ts:3–4,18–28`文字绝对定位在Root内 | 可见label位置不是公开推荐组合；不把被Root包含的点击等同独立Label关联 |
| C09 | 正向对照，不是缺陷 | 五族 `demo-*-label.demo.ts` → `PrototypePreviewer/control-label-demo.ts` | 已用公共ControlLabel、两种naming模式和Base目标；但helper在网站，不是公开install构造，且混family不等于该family完整控件投影 |
| C10 | 正向对照，不是缺陷 | 五族 Field demo → `docs/field-demo.shared.ts:1–55` | Root/Label/Control/Description/Error/Validity用已有anatomy；共享helper合理，升级公开交付另评估 |
| C11 | 候选，桥接收敛 | Base/Shadcn RadioGroup demo观察aria-checked后读取公开value expose；Transition demo观察data-state | 属状态可视化兼容桥，不是值状态机。先找公开订阅路径；不能仅见MutationObserver就称hack |
| C12 | 事实，安装入口漂移 | 见安装矩阵 | package exports、CLI registry、demo并非等价支持集；修明确闭包，不无差别全开放 |
| C13 | 事实，页面局部ARIA | 首页themeButton setAttribute aria-pressed | 公开Toggle或明确command契约；provider业务留应用；#921协调 |
| C14 | 事实，页面ID样式补丁 | gallery针对Brutalist Tabs写height/flexWrap/whiteSpace | family公开wrap能力或正式recipe；不得改Base键盘语义 |

验收必须把“名字可被AT读到”“点击名字激活”“拖选长说明”“交互后代不误激活”分开；不能只对着可见文字截图称正确。

## 5. 全仓类别扫描矩阵

这是全仓公开组合审计的覆盖表，不是所有类别均已发现缺陷。跨族不存在某个原子时，不能为了凑齐矩阵虚构API。

| 组合类别 | 已检查或待续核的公共责任 | 当前处理 |
| --- | --- | --- |
| Checkbox/Switch/RadioGroup | 值与activation原子；独立Label；Indicator/Thumb；Group别混Form | Checkbox/普通Switch命名消费优先；Radio单选组不复制Checkbox状态 |
| Input/Textarea/Field/Fieldset/Form | 单编辑器、Label/Description/Error、optional字段绑定、group与提交 | 普通控件先Label；复杂字段复用既有#906链；不自动承诺所有form/native submission |
| CheckboxGroup | 多选值组合与子控制所有权 | sourceOnly/child-handle失败保留；不能把一组checkbox label等同完整group |
| NumberField/InputOTP | 编辑/步进/多个输入槽的命名和焦点 | 检查推荐结构与安装闭包，不能把普通Input recipe机械套用 |
| Select/Combobox/Autocomplete/DatePicker | 当前值、文本编辑、选择、字段名不同对象 | Select五族补丁已证；其余按已有定义检查，不凭外观推断同角色 |
| Command/search-primitives | 命令输入、结果、选择、空/加载状态 | 公共Command/InputShell与网站搜索服务分开；Pagefind不是原型能力 |
| Dialog/AlertDialog/Drawer/Popover/HoverCard/Tooltip | 触发、内容、标题描述、关闭、focus与dismiss、portal | 默认部件preset不等于完整推荐内容；合法应用业务回调留外层 |
| Dropdown/ContextMenu/Menubar/menu-primitives | 触发路径、菜单item/checkbox/radio、子菜单 | 使用公开组合；不把route/sidebar/nav business映射塞菜单原型 |
| Tabs/Accordion/Collapsible | 关系、方向、roving focus、选中/展开 | Tabs wrap独立family支线；其余不因首页有layout就定性hack |
| Toggle/ToggleGroup/Toolbar | 单toggle与互斥组、pressed、焦点与应用command | Theme pressed迁移候选；避免把provider或editor业务塞Toggle |
| Slider/Resizable/Carousel/ScrollArea | 范围、拖动、键盘、geometry与控件标签 | #986已有Slider来源；实测才证明拖动；不要用synthetic dispatch替native |
| Calendar | 日期选择、网格、locale与应用日程 | 旧首页日程数据不是Calendar基本语义；不另造基本calendar业务 |
| Table/DataTable/Tree/VirtualList | 结构、集合、选择、窗口化与应用数据 | 按已有public来源及sourceOnly边界审查；页面数据不原型化 |
| NavigationMenu/native-link | 真导航、修饰键、中键、current | 原生anchor合法；可复用关联/反馈与路由策略分层 |
| Surface/Card/Text/Separator/Image/Lucide | 被动外观、排版、图片/图标语义 | 不因为可见就加action owner；Card不替代所有Surface；Icon装饰性明确 |
| Progress/Meter/Spinner/Skeleton/Badge | 数值或状态展示、可访问名称 | 不把业务计数或loading任务迁入原子 |
| Toast/LiveRegion/AsyncRegion/MessageScroller | 通知顺序、区域更新、状态与滚动 | 审查定义支持集，业务消息/网络回调留调用方 |
| Transition/behaviors/collection-controls | 可复用机制与声明契约 | 不是单独用户业务组件；不能以通用工具掩盖组件私有补丁 |
| style-scope/recipes/presets | family明确profile、作用域、默认part | 拒绝从upstream最新网页自动扩为全量parity；元数据与导出同源 |

### 5.1 各族 main 源码规模与差异

| 包 | main原型文件数 | 不应隐含的保证 |
| --- | --: | --- |
| Base | 176 | 协议/原子存在不等于全部CLI可安装 |
| Shadcn | 192 | 不同组件固定上游可能不同；不能统称最新Base UI |
| Brutalist | 183 | 不是Shadcn换皮；独立外观规则和缺失入口须单列 |
| Bootstrap 2.3.2 | 153 | 旧版family兼容边界与私有/workspace支持不自动升级 |
| Liquid Glass | 146 | 没有独立Checkbox/Switch/Input/Textarea目录不自动判bug；Field/Group可有自己的组合 |
| Lucide | 1个根原型及图标数据 | 单原型承载大量icon，不按图标数虚报原型覆盖 |

## 6. 诊断工作流与同 PR 累积规则

项目真源建议为 `internal/coverage-matrices/composition-delivery-parity.md`，从现有 coverage README 导航。它不是平行手写组件 registry；公共组件身份/支持事实仍取现有定义、源码、exports、CLI registry。Library 仅提供可读副本。

**用户要求：诊断工作流、累计文档和新修复放在同一个 PR。** 因此下面 S0 是设计步骤，不创建孤立文档 PR。首个独立可修的 Base FieldTextarea workspace facade 漏项携带本文和诊断步骤；后续每个相关修复 PR 更新同一记录，保留已失败、未测试和旧问题证据。

### 6.1 每次诊断的可复现步骤

1. 固定源：记录 main、候选 PR head、base 与实际差异；查仓库指令、最新人工回复、claim、在途依赖。分别标记 main 能力和候选能力。
2. 找上游：从 family catalog/notice 查 fixed revision/path/profile，再取官方源码和相关示例。最新 docs 仅补充，不自动改 pin。记录真实采用项、偏离项与未支持项。
3. 找定义：沿公开 export → prototype → Base/association/anatomy → module/host 路径；确定值、activation、focus、name、selection和外观的唯一所有者。
4. 找三端：记录首页、demo、CLI workspace、packed/install分别用什么构造。追到真实 registry/loader/materializer，不只比较 prototypeId 或截图。
5. 建最小复现：先有失败用例/静态负例，区分名字存在、点label、拖选、嵌套独立交互、多实例、禁用、controlled拒绝、生命周期。
6. 选择正确层：消费者漏关联修消费；公开组合缺口补组合契约；family外观缺口修family；host物理缺口修host。业务数据/导航/服务留应用，Compiler不加组件特判。
7. 实施有界修复：同PR修改实现、相关测试、定义/导出/元数据及本文对应行。不得清除sourceOnly、删测试、mock替代真实行为或降低断言。
8. 验证与回填：适用的四Web runtime、生成快照/JS/TS、独立packed consumer、真实浏览器输入、精确head截图；逐项写实际命令/结果/失败/未测，不把计划写成通过。
9. 独立审查与合并：重读精确head、CI、冲突、人工意见、DCO和负责人协调。自测不等于独立验收；缺checks不是绿；关联Issue只关闭实际完成范围。

这些是工程诊断步骤，不新增第三方执行许可、仓库权限或生产发布。若后续把步骤自动化为脚本/CI，必须遵守仓库既有脚本与workflow注册规则，并在同一修复中记录输入、输出、负例和权限边界。

### 6.2 每片追加的固定记录模板

- 来源 Issue、PR、fixed base/head、修改文件与现有 owner/claim。
- 用户可见现象和最小复现，实际/期望分别是什么。
- 官方固定 revision/path/profile；当前目录是否仍按该基线实现。
- 公开定义与唯一语义所有者，homepage/demo/安装链的具体分叉。
- 修复落点、排除项、真实前置依赖与不应依赖的并行工作。
- 测试：未改前失败、改后结果、负向约束、四runtime/生成/浏览器证据。
- 未完成与失败，截图精确commit、CI/独立review结果。
- 是否改变支持矩阵；若仍workspace-only，必须明确保持。

### 6.3 首片记录：Base FieldTextarea workspace facade

状态：**已发布 Draft [PR #1001](https://github.com/Proto-UI/Proto-UI/pull/1001)，首个映射提交为 `bdeef58c20b7479fd2a0a3975dda0e5c8a543d2f`；input shard 续片为 `ee40d097383321316237210f799c6c73e3e07768`。本节保留首片的有界验证，不代表后续 head 的完整验收。**

实际候选验证：guarded Node 24 对照固定 #955 parent 重新核验 registry/codegen 闭包并重跑，改前四宿主×TS/JS 8/8 缺少 facade，改后 8/8 输出正确；两改动 TypeScript 文件 targeted/transitive diagnostics 均为 0。Vitest 启动被 Rollup `ERR_DLOPEN_DISABLED` 阻断，未收集测试，不扩大 native addon 权限。以上不是 Vitest 通过、生成 facade 运行时通过、packed consumer 或 registry 安装通过。纯逻辑变化不需要虚构 UI 截图。已发布 commit 的 CI 与独立审查按该 PR 的精确 head 分别记录，未完成项不因发布而关闭。

main Base `field/index.ts:11–16` 已导出 FieldTextarea，但 CLI Base Field registry item 只生成原六part，现有测试也只看六part。这是公开导出与明确workspace生成入口的漏项，不是新Textarea实现，不需要等待Label+Checkbox新组合。

范围：仅Base Field registry追加既有FieldTextarea、四Web host生成断言、保留sourceOnly与installed拒绝、同PR加入本文/诊断步骤。排除：Shadcn/其他族在途字段、FieldSelectTrigger、sourceOnly准入升级、发布、#925authored-hook逻辑。来源复用[#942](https://github.com/Proto-UI/Proto-UI/issues/942)/[#906](https://github.com/Proto-UI/Proto-UI/issues/906)。精确候选head与实测结果由修复提交补齐。

#### 首片可复核命令与候选绑定

本节原始证据采集于发布前；该候选随后以 `bdeef58c20b7479fd2a0a3975dda0e5c8a543d2f` 发布到 #1001。审计快照仍为 `7181a93a5ec5cad43936a72e31d5477d5488733a`；本片实现与重新执行的验证基线为 #955 head `b01cd33661850db5d8cba37122d732384c472083`。原 main-parent 证据保留为历史，不用来冒充这次重跑。[首片开发评论](https://github.com/Proto-UI/Proto-UI/pull/1001#issuecomment-6393927428) 已绑定真实 SHA、CI 与剩余证据；任何后续源改动都需要重核。

该 #955 parent 与审计 main 不同：Shadcn Field 已导出 `fieldTextarea` / `shadcnFieldTextarea`（blob `e023230ba16b9ce6598d20d266725bdcc05bf592`）。本片完整保留这项在途能力，但不修其 registry，不宣称所有 Field facade 闭包已齐全。

生产改动只追加 Base Field registry item：`fieldTextarea` → `BaseFieldTextarea`，WC 名为 `BaseFieldTextareaElement` / `proto-ui-base-field-textarea`。既有六part未删改，所有 family 的 `sourceOnly`、installed 拒绝与公共 choices 排除均未放宽。测试沿用 `packages/cli/test/field-prototype.test.ts`，新增四宿主×TS/JS，核对具体 import/facade、唯一声明及负向准入，没有新建 CI workflow 或扩大 Actions 权限。

在受限 Node 24 环境中实际执行的命令（以验证工作目录为相对根）：

- `node --import ./field-facade-loader.mjs check-field-facade.mjs`：相同本地诊断 probe，在原 registry 上退出 1，8 个案例均精确报告缺少 FieldTextarea facade；只追加 registry item 后退出 0，8 个案例无失败。loader 仅转译 TypeScript；probe 实际调用库的 `renderHostIndex` / `listComponentChoices`，不是对源码字符串 grep。此本地诊断程序不是新增项目公共 API，也不冒称已经执行了仓库 Vitest 测试。
- `node check-field-types.mjs`：TypeScript API 检查上述两个改动文件及导入图，退出 0，targeted=0、transitive=0。不是全仓 typecheck。
- `node node_modules/vitest/vitest.mjs run packages/cli/test/field-prototype.test.ts`：实际退出 1；Rollup 试图加载 native addon 时 `ERR_DLOPEN_DISABLED`，在测试收集前失败。保留失败，不安装新包、不扩大 addon/worker/网络权限。该失败不能被前述有限 probe 覆盖。

这些本地诊断脚本和日志用于本次证据，不是仓库已有命令。可在仓库支持的 Node 24 / pnpm 10.32.1 CI 环境复跑实际提交的测试：`corepack pnpm@10.32.1 exec vitest run packages/cli/test/field-prototype.test.ts`；随后按现有项目验证规则执行适用类型检查。后续 CI 必须记录真实收集到的测试及结论。Generated facade 运行时、packed consumer、registry 安装及 UI 本轮未执行，不能从生成文本正确推定通过。

候选与输出内容绑定：

| 材料 | SHA / SHA-256 |
| --- | --- |
| `packages/cli/src/registry/components.ts` 基线 blob | `8bd17346e072495a047f41f95aa299a531bc4384` |
| 同文件候选 blob | `5049a9f6b1d79c9d57bcc9fe3e6a57ca6c823c65` |
| `packages/cli/test/field-prototype.test.ts` 基线 blob | `a1591e26b31569a8f9cd58a8caceadc145ff60e3` |
| 同文件候选 blob | `50c34fa185d6897b7051541a13a5fe48b7ab6595` |
| red stdout SHA-256 | `1f494f77a270c7d0662551b235a63629bcc958a9158358eb255c83a5871f9eb8` |
| red stderr SHA-256 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| green stdout SHA-256 | `882bccbddaecad7d6ddf8bd1b198b910f6993973a816165885e1b9b32a46cb36` |
| green stderr SHA-256 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| types stdout SHA-256 | `36c65db680b3a74d8dc3bd91d3fad321dd380d38bda890b04ac378f07642f17b` |
| types stderr SHA-256 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| vitest stdout SHA-256 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| vitest stderr SHA-256 | `603961a823b31441cc4eb17839180532937c3d17e0bdbaea24c213757d619447` |

以上摘要保持红、绿及启动失败三类证据各自独立；#1001 已有精确 head CI 与 source-review 记录，但仍有未解决失败，不能称最终验收通过。

## 7. 可实施 Stacked Issues / PR 依赖图

```text
已有 main Base FieldTextarea export
  └─ F0 Base workspace facade 漏项修复 + 本文/诊断workflow（可立即独立验证）

S0 定义推荐composition、上游和支持矩阵（设计步骤，随真实修复提交，不独立doc PR）
  └─ S1 一个 Label + Checkbox 公共推荐构造，保留raw atoms
       ├─ S3a 首页 + docs 共用同一公开构造
       └─ S2 该构造的packed/安装闭包
            └─ S3b 安装后的同样组合与真实输入一致性

既有 #942/#954 Textarea  ──→ 对应字段/textarea消费迁移
既有 #962/#975 Select   ──→ 五族命名补丁按实际支持逐片移除
既有 #979/#987 Switch   ──→ 对应optional Field/普通Switch推荐组合
独立：Theme pressed语义；Brutalist Tabs wrap；定义/实现漂移修订
```

不是每个箭头都要求新建Issue。复用既有来源，只有现有Issue无法承载独立验收的具体交付时才创建有界子项；每PR base必须真实包含依赖，不能只在正文写depends-on。

| 切片 | 范围 | 排除 | 验收 | 来源/负责人边界 |
| --- | --- | --- | --- | --- |
| F0 | Base FieldTextarea workspace facade补齐+四host断言+本文 | installed放行、其他族/SelectTrigger | 生成包含正确适配器与公开import；sourceOnly/default拒绝仍成立 | #942/#906；现有cyjin-yl贡献，写前复核精确hunkclaim |
| S0/S1 | 一个公开Label+Checkbox推荐构造、内容/关系/销毁契约 | 任意React slot兼容、第二状态机、每族一套机制 | 多实例不串、动态label、单次激活、disabled/controlled/mixed、raw可用 | #865/#870/#503；新精确五文件consumer claim不自动扩大为公共APIowner |
| S2 | 对S1真正依赖的exports/registry/assets闭包与clean packed consumer | npm发布、private族放行、Compiler全target承诺 | 无monorepo alias/私有import；默认替换省略与负向准入；独立锁文件 | #503/#505；涉及#925CLI hunks必须协调，不接管其任务 |
| S3a | 首页/docs采用同公共构造，raw例清楚区分 | 页面click转发、copied aria-label作为最终方案 | 同源构造+行为矩阵；精确head截图/状态转换 | #865/#933/#568；共享runtime仍受#921协调 |
| S3b | 对已admitted target安装示例与浏览器验证 | workspace成果冒充已发布支持 | fresh artifact执行与网页相同验收；失败保留 | S2实际产物；未admitted族只明确workspace |
| T1 | Input/Textarea可见Label；必要时FieldTextarea | 接管编辑/IME/caret、复制名称 | focus-only，readOnly/disabled分开，输入身份保留 | #942/#954/#955与#906；先重用已有能力 |
| T2 | Select实际Field命名关系，逐片去observer | 扩成普通ControlLabel第六target，接管portal | label/value名字分离、无循环、多实例/关闭/重挂 | #962/#965、#975/#978；仅在真实前置合入后声明main |
| T3 | 普通Switch或optionalField推荐消费 | 新checked所有者/拖动机制 | label/keyboard一次、disabled、controlled与状态同步 | #979/#980、#987/#988；Brutalist draft命名条款须同步 |
| I1 | Theme Button按公开Toggle语义承载pressed | theme provider/持久化下沉Base | provider外部变化、键盘、旧generation停止 | #420/#911；#921共享runtime仍保留owner |
| I2 | Brutalist Tabs公开wrap/profile后两处消费 | Base roving重写、固定viewport默认变化 | 320px/200%字放大、长标签、focus、默认不变 | #909/#870；不因#934是Tabs就视为Brutalistowner |
| I3 | family总纲与已实现零件同步，精确保留缺项 | 虚构新runtime保证 | catalog、exports、test三方一致、支持/缺失分列 | 例如Shadcn Dropdown总纲；既有相关owner需确认 |

### 7.1 在途映射和不能接管的范围

- #954 → #955：Textarea投影与Field相关已有链；#958 → #959：四部件Card；#962 → #965：FieldSelectTrigger；#975 → #978：Select投影；#979 → #980：FieldSwitch；#987 → #988：Switch投影。
- #933既有首页范围有#936/#964/#973/#982/#984，不能由此接管#921共享runtime/native-links/startup-theme。#921协调意见未获新的范围释放。
- #865旧广泛claim已RELEASED；新有限Checkbox consumer claim为[6393741933](https://github.com/Proto-UI/Proto-UI/issues/865#issuecomment-6393741933)。该候选须按当前公开composition设计重审，不能把五文件消费修复宣传为安装架构已完成。
- #732/#997是有界SSR/compiler修复（#997已于上述时间合并），#817是另一有界compiler/inventory范围，#925是authored-hook provenance；都不是通用composition/CLI所有权授权。
- 不能确认精确slice owner的工作标“负责人/精确切片待确认”，不能标“无人负责”然后接管。时间到期也不自动等于释放共享文件。

## 8. 验收矩阵与发布门

| 层 | 必测 | 不能作为替代证据 |
| --- | --- | --- |
| 源/定义 | fixed pin、admitted anatomy、public exports、metadata与registry一致 | 目录同名、旧catalog口头说明 |
| 生成 | WC/React/Vue/Vue2；TS/JS；raw/default/replacement/omission；明确支持门 | 网站webpack/alias能解析 |
| 逻辑 | checked/mixed/controlled拒绝、disabled/readOnly、关系生命周期、多实例 | 只测happy-path截图 |
| 真实浏览器 | pointer/keyboard、焦点、文字拖选、嵌套link/button、IME、重挂/换runtime | dispatchEvent、mock Selection、旧head录像 |
| 可访问性 | visible label/name一致；Description独立；控件状态只一份；disabled语义 | 单纯有aria-label字符串 |
| 外观 | 相应family固定上游、声明profile、长内容/窄屏/文字缩放 | 最新另variant截图、主观“更像” |
| 安装 | 实际packed artifact、干净consumer、无私有路径；合法registry范围 | workspace-only通过、sourceOnly删掉 |
| 合并 | exact head、真实checks、人工意见、冲突、DCO、owner协调 | 缺checks、“自测就是独立验收” |

没有浏览器或安装证据的格子明确写未测。交互源码已存在不等于四runtime全通过；生成代码存在不等于npm已可安装；同一固定源码的上游静态阅读不授予执行第三方或升级版本的权限。

## 9. 安装交付完整入口矩阵（静态）

### B. Registry facade 覆盖缺口（不是语义不存在）

完整枚举两个registry，应用components.ts覆盖FINF spread；共227条entry，公开63，workspace-only164。计数是CLI入口，不是独立prototype数量、不表示发布已验证。逐项数据来自这两个精确版本 registry。

#### base: 52入口；公开21；workspace 31

- 公开：label, surface, text, button, toggle, transition, textarea, image, table, accordion, collapsible, switch, tabs, radio-group, dropdown, select, hover-card, separator, live-region, async-region, dialog
- workspace：alert-dialog, drawer, popover, toggle-group, toolbar, toast, autocomplete, combobox, command, menubar, navigation-menu, context-menu, progress, meter, fieldset, form, checkbox-group, slider-values, slider, number-field, input-otp, calendar, tree, message-scroller, resizable, carousel, virtual-list, date-picker, data-table, dropdown-composition, field

#### shadcn: 51入口；公开21；workspace 30

- 公开：label, card, surface, text, input, button, toggle, separator, textarea, checkbox, switch, tabs, hover-card, dropdown, select, radio-group, scroll-area, tooltip, dialog, accordion, collapsible
- workspace：alert-dialog, drawer, popover, toggle-group, toolbar, toast, autocomplete, combobox, command, menubar, navigation-menu, context-menu, progress, meter, fieldset, form, checkbox-group, slider, number-field, input-otp, calendar, tree, message-scroller, resizable, carousel, virtual-list, date-picker, data-table, dropdown-composition, field

#### brutalist: 51入口；公开21；workspace 30

- 公开：label, surface, text, button, badge, toggle, separator, skeleton, spinner, input, textarea, card, switch, tabs, hover-card, dropdown, select, dialog, scroll-area, accordion, collapsible
- workspace：alert-dialog, drawer, popover, toggle-group, toolbar, toast, autocomplete, combobox, command, menubar, navigation-menu, context-menu, progress, meter, fieldset, form, checkbox-group, slider, number-field, input-otp, calendar, tree, message-scroller, resizable, carousel, virtual-list, date-picker, data-table, dropdown-composition, field

#### bootstrap-2-3-2: 36入口；公开0；workspace 36

- 公开：无
- workspace：alert-dialog, drawer, popover, toggle-group, toolbar, toast, autocomplete, combobox, command, menubar, navigation-menu, context-menu, progress, meter, fieldset, form, checkbox-group, slider, number-field, input-otp, calendar, tree, message-scroller, resizable, carousel, virtual-list, date-picker, data-table, dropdown, field, label, text, accordion, tabs, select, collapsible

#### liquid-glass: 37入口；公开0；workspace 37

- 公开：无
- workspace：alert-dialog, drawer, popover, toggle-group, toolbar, toast, autocomplete, combobox, command, menubar, navigation-menu, context-menu, progress, meter, fieldset, form, checkbox-group, slider, number-field, input-otp, calendar, tree, message-scroller, resizable, carousel, virtual-list, date-picker, data-table, dropdown, toggle, field, label, text, accordion, tabs, select, collapsible

对照各族 exact-main package.json exports，以下组件subpath有导出但没有任何对应CLI entry：

- Base：checkbox、tooltip、scroll-area、input。
- Brutalist：checkbox、tooltip。
- Bootstrap 2.3.2：button、checkbox、switch、toggle、input、textarea、separator、surface。
- Liquid Glass：button、surface。
- Shadcn：未发现组件subpath缺entry；style-scope不是控件入口，不能算缺组件。

排除behaviors/tools/theme/virtual-list/web等辅助subpath，不把这些当作必须一键安装的组件。Bootstrap/Liquid package private:true，现阶段只能补明确workspace表面，不可顺便解除发布门。Base/Brutalist现有包subpath不代表CLI已经支持 `add base-checkbox` / `add brutalist-checkbox`；getComponentEntry找不到时add直接unsupported。缺口需先核对准入与历史原因，然后给出entry或显式文档边界，不能从导出自动推断发布许可。

### C. Field composition 的真实main/在途边界

`components.ts:227-435` 五族Field均sourceOnly，仅列Root/Label/Control/Description/Error/Validity六part。Exact-main `packages/prototypes/base/src/field/index.ts:11-16` 已导出FieldTextarea，但registry没有此part，因此即便明确workspace生成也不提供BaseFieldTextarea facade。`packages/cli/test/field-prototype.test.ts:7-24` 只断言六part，漏项不会被现有测试发现。

重要校正：在途实现不等于main。main Shadcn field/index仍只有六part；main Base field/index没有FieldSelectTrigger。在途的Shadcn FieldTextarea与两族SelectTrigger必须与#942/#954、#962/#975当前PR协调，不能在main报告里宣称已存在或重复实现。另三族field/index也只有六part。

### D. 安装准入是真实负向约束，不是应删掉的障碍

`commands/add.ts:50-54` 在安装之前拒绝sourceOnly；`services/codegen.ts:248-271` 默认installed，workspace必须显式选择；`components.ts:1685-1704` 公共choices排除workspace项。`label-prototype.test.ts:10-30`明确Base/Shadcn/Brutalist Label可生成installed facade，Bootstrap/Liquid Label仅workspace。五族Field、FINF组合入口均保留workspace边界。

因此验收要四栏分开：网页源码演示、workspace生成、独立packed consumer、真正registry install。当前审计仅静态证明门和源码，不宣称四栏通过。CLI config v1还只允许一个project-wide style preset（add.ts:125-140），网站多族切换不能当作安装项目可直接混用多族的承诺。

### E. Demo关联协议不等于公共安装组合

`apps/www/src/components/PrototypePreviewer/demo-types.ts:35-40,263-279` 的 associations.controlLabel 是按demo渲染作用域的序列化关系意图；demo-renderer.ts通过WC setElementAssociations与框架instanceAssociations适配。这个原语应被推荐组合复用，而不是在页面手写.click()/aria状态。CLI codegen当前没有此关系recipe输入；不能把DemoSpec字段原样当作消费者组件prop。

## 10. 其他家族固定上游与逐问题追溯

### 范围、结论与证据等级

Proto 基线：`7181a93a5ec5cad43936a72e31d5477d5488733a`。只读静态比对；未运行第三方源码，未执行浏览器、辅助技术、Compiler 或 native 验收。以下“缺口”不等于违反已稳定保证，相关 P 实体仍为 draft。本次逐文件核对精确 main 与官方来源；固定 URL、Git blob 或内容哈希按下表记录。此前主页 inventory 的消费者证据与本补充合并使用。

重要结论：

1. 固定 shadcn Switch 示例明确是独立 `Switch` 与 `Label htmlFor` 的组合；Switch 自带 Thumb，但不自带文字标签。任意 children/内容槽不等于 `asChild`/Radix Slot，不能以扩大 Checkbox/Switch 控制面来替代推荐标签组合。
2. 发现两项确切总纲漂移：Shadcn Dropdown Root 仍把已存在的 Group/Label/Separator/Shortcut 列为缺失；Dialog Root 的旧 parts 列表未覆盖已导出的 Header/Footer 和已存在默认 CloseIcon preset。应修正追踪与文档，不再新造一套实现。
3. Brutalist Switch 现行 draft 仍要求 demo 的可见 caption 放进 Root；main demo 确实这么做且用绝对定位移出轨道。把它迁到独立 Label 必须同步调整该旧 draft，不可仅更改页面再称符合定义。
4. 每组件、每 part 可以有不同且明确的固定基线，这不是缺陷。Tabs 的新 text/default 来源不能被 Root 的历史 URL 覆盖；Select structural parts 的独立升级也不能扩大到完整 Select 已升级。
5. 未验证的交互/视觉不能由 source presence 或 wrapper 转发推断为通过；底层库版本未锁定时更不能把当前文档行为归到旧 pin。

### 固定来源矩阵

| 家族/组件 | 已采用基线与范围 | 本次官方证据 | 不能作出的推论 |
| --- | --- | --- | --- |
| Shadcn Switch | New York `02cad61166c4c20edbc8a3f71bd720eed4c1f49b` | `apps/v4/registry/new-york-v4/ui/switch.tsx`，blob `c45932af…`；同 revision `examples/switch-demo.tsx` | Nova 历史扩展命中区不是当前默认；current docs invalid 示例不代表 NY wrapper 有 invalid paint |
| Shadcn Toggle | New York `02cad611…` | 同目录 `toggle.tsx`，blob `0291f01c…` | Base active/pressed 不等于已具备所有 variant/icon/native forwarding |
| Shadcn Input | 2026-10-10 base-nova registry 内容快照 | main P-SHADCN-INPUT：registry SHA256 `bbad1bba130ac9750a61844eeb8f043e8a710846e07689fa85398b80a46c2741`，TSX `dab990dfefa0ba78854ab6602ad074270dba9d7d1262184d9bfbb62bd990903b` | 本次未重取得可匹配的旧快照正文；不得用今天同 URL 内容代替旧快照，不推断 Git revision |
| Shadcn Textarea | `3d98900e9b73c45f035f8109e9d41ba6a51685e7`，NY 与 Rhea | NY `ui/textarea.tsx` blob `bf23f6c2…`；`bases/base/ui/textarea.tsx`；P 引用同 revision style-rhea.css | native field-sizing-content 是宿主布局能力，不应改为页面 JS 计算高度 |
| Shadcn Select | Root 历史 `f31ed819…`；已采用结构 parts `02cad611…` | `02cad611…/new-york-v4/ui/select.tsx` blob `8058e266…`；P-…STRUCTURAL-PARTS 明确 Radix Select 2.2.6 | 结构 parts 升级不是完整 Select 全 API/尺寸/动画已迁移；不应混入 Base UI multiple 作为 Radix 必修缺陷 |
| Shadcn Tabs | Root 历史 `f31ed819…`；现行 text/default NY/Nova/Rhea 为 `3d98900…` | main `internal/fixtures/shadcn-tabs-style/coverage.json`，sourceTree `81a576ce…`；本次复取3d989 NY wrapper | legacy `appearance=underline` 不是 upstream `variant=line`；六种未实现 style 不能静默回退 |
| Shadcn Dialog/Menu | `f31ed81983653919dd4fe77aee4b4859f610f1dc` | 同目录 `dialog.tsx` 与 `dropdown-menu.tsx` 精确正文已取得 | 不得只按旧 Root openQuestions 判所有 anatomy 缺失 |
| Neo/Brutalist 全部本次对照 | 仓库声明 `ekmas/neobrutalism-components@3306a802724874a85f93079702b2795370a279d4` | `src/components/ui/{switch,input,textarea,select,tabs,toggle,dialog,dropdown-menu}.tsx` 均复取；package.json | 此 pin 的控件用 `@base-ui/react`，不是 Radix；依赖 `^1.8.0` 只是范围，本次未确认锁文件 resolved 版本 |
| Bootstrap | 仅 `twbs/bootstrap@v2.3.2` | `docs/base-css.html` blob `e7ba257d…`；`docs/javascript.html` blob `9166fe35…`；P 中固定 less 路径 | 不借用 v3/v4/v5；Switch 明确为 Proto design-language extension，不存在应复刻的官方2.3.2 Switch |
| Liquid Glass | Proto 独立设计语言投射；部分 P 引用 Apple HIG/materials/WWDC25 | main P-LIQUID-GLASS-TOGGLE 明确非 Apple component/shader parity；官方 HIG URL 可定位，但正文抓取未成功 | 不制造 Apple 私有组件源码/pin；不能用 CSS blur 或两张图声称光学/原生一致 |

官方固定链接示例：

- [Shadcn Switch 默认示例](https://github.com/shadcn-ui/ui/blob/02cad61166c4c20edbc8a3f71bd720eed4c1f49b/apps/v4/registry/new-york-v4/examples/switch-demo.tsx)
- [Neo Switch](https://github.com/ekmas/neobrutalism-components/blob/3306a802724874a85f93079702b2795370a279d4/src/components/ui/switch.tsx)
- [Shadcn Dialog](https://github.com/shadcn-ui/ui/blob/f31ed81983653919dd4fe77aee4b4859f610f1dc/apps/v4/registry/new-york-v4/ui/dialog.tsx)
- [Bootstrap 2.3.2 forms](https://github.com/twbs/bootstrap/blob/v2.3.2/docs/base-css.html)

### 可执行诊断与修复矩阵

严重度：S1 = 可访问操作/状态所有权受影响的优先修复；S2 = 组合、公开能力或定义漂移；S3 = 来源/证据补齐。置信度与严重度分开。以下不重复创建已有 owner 项。

| ID | 判定与证据 | 修复层/依赖 | 可复现、可关闭标准 |
| --- | --- | --- | --- |
| U-SW-01 | S1 消费者缺口：主页可见 Switch 文本与隐藏命名分离。固定官方示例 L6–8 是 sibling Switch+Label；wrapper L24–30 只自动 Thumb。与 Checkbox 同类，但不是“上游自带文字” | 现有 ControlLabel + family Label + demo/主页/CLI推荐 recipe；Base Switch 保留 checked owner；依赖现有 #865 | 可见 Label 点击恰好一次请求；disabled不切换/不抢焦点；受控拒绝/延迟保持owner值；替换文案后名称来自可见源；附同commit四Web真实操作证据 |
| U-SW-02 | S2 定义迁移：P-BRUTALIST-SWITCH 的 DEMO-NAMING 要求 caption inside Root；main demo L3–4 absolute left-full，L22–28 caption在Root。不是尚未关联标签的同一种实现 | 先修订该draft与相关T；推荐独立组合，保留raw Root能力，不假定任意nested交互可作为label内容 | 新推荐组合无绝对定位挪动标签；安装后示例/demo/主页一致；名称、点击、禁用均验证；不得只删旧断言 |
| U-SW-03 | S2 明确上游能力差异：Neo Switch wrapper size=default/sm，默认h-6 w-12、sm h-5 w-9；main BrutalistSwitchRootProps只扩展draggable?:false，无size | Family视觉size owner与Thumb逻辑关系，复用合法通用能力；不是Base选择语义 | 显式sm及default可逆切换，Thumb归属隔离，checked不变，root字体缩放保持rem；drag显式unsupported不得计为已实现 |
| U-IN-01 | S2 目标能力缺口而非当前plain-text违约：Neo Input用React.ComponentProps<input>转发type，main InputRootProps L11–25只有text相关props，无type；Bootstrap forms也包含不同native inputs | 先定义host-neutral输入种类/文件选择边界，再Base与Host能力；不是给页面塞原生input | 明确范围、value类型、隐私/文件选择与校验所有权后才实现；plain-text IME/readOnly/selection不回归；不要把inputMode误称type支持 |
| U-TA-01 | S1 消费者关联：主页Textarea视觉label+复制ariaLabel而非可见语义关联，普通ControlLabel已可用；FieldTextarea按Base main/其他族在途区分 | 消费者采用已有Field/Label；不新增编辑器、不页面测高 | Label只聚焦不改value；disabled与readOnly区分；IME composition、caret、拖选在controlled延迟及runtime替换下保持；Rhea/NY native intrinsic sizing单独验证 |
| U-SE-01 | S1 消费者workaround：主页Select trigger用aria-label重写observer；普通Select Trigger public naming与FieldSelectTrigger区分 | FieldLabel + FieldSelectTrigger；现有ControlLabel五目标不可擅自当普通Select第六目标；删除observer须等替代成立 | live labelledBy供可见field名，选中值另保留；portal/remount关系不陈旧；disabled/readOnly正确；无属性重写循环 |
| U-SE-02 | S2/证据：02cad SelectContent自动Portal/ScrollUp/Viewport/ScrollDown，Trigger自动Chevron，Item自动indicator+ItemText；Proto公开分件不是同名wrapper自动等价 | 逐preset/生成facade核对默认部件，不把合法raw组成报错；补最小公共recipe与CLI证据 | 从安装输出而非内部demo import运行默认/替换/省略；图标和滚动部件一份且归属正确；Group/Label/Separator已在新P实现，不再列为全缺 |
| U-TB-01 | S2 已知受限能力：NY/Nova/Rhea text/default已覆盖；line、nested SVG/inline icon和六style明示未支持。Neo固定源码同样有default/line、vertical与图标选择器；主页强制wrap是消费者特例 | #935 已关闭，仅作历史 owned-decoration 来源；当前开放 #956/#961/#968/#974 等按精确 scope 协调。#934 只涉及 Shadcn，不是 Brutalist owner；family 定义 wrap/密度，保持 Base roving | 320px、200%字体、长中英文本；orientation/RTL、auto/manual activation；样式变化不重建节点/丢焦点；underline不冒充line；缩放不裁切且默认recipe不被静默改变 |
| U-TG-01 | S1 语义消费者问题：主题Button由页面写aria-pressed，已有Toggle active可表达持续状态；外部theme provider仍是业务owner | controlled Toggle或明确定义command语义；不改BaseButton令其拥有theme | 外部theme更新同步pressed；Space/Enter/点击单次；hover/瞬时pressed与active区分；样式切换不清active；禁用/减少动画适用时测试 |
| U-DG-01 | S2 确切定义漂移：P-SHADCN-DIALOG仍称7 parts；main index导出Header/Footer/CloseIcon，preset导出ShadcnDialogContent并自动可替换CloseIcon；Base P已含Header/Footer | 修订Root compatibility清单与引用，复用已实现preset；不能另造Header/Footer | 静态核对总纲、parts、exports、CLI一致；新安装默认只有一个Close，显式替换/省略正常；不把仅Close preset称完整Portal+Overlay默认组合 |
| U-DG-02 | S2/未知：官方DialogContent自动Portal+Overlay+默认Close；Neo同样showCloseButton=true。Proto合法raw parts不能自动算缺陷；完整便捷composition是否一致需单独证据 | Base modal focus/dismiss，family preset和Host portal各守owner | Title/Description命名；Tab圈定、Escape/外点、关闭返焦；嵌套overlay先关子层；controlled拒绝/延迟；快速开关、200ms动画中断与reduced-motion，不以timer/端点图代替轨迹 |
| U-MN-01 | S2 确切总纲漂移：P-SHADCN-DROPDOWN-MENU称Group/Label/Separator/Shortcut缺失，而main index L33–39导出它们，Group专有P也在main | 文档/定义跟实现核对，保留剩余真正缺口；不新造既有parts | 总纲可追到每part P/T/export；测试group命名、separator非交互、shortcut不执行任意快捷键 |
| U-MN-02 | S2 真正未完成目标：固定shadcn和Neo都公开Sub/SubTrigger/SubContent、CheckboxItem/RadioGroup/RadioItem；main Base DropdownItem仅disabled/value/textValue/closeOnCommit，无checked/radio状态，family未导出这些parts | 先Base中性子菜单/多种selection定义与focus/dismiss策略，再family；Compiler/IR归既有owner | Right/Left/RTL开关子菜单、hover安全区、Escape逐层、父子focus返回；checkbox混合与radio单选；disabled与controlled拒绝；当前普通action menu主页不因此自动算坏 |
| U-HD-01 | S2 架构提取候选，不是“同名上游Header缺陷”：Header非modal站点导航，不应改成modal Dialog或action menu | #921：app保留route/responsive/跨panel策略；公共disclosure/popover负责中性open/focus/dismiss；Host负责geometry | Tab自由离开，无强制trap；嵌套Select第一Escape自己消费，第二Escape关Header；portal子内容不算外点；resize/runtime替换不误返焦 |
| U-LG-01 | S3 证据债：Liquid Glass是独立投射，不是Apple组件复刻；部分检索不到同名P也不能认定实现缺失 | 按实际实体/包导出继续映射；Host material owner提供光学证据；不假造Apple upstream源码 | opaque fallback、对比度、非颜色选中标记、reduced-transparency/减少动画的已准入范围逐项验证；未取得即未验证 |

### 默认组合与 slot 必须分开记录

- 标签是控制器旁的可见命名/激活组合，不是 Switch Track、Checkbox Indicator 或文本输入编辑器本身的任意 children。Label内容可以是合法非交互内容组合，但不因此允许嵌套按钮/链接抢占激活而无明确规则。
- 上游 React `children`、内部固定Thumb/Close、`asChild` 或 Base UI `render` 是四种不同机制。Proto内容槽只证明保留内容；D-AS-CHILD-OMISSION-0001 是有意偏离，不能写成已兼容Slot。
- Raw parts 与 convenience preset均可合法存在。默认推荐组合必须有唯一公开定义，安装结果/demo/主页消费同一个recipe；测试要分别覆盖默认、显式替换、显式关闭和raw定制。
- Select的官方GroupLabel是popup分组名，不是外部field可见label；同叫Label不能混用。DialogHeader是对话框内部结构，不是网站Header。
- 文本选择策略只加在可激活subject；长说明/普通Text仍可复制。不能用全页select-none掩盖点击与拖选边界。

### 共用验收与依赖顺序

首片为前述Base FieldTextarea workspace facade；之后在各相关修复PR累计U-SW-01/U-SW-02/U-TA-01/U-SE-01及Checkbox证据。U-DG-01/U-MN-01的定义同步须随相应真实修复交付，避免过时缺口导致重复实现。后续状态/样式/结构能力按现有issue owner分支，不强占 #921 或 Compiler/IR 的现有范围。#935 已关闭，不再列作活跃 owner/依赖；#956/#961/#968/#974 等开放载体按具体 scope 协调，#934 的 Shadcn 范围不覆盖 Brutalist。

每项证据至少记录exact commit、component-family/profile、安装facade或raw entry、viewport/root font、light/dark、input序列、预期/实得、自动检查与真实输入分别状态。四Web是WC/React/Vue/Vue2；native/Compiler单列。控制接受/拒绝/延迟，disabled/readOnly，移除/重挂/owner变化，IME/selection，方向/keyboard，打开关闭/中断反转与减少动画按组件适用性列明。遗漏应写unknown/unrun，不写pass。

本次未证明任何动态失败复现，也未宣布任何项关闭。Apple HIG正文、Input旧内容快照正文、Neo resolved依赖版本仍为来源补证任务；它们不阻止已有固定wrapper和main静态事实支撑的有界修复。

## 附录 A. 原首页 28 类功能面与身份链（保留来源，补充 main/在途限定）

以下内容承接前一份首页审计，迁移策略以本报告公开 composition 与安装支持要求为准。原“修 demo”是行为修复的必要步骤，不代表独立完成公共组合交付。

### 3. 优先迁移：六类明确问题

#### 01. Checkbox：已有原型能力未进入独立 demo

**位置：** `Homepage/homepage-gallery-parts.ts`，main 第 103–120 行；#984 第 112–135 行。首页已使用 family Checkbox + 独立 family Label，双方共享 `associations.controlLabel`；Label 的 `naming:true, activation:true`。

**现状：** 这不是首页 click 转发。`packages/prototypes/base/src/label/root.proto.ts:9–18` 已负责关联配置及 actionable Label 的 select-none；BaseCheckbox 保留真正 activation/checked 所有权。Shadcn、Brutalist、Bootstrap 的独立 Checkbox demo 则仍有“可见 sibling box + sr-only 命名副本”，Base demo 使用 root 内文本及页面 select-none。

**落点：** 修 demo 消费，复用已有公开关联。不增加 `.click()`、直接 set checked、另建 Label API。与 [#865](https://github.com/Proto-UI/Proto-UI/issues/865) 的关联边界对齐。

**验收：** 点击可见短标签只切换一次；disabled 不切换/抢焦点；controlled 回调一次；indeterminate 保持既有语义；拖动文字、修饰键、嵌套链接和独立长描述不被误当作 toggle。首页与独立 demo 四个 Web runtimes 使用同一组用例。

#### 02. Switch：可见标签缺少语义关联

**位置：** `Homepage/homepage-showcase.ts` 的 `label(copy.summary)`、`settings-summary`；main 第 203 行附近，#984 第 224 行附近。当前是普通 box/Text 与 Switch 并列，Switch 内含 sr-only 命名副本。

**落点：** 独立 family Label + 显式 controlLabel 关联；BaseSwitch 已是直接支持目标。页面保留通知偏好值，Label 不拥有第二份 checked。

**排除：** 不改变 Switch 激活模型，不修改 Compiler，不把所有文字变为点击区域。

**验收：** 可见标签的命名和点击一致；disabled、controlled、重复点击、卸载/重挂和四 runtimes；独立 Switch demo 同步采用相同语义。

#### 03. Textarea：可见标签与编辑器只是复制文本

**位置：** `Homepage/homepage-showcase.ts`，`label(copy.note)` + `ariaLabel:copy.note`；main 第 222–231 行，#984 第 245 行附近。

**落点：** 使用已有 Textarea ControlLabel 的 focus-only 关联；若需要字段级错误/描述/状态，则使用 FieldTextarea。命名取实际渲染 Label，避免副本。

**排除：** 标签点击不得修改 value、移动 caret 到指定位置或接管 IME；readOnly 不等于 disabled。

**验收：** 点击标签仅请求合法焦点；disabled/readOnly、IME、caret、拖选、标签动态更新和关系清理正确；首页与 Textarea/Field demo 一致。

#### 04. Select：MutationObserver 强写 aria-label

**位置：** `Homepage/homepage-showcase.ts` main 第 380–389 行、#984 第 392–401 行，`restoreLabel()` 和 MutationObserver；`PrototypePreviewer/projection-composition.ts:511–636,918–919` 也使用 Text 标签、未声明的 aria-label prop / 直接属性。

**根因：** 普通 BaseSelectTrigger 公开 props 只有 disabled，并以 content 命名；消费者通过反复重写 DOM 维持字段上下文。

**在途能力，不是 main 保证：** #965/#978 依赖链提供 `packages/prototypes/base/src/field/select-trigger.proto.ts` 与 `setupSelectTrigger({fieldBinding:true})`，允许 Field labelledBy 优先和 focus-only 目标。main 7181 尚无此 part；各 family 的实际投影与安装支持必须按本文第 9 节核对。

**落点：** 使用 FieldLabel/FieldSelectTrigger 的已定义 anatomy。不能把普通 Select 擅自扩为直接 ControlLabel 第六目标。只有替代关系跨 runtimes 验证后才删除属性重写观察器。

**验收：** visible Label 通过真实关系命名，当前值独立呈现；无命名循环；disabled/readOnly、portal、runtime 替换关系保留；Header/preview controls/独立 Select 与 Field demo 一致。

#### 05. 主题 Button：直接写 aria-pressed

**位置：** `Homepage/homepage-runtime-client.ts:83–119`，`bindThemeButton()`。

**现状：** Button click 调用 Starlight provider 合理；但 `button.setAttribute('aria-pressed', ...)` 让 toggle accessibility 状态存在于页面 DOM 补丁，而非实例公开语义。

**落点：** 检查是否可用 public Toggle 的 controlled active 表示主题状态；若现有定义不满足，先明确 command/toggle 语义。主题 provider、持久化和页面主题选择仍归应用。

**排除：** 不把 dark theme 业务状态塞入 BaseButton，不对 Compiler 增加 themeButton 特判。

**验收：** 外部主题变化后 pressed 状态同步；pointer/keyboard 各切换一次；WC native/custom channel 不双发；旧 generation 不再触发。

#### 06. Brutalist Tabs：首页按 prototypeId 注入换行样式

**位置：** `Homepage/homepage-gallery-parts.ts:56–80`：对 `brutalist-tabs-list` 注入 height:auto/minHeight3rem/flexWrap，对 trigger 注入 whiteSpace:normal/overflowWrap:anywhere。

**现有 family：** `brutalist/src/tabs/list.proto.ts` 默认 h-12；trigger 默认 whitespace-nowrap；公开 appearance 为 default/underline，没有对应 wrap 能力。

**落点：** 根据 family 定义与上游外观原则，定义可复用 wrap/density 能力或复用合适公开 recipe，再让首页和 docs 同样 opt in。Base roving keyboard、orientation、selection 保持不变。

**验收：** 320px、长中英文、200% text resize 下不裁切/撑破视口；所有标签可聚焦操作；default profile 不变；不引入组件名 Compiler 分支。

### 4. 基础设施与职责边界：七类

#### 07. 受控 props 更新调度重复

`homepage-showcase.ts:300–356` 与 `homepage-gallery-parts.ts` setup 分别实现 props 合并、WC/React microtask、Vue/Vue2 直接写入和 generation gate。先审查 demo renderer/Adapter 的 setProps replacement 与 callback/reentrancy 契约，再提取共享绑定/调度。不是将通知偏好业务迁入原型。验收包括 Textarea IME/caret、Select value/close、callback 保留、旧实例不能回放 queued writes。

#### 08. 跨 runtime outward event 绑定重复

Theme/menu/showcase/gallery/search 都区分 WC CustomEvent 与 framework callback。这是合法的 Adapter-facing 消费，不等于 synthetic input。可归一为类型化共享 helper；验收一次动作一个信号、清理正确，禁止按组件名分发。

#### 09. Header disclosure 中的通用弹层能力

`site-header-disclosure.ts` 包含 open、aria-expanded/controls、Escape/outside、focus return、portal 子项识别和定位。应拆分：可复用开放/关闭/焦点关系考虑既有 Collapsible/Popover/overlay 原型，几何归 host；断点搬移、导航、history、跨面板策略归应用。须与 #921 文件负责人协调。验收嵌套 Select 先消费 Escape、第二次关闭父层、portal 不误判 outside，非模态导航不被强加 focus trap。

#### 10. 原生链接的交互状态采集

`site-native-link-facts.ts:16–109` 采集 hover/pressed/focus-visible/current，投影到 public Surface/Text，不拦截 click、不模拟导航。`site-link-recipes.ts` 与导出的 family action appearance 已复用部分视觉能力。可研究公开 NativeLink/action composition，但必须保留中键、修饰键、context menu、download、Space 原生行为及已定义 disabled 语义；不能用 Button click 冒充链接。

#### 11. Text 替换时保存真实选区

`site-typography.ts:111–188,308,412` 移动文本源节点时保存/重映射 Selection。此属 host/renderer 生命周期，不应成为 portable Text 的 selection state。可提取共有移动能力，但不能全局清除选区。验收正反选区、runtime/theme 替换、不抢焦点、嵌套链接与原文保留；准备期间 passive text 不锁定。

#### 12. Header/Search 跨 generation 焦点恢复

`site-header-surface.ts` 保留原生子树焦点，`site-search-commands.ts` 保存焦点 epoch。可复用 generation-aware restore；返回哪个业务 command 仍由应用决定。不能仅因存在 focus() 就认定为 Button hack。

#### 13. 父层关闭 Select 与替换前关闭

`site-select-dismissal.ts` 注册 owner→public requestOpen；projection composition 在 runtime 替换前关闭。父层/history 关闭意图归应用，Select 状态转移归 Select。若正常选择必须额外 consumer close 才完成，则应以精确按键证据修 Base/router，不能把补丁永久写入页面。已接受的 generic router 修复不是 Select-name Compiler hack。

### 5. 已原型化或合理应用组合：十五类

#### 14. 内容选择策略

BaseButton、actionable BaseLabel、family Checkbox/Toggle/Tabs 已在语义 subject 声明 select-none；passive Text/content 保留可选。验收生成 CSS 与真实拖选/copy；旧 demo className 策略仍需清理。不允许全页禁选，也不要求所有文字都能点击。

#### 15. Button wrap 与 family profile

Shadcn Button 已公开 rhea/luma/new-york profile 和 wrap。首页 wrap:true 是合理 opt-in。保持家族差异，验证独立 demo 同样可消费。

#### 16. Card anatomy

main 首页仍是 Surface + authored headings/body；#984 已采用 Shadcn Card Root/Header/Content rhea，这是分支中实际的原型消费迁移，不应冒称已进入 main。Brutalist 是否有适用 Card 定义须先核对；业务布局不必原子化。

#### 17. Hero Typography 与文档角色

public Text props + site recipes 承担字体；heading role 留在文档 wrapper。哪个文本是 Hero、断点选择属于页面布局。保留200%text resize、行框、字体及选区验证，不新造 BaseHero 业务原型。

#### 18. Header Select appearance/density

ghost/elevated 是 family 选项，宽度/minHeight/padding 是显式消费者输入。不能把 Header 44px 要求推广为所有 Select 默认，或删掉通用不注入高度的测试。若需要公共 responsive size profile，先定义再替换当前输入。

#### 19. Gallery 外层布局

`HomeDemoPreviewer.astro:106–243` 的 grid/columns、gap、reading order、外层换行属应用布局；未发现其中接管组件视觉状态。保留移动端/zoom overflow 与 Tab 顺序测试。

#### 20. 通知偏好保存/重置

draft/saved、dirty、字符计数、save/reset、反馈是应用业务。Select/Switch/Textarea/Button 输出事件；输入接受和IME时序归 primitive/infrastructure，保存含义不下沉。

#### 21. 文本编辑示例

Bold/Italic 使用 Toggle activeChange、Text weight/emphasis；Textarea valueChange、Tabs 和 Reset 组合合理。示例文本和重置值属于消费者；第07项调度重复单独处理。

#### 22. 选择数量、应用选择与副本计数

Checkbox checkedChange、Menu select 由公开原型产生；页面计数与 Apply 的说明属业务。未发现首页标签点击直接写 checked 的代码。

#### 23. Dialog、DropdownMenu、HoverCard

Gallery 使用公开 parts；确认按钮仅更新 status，HoverCard delays 是公开 props。未发现首页另建 Escape 或 hover timer。需共享 keyboard/focus/dismiss 验收，但不能把尚未复现的问题称为缺陷。

#### 24. Command、Slider、Accordion

#984 新 `homepage-composition-parts.ts` 使用 public prototypes，页面只把 command 结果映射为 progress、验证 outward finite range、reset40和状态文字。main 尚无该文件。过滤、键盘、拖动、范围、展开不应由页面重写，计划映射也不应塞入原型。

#### 25. Loading/retry/cancel 与整体 runtime 切换

投影/materializer 编排负责多根节点原子替换。可评价既有 AsyncRegion/loading 复用，但它不是 Checkbox 功能。必须保留 inert、rollback、focus、accepted edits 和旧 generation 隔离。

#### 26. Locale、路由、Starlight、Pagefind

偏好持久化、路由目标、主题 provider、搜索索引属于应用。Search Button 的 shortcut annotation 是业务上下文；物理快捷键桥接依宿主职责，不搬入组件专用 Compiler 分支。

#### 27. 图标与静态 glyph

`home-action-icons.ts`、`site-link-icons.ts` 提供内容；Search 已使用 public Lucide 图标。不因图标在首页出现就新增有状态原型。

#### 28. 旧 homepage-live-preview

此模块展示本页任务数据和视图排列，不是 Calendar 或项目管理原型。当前 `homepage-demo-participant` 调用 `homepage-showcase` 而非它。清理前核对引用，不围绕未使用的旧示例制造迁移任务。

### 6. 建议实现顺序与共同验收

1. 将此28类分类与各 demo 的 Label 精确路径矩阵合并，复用 [#933](https://github.com/Proto-UI/Proto-UI/issues/933)、[#865](https://github.com/Proto-UI/Proto-UI/issues/865) 等来源映射，不为数量拆分Issue。
2. 本旧顺序受前文 S0/S1 公开 composition 设计约束：先确定共同公共构造，再逐片完成 Checkbox → Switch/Textarea → Select Field 消费一致性。保留独立最小 demo，但不得恢复已暂停的 demo-only 发布方案或把消费修补当作安装交付完成。
3. 再处理主题 Toggle 与 Tabs wrap；缺少公开语义时定义先行，保留默认兼容性。
4. 提取受控更新/event helper，再按定义与负责人协调处理 Header/link primitive；不是将所有页面代码搬入 Base。
5. 执行跨消费者回归，检查其余合理组合没有被误改。

每项必须绑定精确commit，覆盖首页 + 独立demo、WC/React/Vue/Vue2、实际受影响family、trusted pointer/keyboard/focus/相关drag、checked/indeterminate/disabled/readOnly/controlled、重复操作与卸载重挂/runtime切换。保留真实CI失败及未测试项；静态检查、合成事件、旧截图不等于当前原生浏览器通过。缺checks不算通过。

### 7. 其余五项的实施边界与负责人

以下“负责人”仅指已确认的分支/文件协作范围，不代表未经核验的原型全局claim。变更前重新读取最新head和公开claim。

| 项目 | 可独立实施范围 | 不应修改/需要先协调 | 已确认负责人或待核验项 |
| --- | --- | --- | --- |
| Switch可见Label | 首页和独立demo采用已有Label+controlLabel，测试disabled/controlled | 不新增Switch状态机，不改Compiler | #984 为 dot 自有分支；原型层是否另有有效claim尚未确认，不能推断无人负责 |
| Textarea可见Label | 使用已有focus-only关联；必要时消费FieldTextarea；补命名/焦点/IME测试 | 不重新实现text editing/caret/IME，不把readOnly当disabled | #984 为 dot 自有分支；关联 [#906](https://github.com/Proto-UI/Proto-UI/issues/906) Field组合范围，实际文件claim需重核 |
| Select字段命名 | 使用FieldLabel/FieldSelectTrigger并移除有替代证据的属性观察器 | 普通Select不能直接扩大ControlLabel目标集；共享projection/runtime修改先协调 | #984为dot；[#921](https://github.com/Proto-UI/Proto-UI/pull/921) 的HyacinthHaru保留共享runtime/native-links/startup-theme范围；Field/Select原型claim需重核 |
| Theme pressed语义 | 核对publicToggle可否受控表达；页面仍调用既有theme provider | 不接管startup-theme、不改主题持久化策略、不改BaseButton为主题专用 | #984为dot；涉及#921共享runtime/startup-theme须HyacinthHaru协调；Toggle原型claim需重核 |
| Brutalist Tabs wrap | 定义family opt-in能力，原型和首页/demo同时消费；保留default | 不改Base键盘语义，不用Compiler组件名例外，不直接覆盖别人的family实现 | #984首页消费为dot；BrutalistTabs当前文件owner尚未确认，实施前核对 |

截至本次复核，未确认这五项各自的独立精确公开claim，因此一律按“负责人/精确切片待确认”处理，而非“无人负责”。#933中dot既有范围为homepage-composition-parts、gallery wiring/layout及HomeDemoPreviewer，不自动覆盖共享runtime。#865此前有限Button/selection claim已明确RELEASED，不因本次任务自动复活；#906的forms composite关联也不能推定五项具体owner。

#921的具体共享文件协调评论：[6390983097](https://github.com/Proto-UI/Proto-UI/pull/921#issuecomment-6390983097)。本审计时尚无相关回复；没有把未回复当作批准。#732/#817的有界Compiler claim不构成全局ABI/Compiler接管许可，#997为独立SSR主题修复，已于上述发布准备记录的时间合并。

### 8. 交接状态

本文件的审计部分记录已确认的源代码结构与建议；首片与续记另行记录已发布的有限实现，不承诺后续迁移或合并。六类迁移尚须各自实现、精确head测试和审查。用户报告的“首页可点标签、demo不可点”有明确静态关联差异支撑，但本次没有制造浏览器复现、截图或通过结果。后续验收应保留真实输入证据和当前部署版本，避免把不同head的首页/demo混为一谈。

### 9. 补充：到底是不是同一套原型？

**结论：在核验的同一版本、同一 family 下，首页组件展示与独立 demo 的核心控件确实沿同一注册链加载同一份公开原型定义；但两处使用不同的 DemoSpec 组合、实例、属性、wrapper 和关联。因此“同一 Checkbox 原型”并不等于“同一个 Checkbox + Label 组合已经被复用”。另有明确的原生 DOM/第三方集成例外，不能笼统说首页每个交互都来自原型。**

#### 9.1 从消费者到真实定义的链路

1. **首页：** `homepage-demo-participant.ts` 调用 `createHomepageShowcase()`；gallery 构造 DemoSpec。`homepage-runtime-client.ts` 把这份内容交给 `materializeProjectionCandidate()`。
2. **投影式 demo：** `projected-previewer-client.ts:269–287` 从 `PROJECTION_FAMILY_MANIFESTS[family].families[component].recipeId` 经 `loadDemo()` 读取独立 `.demo.ts`，经过 runtime-preview-surface 后，也调用同一个 materializer。
3. **普通 demo：** `previewer-client.ts:300–328` 从 demoId 调用 `loadDemo()`；收集原型 ID，调用 `loadPrototypes()`，再调用公共 `renderDemo()`。不经过完整的首页多区域切换，不代表另有一份控件实现。
4. **共同 materializer：** `projection-materializer.ts:360–380` 选择显式 `options.content.demo` 或默认 demo recipe，建立组合，递归收集所有原型，调用 `loadPrototypes()`；第446行调用 `renderDemo()`。
5. **共同注册：** `prototype-modules.ts` 的 loader 导入公开package export或同一仓库family源文件，经 `registerPrototype()` 存入公共registry。`registry.ts` 的 `getPrototype()` 返回该定义对象。
6. **真实实例：** `demo-renderer.ts` 的 WC第207行、React第519行、Vue第705行、Vue2第863行均从registry取定义，交给相应adapter。React等可按runtime adapter/rootTag生成不同wrapper，WC以同一个原型注册custom element；实例及其状态彼此独立，不应共享一份checked。
7. **关联身份：** `demo-associations.ts` 为每次渲染建立独立scope，把数据中的controlLabel key通过公开`createControlLabelRef()`降为关联引用。同一组合内共享key才关联；两个页面即使使用同名key，也不会把两个实例错误关联在一起。

#### 9.2 不是只核对 prototypeId 的几个具体证据

| 控件 | 注册链与真实实现 | 首页/demo差异 |
| --- | --- | --- |
| Shadcn Checkbox | `prototype-modules.ts:1152–1158` → `@proto.ui/prototypes-shadcn/checkbox` 的 `shadcnCheckboxRoot` / Indicator → `packages/prototypes/shadcn/src/checkbox/index.ts` 重新导出 `root.proto.ts` → `asCheckboxRoot()` | 同一Checkbox定义；首页另组合独立Label及controlLabel关联，旧demo只拼普通文本box与sr-only副本 |
| Shadcn Switch | `prototype-modules.ts:881–887` → `packages/prototypes/shadcn/src/switch/root.proto.ts` / thumb.proto.ts 的default export | 同一Switch定义；Label结构、controlled/defaultChecked和页面反馈不同 |
| Shadcn Select | `prototype-modules.ts:1029–1083` →同一family root/trigger/value/content/item源文件与公开surface/viewport/itemText导出 | 同一公开parts；Header/首页/独立demo选择不同anatomy组合、style输入和命名方式；不能据此说已经复用了同一字段组合 |
| Shadcn Textarea | `prototype-modules.ts:1215–1217` → `@proto.ui/prototypes-shadcn/textarea` default → `src/textarea/index.ts` 的 `ShadcnTextareaRoot` → root.proto.ts | 同一editor原型；可见标签、ariaLabel和受控值更新的消费者代码不同 |
| Brutalist Tabs | `prototype-modules.ts:657–671` →同一`brutalist/src/tabs/{root,list,trigger,content}.proto.ts` default | 同一定义，但首页额外按ID注入换行surfaceStyle，独立demo没有这份配置，所以默认外观/可用性可分叉 |

`apps/www/astro.config.mjs:25–68` 的 `resolveProtoUiSource()` 读取package exports，再把dist export映射到仓库src；所以本项目网站中上述package import与原型源码关系可以沿配置确认，不只是猜测导出名字。

`prototype-modules.ts:1233–1267` 对自动 `.demo.proto.ts` 与手动原型 ID 冲突会报错。`registry.ts` 本身使用map.set，理论上允许后续替换，不能把它说成不可覆盖；本次针对首页涉及的 Checkbox/Switch/Textarea/Select/Tabs/Label 注册点检索，未发现首页另注册同名私有实现。此为静态源代码结论，不证明不同部署缓存一定同版本。

#### 9.3 原生控件/应用宿主的例外

- **导航链接：** `HomeActions.astro` 的fallback是真实`a[href]`；增强后 `createHomepageContent()` 仍创建真实anchor，内嵌public Surface/Text，native-link-facts采集状态。它不是Button原型，也没有伪装成同名Button。
- **启动/无JS回退：** `HomeActions.astro:109–111` 有原生theme button；`HomepageRuntime.astro:72–75` 有details/summary fallback。成功提交增强generation后隐藏fallback，失败/销毁路径恢复。必须区分“正在看fallback”与“已增强的public Button/Select”。
- **Header面板：** trigger使用public Button，内容外观用public Surface，但开合、outside/Escape、定位与部分焦点策略目前在site-header-disclosure中，尚不是与独立Dialog/Popover demo相同的公开组合。它是清单第09项需要拆分迁移的重点。
- **站点搜索：** `override/Search.astro:81–132` 是原生dialog，搜索输入/结果由Pagefind提供；`site-search-commands.ts` 只让open/close/retry按钮使用public Button/Lucide。不能说搜索整体就是gallery里的Dialog/Command原型，亦不能仅为表面复用把Pagefind业务移入Base。
- **页面标签和文案：** 普通box/Text并非Label。它们只是视觉文本，只有明确关联或Field anatomy才取得目标命名/activation语义。外观相同不能证明语义相同。

#### 9.4 对迁移目标的修正

应统一的是“公开原型定义 + 可复用的必要语义组合 + 相同验收”，不是强行把两个页面变成同一实例或共享同一业务状态。优先把Checkbox+Label、Field+Textarea/Select等组合做成同一可消费路径，去掉分叉的plain label、属性重写和组件内样式补丁；页面继续只提供业务数据、文案、回调和外层布局。原生导航/第三方搜索保留其真实宿主职责，能抽取的基本交互再依定义迁入原型。

## 续记：#1001 的 inherited input shard 漏项（2026-10-25 UTC）

这一维护片的实现 parent 为 [bdeef58c](https://github.com/Proto-UI/Proto-UI/commit/bdeef58c20b7479fd2a0a3975dda0e5c8a543d2f)，继续 stack 在 #955，不更改 #955 的分支，也不合入整个 main。上文 7181 的全仓审计快照与第一片 Base-only workspace 映射结论保持原有边界。

### 观察、归因与上游来源

- [exact-head CI job](https://github.com/Proto-UI/Proto-UI/actions/runs/40165695418/job/121086167557) 在 capture 之前执行的计划测试报告 187 项中 186 通过、1 失败。失败是 `apps/www/scripts/contrast-audit-plan.test.mjs:94` 的 manifest 全族唯一覆盖断言，workflow passive-and-editors shard 漏了 `input`。原生浏览器 capture 尚未开始，也没有生成截图 artifact；这不是浏览器验收失败的证据，更不是通过证据。
- workflow blob `c33d662219a97bd77252dfe4caefe6d27a7999a7`、manifest blob `839cf5b13ed70891921a17139b4a1160df26074e` 与计划测试 blob `6e460464b4d9c39b350148f06d77578d0a2caedb` 均继承 #955，未由第一片新增。但 baseline 归因不豁免 PR 验收，仍需携带精确修复。
- 修复来源是 HyacinthHaru 于 2026-10-22 提交的 [1038d0fa](https://github.com/Proto-UI/Proto-UI/commit/1038d0fa52406b9dcb1d1cadf1d7df91946c18e2)，经 [#921](https://github.com/Proto-UI/Proto-UI/pull/921) 合并。原提交实际包含两处配对的一行变更：workflow 的 shard 加上 `,input`，以及 `scripts/test/brutalist-contrast-toolbar.test.mjs` 的精确 shard 期待同步加入 `,input`。本片仅携带这两处原始 hunk，并累计本记录；原作者归属不变，整合提交只认证整合者自己的贡献。
- 维护时核对 #974 已包含同一恢复，而非另一个新根因；开放 #1002 无这些路径的 overlap。不会修改其他 owner 的分支。workflow permissions、45 分钟预算、max-parallel=2、fail-fast=false、exact-head checkout、artifact 与 capture 设置均不变。

### 有界真实测试与反例

在既有 Node 24、无网络 guard、只读文件白名单环境中，运行仓库原有测试，而非重新实现断言。为避免启动子进程，使用 Node 原生 `--test-isolation=none`，不新增权限或依赖。命令的仓库相对形式为：

```sh
node --test --test-isolation=none \
  --test-name-pattern='normal PR evidence shards cover every current manifest family exactly once|toolbar setup preserves all current manifest families, bounded jobs and exact-head evidence' \
  apps/www/scripts/contrast-audit-plan.test.mjs \
  scripts/test/brutalist-contrast-toolbar.test.mjs
```

| 被测状态 | 真实结果 | 意义 |
| --- | --- | --- |
| 原 bdeef 两文件 | 1 通过、1 失败，exit 1 | 原计划断言准确发现 input 缺席 |
| 只携带 workflow 一行 | 1 通过、1 失败，exit 1 | 唯一覆盖恢复，但 toolbar 旧的精确期待失败，证明两处必须成对 |
| 两处同源 hunk | 2 通过、0 失败，exit 0 | 选定的两个现有契约测试通过；无删除、跳过或放松其断言 |

这只是明确筛选的两项契约，不是完整 187 项重跑，也不等于完整 CI、浏览器、packed 或 registry-install 验收。原有 FieldTextarea 的 8-case codegen 证据与 Vitest/Rollup 预收集受限记录仍按上一片保留，没有重标为本片新运行。后续必须读取新 exact-head CI 的真实状态，capture 尚未启动时不能补写假截图。

## 续记：治理正文快照与文档时效修复（2026-10-25 UTC）

- 本片 parent 为已发布的 `ee40d097383321316237210f799c6c73e3e07768`；不改 #955 分支，不夹带 #997 的 13 文件 SSR 整合。[对接 source-review](https://github.com/Proto-UI/Proto-UI/pull/1001#issuecomment-6394215927) 要求携带现有 canonical snapshot、修正本报告发布状态并增加 README 导航；[范围确认](https://github.com/Proto-UI/Proto-UI/pull/1001#issuecomment-6394272326) 保留真实验收边界。该 source-review 不是 GitHub 正式 approval、native 或 install 验收。
- [治理失败 job](https://github.com/Proto-UI/Proto-UI/actions/runs/40166542032/job/121088649067) 检出 synthetic merge `f7833b33fd44bc6f03a9d099fa99ab22141f0dd3`（ee40 into #955 b01cd），在 `sync-github-governance-snapshot.mjs:290` 判定 retained/live drift。它由 `internal/coverage-matrices/**` 路径触发，不是新 PR 自动加入快照：快照只含已绑定的 27 Issues 与 PR580。
- 对所有 28 个对象逐条读取后，除 canonical checker 明确忽略的 `updatedAt` 外，仅 #377、#420、#559 的 `bodySha256` 改变。各 live 正文增加了 2026-10-22 Finf #890 当前决策前言；“原目标、讨论依据与验证记录（历史保留）”之后的正文逐项 SHA256 精确等于旧快照。历史未删，state、labels、assignees、milestone、owners 与 PR580 facts 未改变。
- 复用已存在、经对接确认的 `internal/coverage-matrices/github-governance-snapshot.json` blob `d210410244516f84f260b0a26fe6cc87786fe778`：读取时 current main 为 `357068f0f371dd40826b81da43bd4ef5df73bee7`，#974 的 `da764928ba727f9ebec7d52dad74637ecd070fd5` 也携带完全相同文件。本片不手工改 hash、不执行独立 `--write`、不改两消费者 matrix。来源差异只有这三个 body hashes 和六个 observation timestamps（#377/#388/#420/#513/#559/#745）。
- 有界实际验证使用仓库原 `collectDependencyOwners`、`normalizeLiveIssue`、`normalizeLivePullRequest`、`reconcileGovernanceSnapshot`、`hasGovernanceDrift`，输入 exact-parent 两 matrix 与本次 authenticated API 读取的 28 个对象，在既有 Node 24 guard/只读白名单下执行。旧 snapshot `hasGovernanceDrift=true`；同源携带版本 `hasGovernanceDrift=false`；27 Issues/1 PR 全部保留，断言进程 exit 0。没有运行网络 CLI main，也不冒称 hosted `--check` 已通过。
- 可复现流程：固定 head，读取上述两 matrix 和 retained snapshot；读取它们绑定的 Issues/PR，按 canonical normalize/reconcile 比较；保留变更字段与旧正文 hash 证据；只在 owner 协调后携带现有 canonical source；再运行最终 head 的 `node scripts/coverage-matrices/sync-github-governance-snapshot.mjs --check` 与正常 CI。不要因日志提示就自动 `--write` 或推断 owner。
- 仅追加 README 的报告链接并校正此前“尚未发布”的时态，已发布的 bdeef/ee40 证据不冒充本片新测试。ee40 的 popup-boundaries 与 binary-and-buttons 两个目标 CI jobs 已真实通过完整 187/187 计划测试（含 exactly-once 与 toolbar），随后 native capture 在 rest 阶段因 authored materialized anatomy/current conditional subtree 缺失失败，不能称整 shard 通过；其余 shards 与最终新 head 仍需验收。日志与 raw artifacts 见 [popup job](https://github.com/Proto-UI/Proto-UI/actions/runs/40166542220/job/121088651821)、[popup artifact](https://github.com/Proto-UI/Proto-UI/actions/runs/40166542220/artifacts/12590005407)、[binary job](https://github.com/Proto-UI/Proto-UI/actions/runs/40166542220/job/121088651814)、[binary artifact](https://github.com/Proto-UI/Proto-UI/actions/runs/40166542220/artifacts/12589680225)。这里只读取 official CI 日志，未下载或视觉检查这些 artifacts。其他真实失败（private SSR PUI3301、material public-source/blur、原生视觉/几何和 preview artifact 预算）保持各自 owner 与原日志，不因治理修复获豁免。#1000 仅承担 Checkbox composition/install 闭包，不自动扩大为 Shadcn Field registry owner。
