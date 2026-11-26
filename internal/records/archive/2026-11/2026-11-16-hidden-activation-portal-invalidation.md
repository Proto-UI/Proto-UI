# Hidden first activation and portal direction invalidation cost

Date: 2026-11-16. This is an implementation and evidence record, not a new public guarantee.

## Why and source attribution

The archived failing Shadcn Vue-to-React v15 diagnostic measured source `02bb0d7fe92f7991f25883efba56c959f6ac917d`. The two affected source files are unchanged in repair base `6510b63696a4885a7cb20a3e9f1ff50daa5f1d42`.

In the request-to-ready window, from page time 9903.600 ms to 11019.200 ms, native `getPropertyValue` samples attributed **164.287 ms** to `se` in the served `SiteCopyBootstrap` asset at column 766. The exact served function walks `parentElement` and reads computed `display` for first activation. This cost belongs to `apps/www/src/components/hidden-first-activation.ts`, rather than the palette/theme reader. No palette/theme implementation changes follow from this evidence.

The served `site-shadcn-controls.Co-lTth2.js` function `m`, line 12 / column 35018, maps to `retainWebPortalDirection`'s `sync`. Its sampled self cost was **95.705 ms** in request-to-ready and **115.233 ms** from request to profile stop. The existing source observer called `sync` for every source record, including same-valued `dir`, `class` and `style` writes.

These are CDP sample attribution totals from a diagnostic run. They do not measure a function's exact elapsed duration, establish that every sampled call is redundant, or predict the repair's native time saving. The focused fixtures below isolate the redundant work that this change removes.

## Authority and preserved behavior

`spec/host-caps/HC-OVERLAY-PORTAL-0001.yaml` and `spec/tests/T-OVERLAY-CATALOG-0001.yaml` remain draft. `T-OVERLAY-CATALOG-0001-CASE-PORTAL-DIRECTION` describes author ancestry, live direction changes, migration, local direction/CSS and revoked leases. `spec/decisions/D-HOST-PROTOTYPE-PROJECTION-SCOPE-0001.yaml` also remains draft; its atomic-generation direction and the existing hidden-first-activation tests constrain the current host preparation boundary. This repair does not promote those entities or add a public lifecycle guarantee.

The existing first-activation gate defers HTML `hidden` and computed `display:none`; opacity, CSS visibility and offscreen position remain eager. The repair preserves its connection check, `closest('[hidden]')` check and exact `parentElement` traversal boundary, including where that traversal stops inside a shadow tree. It checks outer ancestors first, so a hidden owner rejects its descendants without reading each descendant's computed style.

One local map now shares computed-display facts among consecutive hidden-root reads within a single observer delivery or resize frame. The map is never retained by the gate. It is cleared before and after every application activation callback, so a callback may hide or move later roots, remove a root, dispose the owner or reenter `add` without subsequent roots using earlier style facts. Each later observer delivery, resize frame and independent `add` starts fresh.

The portal source observer now requests attribute old values and skips a delivery only when every record is an attribute record whose old value still equals its current value. Real changes and mixed deliveries still synchronize. Every structural record still synchronizes even if the ancestry did not change: `:empty`, `:has` and sibling selectors can change computed direction. Resize, ancestry rewiring and release behavior are unchanged. The separate author observer is deliberately unchanged: an author writing the same target `dir` still takes ownership, including before observer delivery and cleanup. No computed direction or theme cache is introduced.

## Executed evidence

The two new test files exercise the actual gate and direction lease with real MutationObservers. Their cost assertions count native style-read entry calls, while semantic controls inspect activation or the projected target attribute. Responsive and structural-CSS controls explicitly supply only the computed-style answer; they do not claim HappyDOM proves the native media-query or selector cascade.

On base `6510b6369`, the 11 new cases produced **6 failed / 5 passed**, exit 1, in 2.27 s. The failures distinguish three hidden-gate costs and three same-valued portal source writes:

- a hidden ancestor was reached only after reading its descendants;
- four hidden siblings read their shared owner four times in one mutation delivery;
- the same four reads occurred in one resize frame;
- same-valued `dir`, `class` and `style` source writes each caused a direction style read.

The five passing baseline controls cover callback mutation/reentry, mixed real/no-op records, structural invalidation and same-valued author ownership. With the source repair, all **11/11** passed. The final focused run after test typing/format cleanup also passed **11/11**, zero pending/todo, exit 0, in 1.56 s.

The affected integration run passed **89/89** in **10 files**, zero pending/todo, exit 0, in 14.75 s:

| Evidence                                                  | Cases |
| --------------------------------------------------------- | ----: |
| New hidden read-batch controls                            |     5 |
| Existing hidden first activation                          |     9 |
| Site Copy bootstrap and real command                      |    24 |
| Site CodeSurface consumers                                |    24 |
| New portal source invalidation controls                   |     6 |
| Existing portal direction ownership                       |    15 |
| Actual WC, React, Vue and Vue2 Adapter direction controls |     4 |
| Real React portal and Vue Teleport integration            |     2 |

Commands used Node **24.22.1**, pnpm **10.32.1**, and `vitest run --maxWorkers=1 --minWorkers=1`. The exact 10 paths and complete JSON results are retained in `portal-copy-cost/evidence-report.json` and `candidate-related-vitest.json`. Raw logs retain the existing ES2024 transform warnings.

Strict TypeScript checking of the two modified production files and the two new fixtures, extending the repository `tsconfig.json`, passed with `tsc --noEmit --project portal-copy-cost/types.tsconfig.json` and a 1024 MiB heap limit. This is a narrow source check, not another whole-workspace type pass. Prettier checked all four TypeScript files successfully.

Two fixture corrections remain visible in the evidence archive. The initial reentry test used structural equality for two different empty DOM nodes; its negative assertion was replaced by reference identity before the reported six-failure baseline. Later, strict types rejected an `HTMLElement` cast passed to an inferred `HTMLDivElement[]` membership check. The final test uses the equivalent reference-identity predicate without that cast, followed by the successful focused and type reruns. Neither correction changed product semantics or loosened an activation assertion.

Evidence directory: `/workspace/scratch/46c8fad17f2b/portal-copy-cost`. Original diagnostic directory: `/workspace/scratch/69346f6df757/release03-web-evidence/shadcn-diagnostic-v15-review/captures/homepage-evidence/search-production`.

| Artifact | SHA-256 |
| --- | --- |
| `source-cost-evidence.json` | `55a54ddc45e33a3658af1386e6070b7900680e1f3d8d4509fa56a45a4bbe3165` |
| Original `shadcn-runtime-react-cpu-profile.json` | `96d95e8bc1368801f91bcf1b72606898ea3dd16b3147e0d8406018b54260071c` |
| `baseline-vitest.json` | `49bf89f92263dfbeb250d43c71407e38ec8d025af622ad7b1f4a227780ab1fbf` |
| `candidate-focused-final-vitest.json` | `81a2128cca433386ccf6899a851aca3d9e29971bdeec642f59e8b88530e90b2e` |
| `candidate-related-vitest.json` | `dc39cddeb58c5f8272de955257c6f99a5b74e492288705c2d9814a748cec8306` |
| `evidence-report.json` | `188f9b195f311f83a82ea68616f19e1127700c24694527dd0f7ce09f149ced7d` |

## Remaining acceptance

The demonstrated redundant-read and no-op-invalidation conditions are repaired with passing consumer and ownership controls. No production Search journey has yet run on this candidate. The original failing native results remain evidence, and an elapsed-time improvement or resolution of either Search gate remains unverified until the parent integration runs the unchanged native journeys on the combined source. This child used no browser acceptance slot and changed no timeout, readiness marker, oracle, Anatomy logic or compiler source.
