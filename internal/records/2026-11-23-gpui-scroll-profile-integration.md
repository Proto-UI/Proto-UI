# GPUI public Scroll synchronization and native consumer composition

## Actual failures

The exact `d9958d163436ea08d4a19b325d9e7f5dad3dc951` hosted source lane failed one of 386 tests: the unchanged lifecycle notification fixture now uses callback `scroll.sync`, but the public GPUI target profile omitted that already implemented operation. The same omission stopped the real native producer before compilation. Original [source job 137840575296](https://github.com/Proto-UI/Proto-UI/actions/runs/45216953529/job/137840575296) output is preserved.

A frozen isolated worktree reproduced the public admission error with the expanded, valid controls: **26 passed / 6 failed / 32 total, 0 skipped**. All six failures are `PUI4003` for `scroll.sync`: four legal axes patches, a structural record, and the original lifecycle case. The existing lifecycle test was not edited.

## Narrow admission and controls

Add `scroll.sync` only to the operations declared by `gpui-source-v1`. The common native operation list, other source profiles, Qt/Flutter profile status, parser rules and runtime implementation are unchanged.

The public Scroll API accepts an optional horizontal, vertical or both axes patch during active callbacks. The existing GPUI lowering already calls the owner-scoped `scroll_sync` implementation, which validates axes, preserves omitted or unchanged axes, cancels incompatible pending end-follow work and marks the current owner dirty. The draft status of `C-SCROLL-AXIS-SYNC-0001` is not promoted by this repair.

The expanded source test uses the public compiler entry in addition to its existing checked IR/emitter controls. It retains invalid-axis and invalid-phase rejection, adds an unknown-operation rejection, and verifies that the four other native-source web profiles still reject this operation while the unimplemented Qt and Flutter profiles retain their profile rejection. The official explicit source-test list now includes this file.

The same three selected suites then passed **32 / 32**, with **0 failed and 0 pending**. Before/after source hashes match. These include the unmodified lifecycle and capability controls.

## A second generated-manifest failure

After the admission fix, the unchanged real native producer completed and exposed a separate integration error: it emitted `scroll_reader` twice and appended the same Cargo alias twice. The actual output manifest failed Python's TOML parser with `Cannot overwrite a value (at line 38, column 125)`. Its raw manifest, source receipt, producer output and parse error are retained.

Delete only the second four-line `dependencies.push` block. The first source consumer, its native test target, copied test, original checked source and all negative controls remain. Regeneration then completed with **37 unique modules** (the original receipt contained 38 records including the duplicate), and **38 Cargo manifests** parsed successfully. The top-level consumer manifest is byte-for-byte the old manifest after removing only the second duplicate alias. All generated module records, source bindings and emitted file hashes are unchanged after removing the duplicate receipt entry; the archive step additionally verifies the recorded emitted hashes against the actual files. Generated Cargo manifest originals are checked through the generator-retained `Cargo.toml.generated` files, because the consumer composition intentionally gives packages stable local names.

No generated Rust was edited. This is successful source compilation, generation and manifest validation, not a claim that Cargo native execution has passed. Final native execution remains a separately reported hosted gate.

## Reproducible record and review

The manifest in `internal/records/evidence/2026-11-23-gpui-scroll-profile-integration` binds original and candidate sources, original hosted failure, red/green Vitest JSON and full logs, both actual producer receipts/manifests, emitted validation source, driver scripts, and source-hash statuses. All gzip files decompress to their recorded original SHA-256.

The root agent independently reviewed the GPUI-only admission, public positive and negative controls, and unchanged lifecycle case; the producer deletion and generated-manifest evidence were supplied for supplemental review. This source review is not GitHub approval. PR #1738 remains Draft while its separate actual browser cleanup failure is repaired. No merge or release is claimed.

Agent: ChatGPT / Codex, continuing the user's authorized implementation and readiness work.

## Clarified emitted-artifact counts

The original receipt causes 135 file-hash checks; the deduplicated receipt causes 132. Both cover the same 132 distinct emitted artifact paths with identical bytes. Removing the second Scroll reader emission removes duplicate receipt entries and a duplicate Cargo alias; the first consumer and all its generated files remain. See the companion Checkbox session refresh record for the exact path/hash comparison.
