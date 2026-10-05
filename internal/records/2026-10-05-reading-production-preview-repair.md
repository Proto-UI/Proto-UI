# Reading evidence production-preview repair (2026-10-05)

## Observed failure and preserved evidence

The first source-bound run at `23df79b86fb67a6352278783696a1075935781f5` (Actions run `37289588139`, job `111696588853`) produced all four route/theme measurements and viewport/full-page PNGs, but all four cases correctly remained failed. Astro/Vite's development HMR connection used a different loopback port from the owned HTTP server; the exact-origin guard rejected it. This is a capture-server boundary failure, not a typography acceptance result.

Original artifact `11335263721`, SHA-256 `9e4bc0d51da7615de384215f663f2af966135bd8cd00f34b3320d3714e84277d`, is retained as failed evidence. Its metrics and images may support qualified observations; they are not silently reclassified as passing. Do not reproduce transient query or fragment values from the old failure URLs in new reports.

## Bounded repair

The independent reading workflow now builds the clean exact candidate, then uses the repository's existing `startStrictPreview` helper and supported Astro production preview. It does not start the Vite development server or HMR. One owned preview binds `127.0.0.1:4398`; a fallback port or different bound address is refused. Arbitrary loopback ports are not admitted. The real browser, native theme action, 1180×757/DPR1 geometry, source semantics and actual family/runtime remain unchanged.

Build ownership is explicit. `begin-build` records the clean expected Git head before the successful standard documentation build. `finish-build` checks that same clean head afterward and hashes every ordinary file under the resulting `apps/www/dist`, including both required HTML routes. Before preview startup, the runner requires that receipt and recomputes the file inventory. Wrong source, missing routes, changed bytes or non-file entries fail closed. This receipt binds the workflow's successful build step; it is not a deploy receipt or a public production SHA claim.

The now-unused reading-only `startServer` redirect option is removed from the development browser harness, restoring that harness's prior API and tests. Production-preview readiness still opts into the shared no-follow readiness behavior. The existing HTTP response guard rejects all 30x before a follow, and the WebSocket origin gate remains narrow even though production preview should not need a WebSocket.

Failure URLs are stored as origin/path only. Query, fragment and URL user-info are removed before recording network failures, page-error messages, failed requests, final URLs and stack/error diagnostics. Authored document text is not rewritten by this diagnostic sanitization. The collector remains byte-identical at SHA-256 `6e03822d03aeab6a0b0abcd02e1f2ef68a72516bd50496ac8ca7d35bbca69c3d`.

## Reproduction

From the repository root, with a clean candidate and the pinned toolchain:

```sh
export PROTO_UI_EXPECTED_HEAD="$(git rev-parse HEAD)"
export PROTO_UI_READING_EVIDENCE_DIR=/tmp/reading-reference
export ASTRO_TELEMETRY_DISABLED=1
node apps/www/scripts/reading-reference-production.mjs begin-build
corepack pnpm@10.32.1 --filter apps-www build
node apps/www/scripts/reading-reference-production.mjs finish-build
node --import tsx apps/www/scripts/capture-reading-reference.mjs
```

The independent workflow bounds production build to ten minutes and capture to ten minutes within a twenty-five-minute job, retaining failures and build/capture receipts. Existing browser matrices, public UI, MDX, typography recipes and project deployment remain outside this repair.

## Evidence boundary

Contracts cover strict preview ownership, fallback rejection, readiness cleanup, source/build-byte binding, missing or modified output, URL diagnostic sanitization, no-follow transport and default-readiness compatibility. Existing production-preview helper contracts remain applicable. These checks do not replace the next source-bound Actions capture or inspection of its original PNGs. The failed `23df79b` run remains historical after the repair; new captures require the new exact head.
