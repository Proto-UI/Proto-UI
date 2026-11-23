# Documentation image reading viewport projection

The original integrated documentation type gate rejected `projection: 'native'` in `documentation-image-reading-viewport.proto.ts`. `ScrollProjectionPreference` accepts `auto`, `system`, or `composed`. This bounded repair uses `system` on the existing `asScrollSurface()` handle.

## Authority and resulting behavior

The applicable entities remain **draft**. `D-SCROLL-PROJECTION-0001-B` defines `system` as the host-owned scrolling engine and scrollbar chrome. `C-AS-SCROLL-SURFACE-0001-A/B` defines the singleton handle and its setup-only configuration; the inherited Viewport and this caller configure the same handle. `P-BASE-SCROLL-AREA-VIEWPORT-SURFACE-OWNER`, `KEYBOARD-FOCUS`, and `NAV-PARTICIPATION` retain the public Viewport's surface ownership, standard focus facts, and navigation participation driven by actual scrollable directions.

The documentation reader needs browser scrolling and browser scrollbar chrome. The corrected preference expresses that existing intent through the supported protocol. It adds no raw input or focus handler and does not suppress the type error with a cast. No lifecycle status is promoted.

## Evidence and remaining verification

The original failure is retained in the integration session's `integrated-docs-types.log`, against the implementation inherited from `d0392fb31513b12f55b9e99b1fcf26a6338569c9`. This commit isolates the one-line correction for integration with the separately repaired contrast-audit type errors. The root integration workstream must run the unchanged full `check:types:docs` gate on that combined source; this record does not claim an unexecuted pass.

The separate documentation image preview browser failures remain active work: two intermediate-motion observations, three reader outer-scroll observations, and two mobile selected-image observations in job `137596893964`. This type repair does not claim those seven cases passed.

## Exact consumer import binding

The one-line correction changes the reader's SHA-256 from `5c756216acffabcae06d99c1dd7e75fab539c4943207b8f63a2d6f4b8bde04bc` to `38c40b79ba99dc444a43376052de3c39798f99db7eb965eb990eadc4d6cc77ec`. The formal Website checker therefore correctly rejected the corrected source until its exact reviewed import entry was renewed. The source review above covers that single configuration change.

The renewal changes only this reader's exact source digest in `WEBSITE_RAW_IMPORT_ALLOWLIST` and the corresponding Source-scan binding. Its owner remains `www.docs.whitepaper-diagram-viewer`, with state `blocked`. The required companion is still the exact `documentation-image-controls.ts` source at `ad4fe9ae91198b871eb6a78cd05682e92a105f6d044d3a31547f8080f7c1aa07`. The three permitted import specifiers remain `@proto.ui/core`, `@proto.ui/hooks`, and `@proto.ui/prototypes-base/scroll-area`; no path, prefix, package, or changed-source exemption is added. The component guide now uses the same supported preference.

The seven existing documentation media/reading import-boundary tests are selected directly from the unchanged formal checker test file. Before renewing the digest, six negative/control cases passed and the exact-source positive failed on the three raw imports. After renewal the same seven cases passed (zero skipped); altered reader bytes, a foreign owner, an altered or missing companion, and an unrelated Runtime import remain rejected. Import admission is source review, not browser or final consumer acceptance.

The retained command, input hashes, and original red/green logs are in `internal/records/evidence/2026-11-23-image-reading-import-binding/validation.json`.
