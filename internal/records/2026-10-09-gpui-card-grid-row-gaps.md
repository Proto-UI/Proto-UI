# Card row sizing remains a native capability gap

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

Date: 2026-10-09. Candidate base: `24b54c735`.

## Failure and authority

CI run [37876012675, rust-macos job 113644674159](https://github.com/Proto-UI/Proto-UI/actions/runs/37876012675/job/113644674159) ran synthetic merge `6d8cde03064df8b4a6a39c44ed3c37e8c20ff778`, with parents main `7e28` and Finf `24b54`. It was not a direct-head checkout. The merge and Finf head shared root tree `7a17fc4aea4012ffb7e289374f3704f57062fa45`. The style mapper suite reported 36 passes and one failure, exit 101: the exact inventory discovered `grid-auto-rows` and `grid-template-rows`.

`packages/prototypes/shadcn/src/card/header.proto.ts` genuinely authors `auto-rows-min` and `grid-rows-[auto_auto]`. The canonical fixture correctly retains `grid-auto-rows: min-content` and `grid-template-rows: auto auto`. Removing them, turning them into no-op markers, or replacing the Card's Web layout would conceal the native gap.

The draft author-token contract `C-FEEDBACK-STYLE-0004` does not claim implementation on every host. The native workspace README and mapper contract require explicit diagnostics for unsupported declarations. There is no admitted native Card support criterion to weaken here. Finf G9/native GPUI parity remains unmet.

## Fixed upstream evidence

The unchanged GPUI pin is `zed-industries/zed@62e5991dd0f0c8a3af8d5e7e9c4652490d468db8`. Only its source was read; no new upstream code was executed or installed.

- [`GridTemplate`, style.rs lines 141–175](https://github.com/zed-industries/zed/blob/62e5991dd0f0c8a3af8d5e7e9c4652490d468db8/crates/gpui/src/style.rs#L141-L175) has `repeat` and `min_size`, not an arbitrary track list. [`Style`, lines 304–313](https://github.com/zed-industries/zed/blob/62e5991dd0f0c8a3af8d5e7e9c4652490d468db8/crates/gpui/src/style.rs#L304-L313) has `grid_rows`, `grid_cols` and `grid_location`, but no implicit-row sizing field. Source blob: `9150fdded91b817305454f18beb0a0b7d6c5966a`.
- [`to_grid_repeat`, taffy.rs lines 452–481](https://github.com/zed-industries/zed/blob/62e5991dd0f0c8a3af8d5e7e9c4652490d468db8/crates/gpui/src/taffy.rs#L452-L481) lowers the three minimum variants to repeated `minmax(0, 1fr)`, `minmax(min-content, 1fr)` or `minmax(0, max-content)`. None is `auto auto`. [Lines 506–519](https://github.com/zed-industries/zed/blob/62e5991dd0f0c8a3af8d5e7e9c4652490d468db8/crates/gpui/src/taffy.rs#L506-L519) lower explicit tracks and placement, leaving implicit track sizing at the Taffy default. Source blob: `b9e583a8df43a95a8dd87ae73822ad52efb0d5ee`.

Explicit auto tracks and implicit min-content tracks have different sizing and placement semantics. Equal fractional rows, min-content-minimum fractional rows, max-content rows, or omission do not establish equivalence. The mapper therefore stays unchanged and continues returning `UnknownProperty` for each declaration. This is an inventory correction with discriminating negative coverage, not native layout implementation.

## Regression boundary and next work

The Rust regression resolves each real token, checks its exact property/value, verifies `UnknownProperty` through both `map` and the host-facing feedback path, and rejects any invented `grid_rows` refinement. Supported grid display and one-column lowering remain positive controls. The inventory still rejects both newly appearing gaps and stale entries that cease to occur. The Node fixture regression independently prevents dropping, changing or reclassifying either source token as declaration-free.

A real implementation needs either an explicitly approved upstream capability extension for auto track lists plus implicit track sizing, or an independently reviewed host layout implementation with equivalent placement and sizing. Tests must distinguish unequal intrinsic row heights, constrained/extra block space, wrapping, more children than the two explicit rows, gaps and changes over time. An upstream extension entails a separately governed dependency/pin change and native acceptance; a host implementation risks diverging from grid placement and intrinsic sizing. Neither is attempted here.

No fixture bytes, production mapper behavior, dependency pins or support admission change. Native Rust tests and native pixels remain unverified locally because Cargo, rustc and rustfmt are unavailable. Exact-candidate macOS CI remains required; this record does not turn the retained failed run green or close G9.

Local Node 24.19.0 checks on this candidate:

- `node --test --test-name-pattern='Card row sizing' scripts/gpui/test/style-fixture.test.mjs`: one test passed.
- `node --import tsx scripts/gpui/generate-style-fixture.mts --check`: passed; 365 compiled, 6 declaration-free, both style and theme fixtures current.
- Full `node --test scripts/gpui/test/style-fixture.test.mjs`: 9 passed, 4 blocked/failing because the existing tsx CLI cannot create its local IPC socket (`listen EPERM`). One permission-escalated retry reproduced the same environment failure. The direct-loader generator check is narrower evidence, not a replacement full-suite pass.
- `git diff --check`: passed. No Rust formatting or execution success is claimed.
