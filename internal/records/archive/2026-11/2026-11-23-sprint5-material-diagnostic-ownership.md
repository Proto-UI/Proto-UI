# Sprint 5: exact ownership for the two material diagnostic routes

This non-normative continuation of [PR #1715](https://github.com/Proto-UI/Proto-UI/pull/1715) is based on `d985f1a67a2ed339b54c3f5e3f408cfa8faa82c4`. It changes the production bundle validator, its regression controls and retained workflow evidence. It does not change the compiler, target runtimes, preview lifecycle, diagnostic pages, emitted graph or graph generator.

## Existing source ownership and bounded repair

The self-hosting coverage matrix already inventories the exact `liquid-tint-stage-diagnostic` and `liquid-visible-refraction-diagnostic` Astro routes and their corresponding source helpers under `www.demo.demo-matrix`. These test routes directly import their corresponding material diagnostic producers. The producer closure contains six exact Base material modules: `contact-profile.ts`, `liquidgl-kernel.generated.ts`, `program-inputs.ts`, `program.ts`, `style-tint-profile.ts` and `style.ts`.

The validator now checks those exact route-to-producer pairs against actual module-level import and dynamic-import edges. It requires a complete, unique module graph, emitted producer ownership and no alternate route path that bypasses the producer to the same material. Sharing an emitted chunk is insufficient. Static and dynamic React, Vue, Web Component and unreviewed Adapter paths remain forbidden. The existing ordinary shell, demonstration and site-control permissions are unchanged; the global server-only exclusion still runs for every emitted chunk.

## Executed controls and preserved failure

The [evidence manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-sprint5-material-diagnostics/manifest.json) records the exact candidate source hashes and compressed raw logs. Node 24.22.3 executed all 1,915 bundle validation tests: 1,915 passed, zero failed, cancelled, skipped or todo. The new controls cover exact static/dynamic ownership, invalid/duplicate/missing graph records, dangling edges, chunk-only false ownership, direct/indirect bypasses, unreviewed material and framework imports, copied routes, ordinary-shell imports and the global server-only wall.

A separate negative control substituted the original d985 validator, identified by its SHA-256 in the manifest, without changing the same four new positive graph fixtures. All four failed with exit 1, as expected: the original validator treats these exact material diagnostics as ordinary shell roots. This is a source-edge regression control, not proof of an actual emitted production graph.

The d985 [production job](https://github.com/Proto-UI/Proto-UI/actions/runs/45201919992/job/137787379609) completed the real documentation build, then rejected precisely the two existing diagnostic routes for reaching those six material modules. Its original raw build log is retained. The downloaded artifact 14833225778 contained logs and source/build identity, but no emitted graph; therefore no real-graph replay is claimed for that artifact.

The workflow now runs the complete bundle control suite before the existing production command. An always-run retention step copies the actual emitted graph, records its SHA-256 and compares it byte for byte with the original. It does not alter the graph or replace the existing production log. A hosted build at the published candidate and independent replay of its retained graph remain required to establish actual production admission.

## Browser and readiness boundary

The same d985 hosted run passed native consumers on Ubuntu and macOS and the separate macOS Adapter lane. Its browser journey passed four-target rendering and interaction and the Chinese route, but the edit/reject/recover case still failed with the real 250-millisecond cleanup-acknowledgement deadline; the following cancel/reopen case timed out. Those are unresolved browser failures at this record's creation. This validator repair does not claim to resolve them or to constitute a whole-PR acceptance result.

The two-file validator/test change received an independent source review that preserved exact module ownership, both import forms and the global exclusions. That source review is not a GitHub APPROVED review. Final head CI, DCO and required independent review retain their normal authority.
