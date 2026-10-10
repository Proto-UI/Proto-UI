# Finf 原型能力对照与分类后续（2026-10-10）

> 非规范性只读记录。目标能力差距不等违反当前 draft；本记录不修改协议或宣布验收。

## 范围与结论

基线为 [2a67cb617302](https://github.com/Proto-UI/Proto-UI/tree/2a67cb6173020c487591724538ca56e03f14a1ea)，tree `af287fdbda0bc5ab21e7a0ed59f328e51f5d7e86`。审阅公共定义、精确源 API/状态/测试文本及官方上游，按 API、状态事实、交互键盘、受控动态、RTL/vertical、响应式、a11y 七维记录。没有执行项目或第三方代码；源码/API 存在不等 native、辅助技术或 Compiler 通过。

54 个组件已首次覆盖静态广度：32 重点、20 局部、2 专门后续交接；逐 feature 仍有 72 条未知（事实数，不是任务数），另 1 个 overlay-scrollbar 坐标回归未重审。54+1=55 核心项，加 13 历史项=68；保持 5 done /63 unfinished，新增完成项为 0。

上游来源须分开：Neo 固定 `3306a802724874a85f93079702b2795370a279d4`；Shadcn 为 2026-10-10 Base route / dated registry，不混旧 Radix/React Aria；Base UI 当日 docs 为 1.9.0，仅补充目标，不能把 Neo 的依赖范围当精确版本。Calendar 对照 React DayPicker，Command 对照 cmdk，InputOTP 对照 input-otp，MessageScroller 对照 @shadcn/react。Bootstrap 只对 2.3.2；Liquid Glass 只参考公开设计原则。无直接上游的原创 primitive 不套同名库完整 API，商业扩展示例不自动成为基础义务。

## 分层优先队列

1. 先定义/admission：Calendar range/multiple、Slider 多值、Select/Combobox 多选与分组；Dropdown/Menubar/ContextMenu 子菜单与 check/radio；Command 受控 active 与组语义。确定值域、唯一状态 owner、受控请求、动态成员、键盘和 a11y 后再实现 Base。
2. 先通用边界：InputOTP selection/caret、MessageScroller 消息锚点与 prepend/初始位置；Input 非 plain-text 类型；Toolbar 混合控件参与；Dialog/Popover/Drawer 的 modality、dismissal/focus 策略。通用 State/集合/生命周期表示须逐 C/P/T 核对，不因数组/closure 一律判非法。
3. 先证明 recipe：DataTable 列过滤/显隐/页全选、async 搜索、CommandDialog、Toast manager/promise/queue、表单 schema/网络请求、格式化读数、嵌套 Resizable groups。现有公共可组合能力不能表达已接受目标时，才提最小 Base 扩展。
4. family/组合：ToggleGroup variant/size/spacing、Neo AlertDialog 结构与响应式、ImageCard caption/比例、Table 容器与分区皮肤、Tabs Indicator/折叠高度动画。皮肤不能隐藏语义缺口；Compiler 不加组件名或源路径特例。
5. 单独证据：所有组件真实宿主、受控拒绝/延迟、动态移除、RTL/vertical、窄屏缩放、辅助技术与独立 Compiler 组合。静态比较完成不等验收完成。

## 关键精确证据

- calendar：先定义range/multiple；caption月年组合已有。 [基线 types.ts:10–38](https://github.com/Proto-UI/Proto-UI/blob/2a67cb6173020c487591724538ca56e03f14a1ea/packages/prototypes/base/src/calendar/types.ts#L10-L38)；[基线 index.ts:244–258](https://github.com/Proto-UI/Proto-UI/blob/2a67cb6173020c487591724538ca56e03f14a1ea/packages/prototypes/base/src/calendar/index.ts#L244-L258)；[官方目标](https://ui.shadcn.com/docs/components/base/calendar)
- slider：正式baseline为单值；多值目标已列专门后续。 [基线 types.ts:1–36](https://github.com/Proto-UI/Proto-UI/blob/2a67cb6173020c487591724538ca56e03f14a1ea/packages/prototypes/base/src/slider/types.ts#L1-L36)；[官方目标](https://ui.shadcn.com/docs/components/base/slider)
- combobox：先定义多选、chips与分组；async先验证recipe。 [基线 types.ts:9–45](https://github.com/Proto-UI/Proto-UI/blob/2a67cb6173020c487591724538ca56e03f14a1ea/packages/prototypes/base/src/search-primitives/types.ts#L9-L45)；[基线 family.ts:204–224](https://github.com/Proto-UI/Proto-UI/blob/2a67cb6173020c487591724538ca56e03f14a1ea/packages/prototypes/base/src/search-primitives/family.ts#L204-L224)；[官方目标](https://ui.shadcn.com/docs/components/base/combobox)
- dropdown：先定义子菜单、checkbox/radio及组语义。 [基线 types.ts:18–40](https://github.com/Proto-UI/Proto-UI/blob/2a67cb6173020c487591724538ca56e03f14a1ea/packages/prototypes/base/src/dropdown/types.ts#L18-L40)；[基线 types.ts:101–134](https://github.com/Proto-UI/Proto-UI/blob/2a67cb6173020c487591724538ca56e03f14a1ea/packages/prototypes/base/src/dropdown/types.ts#L101-L134)；[官方目标](https://ui.shadcn.com/docs/components/base/dropdown-menu)
- command：补Group与controlled active；Dialog/async/rank先验recipe。 [基线 family.ts:126–139](https://github.com/Proto-UI/Proto-UI/blob/2a67cb6173020c487591724538ca56e03f14a1ea/packages/prototypes/base/src/search-primitives/family.ts#L126-L139)；[基线 family.ts:157–160](https://github.com/Proto-UI/Proto-UI/blob/2a67cb6173020c487591724538ca56e03f14a1ea/packages/prototypes/base/src/search-primitives/family.ts#L157-L160)；[官方目标](https://github.com/dip/cmdk)
- input-otp：原生editor已有；选区/active slot先补通用selection事实。 [基线 slot.proto.ts:23–35](https://github.com/Proto-UI/Proto-UI/blob/2a67cb6173020c487591724538ca56e03f14a1ea/packages/prototypes/base/src/input-otp/slot.proto.ts#L23-L35)；[基线 types.ts:1–57](https://github.com/Proto-UI/Proto-UI/blob/2a67cb6173020c487591724538ca56e03f14a1ea/packages/prototypes/base/src/input-otp/types.ts#L1-L57)；[官方目标](https://github.com/guilhermerodz/input-otp/blob/v1.5.0/packages/input-otp/src/input.tsx)
- message-scroller：末端跟随已有；消息锚点/初始位置先补定义。 [基线 index.ts:24–29](https://github.com/Proto-UI/Proto-UI/blob/2a67cb6173020c487591724538ca56e03f14a1ea/packages/prototypes/base/src/message-scroller/index.ts#L24-L29)；[基线 types.ts:1–47](https://github.com/Proto-UI/Proto-UI/blob/2a67cb6173020c487591724538ca56e03f14a1ea/packages/prototypes/base/src/message-scroller/types.ts#L1-L47)；[官方目标](https://github.com/ekmas/neobrutalism-components/blob/3306a802724874a85f93079702b2795370a279d4/src/components/ui/message-scroller.tsx#L68-L118)
- input：plain-text已有；file/type目标先补native协议。 [基线 types.ts:1–75](https://github.com/Proto-UI/Proto-UI/blob/2a67cb6173020c487591724538ca56e03f14a1ea/packages/prototypes/base/src/input/types.ts#L1-L75)；[基线 P-BASE-INPUT.yaml:1–28](https://github.com/Proto-UI/Proto-UI/blob/2a67cb6173020c487591724538ca56e03f14a1ea/spec/prototypes/P-BASE-INPUT.yaml#L1-L28)；[官方目标](https://github.com/ekmas/neobrutalism-components/blob/3306a802724874a85f93079702b2795370a279d4/src/components/ui/input.tsx#L1-L19)
- tooltip：delay group已有；click-close/cursor策略先定义。 [基线 trigger.proto.ts:69–86](https://github.com/Proto-UI/Proto-UI/blob/2a67cb6173020c487591724538ca56e03f14a1ea/packages/prototypes/base/src/tooltip/trigger.proto.ts#L69-L86)；[基线 types.ts:1–73](https://github.com/Proto-UI/Proto-UI/blob/2a67cb6173020c487591724538ca56e03f14a1ea/packages/prototypes/base/src/tooltip/types.ts#L1-L73)；[官方目标](https://base-ui.com/react/components/tooltip)
- table：spans/header已有；分区parts和responsive先分层准入。 [基线 index.ts:1–17](https://github.com/Proto-UI/Proto-UI/blob/2a67cb6173020c487591724538ca56e03f14a1ea/packages/prototypes/base/src/table/index.ts#L1-L17)；[基线 P-BASE-TABLE.yaml:13–36](https://github.com/Proto-UI/Proto-UI/blob/2a67cb6173020c487591724538ca56e03f14a1ea/spec/prototypes/P-BASE-TABLE.yaml#L13-L36)；[官方目标](https://github.com/ekmas/neobrutalism-components/blob/3306a802724874a85f93079702b2795370a279d4/src/components/ui/table.tsx#L22-L57)

边界澄清：DatePicker range-close 是尚不存在的 Calendar range 的目标组合依赖，不是当前单日期 bug。CheckboxGroup/ToggleGroup/Accordion 已有多选；ScrollArea 的 Thumb 委托宿主实现 drag，不能因 part 无事件就报缺。VirtualList 有变高测量/generation/ensureVisible，但完整 portable 定义与非 Web 证据未完成。Text/Surface/AsyncRegion/LiveRegion/Transition 的负边界必须保留。

[Table 的 draft 负边界](https://github.com/Proto-UI/Proto-UI/blob/2a67cb6173020c487591724538ca56e03f14a1ea/spec/prototypes/P-BASE-TABLE.yaml#L13-L36)明确不拥有排序、选择、分页或 Head/Body/RowGroup；[Shadcn Table 官方说明](https://ui.shadcn.com/docs/components/base/table)将复杂数据表交由组合。先判断分区语义是否扩定义、展示部分是否只需 recipe。

## 全 54 项交接索引

“重点/局部/专门交接”为审计深度；每项均未因此验收。完整机器索引见同目录 `2026-10-10-finf-capability-index.compact.json`，含逐项已有/缺/未知 ID、定义状态、精确源范围和四 family 来源关系。

| 组件             | 深度     | 下一步或已有边界                                             |
| ---------------- | -------- | ------------------------------------------------------------ |
| accordion        | 局部     | 多开/allowEmpty/RTL已有；过渡与State表示另核。               |
| alert-dialog     | 专门交接 | 2a67基线缺口；0cca已含Neo结构修复，移动端/native仍未验收。   |
| async-region     | 局部     | 只拥有busy；无直接视觉上游，reader证据待验。                 |
| autocomplete     | 重点     | 自由文本已有；group、inline/grid先定目标。                   |
| button           | 局部     | 交互已有；FormSubmit/Reset存在，普通form props后延。         |
| calendar         | 重点     | 先定义range/multiple；caption月年组合已有。                  |
| carousel         | 重点     | orientation/direction已有；连续drag/snap/多slide视窗待定义。 |
| checkbox         | 局部     | mixed已有；readonly/form目标与当前负边界分开。               |
| checkbox-group   | 重点     | 多选/all/mixed已有；嵌套parent/form组合待证。                |
| collapsible      | 局部     | controlled/keepMounted已有；extent过渡待定义/组合。          |
| combobox         | 重点     | 先定义多选、chips与分组；async先验证recipe。                 |
| command          | 重点     | 补Group与controlled active；Dialog/async/rank先验recipe。    |
| context-menu     | 重点     | 子菜单与check/radio先定义。                                  |
| data-table       | 重点     | 排序/过滤/分页/选中已有；列功能先验公共recipe。              |
| date-picker      | 重点     | range关闭为未来Calendar range组合依赖，非单日期bug。         |
| dialog           | 重点     | modal已有；nonmodal/dismissal/focus策略先准入。              |
| drawer           | 重点     | drag/snap已有；nonmodal/dismissal策略先定义。                |
| dropdown         | 重点     | 先定义子菜单、checkbox/radio及组语义。                       |
| field            | 局部     | 异步request/resolve已有；完整constraint/schema范围待查。     |
| fieldset         | 局部     | disabled/legend/description已有；表单范围待组合证据。        |
| form             | 重点     | 已有Field异步/提交状态；校验器/数据逻辑先验组合。            |
| hover-card       | 重点     | 视觉preview已有；多trigger及link/a11y边界待补。              |
| image            | 局部     | native image已有；Neo ImageCard需独立family recipe。         |
| input            | 重点     | plain-text已有；file/type目标先补native协议。                |
| input-otp        | 重点     | 原生editor已有；选区/active slot先补通用selection事实。      |
| label            | 局部     | typed关联已有；跨控件命名/激活待真宿主。                     |
| live-region      | 局部     | politeness/atomic已有；不强加queue，reader证据待验。         |
| menubar          | 重点     | 子菜单与check/radio先定义。                                  |
| message-scroller | 重点     | 末端跟随已有；消息锚点/初始位置先补定义。                    |
| meter            | 局部     | low/high/optimum已有；readout格式/几何待证。                 |
| navigation-menu  | 重点     | hover/vertical/shared viewport目标先准入。                   |
| number-field     | 重点     | locale/empty/scrub等为补充目标，先确认来源范围。             |
| popover          | 重点     | nonmodal已有；modal/hover策略先准入。                        |
| progress         | 局部     | indeterminate/范围已有；format/valueText组合待证。           |
| radio-group      | 重点     | readonly/form目标先准入；typed Label已存在。                 |
| resizable        | 重点     | 分清同group多panel与嵌套groups；drag/constraints逐项核。     |
| scroll-area      | 重点     | 双轴/host drag已有；visibility/corner先验family。            |
| select           | 重点     | 单选已有；multiple/语义分组先准入，别混Radix目标。           |
| separator        | 局部     | orientation/decorative已有；真实extent待证。                 |
| slider           | 专门交接 | 正式baseline为单值；多值目标已列专门后续。                   |
| surface          | 局部     | passive shell已有；Card/material属独立组合/范围。            |
| switch           | 局部     | readonly/form目标与当前负边界分开。                          |
| table            | 局部     | spans/header已有；分区parts和responsive先分层准入。          |
| tabs             | 局部     | activation/vertical/Indicator已有；几何/RTL待实证。          |
| text             | 局部     | passive typography已有；不接管heading/link语义。             |
| textarea         | 重点     | 多行/IME已有；invalid/Field/尺寸组合待证。                   |
| toast            | 重点     | timer/pause已有；swipe先定义，manager/queue先验recipe。      |
| toggle           | 局部     | active/瞬时pressed已有；family变体与组合待核。               |
| toggle-group     | 重点     | single/multiple/vertical已有；variant/size/spacing属family。 |
| toolbar          | 重点     | button roving已有；mixed input/link/group先定参与协议。      |
| tooltip          | 重点     | delay group已有；click-close/cursor策略先定义。              |
| transition       | 局部     | phase/interrupt/reduced-motion已有；host motion仍待验。      |
| tree             | 重点     | 单选/层级键盘已有；typeahead与RTL缩进待补，多选非必修。      |
| virtual-list     | 重点     | 变高/generation/Web桥已有；portable窗口定义待准入。          |

## 正式发布变化与验证边界

本次全组件静态审计保持在 `2a67cb6173020c487591724538ca56e03f14a1ea`，不把后续修复倒写成基线已有能力，也没有重审全矩阵。正式集成提交 [0ccaee462458](https://github.com/Proto-UI/Proto-UI/commit/0ccaee462458ed8988baa50a95d174a34dfb0b99) 已包含 Neo AlertDialog 修复 [fb7004d5f0c9](https://github.com/Proto-UI/Proto-UI/commit/fb7004d5f0c95ad0df00b72b988104c3d72979b0)：新增 passive Header/Footer 分组，按上游调整桌面端样式，保留 Base 语义所有权。

[Neo 修复公开记录](https://github.com/Proto-UI/Proto-UI/pull/872#issuecomment-6100327897)报告独立 219 项测试通过、9 项原基线失败的源码检查转绿；这是 desktop 范围的结构/样式与静态验证，不是桌面像素或上游等价验收。[0cca 集成记录](https://github.com/Proto-UI/Proto-UI/pull/872#issuecomment-6100329696)报告 577/577 focused tests、125/125 planner checks 及类型检查通过。两条记录在 2026-10-10 17:36 UTC 均将新 head 的 native 截图/证据标记为待补，并指向 [对应 Actions run](https://github.com/Proto-UI/Proto-UI/actions/runs/38072250355)；本记录没有据此声称该 run、移动端响应式、动画或 native/upstream parity 已通过。5 accepted /63 unfinished 保持不变。

## 可公开接手的证据

- 同目录 [54 组件 compact 索引](2026-10-10-finf-capability-index.compact.json)保留逐组件审计深度、definition status、已有/缺/未知事实 ID、精确源码行范围及上游来源；source_refs 相对 baseline.source_url_prefix 解析，上游 refs 相对 upstream_sources 解析。不依赖本地归档或私有工具链接。
- [Proto-UI 精确基线源码](https://github.com/Proto-UI/Proto-UI/tree/2a67cb6173020c487591724538ca56e03f14a1ea)、[固定 Neo 上游源码](https://github.com/ekmas/neobrutalism-components/tree/3306a802724874a85f93079702b2795370a279d4/src/components/ui)、[Shadcn 组件文档](https://ui.shadcn.com/docs/components)和[Base UI 文档](https://base-ui.com/react/components/tooltip)均为公开来源。动态文档按本记录日期取样，不视为版本锁。

后续先完善既有类别内短子 TODO；不要新增完成 checkbox 或改变 68 项计数。落实规范通过原有 spec/admission 过程，本记录不能成为第二份规范。
