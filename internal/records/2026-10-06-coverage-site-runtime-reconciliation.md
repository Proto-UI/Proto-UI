# Coverage reconciliation after the current-main merge

Date: 2026-10-06. Baseline: PR #563 at `d1555c8a31bd836e02231c11d6e52f2ecdb57a01`, incorporating `main@c9691a6b4f026e4b7e43f2cf4059bfe778afb837`.

## Requested direction and source boundaries

The maintainer chose to retain the current sitewide React/Vue runtime selection. Reconcile the older WC-only coverage projections with actual source ownership; do not replace the current interface or broaden directory/package allowances. This record is evidence of the bounded repair, not a new stable Adapter guarantee or lifecycle admission.

The production graph recognizes five exact entry/owner pairs: HomepageRuntime/homepage-runtime-client, Header/site-header-surface, Search/site-search-commands, SiteCopyBootstrap/site-copy-client and SiteTypographyBootstrap/site-typography-client. Each admitted entry must statically reach both its named source owner and the shared demo renderer. Static React/Vue leakage remains rejected. Dynamic Adapter dependencies must remain within that renderer's graph closure; copying a facade, omitting either owner, or adding a foreign Adapter branch is rejected. Typography's dedicated test route is a demonstration owner. HomeDemoPreviewer remains an optional known demonstration entry because current pages use HomepageRuntime instead. The runtime loader chunks retain exact module evidence whether Rollup supplies their exact facade or a null facade.

The source wall binds only the exact newly merged public imports to their actual source files. Deleted documentation-image-zoom.proto ownership is retired from the current inventory, without rewriting its historical records. New presentation consumers have explicit blocked rows; no original row's lifecycle/disposition is promoted. Source fingerprints are refreshed only after inspecting their current implementation and ownership.

Two historical Node/browser-evidence helpers happen to live under the documentation source directory. They are not production seeds. Their two exact paths use the existing test-source reachability rule: a production import restores the helper and its transitive dependencies to inventory and consumer checks. Negative fixtures confirm that an imported helper cannot hide raw runtime access. No scripts/test directory admission is added.

## Reproduced merge defects and repair

- The merge duplicated createReactAdapter/createVueAdapter/createVue2Adapter declarations after the existing cached lazy-module acquisition. Remove only the redundant imports and keep both asynchronous lease checks.
- New main consumers still imported identity exports from runtimes/registry after the PR split them into runtimes/ids. Point identity-only consumers at ids and retain compatibility exports without making identity consumers load executable runtime registries.
- New bootstrap/test code retained the removed arbitrary data-loader URL option. Keep the reviewed static prototype-module path; remove the stale option and replace its obsolete URL-execution test with a negative legacy-data-loader assertion.
- The current CI has separate general/browser jobs and a receipt aggregation job. The merge-checkout assertion now inspects the actual general-suite job, where exact base/head/merge evidence variables and full Git checkout remain configured. The workflow itself is unchanged.
- Astro configuration changed only for accepted Copy rendering and the Base Input navigation entry since the previous fingerprint. Source resolution functions remain unchanged; refresh the full configuration digest after inspecting the Copy plugin. Existing resolver parity and mutation fixtures remain required.

## New review regressions

The three latest findings are retained as in-scope fixes: external SVG use href/xlink resources must invalidate promotion when asset bytes change; lowercase-start mixed-case native script names must be recognized without treating capitalized framework components as native; application/x-ecmascript and text/x-ecmascript must join executable script MIME types. Focused baseline execution produced 22 failed assertions and 16 passing controls. The repaired focused set passes 39 assertions, including the retired documentation bridge allowance check. Tests compare relevant consumer/promotion diagnostics rather than unrelated setup errors.

## Validation and remaining acceptance

The candidate produced a complete 284-page production build and passed the separate emitted module/import graph gate. The revised graph suite passed 73 tests. Full checker fixtures, runtime tests, source inventory and types are separately executed and reported with the published commit; this record does not claim remote CI or independent acceptance before they happen. A prior concurrent build/type attempt exposed generated CLI declaration races and was rerun sequentially; the initial Astro invocation also needed telemetry disabled in this temporary cloud environment. Neither setup failure is represented as a product pass.

These are source/checker/integration repairs, with no new intended visual design. Current source, executable controls and the real build graph are the evidence; historical UI captures are not relabeled as the new commit. Existing human review and exact-head CI remain required before ordinary integration. No review self-approval, protection bypass or source lifecycle promotion is authorized by this record.
