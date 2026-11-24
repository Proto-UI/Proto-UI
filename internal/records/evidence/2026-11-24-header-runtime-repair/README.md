# Header, runtime process ownership, and package-budget repair evidence

Contributor-produced evidence collected on 2026-11-24 for the user's request to verify and repair three reported Proto-UI problems. This is a sanitized Agent paraphrase; private conversation text and participant identities are not included.

**Retention:** this directory belongs on the dedicated `evidence/header-runtime-20261124` branch in `Proto-UI/Proto-UI`. The contributing actor and repository maintainers retain the evidence branch for review and historical reproduction. Do not merge this evidence-only branch into the product branch. Maintained findings belong in the dated repair record on the product branch. Historical canonical budget archives retain their existing, separately justified place in the original numeric transaction.

## Revision bindings

| Role | Revision | Meaning |
| --- | --- | --- |
| Initial source baseline | `248f8270dd3458d1fcbc507e618337f98b9fde96` | Original wrapper counterfactual and first repair parent |
| Production/browser baseline | `06d4f20249d8128575d6e0e13385e9dcf540c84c` | Actual complete baseline website build and browser controls |
| Failed integrated candidate | `c554496421759dcafbf0924fbf9777358bb9bba2` | Global explicit chunks caused SSR TDZ; retained as failure |
| Final production-code candidate | `4a556a37acdda77e2cbbc59bb9f10c259b8b5036` | Complete production build, graph inspection, browser sequence, real Vitest wrapper |
| Additional regression | `fcc4776cc0695dc04dad4d058e3858ac0808c759` | Pure re-export/shared-host test; production sources unchanged |
| Original numeric budget transaction | `024bc193c35ca74d1893b4c479b148707a8cdd9a` | Original author, DCO, four-file scope and canonical evidence retained unchanged |
| Integrated strict budget measurement | `957c5ddf0f818a3d91014590a4c2d29c051b1018` | Clean merge, nine strict whole-entry budgets pass |

Later documentation or evidence commits do not relabel these runs as execution on a different revision. The final production graph SHA-256 is `acd1c73ffa630a1c25f47308512ed0e7d8f1128005ebd19c4596b3f8e494dc5a`. The uncompressed strict-budget report SHA-256 is `d10242281c2bbd4d3927b91f47ae4d39b015475891667249b99ace9b26d33bae`.

## Findings and measured state transitions

### Header dependency isolation

The baseline source path reaches `shader-scene-host.ts` through the Web Component adapter and Base barrel. The baseline production graph contains a scene record in the eager site-controls chunk, but its `renderedLength` is **0** and its exports are removed. Actual browser sequences acquire **0 WebGL contexts** on baseline and candidate. Neither observation supports a claim that the normal documentation Header was already running a shader engine.

Rollup 4.60.1's implicit manual-chunk dependency inclusion can nevertheless promote a genuinely used optional scene into the eager Header graph. Executable fixtures preserve the first divergence: a real dynamic facade that only re-exports a scene with a shared eager host can disappear, leaving a static import. A scene-only named chunk, `hoistTransitiveImports: false`, and strict entry signatures did not fix that variant. The final strategy scopes explicit manual chunks to the Astro client build and groups concept data with its existing bootstrap owner. It is a verified strategy, not a proof of global optimality.

| Production measurement | Baseline 06 | Final source 4a |
| --- | ---: | ---: |
| Header static chunks | 22 | 82 |
| Sum of raw static JavaScript bytes | 1,411,700 | 1,461,180 |
| Scene module records in eager closure | Present, zero rendered bytes | 0 |
| Static strongly connected components | See baseline report | 0 |
| Retained duplicate modules / dangling static imports | See baseline report | 0 / 0 |
| Whole production graph diagnostics | 64 | 50 |

The cost is **+49,480 raw bytes (+3.505%) and +60 chunks**. Browser resource intersections corroborate loading all 22 baseline and 82 candidate Header chunk URLs during the complete WC → React → WC sequence. These are not gzip transfer sizes, isolated first-load request counts, or measured latency. No payload or GPU performance improvement is claimed. Normalizing the checker diagnostics by entry and module/edge yields 255 baseline and 134 candidate findings, with 0 introduced and 121 removed. The complete graph gate remains failing; an inspector exit of zero means a report was generated.

### Runtime process ownership

The historical CI job explicitly terminated an orphan `node (vitest 1)` after the wrapper timed out. Controlled Linux command fixtures reproduce the defect against the unchanged wrapper: killing only Astro's leader leaves marker-owned descendants and inherited pipes alive. The final owner records an inherited per-command marker, UID and PID/start-time, observes leader exit, and cleans owned descendants even after detach/reparenting. It uses bounded TERM/KILL cleanup, attempts sibling owners despite a failure, and propagates cleanup failure independently of pipe close. An unrelated PID is not treated as owned merely because it is alive.

The original seven wrapper counterfactual cases fail; the first repair passes 14 owner tests. An independent review then identified three cleanup-failure/pipe/sibling cases: all three fail against frozen c554 sources and all 17 owner cases pass after the final fix. Existing runner tests pass 138/138 and the shared Sprint 1 ownership regressions pass 3/3. A real Astro/Vitest invocation passes two files and ten tests on final 4a. Native Windows/macOS behavior was not executed: Windows taskkill arguments are mocked, and non-Linux POSIX retains process-group cleanup.

### Budget transaction

The historical React gzip measurement was 173,379 B against a 173,380 B ceiling: one byte of headroom was real. Source whitespace is not equivalent to a gzip-byte increase; a controlled whitespace-only diagnostic preserved the minified output, gzip size and artifact hash. Integrated accepted Sprint 6 code measures 179,944 B, beyond that old ceiling.

The original `024bc193` transaction is merged unchanged, rather than replacing its provenance or inventing a new threshold. Its input-closure audit covers 3,840 unique files. On clean merged source 957, the strict command passes all nine entries. React's ceiling is 180,900 B and its remaining headroom is 956 B. The blocking whole-entry policy, bundling/compression shape and external dependency boundary are preserved.

## Actual browser scope and retained failures

Chromium 156.0.8078.79 ran with sandbox enabled against the produced static website, with Node 24.22.3 and pnpm 10.32.1. The script visits actual Chinese Shadcn, Brutalist and Bootstrap 2.3.2 button pages at 390 × 844, uses the Header-owned select popup, switches WC → React, closes the mobile menu with Escape, resizes to 1440 × 900 and switches back to WC. All three complete the control sequence on baseline and candidate, with zero page exceptions, failed resources or WebGL acquisitions. The specifications introduction page hydrates all four concept elements and passes the exercised expand/Escape/ARIA/inert/summary checks.

The overall Header browser command still exits **1**: selecting React loses focus to `body` on all three baseline and candidate themes. The connected trigger remains present but is not focused. Bootstrap also emits the pre-existing `SiteTypography` unsupported-family console error (200 baseline occurrences, 195 candidate occurrences in these runs); count differences are not an improvement claim. Raw assertions and failures remain intact. These scoped browser observations do not prove universal accessibility, pixel parity or all hosts/runtimes.

The selected PNGs are actual captures, not mockups. Final mobile React-menu captures show all three themes; the desktop Shadcn capture shows WC after switching back; the concept capture shows the opened real card. Only selected inspected figures are copied into this archive. JSON reports may list additional diagnostic captures retained in the original execution workspace; missing image exports do not change their recorded assertions.

## Archive layout and reproduction

- `production/baseline-06/`: full graph, graph inspection and successful baseline build log.
- `production/failed-c554/`: failed SSR build, graph and recorded pipeline outcomes.
- `production/final-4a/`: successful 688-page build, final graph, pipeline outcomes and real Vitest wrapper log. Per-step browser exit 1 is retained even though the outer collection pipeline completes.
- `browser/baseline-06/` and `browser/final-4a/`: browser reports and selected actual captures.
- `budget/`: full strict 957 report, command receipt and stderr.
- `local/header/`, `local/process/`: red/green and intermediate diagnostics. Filenames retain their historical meaning; earlier `green` logs are not evidence for a later source snapshot.
- `local/probes/`: executable optional-scene alternative investigation and generated chunk contents.
- `local/scripts/`: actual production and browser inspection programs.
- `local/review/`: independent technical review and budget audit; neither is GitHub approval.
- `local/flow/`: preserved historical and final handoff artifacts, including pending formal review conditions.
- `manifest.json`: exact stored bytes and SHA-256 for every included file, plus decompressed hashes for gzip data.

Use the pinned repository toolchain and the revision/command in each report. Logs are gzip-compressed losslessly with fixed mtime. These are contributor-controlled observations, supplemented by linked canonical Actions budget archives and the original orphan-process CI job; they are not native check-run attestations. Full repository CI and an independent platform approval remain separate live PR requirements.
