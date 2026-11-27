# Coverage matrix current-main reconciliation

Date: 2026-10-03. Scope: PR #563 integration against accepted main `a1af2e64fe16f2d6dd96f701feaeea98e651511c`; no lifecycle promotion or closure of #420.

## Integrated source and ownership

The long-lived candidate `6b1d825dd256a9e47e885de61d51f7f2a4d4419f` conflicts with main in two runtime-test-plan files. Preserve its direct Node/Windows shell boundary and focused-argument handling, while replacing the narrower directory traversal with Node 24 glob discovery over the complete runtime Vitest include roots. This includes component browser tests, package/contract suites, and the accepted Spinner/new-family fixtures exactly once; no assertion or timeout is relaxed.

The first merged-tree matrix check reported 26 concrete source/path/ownership findings. Accepted #787 and #797 replaced `WhitepaperDiagramViewer.astro` with the shared documentation image preview. Retain the stable `www.docs.whitepaper-diagram-viewer` row identity, but bind the actual site-wide implementation, its exact bridge imports and its website-private Base Dialog zoom presentation. PUI owns modal focus, presence, dismissal and transitions; the application owns media selection, request policy, geometry and route disposal. The row remains blocked on draft lifecycle and independent surface admission, not self-hosted or stable.

Bind the accepted #795 new-family fixture to the existing demonstration-matrix row, its exact public Button/theme imports and its route-owned production entry. Bootstrap 2.3.2 and Liquid Glass opaque fallback evidence does not establish translucent material, native/compiler parity, or #793 acceptance. Copied sources and unrelated runtime/adapter imports remain rejected. The production checker still admits only the reviewed exact Base/WC module list in one site-control bridge chunk, never an adapter-family wildcard.

The PageFrame fingerprint now includes its actual media mount and owning viewer row. Old diagram implementation paths are removed rather than invented. The raw allowances do not admit active SVG documents: the outstanding public-SVG discussion remains unresolved, and the existing bounded static SVG-to-Blob image path is not treated as a general sanitizer. The separate Astro-frontmatter review dispute is not resolved by this integration.

## Resolver fingerprint

Main's only change to this candidate's `apps/www/astro.config.mjs` is the accepted CSS layer order: `proto-ui` now precedes `components` and `utilities`. The package resolver and plugin shape are unchanged. After inspecting that exact diff, update the fixed reviewed whole-config fingerprint from `5319f5862ddbb861153a957fb2b54991a33caae4547a3b7ed8b679ceaf537e62` to `b5c4fa84e0ed5120508626d93095432322efc3e2e0abd4145995dccefd799151`. This is a reviewed source adjustment, not a runtime refresh from candidate configuration. Resolver parity, changed dependency and unknown-configuration mutation controls remain mandatory.

## Executed evidence and remaining checks

On Linux / Node 24.19.0 / pnpm 10.32.1:

- The real two-matrix checker passes after the source/owner reconciliation. An intermediate owner wording drift was rejected; the existing reviewed owner token was retained.
- All 491 coverage-matrix/production-bundle/governance tests pass, without skip. Five promotion regressions first failed on the stale config fingerprint; after the exact config review above all passed. Existing changed-config rejection remains.
- Runtime-plan and production-graph focused run: 40 tests pass. Source-scope controls reject a copied image bridge and unapproved imports; the new-family graph control rejects an unreviewed copied route. Negative WC-provenance fixtures remove both now-known route owners rather than weakening the expected failure.
- Local production builds did not complete. The first could not create the missing Astro telemetry configuration directory. Explicit disposable XDG configuration and disabled telemetry reached the real build; subsequent attempts were killed during static/client compilation, including an unchanged-source bounded-heap retry. The cause is not established. No emitted production graph pass, fresh browser evidence or full repository CI success is claimed locally.

The exact pushed head must pass its production build/graph, live governance reconciliation and full required CI before integration. New source-bound screenshots are unnecessary for this internal inventory/checker change; existing UI evidence retains its original source head. No screenshot is relabeled as this candidate's new capture, and no open semantic review is silently accepted.

Co-author by OpenAI Dots
