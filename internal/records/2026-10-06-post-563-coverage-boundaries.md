# Coverage boundary follow-up after PR #563

Date: 2026-10-06. Fresh base: `48b80f8b8b0b94dbac04919e3516bc6a1ed2c37c`.

## Integration history

PR #563 was merged externally at 10:41:03 UTC with head `bc0c7acbfce43f249d386ac5431c5f0966cb6998`, merge `405112ed2cbae56cff6e178d9cb4d5d93b930fe5`. The subsequent script-mask commit `91fb72444a2b39cbbf7be2c621697e1133e25af4` was published after that merge and is not in main. This follow-up carries only its five-file delta, then the bounded repairs below; it does not reapply the already merged matrix/runtime work. The script-mask record retains its original baseline and observations. New-base verification is separate from old PR CI.

## Module-owned production graph edges

Review r4194192770 was reproduced against the actual 284-page emitted graph: adding an unrelated module and its dynamic React Adapter edge to the real shared renderer chunk left the old checker result empty. Exact site entry/owner pairs alone did not attribute a shared chunk's edges.

The build now records resolved Rollup module import and dynamic-import relationships. Site runtime consumers authorize Adapter/framework modules only through the exact renderer module's dependency graph, independently of chunk co-location. Missing, duplicate, malformed, or dangling module records fail closed for these consumers. Inert unrelated co-location is allowed; foreign Adapter branches from shared renderer/runtime/helper chunks are rejected. Existing static shell walls, five owner pairs and dynamic-only runtime identity checks remain in force. This is build-time module dependency evidence, not arbitrary JavaScript flow analysis or a proof that every retained source edge executes.

## Fresh-main Web Component bridge reconciliation

The first integrated production graph failed with the same fifteen errors under both the old and candidate checker. Fresh main added three actual WC support modules to the unique site-control bridge. Rollup reported nonzero rendered lengths: visual-surface 389, experimental-visual-consumer 129, owned-texture-sink 18,950. These figures are observations for this build, not package ceilings or compressed transfer sizes. The registry's install export was removed, while its getter remained.

Independent source review identified private visual-node bookkeeping, consumer-registry lookup, and the generic opaque material fallback used by accepted WC adaptation. Ordinary controls without a consumer/material declaration do not create a sink; the opaque fallback has no shader/compiler runtime import and exits before WebGL creation. The exact three paths are admitted only inside the already reviewed bridge chunk. Per-path sibling/dependency placement and lookalike negatives reject inherited exemptions. This records real support code, not a zero-byte tree-shaking claim or permission for arbitrary material modules.

## Portable checks and mandatory media integration

Review r4194192754 identified a real root-suite portability problem: the portable `*.test.mjs` glob ran unconditional Linux-only real decoder fixtures. Production retained-video validation remains unchanged and fail-closed. Portable tests exercise unsupported-platform and missing-tool failures without invoking real decoders, and explicitly report the real integration as not run. Real fixtures move to `decode-video-evidence.integration.mjs`, invoked unconditionally in the existing Ubuntu CI toolchain step. That command must fail if the platform or tools are unavailable; negative CLI controls verify this behavior. Local Linux integration passed 15/15 using FFmpeg 7.1.5. Simulated Windows/macOS checks are not native-platform execution. Exact-head Ubuntu 24.04 / FFmpeg 6.1.x CI remains required.

## Verification boundaries

These are pure checker/build/test changes with executable evidence. Range and CSS Modules/ICSS remain explicitly unmodeled in #854. No matrix lifecycle status is promoted. Old PR threads are not treated as resolved by the external merge. Final current-tree source, coverage, graph, type and independent-review results belong to the new PR checkpoint; older exact-head results remain historical evidence only.
