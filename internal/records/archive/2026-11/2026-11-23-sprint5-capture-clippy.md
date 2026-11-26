# Sprint 5: pixel classifier Clippy repair

Date: 2026-11-23 (UTC).

## Observed failure and bounded repair

The official rust-macos job `137596731560` on `d0392fb31513b12f55b9e99b1fcf26a6338569c9` failed its unchanged `-D warnings` gate with five errors: unread report fields in the classifier integration target, two indexed range loops, and two manual outside-range expressions. The original log has SHA-256 `a323d810aec145a0380a8488a4f0ec0bad94fa0f5836d042292aa51c2f4109c5`. The same five errors were reproduced with actual Rust/Clippy 1.98.1 before this repair; the red log remains in the evidence archive.

Only `native/gpui/crates/proto-ui-gpui/tests/capture_pixels.rs` and its `tests/support/capture_pixels.rs` helper change. Mutable row and column iterators preserve each original ROI index. Border construction uses ordinary range containment. The existing positive fixture now checks the two actual label names, independently expected ROI coordinates, sixty ink columns across twelve rows, background count and ink-row count at scales 1, 2 and 3. These are observed output assertions, not artificial field reads. The classifier's pixel thresholds, negative controls, geometry admission, capture path and workflow commands remain unchanged. No warning suppression is added.

The related `C-CONTROL-LABEL-0001` and `T-CONTROL-LABEL-0001` definitions remain draft. This helper repair changes no Label semantics, compiler lowering or stable native support claim.

## Executed evidence

The [validation report](evidence/2026-11-23-sprint5-capture-clippy/validation.json) binds the two source hashes, original CI failure, actual commands, environment, durations and raw logs.

| Observation | Result |
| --- | --- |
| Original classifier with `clippy-driver --edition=2021 --test ... -D warnings` | Expected failure, the same five errors |
| Repaired classifier with the same Clippy gate | Passed, zero warnings |
| Existing pixel-classifier executable | 7 passed, 0 failed, 0 ignored |
| `cargo fmt --all --check` | Passed |
| `cargo clippy --workspace --all-targets -- -D warnings` | Passed on Linux / Rust 1.98.1 |
| `cargo clippy -p proto-ui-gpui --features macos-accessibility-test --all-targets -- -D warnings` | Passed on Linux / Rust 1.98.1 |

The first two full Cargo attempts failed before compilation because the offline registry cache lacked `objc2-core-media`. Both exit-101 logs remain archived. Re-enabling ordinary public registry resolution allowed the unchanged commands to pass in 88.414 and 5.285 seconds. The workspace lockfile SHA-256 stayed `a74ca14140d1ff3a65af5fe237cd2cf21af622e026805b6a7e7f656dc47e4df3`; no dependency or gate was changed to obtain the result.

An independent parent reviewer read the actual two-file diff and separately checked the fixture's sixty-column/twelve-row arithmetic, index equivalence and unchanged thresholds. No blocker was found. That review is not a GitHub approval.

## Remaining exact-source acceptance

This evidence establishes the reported lint repair and the existing classifier behavior. The local host is Linux and Rust 1.98.1, while the failing official job used macOS and Rust 1.100. The macOS-only feature body, real window presentation, decoded native screenshots and OS accessibility still require the normal CI run on the combined candidate. Synthetic classifier strokes are not screenshot evidence and were not uploaded as captures. Root retains combined-head CI, review publication, integration and original Sprint tracking.
