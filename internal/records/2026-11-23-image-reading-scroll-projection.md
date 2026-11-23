# Documentation image reading viewport projection

The original integrated documentation type gate rejected `projection: 'native'` in `documentation-image-reading-viewport.proto.ts`. `ScrollProjectionPreference` accepts `auto`, `system`, or `composed`. This bounded repair uses `system` on the existing `asScrollSurface()` handle.

## Authority and resulting behavior

The applicable entities remain **draft**. `D-SCROLL-PROJECTION-0001-B` defines `system` as the host-owned scrolling engine and scrollbar chrome. `C-AS-SCROLL-SURFACE-0001-A/B` defines the singleton handle and its setup-only configuration; the inherited Viewport and this caller configure the same handle. `P-BASE-SCROLL-AREA-VIEWPORT-SURFACE-OWNER`, `KEYBOARD-FOCUS`, and `NAV-PARTICIPATION` retain the public Viewport's surface ownership, standard focus facts, and navigation participation driven by actual scrollable directions.

The documentation reader needs browser scrolling and browser scrollbar chrome. The corrected preference expresses that existing intent through the supported protocol. It adds no raw input or focus handler and does not suppress the type error with a cast. No lifecycle status is promoted.

## Evidence and remaining verification

The original failure is retained in the integration session's `integrated-docs-types.log`, against the implementation inherited from `d0392fb31513b12f55b9e99b1fcf26a6338569c9`. This commit isolates the one-line correction for integration with the separately repaired contrast-audit type errors. The root integration workstream must run the unchanged full `check:types:docs` gate on that combined source; this record does not claim an unexecuted pass.

The separate documentation image preview browser failures remain active work: two intermediate-motion observations, three reader outer-scroll observations, and two mobile selected-image observations in job `137596893964`. This type repair does not claim those seven cases passed.
