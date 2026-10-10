# Historical #377 snapshot before coverage migration

Captured 2026-10-06T16:35:12Z. This is retained history, not the active matrix. [Original issue](https://github.com/Proto-UI/Proto-UI/issues/377).

## Goal

Maintain the authoritative 2026-08-13 v0.3 disposition of all 64 frozen shadcn directory entries plus Proto UI-owned Base and Brutalist candidates.

Roadmap source and frozen comparison baseline: PR #375. Stable semantics remain governed by `spec/**`. This Issue tracks classification and dependencies; it is not an implementation contract and does not require every classified entry to ship in 0.3.

## Completion and reporting rules

Every frozen entry has one primary identity from `existing`, `semantic`, `projection`, `styled-only`, `composition`, `provider/system`, or `excluded`; explicit Base, shadcn, and Brutalist dispositions; dependencies; owner; difficulty; wave; state; and a linked Issue after the bounded work item has an explicit authority or decision state plus an evidence and validation boundary. Creating or updating a reversible collaboration Issue under current authorization is not a privileged publication gate.

Classification closure is not implementation closure. Report `implemented`, `ready`, `research`, `blocked`, `deferred`, `composition/provider/system`, and `excluded` separately. Counts such as 51, 63/64, and Base 30–35 are observations, never implementation or release gates.

Current frozen routing counts:

- identities: 8 `existing`, 26 `semantic`, 5 `projection`, 6 `styled-only`, 17 `composition`, 1 `provider/system`, 1 `excluded`;
- states: 13 `implemented`, 4 `ready`, 7 `research`, 11 `blocked`, 10 `deferred`, 18 `composition/provider/system`, 1 `excluded`.

A row's state describes its current roadmap action. A design-language-specific implementation already present in another column does not silently change a missing shadcn disposition to implemented.

## Coverage Matrix

| Entry | Snapshot group | Primary identity | Base | shadcn | Brutalist | Dependencies | Owner | Difficulty | Wave | State | Issue/PR |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Button | Existing | `existing` | P-BASE-BUTTON (merged) | implemented projection | implemented semantic projection | merged Base P/T; no blocker | maintainers | snapshot | existing | `implemented` | — |
| Dialog | Existing | `existing` | P-BASE-DIALOG* (merged) | implemented projection | implemented semantic projection | merged Base P/T; no blocker | maintainers | snapshot | existing | `implemented` | — |
| Dropdown Menu | Existing | `existing` | P-BASE-DROPDOWN* (merged) | implemented projection | implemented semantic projection | merged Base P/T; no blocker | maintainers | snapshot | existing | `implemented` | — |
| Hover Card | Existing | `existing` | P-BASE-HOVER-CARD* (merged) | implemented projection | implemented semantic projection | merged Base P/T; no blocker | maintainers | snapshot | existing | `implemented` | — |
| Select | Existing | `existing` | P-BASE-SELECT* (merged) | implemented projection | implemented semantic projection | merged Base P/T; no blocker | maintainers | snapshot | existing | `implemented` | — |
| Switch | Existing | `existing` | P-BASE-SWITCH* (merged) | implemented projection | implemented semantic projection | merged Base P/T; no blocker | maintainers | snapshot | existing | `implemented` | — |
| Tabs | Existing | `existing` | P-BASE-TABS* (merged) | implemented projection | implemented semantic projection | merged Base P/T; no blocker | maintainers | snapshot | existing | `implemented` | — |
| Toggle | Existing | `existing` | P-BASE-TOGGLE (merged) | implemented projection | implemented semantic projection | merged Base P/T; no blocker | maintainers | snapshot | existing | `implemented` | — |
| Checkbox | A | `projection` | P-BASE-CHECKBOX* (merged) | P-SHADCN-CHECKBOX* (implemented; #379 completed) | P-BRUTALIST-CHECKBOX* (implemented; #384 completed) | Base P/T + preset/docs/demo | unassigned | F3 – Moderate | W1 | `implemented` | #379 / #384 (completed) |
| Scroll Area | A | `projection` | P-BASE-SCROLL-AREA* (merged) | P-SHADCN-SCROLL-AREA* (implemented; #380 completed, PR #624 merged) | implemented semantic projection | M-SCROLL-0001; HC-SCROLL-SURFACE-0001; HC-MOVE-GESTURE-0001 | maintainers | F5 - Large | W1 | `implemented` | #380 completed; PR #624 merged |
| Separator | A | `projection` | P-BASE-SEPARATOR (merged) | P-SHADCN-SEPARATOR (implemented; #381 completed) | implemented semantic projection | P-BASE-SEPARATOR + accessibility projection | unassigned | F2 – Small | W1 | `implemented` | #381 (completed) |
| Textarea | A | `projection` | P-BASE-TEXTAREA (merged) | P-SHADCN-TEXTAREA (implemented; #382 completed) | implemented semantic projection | M-TEXT-CONTROL-0001; HC-TEXT-CONTROL-0001 | unassigned | F3 – Moderate | W1 | `implemented` | #382 (completed) |
| Tooltip | A | `projection` | P-BASE-TOOLTIP* (merged) | P-SHADCN-TOOLTIP* (implemented; #383 completed) | P-BRUTALIST-TOOLTIP* (implemented; #385 completed) | M-POSITIONING-0001; HC-ANCHORED-POSITION-0001 | unassigned | F5 - Large | W1 | `implemented` | #383 / #385 (completed) |
| Alert | A | `styled-only` | no Base carrier admitted | comparison only; no Proto UI admission | deferred by D-BRUTALIST-STYLED-ONLY-ADMISSION-0001; no Prototype admitted | passive-versus-announced identity, action/dismiss/tone/anatomy and announcement ownership remain open | maintainer-guided | F5 - Large | W2 | `deferred` | #386 completed; PR #615 merged |
| Aspect Ratio | A | `styled-only` | no Base protocol indicated | styled-only/layout candidate | not admitted | reusable layout contract evidence | unassigned | F? - Requires assessment | deferred | `research` | — |
| Badge | A | `styled-only` | none; direct styled-only | styled-only candidate; no Issue yet | implemented direct styled-only | existing Brutalist visual-contract evidence; shadcn scope unreviewed | unassigned | F? - Requires assessment | deferred | `research` | — |
| Breadcrumb | A | `composition` | structure/composition; no same-name Base | composition/shared-style mapping | no automatic prototype | constituent protocols/styles; bounded artifact not yet identified | unassigned | F? - Requires assessment | deferred | `composition/provider/system` | — |
| Button Group | A | `composition` | Button/Toggle/Toolbar composition research | composition/shared-style mapping | no automatic prototype | constituent protocols/styles; bounded artifact not yet identified | unassigned | F? - Requires assessment | deferred | `composition/provider/system` | — |
| Card | A | `styled-only` | none; direct styled-only | styled-only candidate; no Issue yet | implemented direct styled-only | existing Brutalist visual-contract evidence; shadcn scope unreviewed | unassigned | F? - Requires assessment | deferred | `research` | — |
| Empty | A | `composition` | content composition; no independent protocol | composition/shared-style mapping | no automatic prototype | constituent protocols/styles; bounded artifact not yet identified | unassigned | F? - Requires assessment | deferred | `composition/provider/system` | — |
| Item | A | `composition` | structure/composition; no independent protocol | composition/shared-style mapping | no automatic prototype | constituent protocols/styles; bounded artifact not yet identified | unassigned | F? - Requires assessment | deferred | `composition/provider/system` | — |
| Kbd | A | `composition` | native `kbd` content; no Base carrier | shared style/content mapping | shared native content and styling; no Prototype identity | D-BRUTALIST-STYLED-ONLY-ADMISSION-0001; no independent P/T or CLI component | unassigned | F? - Requires assessment | deferred | `composition/provider/system` | #386 completed; PR #615 merged |
| Skeleton | A | `styled-only` | none; direct styled-only | styled-only candidate; no Issue yet | implemented direct styled-only | existing Brutalist visual-contract evidence; shadcn scope unreviewed | unassigned | F? - Requires assessment | deferred | `research` | — |
| Spinner | A | `styled-only` | no Base carrier admitted | comparison only; not admitted by the Brutalist decision | admitted one-part visual-only candidate; implementation #737 | D-BRUTALIST-STYLED-ONLY-ADMISSION-0001 + CLI keyframe/reduced-motion closure + two compositions | guangliang2019 | F5 - Large | W2 | `ready` | #386 completed; PR #615 merged; #737 open |
| Table | A | `semantic` | Checkpoints A/B implemented (#625 / #676); Checkpoint C Adapter/reader evidence remains (#621 reopened) | projection only after remaining Base Adapter/reader evidence | projection only after remaining Base Adapter/reader evidence | draft D/C/P/T chain; React/Vue/Vue2 implementations still planned; activation blocker retained | maintainer-guided | F5 - Large | W4 | `ready` | #387 completed / #621 reopened; PRs #625 / #676 merged |
| Typography | A | `composition` | shared style/content; no prototype | composition/shared-style mapping | no automatic prototype | constituent protocols/styles; bounded artifact not yet identified | unassigned | F? - Requires assessment | deferred | `composition/provider/system` | — |
| Accordion | B | `semantic` | implementation #388 in flight; #548 completed; #549 active via PR #688 (changes requested) | projection after Base approval | projection only if Base matures and a designable surface exists | Disclosure/Collapsible + M-COLLECTION-0001 + A11y | maintainer-guided | F5 - Large | W4 | `research` | #388; #549 / PR #688 |
| Alert Dialog | B | `semantic` | semantic proposal required | projection after Base approval | projection only if Base matures and a designable surface exists | Dialog + A11y; exact alert-dialog boundary research | maintainer-guided | F? - Requires assessment | deferred | `deferred` | — |
| Avatar | B | `semantic` | Base Image boundary delivered (#374 completed, PR #633); Avatar boundary proposal next | projection only after Base/Avatar boundary | projection only with a designable surface | #374 Image checkpoint delivered (P-BASE-IMAGE + M-IMAGE-VIEW-0001 + HC-IMAGE-VIEW-0001 draft); Avatar ownership-split proposal | maintainer-guided | F5 - Large | W3 | `research` | #374 (completed) |
| Collapsible | B | `semantic` | implementation #388 in flight; #548 completed; #549 active via PR #688 (changes requested) | projection after Base approval | projection only if Base matures and a designable surface exists | Disclosure semantics + A11y | maintainer-guided | F5 - Large | W4 | `research` | #388; #549 / PR #688 |
| Field | B | `semantic` | semantic proposal required | projection after Base approval | projection only if Base matures and a designable surface exists | Label/Input relations + M-A11Y-0001 / HC-A11Y-0001 | maintainer-guided | F? - Requires assessment | W4 | `deferred` | — |
| Input | B | `semantic` | implemented single-line text-control slices (#389 completed) | unblocked; no projection Issue yet | unblocked; no projection Issue yet | single-line Text Control boundary + HC-TEXT-CONTROL-0001 | maintainer-guided | F5 - Large | W4 | `ready` | #389 (completed) |
| Label | B | `semantic` | semantic proposal required | projection after Base approval | projection only if Base matures and a designable surface exists | Field/control accessibility relations | maintainer-guided | F? - Requires assessment | W4 | `deferred` | — |
| Native Select | B | `semantic` | semantic proposal required | projection after Base approval | projection only if Base matures and a designable surface exists | host-owned selection UI boundary + Collection/A11y | maintainer-guided | F? - Requires assessment | W4 | `deferred` | — |
| Popover | B | `semantic` | semantic proposal required | projection after Base approval | projection only if Base matures and a designable surface exists | Overlay/Portal/Transition + M-POSITIONING-0001 / HC-ANCHORED-POSITION-0001 | maintainer-guided | F? - Requires assessment | W5 | `deferred` | — |
| Progress | B | `semantic` | semantic proposal required | projection after Base approval | projection only if Base matures and a designable surface exists | A11y value semantics; Meter distinction | maintainer-guided | F? - Requires assessment | W5 | `deferred` | — |
| Radio Group | B | `semantic` | P-BASE-RADIO-GROUP* (merged #464; initial entry repaired by #669) | P-SHADCN-RADIO-GROUP* (implemented; #662 completed, PR #667 merged) | unblocked; no projection Issue yet | P-BASE-RADIO-GROUP* checkpoint #349; Collection + Focus Roving + A11y | advanced contributor | F5 - Large | W3 | `ready` | #378 / #662 completed; PRs #669 / #667 merged |
| Slider | B | `semantic` | semantic proposal required | projection after Base approval | projection only if Base matures and a designable surface exists | HC-MOVE-GESTURE-0001 + A11y value semantics | maintainer-guided | F? - Requires assessment | W5 | `deferred` | — |
| Toast | B | `semantic` | semantic proposal required | projection after Base approval | projection only if Base matures and a designable surface exists | notification queue/lifetime + announcement semantics | maintainer-guided | F? - Requires assessment | W5 | `deferred` | — |
| Toggle Group | B | `semantic` | semantic proposal required | projection after Base approval | projection only if Base matures and a designable surface exists | Toggle + Collection/Focus Roving; Toolbar relationship | maintainer-guided | F? - Requires assessment | W5 | `deferred` | — |
| Calendar | C | `semantic` | semantic boundary unapproved | projection/composition only after Base decision | no automatic projection | date model + locale + grid focus/selection; module/host-cap catalog readiness | maintainer/core | advanced | W6 | `blocked` | — |
| Carousel | C | `semantic` | semantic boundary unapproved | projection/composition only after Base decision | no automatic projection | HC-MOVE-GESTURE-0001 + geometry/scroll semantics; module/host-cap catalog readiness | maintainer/core | advanced | W6 | `blocked` | — |
| Combobox | C | `semantic` | semantic boundary unapproved | projection/composition only after Base decision | no automatic projection | M-COLLECTION-0001 + focus/typeahead + positioning + text control; module/host-cap catalog readiness | maintainer/core | advanced | W6 | `blocked` | — |
| Command | C | `semantic` | semantic boundary unapproved | projection/composition only after Base decision | no automatic projection | M-COLLECTION-0001 + focus/typeahead; module/host-cap catalog readiness | maintainer/core | advanced | W6 | `blocked` | — |
| Context Menu | C | `semantic` | semantic boundary unapproved | projection/composition only after Base decision | no automatic projection | M-COLLECTION-0001 + positioning + focus/dismissal; module/host-cap catalog readiness | maintainer/core | advanced | W6 | `blocked` | — |
| Drawer | C | `semantic` | semantic boundary unapproved | projection/composition only after Base decision | no automatic projection | overlay + HC-MOVE-GESTURE-0001 + host geometry; module/host-cap catalog readiness | maintainer/core | advanced | W6 | `blocked` | — |
| Input OTP | C | `semantic` | semantic boundary unapproved | projection/composition only after Base decision | no automatic projection | single-line text control + segmented display/paste/A11y; module/host-cap catalog readiness | maintainer/core | advanced | W6 | `blocked` | — |
| Menubar | C | `semantic` | semantic boundary unapproved | projection/composition only after Base decision | no automatic projection | M-COLLECTION-0001 + focus/typeahead + positioning; module/host-cap catalog readiness | maintainer/core | advanced | W6 | `blocked` | — |
| Navigation Menu | C | `semantic` | semantic boundary unapproved | projection/composition only after Base decision | no automatic projection | M-COLLECTION-0001 + focus + positioning; module/host-cap catalog readiness | maintainer/core | advanced | W6 | `blocked` | — |
| Pagination | C | `semantic` | semantic boundary unapproved | projection/composition only after Base decision | no automatic projection | navigation semantics + controlled page state + unknown totals; module/host-cap catalog readiness | maintainer/core | advanced | W6 | `blocked` | — |
| Resizable | C | `semantic` | semantic boundary unapproved | projection/composition only after Base decision | no automatic projection | HC-MOVE-GESTURE-0001 + host geometry; module/host-cap catalog readiness | maintainer/core | advanced | W6 | `blocked` | — |
| Attachment | D | `composition` | no same-name Base; composition boundary | composition/recipe mapping | no automatic prototype | constituent protocols/styles; bounded artifact not yet identified | unassigned | F? - Requires assessment | deferred | `composition/provider/system` | — |
| Bubble | D | `composition` | no same-name Base; composition boundary | composition/recipe mapping | no automatic prototype | constituent protocols/styles; bounded artifact not yet identified | unassigned | F? - Requires assessment | deferred | `composition/provider/system` | — |
| Data Table | D | `composition` | no same-name Base; composition boundary | composition/recipe mapping | no automatic prototype | Table + Collection + Selection + Pagination | unassigned | F? - Requires assessment | deferred | `composition/provider/system` | — |
| Date Picker | D | `composition` | no same-name Base; composition boundary | composition/recipe mapping | no automatic prototype | Calendar + Field + Input + Popover | unassigned | F? - Requires assessment | deferred | `composition/provider/system` | — |
| Direction | D | `provider/system` | renderer/adapter concern; no prototype | provider/system mapping | no same-name prototype | renderer/adapter environment | unassigned | F? - Requires assessment | deferred | `composition/provider/system` | — |
| Input Group | D | `composition` | no same-name Base; composition boundary | composition/recipe mapping | no automatic prototype | constituent protocols/styles; bounded artifact not yet identified | unassigned | F? - Requires assessment | deferred | `composition/provider/system` | — |
| Marker | D | `composition` | no same-name Base; composition boundary | composition/recipe mapping | no automatic prototype | constituent protocols/styles; bounded artifact not yet identified | unassigned | F? - Requires assessment | deferred | `composition/provider/system` | — |
| Message | D | `composition` | no same-name Base; composition boundary | composition/recipe mapping | no automatic prototype | constituent protocols/styles; bounded artifact not yet identified | unassigned | F? - Requires assessment | deferred | `composition/provider/system` | — |
| Message Scroller | D | `composition` | no same-name Base; composition boundary | composition/recipe mapping | no automatic prototype | constituent protocols/styles; bounded artifact not yet identified | unassigned | F? - Requires assessment | deferred | `composition/provider/system` | — |
| Questionnaire | D | `composition` | no same-name Base; composition boundary | composition/recipe mapping | no automatic prototype | constituent protocols/styles; bounded artifact not yet identified | unassigned | F? - Requires assessment | deferred | `composition/provider/system` | — |
| Sheet | D | `composition` | no same-name Base; composition boundary | composition/recipe mapping | no automatic prototype | Dialog/Drawer projection decision | unassigned | F? - Requires assessment | deferred | `composition/provider/system` | — |
| Sidebar | D | `composition` | no same-name Base; composition boundary | composition/recipe mapping | no automatic prototype | constituent protocols/styles; bounded artifact not yet identified | unassigned | F? - Requires assessment | deferred | `composition/provider/system` | — |
| Chart | Excluded | `excluded` | none | excluded from frozen v0.3 alignment | excluded | visualization engine/domain | none | n/a | excluded | `excluded` | — |

## Work-routing rules

- Do not create one Issue per directory name.
- A new Base semantic candidate starts with a bounded proposal, draft entity, and executable evidence. When applicable authority and evidence determine one path, Agents continue automatically; otherwise isolate one `unresolved-product-direction`.
- A proposal closes after its result is recorded as accepted, rejected, or deferred and, when implementation is admitted, a linked bounded implementation Issue or PR exists.
- A projection Issue requires a merged Base contract and a designable host surface.
- A Brutalist styled-only implementation Issue requires two real compositions, a reusable/testable visual contract, executable positive and absence evidence, and Brutalist domain co-signoff.
- Composition/provider/system rows remain mappings until a bounded implementation artifact is identified.
- Transition, Live Region, and Async Region do not get thin Brutalist wrappers by default.

## Review flags

- `Typography` is mapped to `composition` only because the seven-class ledger has no separate shared-style/content identity; this row does **not** admit a prototype.
- B/C `semantic` rows start as routing classifications, not approved Base protocols. Checkpoint updates: Accordion/Collapsible #388 Checkpoint A approved as amended (#548 completed; #549 active via PR #688); Input #389 completed with text-control slices cataloged; Table #387 completed, #625/#676 merged Checkpoints A/B, and #621 reopened because Checkpoint C remains incomplete. Remaining proposals must still prove an independently testable cross-host information path; otherwise the row must be reclassified.
- D-group composition mappings are frozen dispositions, not API-stability claims. Attachment/Bubble/Marker/Message/Message Scroller/Questionnaire remain deferred until a bounded artifact and ownership path exist.
- Alert is deferred by `D-BRUTALIST-STYLED-ONLY-ADMISSION-0001`; Spinner is admitted as one-part direct styled-only and advances under #737; Kbd is native/shared style-content with no Prototype identity. Aspect Ratio remains research with no published implementation or proposal Issue.
- Table advanced past proposal: #387 closed with an accepted draft direction; #625 merged the generic A11y prerequisite; #676 delivered Checkpoint B Module/Base source. #621 is reopened for the incomplete Checkpoint C Adapter/catalog/CLI/preview/reader evidence. Sorting, selection, pagination, virtualization, resizing, editing, and data fetching stay in Data Table composition.
- #374 delivered the Image checkpoint (PR #633; P-BASE-IMAGE/M-IMAGE-VIEW-0001/HC-IMAGE-VIEW-0001 draft). An Avatar boundary and ownership-split proposal may now be opened; no Avatar design-language implementation Issue is admitted before it.
- Accordion and Collapsible advance under #388 in dependency order. Research, governed Base implementation, and design-language evidence may proceed automatically; only materially different stable-admission choices not fixed by current authority become one `unresolved-product-direction`.

## Initial linked work

- #378 — Base Radio Group implementation; completed (#464 merged); #349 remains the completed semantic checkpoint.
- #374 — Base Image implementation; completed (PR #633 merged).
- #379–#385 — seven independent W1 design-language projection Issues; all completed, including #380 via PR #624.
- #386 — completed Alert / Spinner / Kbd admission classification via merged PR #615: Alert deferred, Spinner admitted, Kbd kept as shared style/content. Spinner implementation proceeds under #737.
- #387 — Base Table structural-semantics proposal completed; #625 and #676 merged Checkpoints A/B. #621 is reopened for remaining Checkpoint C evidence.
- #388 — Base Disclosure/Collapsible/Accordion semantic-family delivery; #548 completed and #549 is active through PR #688 (current changes requested).
- #375 — roadmap record and frozen comparison baseline.

## Out of scope

- Treating 51, 63/64, or Base 30–35 as release gates.
- Automatically pulling post-snapshot shadcn additions into 0.3.
- Opening C-group implementation Issues before their module/host-cap gates are ready.
- Treating Web Component/React/Vue projections as evidence of completed non-Web host semantics.

## Agent-forward execution

Current decision: `none for the currently eligible bounded transition`.

This bounded work is open for Agent execution. Agents may continue through research or proposal work, implementation of any direction fixed by applicable authority, validation, review response, and the next eligible dependency under current-user or active standing authorization. Routine claiming, implementation details, CI repair, review, ready-for-review, and merge mechanics are not attended decisions.

Pause only for:

1. `unresolved-product-direction`: applicable authority and evidence leave materially different semantic, ownership, public-guarantee, lifecycle, or compatibility choices open.
2. `privileged-or-irreversible-operation`: publication or release, access, secrets, rulesets, security disclosure, a provenance exception, or another action that cannot be safely bounded and recovered.

For every pull-request transition, bind collection, review, and integration to the live exact head. Require trusted repository CI and DCO status plus independent source/provenance review; an independent reviewer who is not the PR author or any commit contributor; no active, non-dismissed `CHANGES_REQUESTED` anywhere in the cumulative review history; and every applicable review thread resolved. A draft pull request may be reviewed and remediated but must not be merged. Respect live permission and repository rules, use an atomic lease or idempotency key and durable receipt, reconcile an unknown outcome once before any retry, and never force/admin-bypass or blindly retry.

