# Sprint 4: preserve declared Rust data source-license metadata

## Problem and governing boundary

The actual Verdant consumer review in PR #1714 identified that `rust-data-v1` generated `license = "MIT"` for translated application code even when the application declared `AGPL-3.0-or-later`. The compiler's own license cannot supply the translated source's declaration.

This repair follows the draft `C-COMPILER-RUST-DATA-0001` publication, typed-data and source-identity criteria. Its lifecycle and private API boundary remain unchanged. `sourceLicense` is an optional caller declaration accepted by `emitRustDataSource`, `compileRustDataPrototype` and `compileRustDataFile`. The manifest and provenance retain the supplied text exactly; an absent declaration produces no Cargo license field. The generated crate retains `publish = false`. Invalid scalar values, empty declarations, controls and unpaired surrogates reject before artifact generation. This encodes metadata without inferring licenses, validating SPDX expressions or certifying contribution rights.

Translated Rust, method schemas and dependency closure are identical between the absent and declared-license variants. The generated Cargo manifest and provenance hashes change. Existing outputs must be regenerated through their producer; the repair does not edit application-generated artifacts by hand.

## Source and execution binding

The isolated worktree starts at `d0392fb31513b12f55b9e99b1fcf26a6338569c9`, the preserved seven-Sprint integration candidate. The final seven-file source delta has SHA-256 `f28640059455f806c85727d664ba6fd1abace4c3e1cc6fb7f6370b97060611f9`; individual resulting hashes and command receipts are in [validation.json](./evidence/2026-11-23-sprint4-source-license/validation.json).

Node 24.22.3, pnpm 10.32.1 and the existing Rust 1.98.1 toolchain execute the independent frozen installation and native data tests. `PROTO_UI_REQUIRE_RUST_DATA_TESTS=1` prevents missing Cargo from becoming skipped native acceptance. The original 24 tests remain; six source-option cases and two artifact/native metadata cases bring this selection to 32.

| Executed boundary | Result |
| --- | --- |
| New metadata controls against unmodified product source | 8 expected failures, 0 passes; original 24 tests unselected |
| Original and new Rust data source/artifact tests after repair | 32/32 passed, 0 failures, 0 skipped |
| Complete diagnostic registry after normal snapshot generation | 13/13 passed, 0 failures, 0 skipped |
| Actual frozen Verdant data consumers | 2 authored units, 3 methods; both metadata variants compile for each unit |

The diagnostic registry has two snapshots. The first refresh selected only the code/category snapshot; the complete run then correctly retained the missing new meaning-row failure (12/13). Running the real snapshot generator for the whole registry updated both tables, and a separate ordinary run passed all 13 cases. No expected diagnostic or category was removed. The final snapshot refresh does not change the executed Rust-data test inputs or compiler implementation.

The extra actual-application observer initially attempted `cargo check --locked` before creating a generated crate's lockfile. That first observation failed with Cargo exit 101 and remains in the evidence. The corrected observer explicitly runs `cargo generate-lockfile --offline`, then uses `--offline --locked` for both metadata and checking. It changes no compiler source or product assertion.

## Actual application consumer

Frozen source is `OpenGreendam/verdant` at `bd8c79364059b48283f6205f1a28cdd38d9758fd`. Its own `frontend/Cargo.toml` and notices supply the existing `AGPL-3.0-or-later` declaration. The exact compiler pin contains two `rust-data-v1` units: `note-gesture-planner` exposes `planNoteGesture`; `control-gesture-planner` exposes `planControlGesture` and `dragNormalized`. The pitch surface and normalized knob are GPUI units and are not counted as data crates.

For both data units, the original file bytes are recovered from that Git commit and checked against their SHA-256 values. The normal file compiler, artifact writer, Cargo manifest parser and locked offline checker run independently for an omitted declaration and the declared AGPL value. The emitted Rust hashes agree between variants; only `Cargo.toml` and `provenance.json` differ. [The consumer receipt](./evidence/2026-11-23-sprint4-source-license/verdant-consumer.json) retains source paths, upstream blob URLs, original declaration/notice hashes, generated hashes and actual command results.

The complete inputs, generated artifacts, Cargo locks and logs remain in the task-owned evidence directory. This record publishes their identities and observations without copying Verdant business source into Proto-UI's MIT source tree. The original application checkout, compiler pin and main branch are unchanged. This bounded metadata consumer does not claim a new complete application, window, audio or assistive-technology run.

## Review and retained scope

A separate root context reviewed the actual production/options/metadata diff against the draft contract and found no blocking issue. This is local independent review, not a GitHub `APPROVE`. Final exact-head CI, DCO, PR integration and earned original-criterion updates remain the root's integration work. The already completed native GPUI 67-case suite is not rerun or relabeled as evidence for this metadata repair.

The initial remote worktree creation timed out and left only its own stale index lock. The task verified that no live Git process owned the lock, preserved it with the failure receipt, and completed that fresh isolated checkout. These execution failures, the first registry result and the first Cargo observer failure remain separate from the successful results above.
