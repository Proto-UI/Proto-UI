# 0.3 release delivery list

Target 0.3 publication: **2026-12-04** (dev freeze **2026-11-27**, acceptance maintenance **2026-11-28 – 2026-12-02**, release decision **2026-12-03 – 2026-12-04**). Progress is tracked in Issue #1673 under [the governing plan](release-0.3-plan.md).

## Scope & Limits

- **Inventory, not acceptance**: This list binds committed 0.3 scope to its source ledger; checked development boxes do not certify release acceptance, native visuals, or assistive-technology results.
- **Frozen source ledger**: [release-0.3-source-ledger.json](release-0.3-source-ledger.json) binds package surfaces, CLI entries, 203 original Finf comment checkboxes, 68 named delivery criteria, and 187 open Issues (1,233 conditions) to its explicit `sourceRevision`.
- **Additive corrections & checkpoints**: [release-0.3-source-corrections.json](release-0.3-source-corrections.json) restores Issue #649's five omitted CRLF conditions (effective denominator: **1,238**), loaded via `loadEffectiveLedger` in `scripts/ci/release-source-ledger.mjs`. [release-0.3-evidence-checkpoints.json](release-0.3-evidence-checkpoints.json) records timestamped child evidence for #1073 and #1191 without rewriting the frozen snapshot.
- Validate the ledger, corrections, and checkpoints with `node --test scripts/ci/test/release-source-ledger-checkpoints.test.mjs` on Node.js 24.

## 2026-11-25 owner scope decision

The owner explicitly moved the entire remaining scope of **20 Issues to 0.4** (recorded in [#1323](https://github.com/Proto-UI/Proto-UI/issues/1323)):

- **Compiler implementation and consumer chains (13)**: [#1809](https://github.com/Proto-UI/Proto-UI/issues/1809), [#732](https://github.com/Proto-UI/Proto-UI/issues/732), [#733](https://github.com/Proto-UI/Proto-UI/issues/733), [#817](https://github.com/Proto-UI/Proto-UI/issues/817), [#687](https://github.com/Proto-UI/Proto-UI/issues/687), [#1018](https://github.com/Proto-UI/Proto-UI/issues/1018), [#1055](https://github.com/Proto-UI/Proto-UI/issues/1055), [#1056](https://github.com/Proto-UI/Proto-UI/issues/1056), [#1061](https://github.com/Proto-UI/Proto-UI/issues/1061), [#1143](https://github.com/Proto-UI/Proto-UI/issues/1143), [#1144](https://github.com/Proto-UI/Proto-UI/issues/1144), [#1145](https://github.com/Proto-UI/Proto-UI/issues/1145), [#1089](https://github.com/Proto-UI/Proto-UI/issues/1089).
- **Original IR10 inputs and semantic migration (7)**: [#913](https://github.com/Proto-UI/Proto-UI/issues/913), [#914](https://github.com/Proto-UI/Proto-UI/issues/914), [#915](https://github.com/Proto-UI/Proto-UI/issues/915), [#892](https://github.com/Proto-UI/Proto-UI/issues/892), [#893](https://github.com/Proto-UI/Proto-UI/issues/893), [#894](https://github.com/Proto-UI/Proto-UI/issues/894), [#902](https://github.com/Proto-UI/Proto-UI/issues/902).

This decision supersedes earlier 0.3 prerequisite and criterion-split assignments for these 20 Issues (and parent references from #890, #1090, #1178, #1488, and #1673). Keep them open with their original criteria and evidence; development and integration into `main` may continue toward 0.4, while independently retained website, CLI, package, and Web-consumer requirements remain in 0.3.

## Committed libraries

| Library | 0.3 commitment |
| --- | --- |
| **Base** | All current exports across the Form, Collection/Search, Disclosure, Overlay, Values/Dates, Geometry/Long-Collections, and existing parity families below. |
| **Shadcn** | All current exports and supported profiles/compositions (Card, input-shell, style-scope, presets); Rhea demos keep public compatibility defaults. |
| **Brutalist / neo-brutalism** | All current exports (including Badge, Card, Skeleton, Spinner, theme); preserve flat/fade, reduced-motion, and native-anchor ownership. |
| **Lucide** | Public Icon facility, manifest/snippets/loaders, and all 1,695 exported icon modules (source inventory, not 1,695 separate runtime cases). |

### Finf-promised family delivery

Each group covers Base semantics, Shadcn and Brutalist projections, Lucide participation, package/CLI delivery, `apps/www` docs/demos, and supported Web-host consumption. Complete per-family source paths (162 directories) and spec entity revisions (162 `P-*.yaml@sha` entries) live in [release-0.3-delivered-families.json](release-0.3-delivered-families.json).

- [ ] Form/relationships: Label, Field, Fieldset, Form, Checkbox Group (`deliver.label` through `deliver.checkbox-group`; #1094).
  - [x] Implementation delivered (#1094): 5 families across Base/Shadcn/Brutalist + 15 spec entities — see [delivered families manifest](release-0.3-delivered-families.json).
  - [ ] 验收层（原生视觉、辅助技术证据与 #1094 中保留的 TODO 条件）
- [ ] Collections/search/focus: Autocomplete, Combobox, Command, Toggle Group, Toolbar, Menubar, Navigation Menu, Context Menu (#1095).
  - [x] Implementation delivered (#1095): 8 families across Base/Shadcn/Brutalist + 24 spec entities — see [delivered families manifest](release-0.3-delivered-families.json).
  - [ ] 验收层（原生视觉、辅助技术证据与 #1095 中保留的 TODO 条件）
- [ ] Disclosure: Collapsible and Accordion (#1096).
  - [x] Implementation delivered (#1096): 2 families across Base/Shadcn/Brutalist + 6 spec entities — see [delivered families manifest](release-0.3-delivered-families.json).
  - [ ] 验收层（原生视觉、辅助技术证据与 #1096 中保留的 TODO 条件）
- [ ] Overlay/notifications: Popover, Alert Dialog, Drawer, Toast (#1097).
  - [x] Implementation delivered (#1097): 4 families across Base/Shadcn/Brutalist + 12 spec entities — see [delivered families manifest](release-0.3-delivered-families.json).
  - [ ] 验收层（原生视觉、辅助技术证据与 #1097 中保留的 TODO 条件）
- [ ] Values/dates: Slider, Number Field, Progress, Meter, Input OTP, Calendar, Date Picker (#1098).
  - [x] Implementation delivered (#1098): 7 families across Base/Shadcn/Brutalist + 21 spec entities — see [delivered families manifest](release-0.3-delivered-families.json).
  - [ ] 验收层（原生视觉、辅助技术证据与 #1098 中保留的 TODO 条件）
- [ ] Geometry/long collections: Resizable, Carousel, Message Scroller, Tree, Virtual List, Data Table (#1099).
  - [x] Implementation delivered (#1099): 6 families across Base/Shadcn/Brutalist + 18 spec entities — see [delivered families manifest](release-0.3-delivered-families.json).
  - [ ] 验收层（原生视觉、辅助技术证据与 #1099 中保留的 TODO 条件）
- [ ] Existing Base parity: Async Region, Button, Checkbox, Dialog, Dropdown, Hover Card, Image, Input, Live Region, Radio Group, Scroll Area, Select, Separator, Surface, Switch, Table, Tabs, Text, Textarea, Toggle, Tooltip, Transition (#1100, #1159–#1162).
  - [x] Implementation delivered (#1100): 22 families across Base/Shadcn/Brutalist + 66 spec entities — see [delivered families manifest](release-0.3-delivered-families.json).
  - [ ] 验收层（原生视觉、辅助技术证据与 #1100 中保留的 TODO 条件）
- [ ] Overlay scrollbar-coordinate repair and scoped prior-work closeouts (#1163/#1164).

Check completed source-bound children promptly; do not hold a completed repair waiting on an unrelated umbrella family.

## Consumer and interaction priorities

- [ ] **Search**: public semantic composition, trigger alignment, input/result geometry, styles, cold/warm perf, keyboard/IME/reopen/mobile/200% (#420/#856/#1095/#1175).
- [ ] **Select**: repeated-open active ownership, item/trigger pairing, size/placement/RTL/resize/collision/scroll, supported-host evidence (#1159; PRs #1210/#1229).
- [ ] **Shared Focus/Overlay**: same-target modality, rapid React present, Menubar withdrawal, init/teardown, nested popup Escape priority (#1177).
- [ ] **Website navigation**: responsive contents/tree ownership and return, focus supersession, first frame, sidebar collapse, full-row hit areas, overflow, font scaling (#1191).
- [ ] **Typography/RuntimeBox**: real composition, authored font priority, portal/lifecycle, glyph/fallback/load failure, CJK, CLS, 200% (#803/#786; PR #1227).
- [ ] **Shadcn docs/profile delivery**: explicit Rhea demos, Vue 2 snippets, complete public dependencies, Card compatibility, community-button alignment (#1042/#1044; PRs #1211/#1275).
- [ ] **Brutalist interaction motion**: Button/action/Select/Surface and community/native-anchor consumers, reduced-motion, interrupt/release (#398/#559; PR #1236).
- [ ] **www**: bilingual Preview/Code/Usage/install, four supported Web hosts, homepage atom exhibits, navigation/search, responsive interaction (#1042/#420/#1175).
- [ ] **CLI**: all supported registry entries, init/add/facade, exact-version packed consumers, finite token/style closure, generated artifacts (#1000/#1073/#1115/#1154).
- [ ] **Core/Runtime/Module/Adapter Web prerequisites**: repair installation, build, strict-generated, and lifecycle defects retained in effective 0.3 scope (#1120/#1209; excluding the 20 Issues deferred to 0.4).
- [ ] **Regression/acceptance**: retain failure identities, repair owners, trusted checks, source/package consumers, independent review, genuine DCO (#1176/#1177/#1178).

Integration owner: current authorized release coordinator (existing topic claims remain in force). For each row, bind the latest evidence, finish its first unmet child, integrate, and update the Issue checkbox with the receipt.

## 0.4 / WIP / Experimental

- **Bootstrap 2.3.2 & Liquid Glass**: Source, docs, optics/performance, and family parity (#1148/#1149, Liquid criteria 13/14/49) move to 0.4 WIP/Experimental while keeping existing PRs and evidence reviewable. The user-requested Bootstrap homepage demo carries an explicit **WIP** label; Liquid Glass stays excluded from that selector.
- **Native targets & Harness**: Independent GPUI, Qt, Flutter, extra SSR/backend matrices, Agent Harness apps, and unrelated experiments belong to 0.4 unless required for a committed 0.3 Web consumer. The 20 deferred Issues above stay excluded from 0.3 prerequisites.
