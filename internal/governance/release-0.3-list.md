# 0.3 release delivery list

Production deadline: **2026-11-04 23:59 Asia/Shanghai**. Feature integration target: **2026-11-08 23:59**. Acceptance/repair stage: November 9–22; RC: November 23–27; final decision: November 28–30. See [the governing plan](release-0.3-plan.md).

This is a source inventory, **not a claim that these capabilities have passed acceptance**. The [source ledger](release-0.3-source-ledger.json) binds package surfaces, CLI entries, 203 original Finf comment checkboxes, 68 named delivery criteria, and the 187-open-Issue snapshot with its 1,233 checkbox conditions to their sources. Historical checks remain historical; each current development and acceptance result needs its own exact source and evidence. Mixed Issue conditions retain `criterion-split` until their concrete family and prerequisite role are reconciled; the snapshot does not authorize title-only closure or deferral. Counts of export roots or aliases are not counts of independent Prototypes.

Repository file fingerprints in the ledger bind to its explicit `sourceRevision`, not to later worktree bytes. In particular, the delivery checklist fingerprint preserves the complete pre-preface source at that revision; the additive release-stage preface does not replace that historical source or certify acceptance.

## Additive evidence checkpoints

The [evidence checkpoints](release-0.3-evidence-checkpoints.json) extend this same source-bound ledger with timestamped child evidence for #1073 and #1191. They bind the unchanged source snapshot by Git blob and SHA-256, retain original Issue/criterion keys, and separate verified contribution owners from unconfirmed acceptance owners. They are not a second inventory, do not override original criteria, and do not close either Issue. Development integration, Draft publication, source-only tests, skipped CI and native/packed acceptance remain distinct. New inventory versions must preserve this historical snapshot rather than silently rebinding it.

Validate the snapshot/companion and its negative controls with `node --test scripts/ci/test/release-source-ledger-checkpoints.test.mjs` on Node.js 24.

## Committed libraries

- **Base:** all current exports, including the full Form, Collection/Search, Disclosure, Overlay, value/date, geometry/long-collection and existing-control families below.
- **Shadcn:** all current exports and their supported profiles/compositions, including Card, input-shell, style-scope and component presets. Explicit author-selected Rhea demos must preserve public compatibility defaults.
- **Brutalist / neo-brutalism:** all current exports, including Badge, Card, Skeleton, Spinner and theme in addition to the shared families. Preserve flat/fade boundaries, reduced-motion and native-anchor ownership when repairing motion.
- **Lucide:** the public Icon facility, manifest/snippets/loaders and every exported icon identity. The ledger enumerates the 1,695 current icon modules; this is source coverage, not 1,695 independently exercised runtime cases.

### Finf-promised family delivery

Each item includes Base semantics, Shadcn and Brutalist projection, applicable Lucide participation, package/CLI delivery, real www documentation/demo and supported Web-host consumption. The original full wording and existing Issue links remain in `deliverySource.criteria`.

- [ ] Form/relationships: Label, Field, Fieldset, Form, Checkbox Group (`deliver.label` through `deliver.checkbox-group`; #1094).
- [ ] Collections/search/focus: Autocomplete, Combobox, Command, Toggle Group, Toolbar, Menubar, Navigation Menu, Context Menu (#1095).
- [ ] Disclosure: Collapsible and Accordion (#1096).
- [ ] Overlay/notifications: Popover, Alert Dialog, Drawer, Toast (#1097).
- [ ] Values/dates: Slider, Number Field, Progress, Meter, Input OTP, Calendar, Date Picker (#1098).
- [ ] Geometry/long collections: Resizable, Carousel, Message Scroller, Tree, Virtual List, Data Table (#1099).
- [ ] Existing Base parity: Async Region, Button, Checkbox, Dialog, Dropdown, Hover Card, Image, Input, Live Region, Radio Group, Scroll Area, Select, Separator, Surface, Switch, Table, Tabs, Text, Textarea, Toggle, Tooltip, Transition (#1100, #1159–#1162).
- [ ] Overlay scrollbar-coordinate repair and scoped prior-work closeouts (#1163/#1164).

These grouped boxes are acceptance umbrellas. Check completed source-bound children promptly; do not wait for every family to pass before recording a completed repair.

## Consumer and interaction priorities

- [ ] Search: public semantic composition, trigger alignment, input/result geometry, styles, cold/warm performance, keyboard/IME/reopen/mobile/200% (#420/#856/#1095/#1175).
- [ ] Select: repeated-open active ownership, each Item matching its own Trigger, size/placement/RTL/resize/collision/scroll and real supported-host evidence (#1159; PRs #1210/#1229).
- [ ] Shared Focus/Overlay: same-target modality, rapid React present, Menubar withdrawal, initialization/teardown, real nested popup Escape priority (#1177).
- [ ] Website navigation: responsive contents/tree ownership and return, current focus supersession, first frame, sidebar collapse/manual state, full-row hit areas, overflow and font scaling (#1191).
- [ ] Typography/RuntimeBox: real composition, authored font priority, portal/lifecycle, glyph/fallback/load failure, CJK, CLS and 200% (#803/#786; PR #1227).
- [ ] Shadcn docs/profile delivery: explicit Rhea demos, real Vue 2 snippets, complete public dependencies, Card compatibility and community-button alignment (#1042/#1044; PRs #1211/#1275).
- [ ] Brutalist interaction motion: Button/action/Select/Surface and community/native-anchor consumers; reduced-motion and interrupt/release evidence (#398/#559; PR #1236).
- [ ] www: reachable bilingual Preview/Code/Usage/install, four supported Web hosts, homepage actual-atom exhibits, navigation/search and responsive interaction (#1042/#420/#1175).
- [ ] CLI: all supported registry entries, initialization/add/facade, exact-version packed consumers, finite token/style closure and generated artifacts (#1000/#1073/#1115/#1154).
- [ ] Required core/Runtime/Module/Adapter/compiler prerequisites: preserve legal source semantics, independent definitions, reached capability closure and actual generated Web-consumer behavior; repair generated strict and lifecycle defects where needed by the above consumers (#1145/#1055/#1061/#1120/#1209).
- [ ] Regression/acceptance: retain failure identities and repair their owners, exact-source trusted checks, source/package consumers, independent review and genuine DCO (#1176/#1177/#1178).

Integration owner: the current authorized release coordinator. Existing topic claims and authorship remain in force; a new claim must re-read live ownership. Next action for each row: bind the latest source/evidence, identify its first unmet child, complete that bounded repair, review/integrate, and update the original Issue checkbox with the receipt. Release acceptance is tracked separately from development integration.

## 0.4 / WIP / Experimental

Bootstrap 2.3.2 and Liquid Glass source, docs, optics/performance and independent family parity move to **0.4 WIP / Experimental**, including #1148/#1149 and the Liquid-specific source criteria 13/14/49. They must not be counted as stable 0.3 support. Keep their existing source/evidence and current PRs reviewable; do not delete valid work.

Independent native-target expansion (GPUI, Qt, Flutter and additional SSR/backend matrices), Agent Harness applications and unrelated experiments belong to 0.4 when they are not required to deliver a committed 0.3 consumer. Mixed compiler/native Issues must retain separate 0.3 prerequisite children: an experimental target label never defers a shared Web-consumer defect. The ledger's `split` disposition retains both releases and the original condition rather than closing it.

No draft entity is automatically promoted by inclusion here. Missing promised behavior is a blocker, not an implicit deferral. Publication, production deployment and lifecycle decisions retain their ordinary controls.
