# Header chunk isolation, runtime cleanup, and package-budget repair

Date: 2026-11-24

## Outcome and evidence boundaries

This repair addresses the reproduced optional-scene bundling hazard and runtime-wrapper process ownership defect. It also integrates the existing, separately reviewed package-budget transaction. Independent local technical review closed findings F1–F4 in the Header/process scope. Existing website failures, full CI acceptance, and formal platform approval remain open.

The request was to verify and fix three claims: Header statically includes the shader scene and therefore runs GPU work while reading documentation; terminating the test server leaves Vitest orphans; and React has a one-byte package-budget margin, making a whitespace edit sufficient to fail the budget. Those claims require separate conclusions below.

Evidence is retained on a separate, unmerged evidence branch under [the repair evidence directory][evidence]. The archive includes the independent review, raw reports, failure logs, counterfactual controls, and source bindings. This record does not turn an evidence commit into a production merge or GitHub approval.

| Evidence role | Bound revision | What it establishes |
| --- | --- | --- |
| Production baseline | `06d4f20249d8128575d6e0e13385e9dcf540c84c` | Successful reference build, graph, and browser controls |
| Rejected intermediate candidate | `c554496421759dcafbf0924fbf9777358bb9bba2` | Failed SSR build and diagnostic client graph |
| Corrected production candidate | `4a556a37acdda77e2cbbc59bb9f10c259b8b5036` | Successful full build, final production graph, browser controls, actual-wrapper smoke |
| Additional regression commit | `fcc4776cc0695dc04dad4d058e3858ac0808c759` | Pure scene re-export counterexample; production source unchanged |
| Original budget transaction | `024bc193c35ca74d1893b4c479b148707a8cdd9a` | Dedicated numeric adjustment and original canonical evidence |
| Integrated candidate | `957c5ddf0f818a3d91014590a4c2d29c051b1018` | Strict package-budget measurement after normal merge; saved report independently checked |

The integrated tree is `dbcc2325fe50ff833b79b4837cdcd0a8a52056fe`. Production/browser results remain bound to `4a556a37`; they are not described as reruns on `fcc4776c` or `957c5ddf`.

## What was true in the original claims

### Static reachability did not establish GPU execution

The baseline source graph has a path from the Header script through website controls, the Web Component adapter, and the base adapter to `shader-scene-host.ts`. Its emitted graph also recorded the scene module in an eager shared chunk. However, that record had `renderedLength: 0`, no rendered exports, and removed scene factory exports. No scene implementation bytes were retained there. Instrumented baseline and final browser sequences recorded zero WebGL context calls.

These observations do not substantiate “reading documentation runs the scene/GPU.” They do substantiate a latent chunking defect: when a dynamic consumer actually uses the scene, implicit manual-chunk grouping can place positive-length scene implementation in Header's static closure. Real Rollup counterexamples distinguish this defect from an empty module record. The repair preserves the lazy boundary when scene code is genuinely used; it is not presented as removal of an already running GPU engine. See the baseline/final graph reports and optional-scene probe in the [evidence archive][evidence].

### The orphan-process claim had direct evidence

[GitHub Actions run 45314673679, job 138198390013][orphan-ci], at historical source `1dd7afa3ea4ff43c1f28306c9b035e87ed11ea62`, reached its 900-second timeout. The wrapper reported SIGTERM, the step exited 124, and GitHub's final cleanup killed PID 3056, identified as `node (vitest 1)`. The preserved excerpt is `local/process/original-ci-orphan-excerpt.txt`.

The old wrapper explicitly cleaned Astro, assumed foreground signal delivery would handle Vitest, and did not own style-generation commands. Parent exit also did not prove that descendants were gone or output pipes had closed. Real-process controls reproduced the lifecycle defects. The historical incident proves an orphan existed; it does not prove that the later injected EPERM scenario caused that incident.

### One-byte headroom was real; the whitespace assertion was unsupported

The historical canonical React measurement was 173,379 gzip bytes against a 173,380-byte ceiling. The one-byte margin was therefore factual. A source-space injection left both minified-output and gzip hashes unchanged in the recorded experiment. A source character is not automatically an extra byte in the measured compressed bundle.

The budget repair uses the existing dedicated numeric transaction and preserves its historical failures. The [separate budget review][evidence] documents its canonical inputs and scope; the final integrated measurement is identified separately below.

## Implementation

### Client isolation with an unchanged SSR policy

`apps/www/scripts/client-chunk-isolation.mjs` exports an Astro integration factory. Its `astro:build:setup` hook uses `target` and `updateConfig` to apply `onlyExplicitManualChunks: true` only to the client build. The flag is absent from the shared global Vite output. Inspection and tests use installed Astro 5.18.1's actual per-target hook behavior.

`apps/www/astro.config.mjs` also places the concept bootstrap and its pure data module together in the existing `site-concepts` chunk. These are `apps/www/src/scripts/proto-concept.ts` and `apps/www/src/data/concepts.ts`. This prevents the data module from landing in the importing PageFrame entry and creating an initialization cycle.

The Retry source-admission guard now recognizes the exact final configuration and exact integration-helper bytes. Historical profiles remain valid under their historical requirements. The four authorized Retry importers remain constrained, general package promotion remains rejected, and the head-resource scanner was not relaxed to accept an opaque integration.

Key final production SHA256 bindings are:

| File | SHA256 |
| --- | --- |
| `apps/www/astro.config.mjs` | `10404ebdfd8ec0f96f74f59bba0b064b9f361b26de9483e82e5550d7aba7e58d` |
| `apps/www/scripts/client-chunk-isolation.mjs` | `ab1b90b6ab049058595d686ae23b835cdec6d3b96058bd4055982c8a73c57e69` |
| `scripts/test/runtime-process-owner.mjs` | `539fc03b6b5e28986aa33a2ed81b87de780bae4549d6a2e0a3bf77737638fb71` |
| `scripts/test/run-runtime-tests.mjs` | `5c9ffb33be379a252762c2ee29fd3ff4ee3d09261bcd9bdf1a7786cd1e50e32f` |

The complete source manifest is in `local/review/independent-review-final.json`. The post-production graph test has SHA256 `c86479ab6d3f56d948dd6cf9405027fe5996c63422ba76fb84891eb76df2cae3`, separately bound to `fcc4776c`.

### Explicit ownership and observable cleanup failure

The runtime wrapper owns style generation, Astro, and Vitest through `runtime-process-owner.mjs`. The Linux ownership helper was extracted from Sprint1 and reused. Ownership combines an inherited random marker, UID, and PID/start-time identity. Initial leader observation requires the marker; a recycled numeric PID is insufficient. Detached or reparented descendants can be rediscovered without killing unrelated processes by executable name.

Cleanup begins on parent `exit`. Each child exposes a stable `completed(child)` promise, and the wrapper awaits cleanup alongside ordinary `close` and output forwarding. A cleanup rejection can therefore interrupt an EOF wait held open by descendants. The failure path closes only owned read ends, flushes forwarded output, and exits nonzero. Style cleanup must finish successfully before later stages start.

Signaling attempts all confirmed owned processes and aggregates failures instead of abandoning siblings after the first error. Shutdown is idempotent and rejects new spawns. The existing five-second TERM and one-second KILL windows remain unchanged. Native evidence is Linux-only; Windows `taskkill /T /F` parameters are covered by mocks, not a native Windows run.

## Failed iterations and independent review findings

| Finding | Failure retained in evidence | Resolution and closure basis |
| --- | --- | --- |
| F1, P1 | The changed Astro configuration was missing from exact Retry admission; an existing profile assertion failed. | Add exact configuration/helper bindings while retaining historical and negative controls. Final focused Retry tests: 60/60, zero skipped. |
| F2, P2 | Automatic cleanup rejection was stored internally while the caller waited indefinitely for `close`; an inherited-pipe descendant made the failure observable. A first signal error could also skip siblings. | Per-child cleanup completion, bounded failure propagation, style-stage sequencing, and best-effort aggregate signaling. Three new controls fail against frozen `c554496` bytes and pass after repair. |
| F3, P1 | Global explicit chunking changed SSR initialization. `c554496` failed prerendering `/en/start-here/quick-start/` with `DEFAULT_BASE_Z_INDEX` accessed before initialization. | Apply the option only during client setup. Real-hook tests preserve server configuration, and the full corrected production build exits zero. |
| F4, P2 | The client graph introduced a PageFrame/site-concepts cycle and self-import. | Group concept data with its bootstrap. Actual-source counterfactuals reproduce the cycle and initialization error; final graph and native concept-page evidence pass. |

An inline integration attempt was rejected by the existing opaque-integration guard. Moving to an imported, precisely bound factory resolved that rejection without weakening the guard. The intermediate SSR failure remains archived rather than being relabeled a successful client-only build.

A narrower alternative, naming only the scene chunk, passed initial fixtures but failed a pure re-export dynamic entry sharing an eager host. Header acquired a static scene import and lost its real dynamic import. Strict entry signatures and disabling transitive-import hoisting did not fix that variant. The added seven-module regression preserves both failing controls and the successful explicit-chunk case. It asserts positive scene bytes remain outside the eager closure and reachable through a real dynamic edge, without requiring the scene itself to be a dynamic entry.

This supports the selected repair, not a claim that it is the only possible chunking strategy. A future optimization needs the same counterexamples and production validation.

## Verification and measured cost

Independent reviewer executions included the four final hook/scene/concept cases, all 60 Retry controls, five focused process outcomes, the new pure-reexport case, and three Sprint1 extraction checks. All passed within their stated scope. Saved implementation-owner runs additionally show 2,170/2,170 graph tests and 17/17 process-owner tests. These execution roles remain separate in the review report.

The production evidence was generated on Linux with Node 24.22.3, pnpm 10.32.1, Astro 5.18.1, Rollup 4.60.1, and Chromium 156.0.8078.79, using clean source worktrees. The reviewer inspected the saved remote evidence; the reviewer did not independently rerun the remote build.

| Check | Observed result |
| --- | --- |
| Baseline full build | Exit 0; 316.445 seconds |
| Intermediate full build | Exit 1; SSR failure retained |
| Corrected `4a556a37` full build | Exit 0; 688 pages; 264.18 seconds |
| Corrected production graph | Scene records 0; static cycles 0; duplicate retained modules 0; dangling imports 0 |
| Actual runtime-wrapper smoke | Two files, ten tests, exit 0; limited smoke scope |
| Three theme control sequences | All sequences complete; focus assertions still fail; runner exits 1 |
| Actual concept page | Four hydrated elements; passes with zero page/console errors |

The final production graph SHA256 is `acd1c73ffa630a1c25f47308512ed0e7d8f1128005ebd19c4596b3f8e494dc5a`.

| Header static closure |  Baseline | Corrected candidate |                        Change |
| --------------------- | --------: | ------------------: | ----------------------------: |
| Emitted JS chunks     |        22 |                  82 |                           +60 |
| Raw emitted JS bytes  | 1,411,700 |           1,461,180 | +49,480, approximately 3.505% |

This is a measurable cost. Browser resource intersections include all 22 baseline and 82 candidate Header chunk URLs across the complete WC → React → WC sequence. These measurements are not gzip transfer size, cold-load latency, or proof of 60 additional initial-page requests. The change is not presented as a performance optimization. Retained scene implementation bytes were already zero in the measured baseline. Website closure size and the whole-entry React package budget are different measurements.

## Budget integration and final strict measurement

The original transaction `024bc193` was normally merged, preserving its dedicated commit, provenance, DCO, and canonical evidence. It changes five ceilings and explanatory comments, without changing bundling, compression, external dependencies, entry definitions, or strict/advisory policy. The separate budget reviewer compared all 3,840 unique recorded input files across the original transaction, baseline, and corrected production candidate; no input-content differences were found. That supports reuse of the numerical decision, while a fresh measurement remains necessary for the integrated head.

The implementation owner ran:

```bash
node scripts/analysis/package-budgets.mjs --json --require-clean --expected-sha 957c5ddf0f818a3d91014590a4c2d29c051b1018
```

The recorded result is strict **9/9**, with clean source, source matching HEAD, and stability during measurement all true. React's final ceiling is **180,900 gzip bytes**, measured size **179,944**, and remaining headroom **956**. Its previous ceiling was **173,380**.

The [final raw report][budget-raw] and [receipt][budget-receipt] bind this result. The uncompressed raw-report SHA256 is `d10242281c2bbd4d3927b91f47ae4d39b015475891667249b99ace9b26d33bae`. The implementation owner executed the measurement. The separate budget reviewer subsequently read the complete saved JSON and receipt, verified their SHA256 values, checked all nine entries and source flags, and hashed the original Git commit object to verify its tree and both parents. This is independent verification of the saved result, not an independent rerun or a canonical GitHub Actions attestation. The Header/process review remains separately scoped.

A publication preflight against main `050a155903177dbf2805552ba75e10207c4d1a3c` found a clean `git merge-tree` result with candidate 957 (synthetic tree `4e975a52bf8b326d0dc4c31091766a4374acbe27`). This was a conflict check, not an executed merge or a build of that combined tree.

## Gates still open

1. **Focus return:** Shadcn, Brutalist, and Bootstrap complete mobile open, React selection, close, desktop docking, and return to Web Components. On both baseline and candidate, the connected trigger is not focused after React selection; focus is on `body`. Each complete case remains failed. Zero page errors, resource errors, and WebGL calls were recorded in both versions.
2. **Bootstrap typography:** The same unsupported documentation typography-family console-error category remains: 200 baseline messages and 195 candidate messages. The count difference is not evidence of a typography fix. Shadcn and Brutalist have zero console errors in these runs.
3. **Full graph admission:** Diagnostics decrease from 64 to 50, so the overall graph gate still fails. Independent comparison of entry/module-level diagnostic items found no added items, but existing admission and ownership findings remain. No broad allowlist was introduced to hide them.
4. **Full CI and platform approval:** The scoped tests, real-wrapper smoke, builds, and budget result do not establish all repository checks, native cross-platform behavior, release acceptance, or a GitHub review decision. F1–F4 are resolved local technical findings. No GitHub `APPROVE` was submitted, and no independent identity or formal approval is implied by the author's account or the evidence branch.

[evidence]: https://github.com/Proto-UI/Proto-UI/tree/4cfbcf45b1540c9d7ba0f712d9565d2e79982dca/internal/records/evidence/2026-11-24-header-runtime-repair/
[budget-raw]: https://github.com/Proto-UI/Proto-UI/blob/4cfbcf45b1540c9d7ba0f712d9565d2e79982dca/internal/records/evidence/2026-11-24-header-runtime-repair/budget/final-package-budgets.json.gz
[budget-receipt]: https://github.com/Proto-UI/Proto-UI/blob/4cfbcf45b1540c9d7ba0f712d9565d2e79982dca/internal/records/evidence/2026-11-24-header-runtime-repair/budget/final-package-budgets-receipt.json
[orphan-ci]: https://github.com/Proto-UI/Proto-UI/actions/runs/45314673679/job/138198390013
