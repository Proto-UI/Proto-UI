# Sprint 5 current consumer execution lanes

This change prepares actual execution of the repaired Sprint 5 candidate. It preserves the existing manual opt-in, scheduled owner, worker limits, browser sandbox and the original 250 ms preview-retirement requirement. Preparation is not an execution receipt.

## Browser prerequisites and generated owner evidence

The previous candidate's browser job in [run 45228171867](https://github.com/Proto-UI/Proto-UI/actions/runs/45228171867) stopped while installing the Chinese font package, before executing a page. The workflow now uses the already committed `prepare-homepage-composition-fonts.sh`, also used by the Sprint 3 follow-up. That helper verifies the configured package bytes, package identity, font family and required Chinese glyphs. Its invocation has a 220 second bound inside a five minute step and retains the font-preparation evidence. This does not change any application readiness or retirement deadline.

The existing source-regression selection additionally runs the generated physical-control SSR tests, the owner-retirement regression, SDK assembly and authored-input regressions. The actual browser lane also executes the four emitted WC SSR adoption/retirement scenarios before the full bilingual Compiler journey. `CHROME_PATH` explicitly receives the same detected binary as `PUI_CHROME_EXECUTABLE`, so the fixture's shared browser helper does not silently select a different executable. Its artifacts remain under the existing source-bound upload directory.

## Independent native consumers

The Linux/macOS matrix retains all existing ordinary, ControlLabel, style, A11y, numeric, Scroll pause/reader and SDK lifecycle consumers. Three duplicated steps are removed; each original consumer still executes once.

The matrix now also produces and executes the separate official ControlLabel fixture. It compiles the unchanged Button, Label, Input and actual Input delegate and retains its two physical views of the same Entity, ambiguity, retirement and recovery assertions. This consumer supplies a different boundary from the ordinary-values ControlLabel test; neither substitutes for the other.

The independent workspace's metadata is resolved before its locked graph check, following the existing numeric-consumer pattern. The graph validator still verifies the exact GPUI Git source/revision and shared SDK dependency closure. The final consumer uses `cargo test --locked`; generated Rust is never edited. Producer, graph and consumer logs have distinct names.

## Executed controls and pending execution

- The workflow scheduling, cycle inventory and cycle-report controls passed **59/59**, with no skipped cases, after the final consumer additions.
- `check-ci-schedule.mjs` passed: no push-triggered full cycle, one three-slot scheduled regression owner, guarded event contexts.
- The existing font-helper mock controls covered success, wrong bytes, wrong version, wrong family and missing glyphs. These are helper controls, not a new runner font installation.
- The independent source review verified that the removed native steps were duplicates and identified the Chrome environment-variable mismatch; the explicit `CHROME_PATH` binding above resolves that finding.

The final hosted font installation, Linux/macOS GPUI and independent Adapter execution, generated SSR browser scenarios, fresh production graph and full Compiler browser journey remain pending until their actual source-bound receipts are collected. No previous failed or skipped result is rewritten as a pass by this workflow change.
