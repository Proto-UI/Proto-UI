# Pointer-pair compositing calibration

This audit-only repair continues #469 / PR #775 from `bf235775bca68c07ab04c1cdf066a45de2f5ce59`. It addresses [discussion_r4179621482](https://github.com/Proto-UI/Proto-UI/pull/775#discussion_r4179621482), without changing production components, palette, lifecycle or draft criteria.

The draft `P-BRUTALIST-DROPDOWN-MENU-ITEM-PAIR-INVARIANT`, `P-BRUTALIST-DROPDOWN-MENU-ITEM-INTERACTION` and `P-BRUTALIST-SELECT-ITEM-INTERACTION` require the interaction's explicit fill/foreground pair. Correct computed source tokens do not establish that pair when the target or a composed ancestor applies fractional opacity or non-normal `mix-blend-mode`. Both native interaction state and geometry can survive this change.

`readContrastPointerPair` now checks the composed chain for these two unsupported paint models and records `paintLimits`. It retains the existing visibility, native hover/held, physical-connection and exact-token gates. This additional condition is pair-specific: ordinary target/anatomy visibility is unchanged, including authored partially opaque disabled surfaces. The instrument reports an unsupported pair rather than inventing composited colors or a contrast ratio.

## Executed discrimination

Four synthetic CSSOM cases run the actual serialized browser function: target and ancestor, each with opacity `0.5` or blend `multiply`. On the unchanged baseline all four incorrectly return `achieved: true`, while the eight existing controls pass. With the guard, all twelve tests pass. Each new case preserves expected fill/foreground, native hover and held state, ordinary geometry visibility, and a recovery positive control after removal. The fixture's canvas normalization and CSSOM values are injected; this is not a native rendering claim.

Four isolated real-Chromium cases also exercise those actual CSS properties with native hover and held mouse input, unchanged source tokens, paint rejection and recovery. Their local execution is blocked before assertions because Chromium's required local socket is denied; the supported escalated route has the same restriction. No native pass or production screenshot is claimed. They remain in the normal exact-head PR calibration workflow.

## Separate setup failure

Historical run [37242286605](https://github.com/Proto-UI/Proto-UI/actions/runs/37242286605), binary-and-buttons job [111553239072](https://github.com/Proto-UI/Proto-UI/actions/runs/37242286605/job/111553239072), timed out in its 10-second `beforeAll` hook. All 21 instrument tests and the binary native journey were unexecuted. The hook performs esbuild bundling and Chromium startup, but that run has no per-phase timing, so neither a failing assertion nor a transient-resource explanation is established. Calibration now logs bundle start/completion and browser start/readiness with elapsed milliseconds. The timeout, test assertions and acceptance thresholds are unchanged.

The other three shards on that same historical head contain 510 matched PNG/fact frames across 102 runtime/theme cases. Their original source and artifact digests were recovered and verified. Those are retained historical observations, not evidence for this repair or a complete family/conformance result.

## Validation boundary

Node 24.19.0 / pnpm 10.32.1: all 147 public-docs/model/provenance/journal tests pass, including the twelve serialization cases. Narrow TypeScript for runner, probe and browser calibration passes, as do changed-file formatting and diff checks. New exact-head native calibration, complete family evidence, package gates and independent acceptance remain required. No review thread is treated as resolved solely by this record.
