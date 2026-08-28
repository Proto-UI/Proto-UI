# Proto UI Whitepaper Editorial Audit (Issue #478)

Date: 2026-08-26 · Scope: 8 pages × zh-cn/en under `apps/www/src/content/docs/{zh-cn,en}/whitepaper/` · Spec source of truth: `spec/**`

Status legend: **active** / **draft** / **partial** / **mixed** / **gap** (no governing entity) / **contradiction-risk** / **n/a**; **—** means no catalog lifecycle is assigned to a general-theory claim.

---

## 1. Reading Order

**Current sidebar order (`apps/www/astro.config.mjs`, both locales):** component-as-protocol → information-flow-model → prototype-boundary → execution-semantics → translation-layer → design-constraints → evolution-path → faq.

**Current next-step footer graph:** component-as-protocol → information-flow-model → prototype-boundary → execution-semantics → translation-layer → design-constraints. The design-constraints footer links directly to FAQ alongside non-whitepaper exits; evolution-path also links to FAQ alongside exits; FAQ has no next-step footer. The footer graph therefore does not currently define one eight-page sequence.

**Recommended canonical order:** component-as-protocol → information-flow-model → prototype-boundary → execution-semantics → translation-layer → design-constraints → faq → evolution-path.

Keep the first-six-page footer chain, retain design-constraints → FAQ, add FAQ → evolution-path, make evolution-path the terminal whitepaper page, and align the sidebar to the same order.

---

## 2. Claim Inventory

IDs: `<page-abbr>#<n>`; pages: CAP=component-as-protocol, IFM=information-flow-model, PB=prototype-boundary, ES=execution-semantics, TL=translation-layer, DC=design-constraints, EP=evolution-path, FAQ.

| claim_id | page | heading | locale | summary | class | spec_entity_id | status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CAP#1 | CAP | 组件并不只存在于代码里 | zh+en | A component is first a stable interactive subject, not its implementation | proto-specific | K-COMPONENT-INTERACTION-0001 | draft |
| CAP#2 | CAP | 组件的预期，往往先于实现而存在 | zh+en | Reproducibility (还原度) implies components exist apart from implementations | general-theory | — | — |
| CAP#3 | CAP | 原型不是漂浮的能力清单 | zh+en | Prototype needs root attachment; acts on itself | proto-specific | K-COMPONENT-INTERACTION-0001; C-TEMPLATE-0001; C-TEMPLATE-0002; cf. C-AS-HOOK-0001 only as the exceptional subjectless form attached to its caller | draft |
| CAP#4 | CAP | 可抽象，不等于已经成为协议 | zh+en | Only part of a component is promotable to protocol layer | general-theory | — | — |
| CAP#5 | CAP | 为什么这里会出现“协议”这个词？ | zh+en | Protocol = describable/translatable/constrainable interactive contract | general-theory | — | — |
| CAP#6a | CAP | Prototype 定义 | zh+en | Prototype is a stable, describable interaction definition that must continue to identify an interactive subject | proto-specific | K-COMPONENT-INTERACTION-0001-C (interactive-subject aspect only) | partial (draft) |
| CAP#6b | CAP | Adapter 定义 | zh+en | Adapter is the concrete translation profile that maps governed semantics into a target host/runtime | proto-specific | D-ADAPTER-PROFILE-0001; A-REACT-18-19-0001; A-VUE-2-0001; A-VUE-3-0001; A-WEB-COMPONENT-0001 | partial (active; official runtime Adapter profiles only) |
| CAP#6c | CAP | Host 定义 | zh+en | Host is the broad environment in which Proto UI is realized | proto-specific | no governing entity found; K-HOST-SURFACE-ROLES-0001 governs narrower boundary/surface roles, not Host identity | gap |
| CAP#7 | CAP | 三者之间的关系 | zh+en | Prototype + Adapter = component implementation in Host | proto-specific | no governing entity found; D-ADAPTER-PROFILE-0001 governs Adapter profiles, not this formula | gap |
| CAP#8 | CAP | 原型可以开放，协议可以稳定 | zh+en | Community prototype definitions may remain open; official foundational prototypes are maintained as stable prototype protocols | proto-specific | community openness: no entity found; official protocol identity: D-PROTOTYPE-ENTITY-NAMING-0001 and cataloged P-\* entities | mixed (draft + gap) |
| IFM#1 | IFM | 先从“使用者”切分组件关系 | zh+en | Actors: User, Maker, Other Component | proto-specific | K-COMPONENT-ACTOR-0001 | draft |
| IFM#2 | IFM | 什么是信息通路？ | zh+en | Channels derived from who exchanges information, not API enumeration | proto-specific | K-INFORMATION-CHANNEL-0001; C-CORE-CHANNEL-0001 | draft |
| IFM#3 | IFM | User ↔ Component | zh+en | event = User→Component; feedback = Component→User | proto-specific | C-EVENT-0001; C-FEEDBACK-0001 | draft |
| IFM#4 | IFM | Maker ↔ Component | zh+en | props = App Maker→Component; expose = Component→App Maker/caller | proto-specific | C-PROPS-0001; C-EXPOSE-0001 | mixed (active + draft) |
| IFM#5 | IFM | Other Component ↔ Component | zh+en | context is the inter-component environmental channel | proto-specific | C-CONTEXT-0001 | draft |
| IFM#6 | IFM | 为什么这些能力不是随意枚举 | zh+en | Five core portable channels are identity-derived and protocol-governed | proto-specific | C-CORE-CHANNEL-0001 + per-channel contracts | draft |
| IFM#7 | IFM | 信息通路并不等于组件的全部 | zh+en | state/lifecycle/meta are non-channel internal dimensions | proto-specific | C-STATE-0001; M-STATE-0001; C-LIFECYCLE-0001..0007; **meta: no entity found** | mixed (draft + gap) |
| IFM#8 | IFM | 信息通路可以扩展吗？ | zh+en | Model remains extensible; host/environment exchange is deliberately outside the core portable channel set by default | proto-specific | K-COMPONENT-ACTOR-0001-D; K-INFORMATION-CHANNEL-0001-D; C-CORE-CHANNEL-0001-D | draft |
| PB#1 | PB | 关心的不是切块，而是交互主体 | zh+en | Boundary = interaction-responsibility boundary | proto-specific | K-COMPONENT-INTERACTION-0001 | draft |
| PB#2 | PB | 拆分判断规则 1/2/3 | zh+en | Non-feedback flow ⇒ must split; feedback-only ⇒ optional; none ⇒ must not split | proto-specific | related draft evidence: C-FEEDBACK-STYLE-0003-Q-TEMPLATE-STYLE and C-CONTEXT-0001-C; no entity governs the complete three-rule test | mixed (draft evidence + gap) |
| PB#3 | PB | 为什么 feedback-only 可以不拆 | zh+en | Explicit engineering compromise for human readability | proto-specific | K-DESIGN-TRADEOFF-0001 | draft |
| PB#4 | PB | 如何强制原型边界成立 | zh+en | Author-facing syntax withholds props/event/expose/context on substructures that remain unsplit | proto-specific | related draft direction: K-PROTOTYPE-COMPOSITION-0001 and C-CONTEXT-0001-C; no direct Contract governs the syntax rule | gap |
| PB#5 | PB | 拆分之后，组合回到宿主侧 | zh+en | Logic reuse ≈ hook/inheritance; structural composition excluded | proto-specific | K-PROTOTYPE-COMPOSITION-0001; C-AS-HOOK-0001 | draft |
| ES#1 | ES | setup 与 runtime | zh+en | setup/runtime staging required | proto-specific | C-LIFECYCLE-0001 | draft |
| ES#2 | ES | 生命周期在这里扮演什么角色 | zh+en | Lifecycle organizes runtime phase/capability order | proto-specific | C-LIFECYCLE-0002/0004/0005/0006/0007 | draft |
| ES#3 | ES | feedback 一致性（Web 宿主） | zh+en | Among Web hosts, target near pixel-level identity | temporary-impl (aspirational) | none — A-\*-0001 have no such criterion | contradiction-risk |
| ES#4 | ES | event / lifecycle 一致性 | zh+en | Portable interaction intent and relative lifecycle order are preserved across hosts | proto-specific | C-EVENT-TYPE-0001; C-EVENT-TYPE-0002; C-LIFECYCLE-0002 | draft |
| ES#5 | ES | 跨平台一致性由原型规则决定 | zh+en | Medium-appropriate forms allowed within prototype-declared boundaries | proto-specific | no direct entity | gap |
| TL#1a | TL | 翻译层不只是语法转换 | zh+en | Official Adapter profiles catalog reviewed Module translation and the provision of cataloged host capabilities | proto-specific | D-ADAPTER-PROFILE-0001; A-REACT-18-19-0001; A-VUE-2-0001; A-VUE-3-0001; A-WEB-COMPONENT-0001 | active |
| TL#1b | TL | 翻译层不只是语法转换 | zh+en | Web Components Context bridging and cross-host Styler completion are offered as concrete capability-filling examples | proto-specific | no profile lists Context or Feedback/Styler under `supports` or `omits`, and no current HC-\* entity catalogs Context or styling capability | gap |
| TL#2 | TL | Adapter 与 Compiler | zh+en | Two translation forms share one semantic baseline; Adapter is main path | mixed | A-\*-0001 active; **Compiler has no entity — direction only** | partial |
| TL#3 | TL | 翻译为什么可能有损 | zh+en | Lossy translation may occur while core semantics must survive | general + proto framing | Adapter-profile requirements: D-ADAPTER-PROFILE-0001 (active); tradeoffs: K-DESIGN-TRADEOFF-0001-B/C (draft); general loss boundary: no entity found | mixed (active + draft + gap) |
| TL#4 | TL | `host` 通路默认不在跨平台主承诺内 | zh+en | Host/environment exchange is excluded from the core portability commitment by default | proto-specific | K-COMPONENT-ACTOR-0001-D; K-INFORMATION-CHANNEL-0001-D; C-CORE-CHANNEL-0001-D | draft |
| DC#1 | DC | 取舍顺序 | zh+en | semantic consistency > User > Maker > Author experience | proto-specific | K-DESIGN-TRADEOFF-0001 | draft |
| DC#2 | DC | 不把自己做成框架 | zh+en | Proto UI excludes prototype-level final composition from the core template language and additionally states that it does not own business integration, framework-level scheduling, or host-specific high-level UI organization | proto-specific | prototype composition: K-PROTOTYPE-COMPOSITION-0001; broader framework exclusions: no entity found | mixed (draft + gap) |
| DC#3 | DC | 可序列化是长期方向约束 | zh+en | Protocol layer prefers serializable expression by default | proto-specific | K-DESIGN-TRADEOFF-0001-D (draft direction); C-PROPS-0003 (active Props rule); C-RULE-0003 and C-DELAY-0001-J (draft rules/exceptions) | mixed (active + draft) |
| DC#4a | DC | 宿主特有能力作为强宿主相关能力 | zh+en | Host-specific capabilities as a class are isolated from the core axis | proto-specific | no governing entity found; HC-\* entities govern individual capability interfaces, while K-HOST-SURFACE-ROLES-0001 governs only boundary/surface roles | gap |
| DC#4b | DC | 宿主特有能力作为强宿主相关能力 | zh+en | Host/environment-related channels are outside the core portability guarantee by default | proto-specific | K-COMPONENT-ACTOR-0001-D; K-INFORMATION-CHANNEL-0001-D; C-CORE-CHANNEL-0001-D | draft |
| EP#1 | EP | 第一阶段：先在 Web 站稳 | zh+en | v0 axis = Web hosts | temporary-impl/planning | V-PROTO-UI-\* (versions only) | n/a |
| EP#2 | EP | 第二阶段：原生宿主；工业级保障 | zh+en | v1 native expansion, industrial-grade QA aspiration | temporary-impl/planning | none | n/a |
| EP#3 | EP | 从覆盖宿主到影响宿主选择 | zh+en | Long-term direction, explicitly non-committal | general-theory | none | n/a |
| FAQ#1 | FAQ | Q1 | zh+en | Proto UI does not define itself as a framework | proto-specific | no governing entity found | gap |
| FAQ#2 | FAQ | Q2 | zh+en | Cross-platform support follows from separating component interaction semantics from technical implementations | proto-specific | K-COMPONENT-INTERACTION-0001 (partial coverage) | partial (draft) |
| FAQ#3 | FAQ | Q3 | zh+en | Proto UI can underlie component libraries, including through community adapters | proto-specific | no governing entity found | gap |
| FAQ#4 | FAQ | Q4 | zh+en | Proto UI core does not provide prototype-level composition | proto-specific | K-PROTOTYPE-COMPOSITION-0001 | draft |
| FAQ#5 | FAQ | Q5 | zh+en | A substructure carrying an independent information channel must be split | proto-specific | no direct governing entity found | gap |
| FAQ#6 | FAQ | Q6 | zh+en | A feedback-only substructure may remain unsplit as a readability tradeoff | proto-specific | K-DESIGN-TRADEOFF-0001 and C-FEEDBACK-STYLE-0003-Q-TEMPLATE-STYLE provide partial draft evidence; no direct split-rule Contract | mixed (draft + gap) |
| FAQ#7 | FAQ | Q7 | zh+en | Same prototype remains the same interactive subject; Web hosts are expected to be especially strict | proto-specific | interactive identity: K-COMPONENT-INTERACTION-0001-C; Web strictness: no entity found | mixed (draft + gap) |
| FAQ#8 | FAQ | Q8 | zh+en | Cross-platform media may vary within prototype-defined bounds | proto-specific | no governing entity found | gap |
| FAQ#9–10 | FAQ | Q9–Q10 | zh+en | Community adapters/prototypes welcomed; official neutral baseline | proto-specific | no dedicated governance entity | gap |

---

## 3. Duplicated Arguments

1. **Split rules + feedback-only rationale**: PB 拆分判断 + 为什么 feedback-only 可以不拆 ≈ FAQ Q5+Q6 (near-verbatim both locales). Compress FAQ to summary + link.
2. **Consistency strictness**: ES (two sections) ≈ FAQ Q7+Q8.
3. **Not-a-framework / no composition**: DC two sections ≈ FAQ Q4 ≈ PB 组合回到宿主侧. Three full treatments of the same exclusion.
4. **Root anchoring / acts-on-itself**: CAP ≈ PB 原型不能失去自己的依附结构. Motivation vs consequence, but wording overlaps heavily.
5. **`host` flow caution**: IFM ≈ TL ≈ DC. Three statements with draft catalog ownership but no single whitepaper pointer.

## 4. Missing Transitions

1. **Rule** (C-RULE-0001) never appears in the whitepaper. The entity explicitly says Rule is not an information channel, so the transition should introduce it as a separate behavior mechanism adjacent to the five-channel model—not as a sixth channel or evidence that the core channel set is incomplete.
2. **Anatomy** (C-ANATOMY-0001..0010), structural semantics complementing Context, is entirely absent; draft C-ANATOMY-0004 clarifies that each part is a prototype instance claiming an Anatomy role, while draft C-ANATOMY-0009 allows PartViews to read only capabilities explicitly exposed by same-domain parts. This is compatible with PB#4's author-facing prohibition for substructures that have not been split into independent prototypes, not an exception to it.
3. **asHook**: PB/DC mention “逻辑复用≈hook 调用” casually; spec treats asHook as a governed special prototype form (C-AS-HOOK-0001, many D-AS-HOOK-\*).
4. **meta** dimension named once (IFM#7), never developed anywhere and has no catalog entity.
5. **Terminology handoff**: whitepaper uses the general actor term Maker, consistent with K-COMPONENT-ACTOR-0001; Props and Expose use the narrower App Maker endpoint/caller identity in C-PROPS-0001 and C-EXPOSE-0001. The Specifications exit needs that scoped mapping, not a global rename.
6. **Compiler**: introduced as a major direction in TL; never tracked afterwards (EP mentions compilation only vaguely under 长期方向).

## 5. Weak / Unclear Claims

- **ES#3 pixel-level consistency**: highest-confidence sentence in the whitepaper; no contract/test/profile criterion backs it. Demote to aspiration or map to a future conformance entity.
- **PB#4 “语法层强制”**: stated as an enforced invariant; no direct Contract pins per-substructure channel syntax. It needs an entity or softer, author-facing wording.
- **CAP#7 formula**: `Prototype + Adapter = Component implementation in Host` is not directly governed. D-ADAPTER-PROFILE-0001 governs the profile identity and requirements, not this complete equation.
- **IFM#8 / TL#4 `host` direction**: K-COMPONENT-ACTOR-0001-D, K-INFORMATION-CHANNEL-0001-D, and C-CORE-CHANNEL-0001-D catalog the default exclusion, but all are draft. Whitepaper language must not present that direction as an active guarantee.
- **EP#2 “工业级别”**: undefined term; appropriately hedged but should carry an explicit non-normative marker.
- **CAP#2 还原度 argument**: rhetorically load-bearing and unsupported; acceptable for motivation but should be marked as such.

## 6. Terminology Drift

| Term | whitepaper zh | whitepaper en | spec en | issue |
| --- | --- | --- | --- | --- |
| 信息通路 | 信息通路 | information flow | information channel | EN locale diverges from the governed term used in channel entity titles. Highest-priority fix. |
| Maker / App Maker | Maker | Maker | Maker generally (K-COMPONENT-ACTOR-0001); App Maker for Props/Expose endpoints (C-PROPS-0001, C-EXPOSE-0001) | Keep Maker for the general actor taxonomy; use or explain App Maker only at the Props/Expose endpoint/caller boundary. |
| 还原度/保真 | 还原/保真 | reproduction/fidelity/faithfulness (mixed) | reproduction, fidelity | EN alternates three renderings. |
| 宿主能力补全 | 补全 | fill in / completion / carrying mechanism (mixed) | host capability | Four near-synonyms within TL alone. |
| 组合 | 组合/拼接 | composition/assembly/stitching | composition | Minor; “stitching” only in EN PB. |
| 会成立的交互主体 | 会成立的交互主体 | an interactive subject that can actually stand up as one | valid interactive subject (K-COMPONENT-INTERACTION-0001-C, draft) | Current EN is awkward but semantically compatible; normalize to the cataloged wording without adding host materialization or temporal progression. |

Also: every EN page carries a stray `desp:` frontmatter key — trivial cleanup.

## 7. EN/ZH Semantic Drift (argument-changing only)

1. **“使用者” scope (IFM)**: ZH heading frames User/Maker/Other Component collectively as 使用者; EN renders "through 'users'". Since Maker is precisely not a User, both blur the taxonomy the section establishes; EN is slightly more misleading. Reword both to “关系对象 / relation targets”.

No other argument-changing drift found. The ZH and EN ES#3 pixel-consistency phrases are equivalent hedges; the unsupported strength of the underlying promise remains a §5/R4 issue, not locale drift.

## 8. Prose/Spec Reconciliation Notes

1. **PB#4 remains an uncataloged syntax claim, not an Anatomy contradiction**: PB#4 concerns author-facing direct channel syntax on a substructure that still remains inside its parent Prototype. C-ANATOMY-0004 defines an Anatomy part as a prototype instance claiming a role, and C-ANATOMY-0009 permits only bounded reads of capabilities that such a same-domain part has explicitly exposed. The two positions are compatible; PB#4's remaining issue is the absence of a direct governing Contract.
2. **ES#3 vs adapter profiles**: A-REACT-18-19-0001, A-VUE-2-0001, A-VUE-3-0001, and A-WEB-COMPONENT-0001 are active and contain module-support/omission and lifecycle relations, but no visual-identity criterion. The strictest promise has the weakest governance.
3. **TL Compiler**: “翻译层目前主要有两种典型形态” overstates current governance. Adapter exists as a governed identity through active D-ADAPTER-PROFILE-0001 and official A-\* profiles; Compiler has no catalog entity. It should read “Adapter 是当前唯一受治理的形态，Compiler 是方向”.

## 9. Recommended Rewrite Sequence (bounded)

Each step is independently shippable as a PR touching only `apps/www/src/content/docs/**` unless noted.

| # | Step | Type | Pages | Notes |
| --- | --- | --- | --- | --- |
| R1 | Terminology alignment: information flow→channel (EN); add the scoped Maker→App Maker mapping at Props/Expose endpoints; remove `desp:`; unify fidelity vocabulary | editorial + source-trace maintenance | all 16 files; matching `spec/**` source metadata | Do not globally rename the general Maker actor. When a renamed heading is listed in a catalog entity's `sources.sections`, update that exact section string in the same PR; current owners include K-COMPONENT-ACTOR-0001, K-INFORMATION-CHANNEL-0001, C-CORE-CHANNEL-0001, and C-STATE-0001. |
| R2 | Reading-order convergence: align the sidebar to design-constraints → faq → evolution-path, add an FAQ → evolution-path next-step footer, and remove the evolution-path → FAQ back-link so evolution-path can close the sequence | editorial | FAQ/EP footers, `apps/www/astro.config.mjs` | DC already links to FAQ; CAP and the first-six-page footer chain need no change |
| R3 | Deduplicate: compress FAQ Q4–Q8 to summaries linking PB/ES; single authoritative `host`-direction statement + pointers | editorial | PB, ES, TL, DC, FAQ | Preserve the draft lifecycle of the `host` exclusion. |
| R4 | Weaken unsupported absolutes: pixel-level marked aspirational/non-normative; PB#4 scoped to author-facing syntax; TL Compiler reworded direction-only; CAP#7 formula softened or separately governed | editorial wording | ES, PB, TL, CAP | No governed meaning change. |
| R5 | Add an adjacent-semantics bridge after the IFM channel model, naming Rule (not a channel), Anatomy (structural semantics), and asHook (logic reuse), each linked to its entity | editorial + light new prose | IFM, FAQ | Cite existing draft entities without promoting them. |
| R6 | Mark the `host`-flow exclusion explicitly as draft catalog direction and `meta` as an uncataloged open direction | editorial | IFM, TL, DC | Lifecycle honesty fix. |
| R7 | Semantic decisions requiring catalog governance, not part of editorial PRs: (a) decide whether the substructure channel-syntax prohibition becomes a Contract; (b) decide whether the draft host/environment exclusion should stabilize or change; (c) define conformance criteria behind Web-host consistency; (d) give `meta` a lifecycle (Contract or removal); (e) record community adapter/prototype governance (FAQ Q9–10); (f) govern or soften the CAP#7 formula | governance | spec/\*\* | Out of scope of #478. |

R1–R6 do not require any page to reach a final state; this audit does not assume every rewrite lands.

---

### Provenance

All entity IDs and statuses were verified against `spec/**/*.yaml` on the audited head. `C-PROPS-0001` is an active YAML entity; its linked `C-PROPS-0001.md` file is explanatory notes and has no independent lifecycle. This dated record is an editorial audit, not normative authority; applicable catalog entities retain precedence according to their lifecycle.
