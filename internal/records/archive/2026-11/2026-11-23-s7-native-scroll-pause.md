# Sprint 7 native follow pause: observe an external viewport after its clamp

## Problem and source

At source `0ffe83b72a80c10d542c0291bc63b03b3a04901b`, the new ordinary GPUI consumer exposed a real error: a wheel event against the end of an externally bound viewport changed `paused` to `following`, even though the final physical offset did not move. The existing three internal-viewport reader cases and three explicit-pause cases passed. The external case failed its original `clamped external input cannot resume follow` assertion. The complete failed native output is retained in the adjacent evidence directory.

The parent observer canvas is traversed before the child slot during prepaint. For an external child `ScrollHandle`, the canvas could therefore observe the raw wheel offset before that child's GPUI `Div` had clamped it to its actual extent. The implementation already required followed-axis movement, unchanged geometry and a current reader epoch; observing an intermediate host offset defeated that admission boundary.

## Change

Internal viewports keep their existing prepaint observation, after their parent has clamped the handle. Externally bound viewports are observed at the observer canvas's paint entry, after the full prepaint traversal has committed and clamped child geometry. The owner borrow ends before `scroll_frame` acquires its mutable borrow. Existing animation-frame scheduling handles an accepted follow write.

This changes the timing of the private host observation only. The original test still uses the actual GPUI child viewport, actual `ScrollHandle`, real wheel dispatch, appends and followed-axis arrival. No test offset is fabricated, no assertion or timeout is relaxed, and no public operation, input vocabulary or component-name dispatch is added.

The generated ordinary-consumer Cargo graph also lacked its new local `proto-ui-gpui-consumer-scroll-reader` package. An actual offline Cargo metadata resolution added that package and its transition-consumer dependency. No external package version or pinned GPUI revision changed. The graph is then checked with the original `--locked` requirement.

## Executed results

The candidate is bound to parent `0ffe83b72a80c10d542c0291bc63b03b3a04901b` and the two changed source-file SHA-256 values in [manifest.json](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-s7-native-scroll-pause/manifest.json). Node 24.22.3, pnpm 10.32.1, Rust 1.98.1 and pinned GPUI `62e5991dd0f0c8a3af8d5e7e9c4652490d468db8` were used.

| Check | Actual terminal result |
| --- | --- |
| Frozen workspace dependency installation | exit 0 |
| Eight original compiler scroll suites | 90 passed, 0 failed, 0 skipped |
| Official ordinary-consumer producer | exit 0 |
| Pinned Cargo graph with locked metadata | exit 0 |
| Original native explicit-pause suite | 3 passed |
| Native reader suite, including the failing external-viewport case | 4 passed |
| Native total | 7 passed, 0 failed, 0 ignored, 0 filtered |

The native before/after pair preserves the unchanged seven cases. The final native command was `cargo +1.98.1 test --offline --locked --manifest-path <generated>/transition/Cargo.toml --features test-support --test scroll_pause --test scroll_reader -- --test-threads=1 --nocapture`. The two suites ran against the official generated source, not a hand-written replacement SDK.

Raw source-suite stdout retains all eight file results and the 90-test terminal summary. The command wrapper accidentally wrote its command/exit receipt over the same filename used for the Vitest JSON report; that overwritten JSON is not presented as an original Vitest report. Complete stdout and its digest are retained separately. This did not change the executed command, cases or exit status.

## Earlier CI and separate consumer evidence

The earlier exact-source [native workflow 45168271190](https://github.com/Proto-UI/Proto-UI/actions/runs/45168271190) at `0ffe83b7` exposed the missing lock entry on macOS before native tests. Its macOS artifact `14816116454` has SHA-256 `9d57d1177f7a98fa6636a0a997761ae5c1e6da2672f38d7f42897e881c7c4026`. The Flutter job in that same run passed. A local GPUI success is not a claim that this earlier macOS job passed, and a new published head requires its own workflow result.

The real Shenko companion [PR 389](https://github.com/cyjin-yl/shenko/pull/389) has since merged. Its `07d6a473d2ac03dca7a351a3299c9b504e547ae0` source passed all four Inspect/IM journeys, 82 checks, and eight bidirectional Tab checks, with maximum anchor displacement 0.25 CSS px against the unchanged 2 CSS px bound. The six required jobs in [run 45103877174](https://github.com/cyjin-yl/shenko/actions/runs/45103877174) passed. Those results retain their original Proto-UI `ad39435a` package pin; they are recovered completed progress, not a newly executed run of this native repair.

## Remaining boundaries

This is native GPUI test-runtime evidence on Linux, not a physical-device, operating-system input, accessibility-technology or macOS execution claim. The complete 63-row Harness, Inspector/Tree requirements, other experiments, native parity, backend/model and historical governance acceptance remain independently tracked. The original draft contracts remain draft. Source review and executed tests do not constitute a GitHub approval, DCO certification by another contributor, release or deployment.
