# R15: reached Image support and explicit directory migration (WIP)

**Pure Image output selects reached native support at compile time. Explicit migration joins verified old Trigger/new Image outputs into a fresh cohort with shared ownership. Untouched independent directories remain incompatible.** This is a bounded increment under [#1055](https://github.com/Proto-UI/Proto-UI/issues/1055), not thin-compiler completion. R13's separate Text value change is excluded.

`D-IMAGE-VIEW-PROJECTION-0001`, `C-IMAGE-VIEW-0001`, `M-IMAGE-VIEW-0001`, `HC-IMAGE-VIEW-0001` and `T-IMAGE-VIEW-0001` remain **draft**. No lifecycle promotion is claimed.

## Actual results and retained failures

- Final compiler/source test graph, six roots: **strict 0**. Core: **82/84**, retaining the original full-generated-strict and Text empty-value-versus-seed failures. Independent Vue2 regressions: **41/41**. Existing CLI/output checks: **34/34**.
- Migration: **65/65**, comprising the original 62 plus three Image cases. The original test's 60,539-byte prefix is unchanged. Tests use the production CLI handler, real directories and ordinary filesystem imports, without a virtual registry or generated-source alias. Default tests use the committed historical capture.
- Separate actual `cli-entry.ts` subprocesses: **success exit 0; wrong Image trust anchor exit 1 with no output; missing-output usage exit 2**. All 21 successful output files, 285,926 B, match the handler capture by complete path, byte count and SHA256. Original Component/source-map/manifest bytes are unchanged. This was a separate process-entry check, not another 65-case run.
- The four Image controls pass, including synchronous completion for a controlled displayable cached image and accessibility fail-closed/recovery. All 11 Image input/result/trace captures match the earlier tested captures byte-for-byte in the final run.
- Two intermediate source checks failed with **TS2322** and **TS1361** in test error-handler restoration. Those failures are retained. The test now restores the actual loaded Vue handler. Product behavior and acceptance assertions were unchanged.

The original three complete generated graphs still have **92/54/55 diagnostics**, each with 215 program files. Requests, complete diagnostic fields and all program-source hashes match prior evidence after only verified temporary-directory normalization, not merely equal counts.

The complete additional Image graph changes from **116 diagnostics/222 files to 71/217**: 45 diagnostic occurrences removed, zero added, 71 remain. The final GeneratedModule matches the typed input exactly. The existing ordinary consumer type harness does not establish clean generated types or coverage of every Image API. Both SSR inputs and entire GeneratedModule results remain byte-identical. Real SSR execution and hydration are still unverified.

## Ordinary CLI migration

This is the repository development source entry with its pinned development dependencies:

```sh
node --import tsx packages/compiler/src/cli-entry.ts migrate-native-support ./plan.json --output ./cohort --json
```

Minimal plan, with directories relative to the plan file:

```json
{
  "version": 1,
  "inputs": [
    {
      "id": "old-trigger",
      "directory": "./old-trigger",
      "provenanceSHA256": "<trusted old-trigger manifest SHA-256>"
    },
    {
      "id": "new-image",
      "directory": "./new-image",
      "provenanceSHA256": "<trusted new-image manifest SHA-256>"
    }
  ]
}
```

Replace these non-runnable placeholders with 64-hex anchors retained from trusted successful compilations. Rehashing an edited manifest does not establish trust. Complete contents, kinds, paths, dependencies and known support formats are checked before output creation. Resealed modified Image support is rejected before any output open.

Import `./cohort/old-trigger/Component.js` and `./cohort/new-image/Component.js` normally. Relative facades share one ownership implementation; the two owners keep distinct identities. Input directories, Component.js and source maps are not rewritten. Move the whole cohort together: nested output and whole-directory relocation are tested, moving an isolated component is not. Existing create-only and ownership-aware rollback checks remain intact.

## Ownership and host boundaries

Original old/old controls remain. New cases retain unmigrated old-Trigger/new-Image misrouting, exercise migration, and physically split the Image ownership chain as a negative control. The split restores outer Trigger misactivation while Image requests and cleanup continue working. Image clicks still reach an ordinary parent listener, so stopping click propagation cannot substitute for shared ownership.

The generated Vue2 consumer covers stale/current decode completions, errors, source clearing, detach/rebind, stable owner identity and late completion after disposal. Load/error observations use **controlled HappyDOM decode promises and synthetic events with bubbles:true**. These establish no real network, browser-cache or native propagation result. Cache/accessibility checks also use controlled host facts.

## Reached sources and remaining work

For the measured pure Image input, emitted Component source changes from **40,587 B to 32,667 B**; interaction support from **172,804 B to 18,476 B** (Image 14,247 + ownership 4,229 B). Context support remains 8,797 B, byte-identical. The pure graph depends on **Vue 2.6.14**, with no Floating UI import. Reached mixed/full families still retain their broader support and dependencies.

Selection uses checked operations/declarations, not component identity. No IR interpreter or second framework runtime is added; the existing broad full-family layer remains. These are generated source/import measurements, not optimized retained bundle bytes, initialization work, memory or timing savings.

**Keep this work Draft and #1055 open.** Generated typing, the original Text value defect, complete callable lowering, broader-family runtime removal, the full backend/operation matrix, native browser and production mixing, SSR/hydration, and final bundle/initialization measurements remain unfinished. No approval, integration, deployment or broad closure is claimed. AI-assisted contribution by dot for cyjin-yl.

## Evidence and reproduction boundary

[Execution results](execution-results.json) retain every selected test identity, command, actual exit and both current failures. [Complete prior graphs](strict/unchanged-comparison.json), [Image diagnostic comparison](image/diagnostic-comparison.json), [Image observations](image/observations.json), [process entry](migration/process-entry.json), [source/import measurements](source-cost-and-imports.json), and [SSR byte comparison](ssr-output-boundary.json) are separate evidence.

The tested source tree is `cf29d300c6d8c1276a89b4d6140507f79c807a5a`, based on fixed `783ac833a77102365489d4050f7279c758114ec4` with the recorded compiler/test overlays. The public parent is `869c479201d4dfed1d618814c4ae55cd1acd2a27`. Neither all public ancestry nor current main was rerun. These are selected project records, not complete original execution logs. Portable records replace only complete known environment directory prefixes, retaining all product diagnostic fields, source hashes, project-relative paths and failures.

The Image type-request file retains the original 54-diagnostic/215-file baseline request used as an exact initial check. Each Image graph then replaces that generated module with every actual Component/supporting source plus the same Consumer.ts; the two derived actual requests explicitly list those roots. All generated files are included, with no diagnostic filtering. Unchanged context and old full-family helper snapshots are represented by their actual SHA-256/import records rather than duplicated here; their omission is not a claim that those layers were removed.
