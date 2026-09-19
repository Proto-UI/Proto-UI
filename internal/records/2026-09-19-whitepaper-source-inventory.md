# 白皮书来源清点（bounded source-inventory）

日期：2026-09-19基线提交：`ddac15dae7016d995fcb0cb5afb334b495c0a842`（origin/main）授权：[Issue #478 维护者裁决](https://github.com/Proto-UI/Proto-UI/issues/478#issuecomment-5732667692)（2026-09-18T16:02:42Z），将 #478 正式收窄为 bounded source-inventory / research follow-up。配套附录：`internal/records/2026-09-19-whitepaper-source-inventory.appendix.json`（机器提取的 34 个页面文件 × heading × locale × anchor 位置清单）。

本文是 `internal/records/**` 下的非规范性研究产物。按照裁决与 `internal/records/README.md`：

- 本文不修改 `spec/**`，不重写公开白皮书正文，不包含产品/协议裁决，不做任何 lifecycle 晋升；
- 本文引用 [PR #550](https://github.com/Proto-UI/Proto-UI/pull/550)（closed-unmerged）仅作为 neutral research provenance；其中已被 #565 取代的旧页面手术式 rewrite sequence、统一降级判断与结构建议均不被本文继承；
- 本文与适用 spec 实体冲突时，以实体自身 lifecycle 为准；本文只是带日期的核验快照。

## 0. 裁决五点的执行方式

| 裁决要求 | 本文对应章节 |
| --- | --- |
| 1. 核验后的旧白皮书 baseline / page / heading / locale 位置 | §1 + 附录 JSON（9 编号章节 + 8 legacy 页 × 2 locale，34 文件全覆盖） |
| 2. 中性事实：claim inventory、sidebar 顺序与 footer-link graph、重复论证/阅读断点、术语漂移、ZH/EN drift、claim → spec mapping | §2（导航图）、§3（claim inventory）、§4（重复与断点）、§5（术语）、§6（locale drift）、§3/§7（mapping） |
| 3. 每个 Proto-specific mapping 标注 current lifecycle/status；无治理标 gap/unknown；冲突并列双方证据 | §3 表格 status 列、§7 冲突并列、§8 gap 清单 |
| 4. 可引用 #550 但不继承其 rewrite sequence / 降级判断 / 结构建议 | §3.2 逐条标注 #550 provenance；本文不含任何 rewrite 建议 |
| 5. 非规范性声明 | 本 preamble 与 §9 |

## 1. 当前基线：双层页面结构

核验结论：当前 `apps/www/src/content/docs/{zh-cn,en}/whitepaper/` 下存在**两层**白皮书，发布状态截然不同。

### 1.1 编号章节（当前发布基线）

9 个编号章节 × 2 locale = 18 个文件。frontmatter 无 `draft` 标记，全部进入生产构建并被 sidebar 收录：

`0-preface` → `1-components-before-code` → `2-interaction-relations` → `3-component-boundary` → `4-semantics-beyond-channels` → `5-translation-layer` → `6-consistency-boundary` → `7-evolving-within-boundaries` → `8-conclusion`

各章标题（ZH）：序章：我们还要发明多少次 Button？ / 第一章：组件先于代码 / 第二章：交互关系 / 第三章：组件的边界 / 第四章：通路之外的语义 / 第五章：翻译层 / 第六章：一致性的边界 / 第七章：在边界中演进 / 结语：为过去与未来保留交互知识。

### 1.2 legacy 页面（事实上下线，仓内保留）

8 个 legacy 页 × 2 locale = 16 个文件：`component-as-protocol`、`information-flow-model`、`prototype-boundary`、`execution-semantics`、`translation-layer`、`design-constraints`、`evolution-path`、`faq`。

三项并存的核验事实：

1. 全部 16 个文件 frontmatter 带 `draft: true`（不进入生产构建）；
2. `apps/www/astro.config.mjs` 的 `redirects` 把 8 个 legacy URL 逐个映射到编号章节（见 §2.2），并由 `whitepaperRedirectFragments` integration 保 fragment；
3. 正文完整保留在仓库中（未删除、未改写为 stub），ZH 2,708–4,900 字符/页、EN 7,543–14,523 字符/页（附录 JSON 有逐文件字符数）。

即：legacy 页是**仓内可见、站点不可达**的历史 baseline。#478 原始审计对象（旧八页）现在处于这一层。

### 1.3 legacy anchor 保留机制

新章节通过两类 HTML 标记承接旧链接 fragment（附录 JSON 逐页列出）：

- `whitepaper-legacy-topic` stub：0-preface 含 11 个（承接旧 faq 的 10 个议题 + 「还有别的问题」），1-components-before-code 含 6 个（承接旧 component-as-protocol 的 Prototype/Adapter/Host 命名、Prototype 定义（→ch3）、Adapter（→ch5 `#adapter`）、Host、三者关系（→ch5）与「原型可以开放，协议可以稳定」（→ch7 三条主线）议题），每个 stub 注明"这一主题现已移至"并链接到新位置；两个 locale 对称；
- `whitepaper-legacy-anchor` 空 div：散布于 0-preface、2/3/4 章等，保留旧 heading 的锚点 id（`aria-hidden`，无可见内容）。

## 2. 导航与链接图（中性事实）

### 2.1 sidebar 顺序

`apps/www/astro.config.mjs` 中 Whitepaper 分组只收录 9 个编号章节，顺序同 §1.1；两个 locale 相同。legacy 页不在 sidebar。

### 2.2 redirect 表

| legacy URL                            | redirect 目标                                |
| ------------------------------------- | -------------------------------------------- |
| `*/whitepaper/component-as-protocol`  | `*/whitepaper/1-components-before-code/`     |
| `*/whitepaper/information-flow-model` | `*/whitepaper/2-interaction-relations/`      |
| `*/whitepaper/prototype-boundary`     | `*/whitepaper/3-component-boundary/`         |
| `*/whitepaper/execution-semantics`    | `*/whitepaper/4-semantics-beyond-channels/`  |
| `*/whitepaper/translation-layer`      | `*/whitepaper/5-translation-layer/`          |
| `*/whitepaper/design-constraints`     | `*/whitepaper/6-consistency-boundary/`       |
| `*/whitepaper/evolution-path`         | `*/whitepaper/7-evolving-within-boundaries/` |
| `*/whitepaper/faq`                    | `*/whitepaper/0-preface/`                    |

注意最后一行：faq 不映射到任何一章正文，而是映射到序章（其议题由 §1.3 的 stub 再分发）。映射关系按内容主题对应，不保证论证顺序连续（见 §4.2）。

### 2.3 legacy 页内 footer-link 图

legacy 页正文末尾的「下一步 / Next」链接链（两个 locale 同构）：

`component-as-protocol → information-flow-model → prototype-boundary → execution-semantics → translation-layer → design-constraints → faq`；`evolution-path → faq`；`faq` 无后续链接。

该图与 #550 记录一致，当前 head 未变。但经过 §2.2 的 redirect 后，跟随这些链接的实际落点序列是 ch1 → ch2 → ch3 → ch4 → ch5 → ch6 → 序章；从 evolution-path 出发则直接到序章。

### 2.4 站内其他入口

`apps/www/src/**` 中除 whitepaper 目录自身外，所有指向白皮书的链接都指向编号章节，无一指向 legacy URL：`Header.astro`/`Hero.astro`/`PageFrame.astro`/quick-start → `0-preface`；`utils/shadcn-doc-links.ts` → ch1、ch3；`build/prototypes/checklist.md` → ch3；`build/compiler-guide.md`、`start-here/how-it-works.md` → ch5；`start-here/what-you-saw.md` → ch6。

### 2.5 spec graph 的白皮书引用

`spec/**/*.yaml` 共 612 个实体，其中 15 个实体的 `sources` 引用白皮书页面（30 条 path+section 记录），**全部指向编号章节**，无一指向 legacy 页。清单（status 见 §3 各表）：

- ch1：K-COMPONENT-INTERACTION-0001（组件到底是什么？/ What Is a Component, Exactly?）；C-STATE-INTERACTION-0003（组件到底是什么？，仅 ZH）
- ch2：K-COMPONENT-ACTOR-0001、K-INFORMATION-CHANNEL-0001、C-CORE-CHANNEL-0001、C-EVENT-0001、C-FEEDBACK-0001、C-PROPS-0001、C-EXPOSE-0001、C-CONTEXT-0001（均指向「从关系得到信息通路 / Deriving Information Channels from Relations」或「组件都在和谁交互？」）
- ch3：K-COMPONENT-INTERACTION-0001（从 Component 到 Prototype）；D-TOOLTIP-PROTOTYPE-BOUNDARY-0001（为什么 feedback-only 可拆可不拆？，仅 ZH）
- ch4：C-STATE-0001（State 章节）
- ch5：C-FEEDBACK-STYLE-0001（形式改变不等于语义损失）；K-HOST-SURFACE-ROLES-0001（整页，无 section）
- ch6：K-DESIGN-TRADEOFF-0001（Prototype 是一致性的第一把尺度）

ch0、ch7、ch8 暂无 spec 实体引用。

## 3. Claim inventory

分类沿用 #478 原始三分：`general-theory`（一般技术理论）/ `proto-specific`（Proto UI 特有设计决定）/ `temporary-impl`（临时实现或规划细节）。status 列为**当前 head 核验**的实体 lifecycle（active / draft / deprecated / gap / n/a）。

### 3.1 新基线（编号章节）claims

#### 0-preface（序章）

| claim | 位置（ZH heading 区域） | 分类 | spec mapping | status |
| --- | --- | --- | --- | --- |
| N0-1 同类组件的基础交互被反复重新实现（Button/Switch 缩影） | 正文前段 | general-theory | — | n/a |
| N0-2 Switch 的交互需求清单（状态/激活/反馈/焦点/a11y/通知）跨技术稳定，代码差异巨大 | 正文 bullet | proto-specific | P-BASE-SWITCH 等原型实体是该清单的工程化；清单本身无治理 | partial（原型库 draft/active 混合；清单 gap） |
| N0-3 单生态内交互知识可集中维护（Radix UI 为例），但不能证明可跨技术 | 正文中段 | general-theory | — | n/a |
| N0-4 Proto UI 的问题：交互知识能否脱离具体技术被保存、复用、检验 | title/description | proto-specific | K-COMPONENT-INTERACTION-0001（动机层覆盖） | draft |

#### 1-components-before-code（第一章）

| claim | 位置 | 分类 | spec mapping | status |
| --- | --- | --- | --- | --- |
| N1-1 「还原」预设了组件预期先于实现存在 | 开发者在"还原"和"实现"什么？ | general-theory | — | n/a |
| N1-2 组件首先是可交互、可描述、可被还原的交互主体，代码只是宿主中的实现方式之一 | 组件到底是什么？ | proto-specific | K-COMPONENT-INTERACTION-0001 | draft |
| N1-3 组件的描述对象是其交互身份与义务，而非任一实现形态 | 但我们如何描述它？ | proto-specific | K-COMPONENT-INTERACTION-0001 | draft |

注：旧 CAP 的「Prototype + Adapter = Host 中的组件实现」公式与 Prototype/Adapter/Host 命名议题**不在本章正文**；其 stub 指向 ch5（见 §7.4）。

#### 2-interaction-relations（第二章）

| claim | 位置 | 分类 | spec mapping | status |
| --- | --- | --- | --- | --- |
| N2-1 交互对象分类：User、Maker（App Maker）、Other Component | 组件都在和谁交互？ | proto-specific | K-COMPONENT-ACTOR-0001 | draft |
| N2-2 信息通路从参与者关系推导，不是 API 枚举 | 从关系得到信息通路 | proto-specific | K-INFORMATION-CHANNEL-0001；C-CORE-CHANNEL-0001 | draft |
| N2-3 User↔Component：event / feedback | 同上 | proto-specific | C-EVENT-0001；C-FEEDBACK-0001 | draft / draft |
| N2-4 App Maker↔Component：props / expose | 同上 | proto-specific | C-PROPS-0001；C-EXPOSE-0001 | active / draft |
| N2-5 Other Component↔Component：context（允许双向但需说明提供/接收方） | 同上 | proto-specific | C-CONTEXT-0001 | draft |
| N2-6 新通路需要现有通路无法吸收的、稳定且重要的参与者身份或关系方向 | 同上 | proto-specific | K-INFORMATION-CHANNEL-0001-B/-C | draft |
| N2-7 Host/environment 交换默认不构成核心可移植通路（不排除使用宿主能力） | 拓展 details 块 | proto-specific | K-INFORMATION-CHANNEL-0001-D；K-COMPONENT-ACTOR-0001-D；C-CORE-CHANNEL-0001-D | draft / draft / draft |
| N2-8 Component Author 是真实角色但不是运行时组件的交互对象 | 拓展 details 块 | proto-specific | 无对应实体 | gap |
| N2-9 State 不是信息通路，有自己的语义责任 | 把 Switch 放进这张关系图 | proto-specific | C-STATE-0001（State 语义）；「非通路」判断无独立实体 | partial（draft + gap） |
| N2-10 五条通路不是永久上限，模型可修正 | 这只是一副骨架 | proto-specific | K-INFORMATION-CHANNEL-0001-B | draft |

#### 3-component-boundary（第三章）

| claim | 位置 | 分类 | spec mapping | status |
| --- | --- | --- | --- | --- |
| N3-1 组件边界由交互责任（信息通路）判断，不由代码量/视觉树/库惯例判断 | 组件应该怎么拆分？ | proto-specific | K-COMPONENT-INTERACTION-0001（动机层） | draft |
| N3-2 三态拆分规则表：任一非-feedback 通路独立成立→必须拆；仅 feedback→可拆可不拆；无可移植通路→不应拆；明确标注「当前仍待实践检验的工作模型」 | 用信息通路判断组件边界 | proto-specific | 无直接治理 Contract；D-TOOLTIP-PROTOTYPE-BOUNDARY-0001 是个案决策 | gap（个案 draft） |
| N3-3 feedback-only 弹性是边界清晰与整体可读性的平衡 | 为什么 feedback-only 可拆可不拆？ | proto-specific | K-DESIGN-TRADEOFF-0001（取舍框架）；D-TOOLTIP-PROTOTYPE-BOUNDARY-0001（Tooltip Arrow 个案） | draft / draft |
| N3-4 Switch → Root+Thumb、Select 的应用示例 | 运用上述规则 | proto-specific | P-BASE-SWITCH / P-BASE-SWITCH-THUMB 等原型实体 | 原型库 draft/active 混合 |
| N3-5 从 Component 到 Prototype：Prototype 是跨技术可描述、可翻译、可约束的交互定义，必须继续指向交互主体 | 从 Component 到 Prototype | proto-specific | K-COMPONENT-INTERACTION-0001（sources 直接引用本节） | draft |
| N3-6 组合回到 Maker/宿主侧；Root 不在内部创建 Thumb | 同上 | proto-specific | K-PROTOTYPE-COMPOSITION-0001 | draft |

#### 4-semantics-beyond-channels（第四章）

| claim | 位置 | 分类 | spec mapping | status |
| --- | --- | --- | --- | --- |
| N4-1 通路之外还需 State、Anatomy、Lifecycle 三类语义 | 只有通路还不够 | proto-specific | C-STATE-0001；C-ANATOMY-0001；C-LIFECYCLE-0001 | draft / draft / draft |
| N4-2 State 保存交互中的内部事实，不隐式产生外部效果 | State：保存交互中的内部事实 | proto-specific | C-STATE-0001（sources 直接引用本节） | draft |
| N4-3 Anatomy 描述复合结构（family/role/relation） | Anatomy：描述复合结构 | proto-specific | C-ANATOMY-0001..0010 系列 | draft |
| N4-4 一次 setup、持续 runtime 的时间模型 | Lifecycle：原型如何在时间中建立 | proto-specific | C-LIFECYCLE-0001..0008 系列 | draft |
| N4-5 Switch Root/Thumb 完整伪代码示例（setup.props/state/feedback/context/lifecycle） | 再回到 Switch | proto-specific | P-BASE-SWITCH 实现证据；`packages/prototypes/base/src/switch` | 实现证据（非 lifecycle） |

注：旧 IFM 的 `meta` 内部维度**不在本章**（§6.3）。

#### 5-translation-layer（第五章）

| claim | 位置 | 分类 | spec mapping | status |
| --- | --- | --- | --- | --- |
| N5-1 Prototype 描述的义务 ≠ Host artifact（运行中的组件/DOM/widget 等） | Prototype 还不是宿主中的组件 | proto-specific | D-ADAPTER-PROFILE-0001（Adapter profile 治理）；「artifact」概念本身无实体 | partial（active + gap） |
| N5-2 Host 定义：让组件运行起来的具体技术环境 | 同上 | proto-specific | K-HOST-SURFACE-ROLES-0001（sources 引用整页；治理的是 boundary/surface 角色而非 Host 身份定义） | partial（draft + gap） |
| N5-3 Module 封装可复用语义实现；Host Capability 是翻译层向 Host 索取的最小事实或动作 | Module 与 Host Capability | proto-specific | M-\* / HC-\* 实体族（如 M-IMAGE-VIEW-0001、HC-ANATOMY-STRUCTURE-0001） | draft/active 混合（逐实体） |
| N5-4 翻译可发生在不同阶段：Adapter / Compiler / Hybrid 三种形态 | 翻译可以发生在不同阶段 | proto-specific | Adapter：D-ADAPTER-PROFILE-0001 + A-REACT-18-19-0001/A-VUE-3-0001/A-WEB-COMPONENT-0001/A-VUE-2-0001（均 active）；Compiler/Hybrid：无实体 | mixed（active + gap + gap） |
| N5-5 翻译结果三分：Faithful / Authorized bounded degradation / Unsupported | 形式改变不等于语义损失 | proto-specific | C-FEEDBACK-STYLE-0001（sources 引用本节，覆盖 feedback 一侧）；三分 taxonomy 本身无实体 | partial（draft + gap） |
| N5-6 Terminal UI 示例：bounded degradation 的具体推演 | 以 Terminal UI 为例 | general-theory（示例） | — | n/a |
| N5-7 四个不该混在一起的问题（能力、选择、代价、证据的正交性） | 四个不该混在一起的问题 | proto-specific | 无单一实体；与 D-ADAPTER-PROFILE-0001 的 profile 要求相邻 | gap |
| N5-8 在最早可靠的边界报告问题 | 在最早可靠的边界报告问题 | proto-specific | 无实体 | gap |
| N5-9 翻译结论需要证据；未验证目标不能自动继承一致性结论 | 翻译结论需要证据 | proto-specific | 无实体（与 §7.2 的 comparison profile 缺口相关） | gap |

#### 6-consistency-boundary（第六章）

| claim | 位置 | 分类 | spec mapping | status |
| --- | --- | --- | --- | --- |
| N6-1 Prototype 是一致性的第一把尺度 | Prototype 是一致性的第一把尺度 | proto-specific | K-DESIGN-TRADEOFF-0001（sources 直接引用本节） | draft |
| N6-2 设计取舍与可移植性的张力按取舍顺序处理 | 设计取舍与可移植性 | proto-specific | K-DESIGN-TRADEOFF-0001 | draft |
| N6-3 Prototype 未说明的细节默认不由协议层承诺 | Prototype 没有说明意味着什么？ | proto-specific | 无实体 | gap |
| N6-4 条件一致性包络：共享且受控的条件越多，可比较的层越细；像素比较是最高强度要求且需前置条件 | 共同条件越多，比较越细 | proto-specific | 无实体（见 §7.2） | gap |
| N6-5 媒介分支（如 Select 桌面 dropdown / 触屏 picker）应由 Prototype 声明，Adapter 不得自行替换交互形式 | 同上 | proto-specific | 无实体（媒介分支声明机制未编目） | gap |
| N6-6 自我限定声明：当前可靠证据主要来自 Web family；comparison profile、normalized DOM、image evidence 尚未形成治理身份 | 同上末段 | proto-specific（证据边界声明） | 与 A-\* active profile 的证据范围一致；声明本身无需实体 | n/a（声明性事实） |

#### 7-evolving-within-boundaries（第七章）

| claim | 位置 | 分类 | spec mapping | status |
| --- | --- | --- | --- | --- |
| N7-1 Proto UI 是一种有边界、可运行、可检验的近似，不垄断问题定义权 | 一条可行路径，而不是唯一答案 | general-theory（立场声明） | — | n/a |
| N7-2 三条主线：原型库 / 翻译层与生态 / 理论与内核 | Proto UI 选择的三条主线 | temporary-impl（当前工作组织） | 原型库治理见 D-PROTOTYPE-ENTITY-NAMING-0001 | draft（命名决策）；主线本身 n/a |
| N7-3 Base 原型库记录不依赖设计语言的交互语义；shadcn 衍生原型逐步编目中 | 原型库 | temporary-impl | P-BASE-\* / P-SHADCN-\* 实体族 | draft/active 混合 |
| N7-4 组合放大效应不是无条件笛卡尔积，取决于能力、翻译结果和证据 | 翻译层与生态 | proto-specific | 无实体 | gap |
| N7-5 实践可以修正当前近似；未进入主线的工作仍有价值 | 实践怎样修正当前近似 / 没有进入主线… | general-theory | — | n/a |

#### 8-conclusion（结语）

| claim | 位置 | 分类 | spec mapping | status |
| --- | --- | --- | --- | --- |
| N8-1 要保留的是交互知识（状态/关系/结构/时间/宿主选择权），不是某份实现 | 要保留的不是某一份实现 | general-theory | — | n/a |
| N8-2 Prototype 是可继续被询问的当前近似，不是时间胶囊 | 同上 | general-theory（K-COMPONENT-INTERACTION-0001 动机层有部分呼应） | partial（draft） | draft |
| N8-3 Proto UI 是一条路径而非历史终点；交互知识应成为公共基础设施 | 一条路径，而不是历史的终点 / 把精力还给交互本身 | general-theory | — | n/a |

### 3.2 legacy 页面 claims（#550 provenance + 当前核验）

以下沿用 #550 的 claim ID（CAP/IFM/PB/ES/TL/DC/EP/FAQ 前缀）作为 provenance。「当前核验」列为本文在当前 head 的复核结果：`present` = legacy 页内仍在；`relocated` = 该议题已由 §1.3 的 stub 迁往编号章节；status 列为当前实体 lifecycle（#550 审计时至今发生变化者加 †）。

| #550 claim | 当前核验 | 要点 | spec mapping（当前 status） |
| --- | --- | --- | --- |
| CAP#1 组件首先是交互主体 | present + relocated(ch1) | 新基线 N1-2 承接 | K-COMPONENT-INTERACTION-0001（draft） |
| CAP#2 还原度预设 | present + relocated(ch1) | N1-1 承接 | n/a |
| CAP#3 原型需要依附结构、作用于自身 | present | 新 ch3 由 N3-5/N3-6 弱化重述 | K-COMPONENT-INTERACTION-0001（draft）；C-TEMPLATE-0001/-0002（draft） |
| CAP#4/#5 抽象≠协议；协议=可描述/可翻译/可约束 | present + relocated(ch1) | N1-3 承接 | n/a |
| CAP#6a/b/c Prototype/Adapter/Host 定义 | present；stub 分别迁至 ch3（Prototype）与 ch5（Adapter/Host） | 新基线未以定义体形式逐一重述（§7.4） | Prototype：K-COMPONENT-INTERACTION-0001（draft）；Adapter：D-ADAPTER-PROFILE-0001 + A-\*（active）；Host：gap |
| CAP#7 `Prototype + Adapter = Host 中的组件实现` | present（ZH 行 194）；stub 迁至 ch5 | ch5 明确「Prototype 与 Host artifact 并不是同一种东西换了一个名字」，未重申该公式 | gap（无治理实体；#550 已标） |
| CAP#8 原型可开放、协议可稳定 | present | 社区治理议题迁入 ch7 | D-PROTOTYPE-ENTITY-NAMING-0001（draft）；社区治理 gap |
| IFM#1–#6 参与者/五通路模型 | present + relocated(ch2) | N2-1..N2-6 承接；术语见 §5.1 | 见 §3.1 ch2（draft，C-PROPS-0001 active） |
| IFM#7 state/lifecycle/`meta` 内部维度 | present | ch4 只保留 State/Anatomy/Lifecycle；`meta` 未带入新基线且无实体 | C-STATE-0001/C-LIFECYCLE-0001（draft）；`meta` gap |
| IFM#8 潜在的 `host` 通路 | present | ch2 改为「默认放在核心可移植通路之外」（§7.3） | K-INFORMATION-CHANNEL-0001-D 等三条（draft） |
| PB#1–#3 交互责任边界/三态拆分规则 | present + relocated(ch3) | N3-1/N3-2 承接；ch3 明确标注工作模型待检验 | gap（同 N3-2） |
| PB#4 子结构语法层强制（留在父原型内的结构不开放某些语法能力） | present | 新基线无对应段落；无直接 Contract | gap（C-ANATOMY-0004/-0009 相邻兼容，draft） |
| PB#5 feedback-only 弹性 | present + relocated(ch3) | N3-3 承接 | draft（见 N3-3） |
| ES#1 setup/runtime 分期 | present + relocated(ch4) | N4-4 承接 | C-LIFECYCLE-0001..0008（draft） |
| ES#2 feedback/event/lifecycle 一致性要求 | present + relocated(ch6) | ch6 以条件包络重述 | gap（一致性包络无实体） |
| ES#3 同为 Web 宿主时「接近 pixel-level 一致」 | present（EN 行 197 措辞最强） | ch6 改为条件化最高强度要求 + 证据免责声明（§7.2） | gap（A-\* active 但无视觉一致性 criterion） |
| TL#1 原型≠宿主实现别名 | present + relocated(ch5) | N5-1 承接 | partial（active + gap） |
| TL#2 翻译层「目前主要有两种典型形态」（Adapter/Compiler） | present（EN 行 109） | ch5 改为 Adapter/Compiler/Hybrid 三形态（§7.5） | Adapter active；Compiler/Hybrid gap |
| TL#3 翻译可能有损；差异须在原型语义边界内 | present + relocated(ch5) | N5-5 承接 | partial（draft + gap） |
| TL#4 `host` 通路默认不在跨平台主承诺 | present | 同 IFM#8 | 三条 -D criterion（draft） |
| DC#1 取舍顺序：语义一致 > User > Maker > 原型 Author | present | 新基线无独立章节重述；K-DESIGN-TRADEOFF-0001 sources 指向 ch6 | K-DESIGN-TRADEOFF-0001（draft） |
| DC#2 Proto UI 不把自己做成框架 | present + relocated(ch7) | N7-1 承接 | n/a |
| DC#3 可序列化长期方向约束 | present | 新基线未见对应承诺 | gap |
| DC#4a/4b 宿主特有能力隔离 / host 通路默认排除 | present | 同 IFM#8 | K-HOST-SURFACE-ROLES-0001†（draft，since 0.2.0-rc.7；#550 审计时该实体尚不在本 mapping 中） |
| EP#1–#3 三阶段路线 | present | ch7 以「三条主线」取代「三阶段」叙事 | V-PROTO-UI-0001..0008（active）/ V-PROTO-UI-0009（draft）仅版本事实；阶段规划 n/a |
| FAQ#1–#10 | present；stub 迁至 0-preface 再分发 | 议题分别由 ch3/ch5/ch6/ch7 承接 | 见 §3.1 各章；FAQ#9–10 社区治理仍 gap |
| FAQ#4 原型级组合不由核心提供 | present + relocated(ch3) | N3-6 承接 | K-PROTOTYPE-COMPOSITION-0001（draft） |

†：另一个 status 变化是 C-STATE-INTERACTION-0003 现为 `deprecated`（见 §7.1）。

## 4. 重复论证与阅读断点

### 4.1 legacy 层内部重复（#550 发现，当前核验仍为 present）

1. 拆分规则 + feedback-only 论证：PB ≈ FAQ Q5/Q6（两 locale 均近乎逐字）；
2. 一致性严格度：ES 两节 ≈ FAQ Q7/Q8；
3. 「不是框架/不提供原型级组合」：DC ≈ FAQ Q4 ≈ PB「组合回到宿主侧」三处完整论述；
4. 根依附/作用于自身：CAP ≈ PB「原型不能失去自己的依附结构」；
5. `host` 通路谨慎表述：IFM ≈ TL ≈ DC 三处。

由于 legacy 页已事实下线（§1.2），这些重复当前只影响仓内读者，不影响站点读者。本行是状态说明，不是处理建议。

### 4.2 跨层阅读断点（当前核验）

1. **legacy footer 链经 redirect 后的落点断裂**：legacy design-constraints 的「下一步」指向 faq，faq redirect 到 0-preface——即旧链倒数第二页把读者送回新基线的起点；legacy evolution-path 同样汇入 0-preface。旧八页的自身顺序（…→DC→EP→FAQ）与新九章顺序（0→…→8）不存在连续拼接。
2. **faq → 0-preface 的二次分发**：读者需经 preface 顶部的 11 个 stub 自行选择落点，stub 目标是各章中段 anchor（如 `#用信息通路判断组件边界`），依赖 fragment 保留（`whitepaperRedirectFragments` integration 的存在说明这是已知风险点并做了工程处理）。
3. **ch1 的两个 stub 指向 ch5 中段**：旧 CAP 读者寻找「三者之间的关系」时落在 ch5 的「Prototype 还不是宿主中的组件」，该节回答的是 Prototype/Host artifact 关系而非旧公式本身（§7.4）。
4. 新基线内部顺序（0→8）在正文章末均有承接句，未发现断点。

### 4.3 新基线内部的相邻概念过渡（当前核验）

- ch2 末尾以「State 不是通路」过渡到 ch4；Rule 在新基线中同样**未出现**（C-RULE-0001 族，draft，无白皮书来源）；
- asHook 在新基线未被命名（旧 PB/DC 的「逻辑复用≈hook 调用」段落未迁入；C-AS-HOOK-0001 族 draft）；
- Anatomy 在 ch4 有专节（#550 时代的「Anatomy 缺席」已被新基线解决）。

## 5. 术语漂移

| 术语 | legacy ZH | legacy EN | 新基线 ZH | 新基线 EN | spec | 事实记录 |
| --- | --- | --- | --- | --- | --- | --- |
| 信息通路 | 信息通路 | `information flow`（8 页共 34 处，`information channel` 0 处） | 信息通路 | `information channel`（34 处，`information flow` 0 处） | information channel（K-INFORMATION-CHANNEL-0001 等标题） | WPD-04 的术语裁决已在新基线与 spec 落地；legacy EN 保留旧词 |
| Maker / App Maker | Maker | Maker | 两者并用 | 两者并用（ch2 App Maker×15 / bare×5；ch3 App×2 / bare×13；ch4 App×4 / bare×10；其余章节零星） | 一般角色 Maker（K-COMPONENT-ACTOR-0001）；Props/Expose 端点 App Maker（C-PROPS-0001/C-EXPOSE-0001） | WPD-04 允许两种身份；新基线 ch2 关系草图在通路端点一致使用 App Maker，ch3/ch4 对同一配置关系多用 bare Maker，使用粒度不均匀 |
| 还原/保真 | 还原、保真 | reproduction / fidelity / faithfulness 混用（#550 记录，当前 legacy 内仍 present） | 还原 | ch5 以 Faithful / Authorized bounded degradation / Unsupported 建立结果 taxonomy | 无术语实体 | 新基线 EN 在 ch5 收敛为 Faithful 系词汇；taxonomy 本身无治理（gap，同 N5-5） |
| 宿主 | 宿主（Host） | Host | 宿主 | Host | K-HOST-SURFACE-ROLES-0001（draft）治理 boundary/surface 角色 | Host 身份定义仍无实体（gap，同 CAP#6c） |
| `desp:` frontmatter | 无 | 8/8 legacy EN 页仍有 `desp:` 键 | 无 | 无（0/9 编号章节） | — | #550 标记的杂散键仍在 legacy EN；新基线干净 |

## 6. ZH/EN 语义漂移

### 6.1 新基线（编号章节）内部

方法：逐章比对 9×2 个文件的 heading 结构（1:1 对应），并抽查论证密度最高的三处——ch3 三态拆分规则表、ch5 翻译结果三分（Faithful / Authorized bounded degradation / Unsupported）、0-preface 的 11 个 legacy-topic stub——两个 locale 语义等价。本轮未发现改变论证的 ZH/EN 漂移。

### 6.2 legacy 层内部

#550 记录的唯一 argument-changing 漂移——IFM「使用者」框定（ZH 把 User/Maker/Other Component 统称「使用者」，EN "through 'users'"，而 Maker 恰不是 User）——在当前 head 的两个 locale legacy IFM 页中均仍 present（§1.2 状态下仅影响仓内读者）。

### 6.3 跨层漂移（legacy ↔ 新基线，两个 locale 同构）

1. **`meta` 维度**：legacy IFM 列 state/lifecycle/`meta` 三个通路外内部维度；ch4 列 State/Anatomy/Lifecycle 且全文未出现 `meta`。`meta` 无 spec 实体（gap）；#565 后续工作清单中「`meta` 是否获得一级 lifecycle」仍是未决治理问题。
2. **`host` 通路**：legacy IFM 称「可以承认这种方向存在，并把它视作潜在的 `host` 通路」；ch2 称「默认放在核心可移植通路之外」并强调排除的是核心通路身份而非宿主能力使用。两者与 K-INFORMATION-CHANNEL-0001-D（draft）兼容，但「潜在通路」与「默认排除」的措辞重心不同。
3. **阶段叙事 → 主线叙事**：legacy EP 的三阶段（Web→原生→影响宿主选择）被 ch7 的三条主线（原型库/翻译层与生态/理论与内核）取代；旧阶段目标（如「工业级保障」）未迁入新基线。
4. **一致性论证**：legacy ES 的 Web 宿主高严格度 + pixel-level 表述 → ch6 的条件一致性包络（§7.2）。

## 7. 冲突与并列证据

按裁决第 3 点，以下条目并列记录双方证据，不做取舍。

### 7.1 deprecated 实体引用当前白皮书

- 证据 A：`spec/contracts/C-STATE-INTERACTION-0003.yaml` status=`deprecated`（deprecatedSince 0.1.0，关联 D-STATE-SEMANTIC-ACCESSORS-DEPRECATION-0001），其 `sources` 仍包含 `apps/www/src/content/docs/zh-cn/whitepaper/1-components-before-code.md` 的「组件到底是什么？」。
- 证据 B：该节正文（N1-2）论述的是交互主体身份的一般概念，不涉及 deprecated 的 `fromInteraction` 兼容行为；实体自身 revisions 记录了降级原因。
- 事实陈述：spec graph 中存在 deprecated 实体 → 当前发布白皮书章节的 source 绑定；按 AGENTS.md 规则 deprecated 实体仅为兼容/历史可读，该绑定不构成白皮书对 deprecated API 的背书，但 source 列表的语义（"本实体论述来源"）在此处与 lifecycle 状态并存，值得治理侧知悉。

### 7.2 pixel-level / 视觉一致性承诺的强度

- 证据 A（legacy ES，EN 行 197）："At worst, they should approach what people call 'pixel-level consistency.'"（ZH 对应措辞为等价但稍弱的 hedge）；legacy DC/FAQ Q7-Q8 同向。
- 证据 B（ch6「共同条件越多，比较越细」）：像素比较仅当 device metrics、单位、字体 shaping、色彩、rasterization 均受控时「才可能成为最高强度要求」，且章末明确声明 comparison profile、normalized DOM 与 image evidence 尚未形成治理身份，当前可靠证据主要来自 Web family。
- 证据 C（spec）：A-REACT-18-19-0001 / A-VUE-3-0001 / A-WEB-COMPONENT-0001 / A-VUE-2-0001 均 active，但均无视觉一致性 criterion；无任何实体治理像素级承诺（gap）。
- 事实陈述：新基线已把 legacy 的强承诺条件化并附加证据免责声明；spec 侧的一致性证据治理仍是空白；两侧现状不构成直接矛盾，但「最强承诺」（legacy ES）与「最弱治理」（无实体）的张力依旧存在。

### 7.3 `host` 通路的定位

- 证据 A（legacy IFM/TL/DC）：潜在通路 / 默认不在主承诺 / 宿主特有能力隔离（三处措辞见 §4.1-5）。
- 证据 B（ch2 details 块）：默认排除核心可移植通路身份，明确不排除宿主能力使用。
- 证据 C（spec）：K-INFORMATION-CHANNEL-0001-D、K-COMPONENT-ACTOR-0001-D、C-CORE-CHANNEL-0001-D 均为 draft criterion，与证据 B 同向。
- 事实陈述：三层证据方向一致（默认排除），差异仅在「是否承认其为潜在通路」的措辞重心；全部为 draft 治理，不能引用为 active 保证。

### 7.4 CAP#7 公式与三定义的承接

- 证据 A（legacy CAP，ZH 行 194）：`Prototype + Adapter = Host 中的组件实现`；同页给出 Prototype/Adapter/Host 三定义。
- 证据 B（ch1 stub）：「三者之间的关系」「为什么使用 Prototype、Adapter 和 Host」迁至 ch5。
- 证据 C（ch5）：明确「Prototype 与 Host artifact 并不是同一种东西换了一个名字」，给出 Host 与 Host artifact 的工作定义，但未重申 CAP#7 公式，也未逐一重述三定义。
- 证据 D（spec）：D-ADAPTER-PROFILE-0001（active）治理 Adapter profile 身份；公式与 Host 身份定义无实体（gap）。
- 事实陈述：旧公式在新基线中既未被重申也未被显式撤回；其 stub 落点章节含有与公式字面不同的关系表述。

### 7.5 翻译层形态数量

- 证据 A（legacy TL，EN 行 109）："the translation layer currently has two typical forms"（Adapter/Compiler）。
- 证据 B（ch5「翻译可以发生在不同阶段」）：Adapter / Compiler / Hybrid 三形态。
- 证据 C（spec 与治理记录）：D-ADAPTER-PROFILE-0001 + 四个 A-\* profile（active）只覆盖 Adapter；Compiler/Hybrid 无实体（gap）；#565 WPD-08 记录三者是同一翻译责任的不同实现形式。
- 事实陈述：legacy 的「两种形态」已被新基线的三形态取代；Compiler/Hybrid 的治理空白在两个基线中一致存在。

## 8. gap / unknown 汇总（无对应治理的 Proto-specific claims）

| 议题 | 出处 claim | 备注 |
| --- | --- | --- |
| Host 身份定义 | CAP#6c / N5-2 | K-HOST-SURFACE-ROLES-0001（draft）只覆盖边界/表面角色 |
| `Prototype + Adapter = 实现` 公式 | CAP#7 | 无实体；新基线未重申 |
| 三态拆分规则的直接 Contract | N3-2 / PB#1–#3 / FAQ#5 | ch3 已自标「待实践检验的工作模型」；个案决策 D-TOOLTIP-PROTOTYPE-BOUNDARY-0001（draft） |
| 子结构语法层强制 | PB#4 / DC（语法能力边界节） | C-ANATOMY-0004/-0009（draft）相邻兼容 |
| `meta` 维度 | IFM#7 | 未迁入新基线；lifecycle 去留是 #565 列出的未决治理问题 |
| Compiler / Hybrid 身份 | TL#2 / N5-4 | 仅 Adapter 有 active 治理 |
| 翻译结果三分 taxonomy | N5-5 | C-FEEDBACK-STYLE-0001（draft）只覆盖 feedback 一侧 |
| 条件一致性包络 / comparison profile / normalized DOM / image evidence | N6-4 / ES#3 | ch6 已自我声明未治理 |
| 媒介分支声明机制 | N6-5 | 无实体 |
| Component Author 角色定位 | N2-8 | 无实体 |
| 社区 adapter / 社区原型治理 | CAP#8 / FAQ#9–10 / N7-3 | D-PROTOTYPE-ENTITY-NAMING-0001（draft）只管命名 |
| 可序列化长期约束 | DC#3 | 未迁入新基线，无实体 |
| 「四个不该混在一起的问题」与「最早可靠边界报错」 | N5-7 / N5-8 | 无实体 |
| Rule / asHook 的白皮书过渡 | §4.3 | C-RULE-0001 / C-AS-HOOK-0001 族均 draft，无白皮书 source |

## 9. 本文明确不包含

- 不修改 `spec/**` 或任何实现、测试、公开页面；
- 不重写、不提出重写顺序、不评价新旧基线优劣；
- 不做 lifecycle 晋升/降级建议，不做产品或协议裁决；
- 不构成 #475/#477 的 blocking gate；
- §8 的 gap 清单是事实登记；其中任何一项如需治理，应按 AGENTS.md 进入独立 governance/decision 流程。

## 验证方法与来源

- 基线提交：`ddac15dae7016d995fcb0cb5afb334b495c0a842`；34 个页面文件逐一手读（编号章节双语全读，legacy 页 ZH 全读 + EN 结构与关键段落比对）；
- 附录 JSON 由脚本从当前 head 机械提取（frontmatter、heading、anchor、stub、内部链接、字符数）；
- spec 侧：`spec/**/*.yaml` 612 实体全量扫描 id/status/since，15 个 whitepaper source 实体逐条核对 path+section；
- #550（head `dc081c57` 的 `internal/records/2026-08-26-whitepaper-editorial-audit.md`）作为 provenance 逐条复核，其 claim ID 在 §3.2 沿用；
- 抽查命令：`corepack pnpm@10.32.1 check:agent-doc` 通过；10 个实体引用（K-INFORMATION-CHANNEL-0001、K-COMPONENT-ACTOR-0001、K-DESIGN-TRADEOFF-0001、K-PROTOTYPE-COMPOSITION-0001、K-HOST-SURFACE-ROLES-0001、C-PROPS-0001、C-CORE-CHANNEL-0001、C-STATE-INTERACTION-0003、D-ADAPTER-PROFILE-0001、D-TOOLTIP-PROTOTYPE-BOUNDARY-0001）逐一确认存在且 status 与本文一致。

## 主要来源

- 裁决：[#478 comment-5732667692](https://github.com/Proto-UI/Proto-UI/issues/478#issuecomment-5732667692)
- 治理背景：`internal/records/2026-08-28-whitepaper-rewrite-maintainer-decisions.zh-CN.md`（WPD-01..10，#565）
- 研究 provenance：[PR #550](https://github.com/Proto-UI/Proto-UI/pull/550)（closed-unmerged）
- 页面：`apps/www/src/content/docs/{zh-cn,en}/whitepaper/**`、`apps/www/astro.config.mjs`、`apps/www/src/utils/whitepaper-redirect-fragments.mjs`
- 实体：`spec/**`（见 §2.5、§3、§7、§8）
