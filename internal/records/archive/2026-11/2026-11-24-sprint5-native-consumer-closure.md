# Sprint 5 complete native consumer assembly

The actual macOS job `137955391295` in [run 45249588810](https://github.com/Proto-UI/Proto-UI/actions/runs/45249588810) used candidate `0b7b212d3193ea5c7ae219c0501036ee1255e3f2`. Its default generated GPUI SDK passed `cargo check --locked --lib`. The following ordinary-consumer test compilation failed with two `E0433` diagnostics: the test referenced `external_scroll::CompiledComponent`, but the producer had not included that existing authored source in its generated consumer dependency list. The remaining native consumer steps were consequently skipped on that OS.

## Restore the actual source closure

The producer now compiles the unchanged `external-scroll.proto.ts` through `compileFile`, with the repository root, public GPUI profile and shared SDK path used by its other real source consumers. Its original `asScrollSurface` setup and public methods remain intact. The output enters the same artifact receipt, local-package naming and Cargo **dev-dependency** assembly as the other consumer modules. Neither the Rust test nor generated Rust is edited.

The repaired producer ran successfully and generated **38 modules**. Parsing its emitted manifest with Python's TOML parser confirmed the exact `external_scroll` local package/path; the source receipt matches the original input SHA-256 `01429d9ec1b5f79c9a992d3e42b722bf7de2e3d3d99faf03a7316fe28a30396a`. The copied `ordinary.rs` bytes equal the existing source consumer. These checks establish producer assembly, not a successful native test execution.

The local evidence checker initially looked for `receipt.json`, then for a normal dependency table. The producer's actual contract is `source-receipt.json` and `[dev-dependencies]`; after correcting the checker, the unmodified producer output passed. Those checker mistakes do not create additional product counterexamples.

## Retain independent failures and executions

After the common default SDK succeeds, each independent native consumer now uses the exact condition `!cancelled() && steps.native_sdk.outcome == 'success'`. This permits the other consumer suites to execute after one consumer fails. Every command retains `set -euo pipefail`, its complete locked target and its own original log. No step uses `continue-on-error`, so any failure still fails the job. Cancellation remains effective, and a failed SDK prerequisite does not start consumer suites.

GitHub documents the default `success()` condition and explicit status functions in its [workflow expression reference](https://docs.github.com/en/actions/reference/workflows-and-actions/expressions#status-check-functions). The existing Scroll scheduling control originally rejected every explicit step condition. It now requires this precise dependency/status condition, verifies the actual mandatory locked SDK build, and rejects added opt-in inputs, coupling to earlier consumer success, missing continuation, conditional/skipped SDK builds and swallowed SDK failures. Its original missing/duplicate/filtered/unlocked/swallowed-consumer controls remain.

All three workflow-control files completed **59/59**, zero skipped, with the updated contract and negative variants. The initial 58/59 run is retained as the old static rule rejecting the newly explicit condition; it is not a native product failure or a discarded assertion.

## Evidence and pending native acceptance

[The evidence manifest](evidence/2026-11-24-sprint5-native-consumer-closure/manifest.json) binds the complete original macOS job log, current producer receipt and Cargo manifest, independent assembly check, and both scheduling-control outputs. The succeeding native run must still compile and execute the complete ordinary, ControlLabel, style, accessibility, Scroll and SDK test selection on Linux and macOS. This record does not convert the original unexecuted tests, any later queued job, or the producer result into native acceptance.
