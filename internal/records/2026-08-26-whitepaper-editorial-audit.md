# Proto UI Whitepaper Editorial Audit (Issue #478)

Date: 2026-08-26 · Scope: 8 pages × zh-cn/en under `apps/www/src/content/docs/{zh-cn,en}/whitepaper/` · Spec source of truth: `spec/**`
Status legend: **active** / **draft** / *(no governing entity)*

---

## 1. Reading Order

**Current (as linked by next-step footers):**
component-as-protocol → information-flow-model → prototype-boundary → execution-semantics → translation-layer → design-constraints → evolution-path → faq (FAQ is linked *from* design-constraints and evolution-path, i.e. reachable mid-sequence).

**Recommended:**
1–6 unchanged (the argument chain is genuinely sequential), then **faq**, then **evolution-path** last. Rationale: FAQ is almost entirely a restatement of boundary/consistency positions (see §3); reading it before evolution-path avoids answering questions whose setup reappears later, and evolution-path is forward-looking material that reads best as the closing page. Both design-constraints and evolution-path already offer multi-exit footers; these should converge on one canonical ordering.

---

## 2. Claim Inventory

IDs: `<page-abbr>#<n>`; pages: CAP=component-as-protocol, IFM=information-flow-model, PB=prototype-boundary, ES=execution-semantics, TL=translation-layer, DC=design-constraints, EP=evolution-path, FAQ.

| claim_id | page | heading | locale | summary | class | spec_entity_id | status |
|---|---|---|---|---|---|---|---|
| CAP#1 | CAP | 组件并不只存在于代码里 | zh+en | A component is first a stable interactive subject, not its implementation | proto-specific | K-COMPONENT-INTERACTION-0001 | draft |
| CAP#2 | CAP | 组件的预期，往往先于实现而存在 | zh+en | Reproducibility (还原度) implies components exist apart from implementations | general-theory | — | — |
| CAP#3 | CAP | 原型不是漂浮的能力清单 | zh+en | Prototype needs root attachment; acts on itself | proto-specific | K-COMPONENT-INTERACTION-0001; cf. C-AS-HOOK-0001 | draft |
| CAP#4 | CAP | 可抽象，不等于已经成为协议 | zh+en | Only part of a component is promotable to protocol layer | general-theory | — | — |
| CAP#5 | CAP | 为什么这里会出现“协议”这个词？ | zh+en | Protocol = describable/translatable/constrainable interactive contract | general-theory | — | — |
| CAP#6 | CAP | Prototype / Adapter / Host 定义 | zh+en | Three concept definitions | proto-specific | D-ADAPTER-PROFILE-0001; A-*-0001; K-HOST-SURFACE-ROLES-0001 | mixed |
| CAP#7 | CAP | 三者之间的关系 | zh+en | Prototype + Adapter = component implementation in Host | proto-specific | D-ADAPTER-PROFILE-0001 | active |
| CAP#8 | CAP | 原型可以开放，协议可以稳定 | zh+en | Community splits open; official base prototypes maintained like a protocol | proto-specific | no single governance entity | gap |
| IFM#1 | IFM | 先从“使用者”切分组件关系 | zh+en | Actors: User, Maker, Other Component | proto-specific | K-COMPONENT-ACTOR-0001 | draft |
| IFM#2 | IFM | 什么是信息通路？ | zh+en | Channels derived from who exchanges information, not API enumeration | proto-specific | K-INFORMATION-CHANNEL-0001; C-CORE-CHANNEL-0001 | draft |
| IFM#3 | IFM | User ↔ Component | zh+en | event = User→Component; feedback = Component→User | proto-specific | C-EVENT-0001; C-FEEDBACK-0001 | draft |
| IFM#4 | IFM | Maker ↔ Component | zh+en | props = Maker→Component; expose = Component→Maker | proto-specific | C-PROPS-0001 (.md, no machine status); C-EXPOSE-0001 | draft/partial |
| IFM#5 | IFM | Other Component ↔ Component | zh+en | context is the inter-component environmental channel | proto-specific | C-CONTEXT-0001 | draft |
| IFM#6 | IFM | 为什么这些能力不是随意枚举 | zh+en | Five capabilities are derived, canonical | proto-specific | C-CORE-CHANNEL-0001 + per-channel contracts | draft |
| IFM#7 | IFM | 信息通路并不等于组件的全部 | zh+en | state/lifecycle/meta are non-channel internal dimensions | proto-specific | M-STATE-0001; C-LIFECYCLE-0001..0007; **meta: no entity found** | gap |
| IFM#8 | IFM | 信息通路可以扩展吗？ | zh+en | Model open; potential `host` flow deliberately not core | proto-specific | no explicit entity for the exclusion | gap |
| PB#1 | PB | 关心的不是切块，而是交互主体 | zh+en | Boundary = interaction-responsibility boundary | proto-specific | K-COMPONENT-INTERACTION-0001 | draft |
| PB#2 | PB | 拆分判断规则 1/2/3 | zh+en | Non-feedback flow ⇒ must split; feedback-only ⇒ optional; none ⇒ must not split | proto-specific | C-FEEDBACK-STYLE-0003 (sources cite this rule); C-CONTEXT-0001-C | draft |
| PB#3 | PB | 为什么 feedback-only 可以不拆 | zh+en | Explicit engineering compromise for human readability | proto-specific | K-DESIGN-TRADEOFF-0001 | draft |
| PB#4 | PB | 如何强制原型边界成立 | zh+en | Syntax withholds props/event/expose/context on unsplit substructures | proto-specific | supported by K-PROTOTYPE-COMPOSITION-0001, C-CONTEXT-0001-C; **no direct contract pins it** | gap |
| PB#5 | PB | 拆分之后，组合回到宿主侧 | zh+en | Logic reuse ≈ hook/inheritance; structural composition excluded | proto-specific | K-PROTOTYPE-COMPOSITION-0001; C-AS-HOOK-0001 | draft |
| ES#1 | ES | setup 与 runtime | zh+en | setup/runtime staging required | proto-specific | C-LIFECYCLE-0001 | draft |
| ES#2 | ES | 生命周期在这里扮演什么角色 | zh+en | Lifecycle organizes runtime phase/capability order | proto-specific | C-LIFECYCLE-0002/0004/0005/0006/0007 | draft |
| ES#3 | ES | feedback 一致性（Web 宿主） | zh+en | Among Web hosts, target near pixel-level identity | temporary-impl (aspirational) | none — A-*-0001 have no such criterion | contradiction-risk |
| ES#4 | ES | event / lifecycle 一致性 | zh+en | Same interaction responsibility; lifecycle order preserved | proto-specific | C-EVENT-0007; C-LIFECYCLE-0002 | draft |
| ES#5 | ES | 跨平台一致性由原型规则决定 | zh+en | Medium-appropriate forms allowed within prototype-declared boundaries | proto-specific | no direct entity | gap |
| TL#1 | TL | 翻译层不只是语法转换 | zh+en | Translation maps *and fills in* missing host capability (WC context, Styler) | proto-specific | HC-* family; A-*-0001 | mixed |
| TL#2 | TL | Adapter 与 Compiler | zh+en | Two translation forms share one semantic baseline; Adapter is main path | mixed | A-*-0001 active; **Compiler has no entity — direction only** | partial |
| TL#3 | TL | 翻译为什么可能有损 | zh+en | Lossy translation normal; core semantics must survive | general + proto framing | D-ADAPTER-PROFILE-0001 | active |
| TL#4 | TL | `host` 通路默认不在跨平台主承诺内 | zh+en | host flow excluded from core commitment | proto-specific | same gap as IFM#8 | gap |
| DC#1 | DC | 取舍顺序 | zh+en | semantic consistency > User > Maker > Author experience | proto-specific | K-DESIGN-TRADEOFF-0001 | draft |
| DC#2 | DC | 不把自己做成框架 | zh+en | No business integration / final composition / framework scheduling | proto-specific | K-PROTOTYPE-COMPOSITION-0001 | draft |
| DC#3 | DC | 可序列化是长期方向约束 | zh+en | Protocol layer prefers serializable expression by default | proto-specific | C-RULE-0003; C-PROPS-0003; C-DELAY-0001-K | draft |
| DC#4 | DC | 宿主特有能力作为强宿主相关能力 | zh+en | Host-specific capabilities isolated from core axis | proto-specific | HC-* family; K-HOST-SURFACE-ROLES-0001 | draft |
| EP#1 | EP | 第一阶段：先在 Web 站稳 | zh+en | v0 axis = Web hosts | temporary-impl/planning | V-PROTO-UI-* (versions only) | n/a |
| EP#2 | EP | 第二阶段：原生宿主；工业级保障 | zh+en | v1 native expansion, industrial-grade QA aspiration | temporary-impl/planning | none | n/a |
| EP#3 | EP | 从覆盖宿主到影响宿主选择 | zh+en | Long-term direction, explicitly non-committal | general-theory | none | n/a |
| FAQ#1–4 | FAQ | Q1–Q4 | zh+en | Not-a-framework; cross-platform as result; library substrate; no composition | proto-specific | K-PROTOTYPE-COMPOSITION-0001; K-DESIGN-TRADEOFF-0001 | draft |
| FAQ#5–8 | FAQ | Q5–Q8 | zh+en | Split rules & consistency strictness restated | proto-specific | see PB#2, PB#3, ES#3–ES#5 | draft |
| FAQ#9–10 | FAQ | Q9–Q10 | zh+en | Community adapters/prototypes welcomed; official neutral baseline | proto-specific | no dedicated governance entity | gap |

---

## 3. Duplicated Arguments

1. **Split rules + feedback-only rationale**: PB 拆分判断 + 为什么 feedback-only 可以不拆 ≈ FAQ Q5+Q6 (near-verbatim both locales). Compress FAQ to summary + link.
2. **Consistency strictness**: ES (two sections) ≈ FAQ Q7+Q8.
3. **Not-a-framework / no composition**: DC two sections ≈ FAQ Q4 ≈ PB 组合回到宿主侧. Three full treatments of the same exclusion.
4. **Root anchoring / acts-on-itself**: CAP ≈ PB 原型不能失去自己的依附结构. Motivation vs consequence, but wording overlaps heavily.
5. **`host` flow caution**: IFM ≈ TL ≈ DC. Three statements, no single authoritative pointer.

## 4. Missing Transitions

1. **Rule** (C-RULE-0001, explicitly “not an information channel”) never mentioned anywhere in the whitepaper; the five-channel model reads as complete but is not the full catalog.
2. **Anatomy** (C-ANATOMY-0001..0010), structural semantics complementing Context, entirely absent; C-ANATOMY-0009 lets parts be *read through Expose*, which nuances PB#4's absolutist prohibition. Readers hit this in Specifications with no bridge.
3. **asHook**: PB/DC mention “逻辑复用≈hook 调用” casually; spec treats asHook as a governed special prototype form (C-AS-HOOK-0001, many D-AS-HOOK-*).
4. **meta** dimension named once (IFM#7), never developed anywhere.
5. **Terminology handoff**: whitepaper says Maker; contracts say App Maker (C-EXPOSE-0001); no mapping at the Specifications exit.
6. **Compiler**: introduced as major direction in TL; never tracked afterwards (EP mentions compilation only vaguely under 长期方向).

## 5. Weak / Unclear Claims

- **ES#3 pixel-level consistency**: highest-confidence sentence in the whitepaper; no contract/test/profile criterion backs it. Demote to aspiration or map to a future conformance entity.
- **PB#4 “语法层强制”**: stated as enforced invariant; no cited contract pins per-substructure channel syntax. Needs an entity or softer wording.
- **IFM#8 / TL#4 `host` 通路**: presented as an existing named flow with defined policy but has no entity; today it is a cataloged direction — prose should say so.
- **EP#2 “工业级别”**: undefined term; appropriately hedged but should carry explicit non-normative marker.
- **CAP#2 还原度 argument**: rhetorically load-bearing and unsupported; acceptable for motivation but should be marked as such.

## 6. Terminology Drift

| Term | whitepaper zh | whitepaper en | spec en | issue |
|---|---|---|---|---|
| 信息通路 | 信息通路 | information flow | information channel | EN locale diverges from governed term used in every contract title. Highest-priority fix. |
| Maker | Maker | Maker | App Maker (C-EXPOSE-0001) | Two names for one actor; breaks Specs handoff. |
| 还原度/保真 | 还原/保真 | reproduction/fidelity/faithfulness (mixed) | reproduction, fidelity | EN alternates three renderings. |
| 宿主能力补全 | 补全 | fill in / completion / carrying mechanism (mixed) | host capability | Four near-synonyms within TL alone. |
| 组合 | 组合/拼接 | composition/assembly/stitching | composition | minor; “stitching” only in EN PB. |

Also: every EN page carries a stray `desp:` frontmatter key — trivial cleanup.

## 7. EN/ZH Semantic Drift (argument-changing only)

1. **“使用者” scope (IFM)**: ZH heading frames User/Maker/Other Component collectively as 使用者; EN renders "through 'users'". Since Maker is precisely not a user, both blur the taxonomy the section establishes; EN slightly more misleading. Reword both to “关系对象 / relation targets”.
2. **ES#3 strength**: ZH “所谓的‘像素级一致’” hedges more than EN "what people call 'pixel-level consistency'". Given the claim is unsupported (§5), align both to the weaker hedge.
3. **CAP “会成立的交互主体”** rendered "an interactive subject that can actually stand up as one" obscures the ZH sense of coming-to-stand-in-a-host-over-time, which foreshadows ES. Suggest "an interactive subject that comes to stand in a host".
No other argument-changing drift found; FAQ Q5–Q10 translations are semantically faithful.

## 8. Prose/Spec Contradictions (with evidence)

1. **Channel completeness**: IFM#6 presents {event, feedback, props, expose, context} as *the* derived core set. C-CORE-CHANNEL-0001 (“Core portable channels are identity-derived and protocol-governed”, draft) and C-RULE-0001 (“Rule is not an information channel”) show the governed catalog is larger with explicit exclusions. Soften or link.
2. **PB#4 vs C-ANATOMY-0009**: “Anatomy may read only capabilities explicitly exposed by same-domain parts through Expose” means parts do participate in Expose-mediated relations without being independent prototypes. PB's “单独让它 expose 能力” prohibition needs scoping (“author-facing direct syntax”) to avoid contradicting the anatomy domain.
3. **ES#3 vs adapter profiles**: A-REACT-18-19-0001 / A-VUE-3-0001 / A-WEB-COMPONENT-0001 (all active) contain module support/omission and lifecycle relations but no visual-identity criterion. The strictest promise has the weakest governance.
4. **TL Compiler**: “翻译层目前主要有两种典型形态” overstates — only Adapter exists as governed identity (A-*, D-ADAPTER-PROFILE-0001). Should read “Adapter 是当前唯一受治理的形态，Compiler 是方向”. 

## 9. Recommended Rewrite Sequence (bounded)

Each step independently shippable as a PR touching only `apps/www/src/content/docs/**` unless noted.

| # | Step | Type | Pages | Notes |
|---|---|---|---|---|
| R1 | Terminology alignment: information flow→channel (EN), Maker→App Maker (+one-line mapping), remove `desp:`, unify fidelity vocabulary | editorial | all 16 files | pure projection fix |
| R2 | Exit-footer convergence: canonical order, FAQ after DC, EP last | editorial | CAP/DC/EP footers, docs nav | |
| R3 | Deduplicate: compress FAQ Q4–Q8 to summaries linking PB/ES; single authoritative `host`-flow statement + pointers | editorial | PB, ES, TL, DC, FAQ | |
| R4 | Weaken unsupported absolutes: pixel-level marked aspirational/non-normative; PB#4 scoped to author-facing syntax; TL Compiler reworded direction-only | editorial wording | ES, PB, TL | no governed meaning change |
| R5 | Add “beyond the five channels” bridge in IFM + FAQ entry naming Rule (not a channel), Anatomy (structural semantics), asHook (logic reuse), each linked to its entity | editorial + light new prose | IFM, FAQ | cites existing draft entities; promotes nothing |
| R6 | Mark `host` flow and `meta` explicitly as open directions without governing entities | editorial | IFM, TL, DC | honesty fix |
| R7 | (semantic decisions requiring catalog governance, NOT part of editorial PRs): (a) decide whether substructure channel-syntax prohibition becomes a contract; (b) admit or formally defer a `host` channel entity; (c) define conformance criteria behind Web-host consistency; (d) give `meta` a lifecycle (contract or removal); (e) record community adapter/prototype governance (FAQ Q9–10) as decision/knowledge entities | governance | spec/** | out of scope of #478 |

R1–R6 do NOT require any page to reach a final state; this audit does not assume every rewrite lands.

---
### Provenance
All entity IDs/statuses verified against `spec/**/*.yaml` on main (clean tree): statuses quoted from `status:` fields; evidence quotes from C-CONTEXT-0001, C-ANATOMY-0001/0009, C-AS-HOOK-0001, C-EXPOSE-0001, C-RULE-0001/0003, C-PROPS-0003, C-LIFECYCLE-0001..0008, C-FEEDBACK-STYLE-0003, all K-* entries, D-ADAPTER-PROFILE-0001, A-*-0001, HC-*. C-PROPS-0001 is a `.md` contract with no machine status field — flagged as a catalog hygiene note, not amended here.
