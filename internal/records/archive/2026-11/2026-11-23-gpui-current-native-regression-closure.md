# Current GPUI Scroll and ControlLabel regression closure

## Exact source and changes

This record binds validation to upstream f6bdadf1bf1791bab8a66d7c9a6c25993fc5c1f4 (tree d2a1b196393830d6ca746f35c1c1715c44eb88f5) plus the two repairs below. The archive contains exact changed-file hashes, source guards, original commands, Cargo graphs, raw logs, and stage timings. The real generated native SDK and complete consumer targets were executed.

The current upstream producer is retained unchanged (SHA-256 c76ee6adab6ae7db487a984d6289c080d72b9f9788124a6cfcf3ce0458160521). It already restores external_scroll with the standard compileFile path. The earlier local producer-restoration commit is not replayed. The current Scroll lease guard against a disposing owner is also retained unchanged.

The Scroll repair reads the current built-in binding inside the tail prepaint callback. External viewports retain the existing paint observation after later siblings clamp their physical offsets. The actual-wheel sibling case preserves all four original test bodies. Its original-source red and first green remain in [the sibling record](2026-11-23-gpui-sibling-scroll-clamping.md); the complete five-case target is rerun here against the current source.

The ControlLabel repair separates diagnostic queue retention from stderr deduplication. After a consumer drains the queue, a subsequent actual refusal is retained even when its message is unchanged. An unread message is not duplicated, and stderr remains deduplicated. The official nine-case consumer is unchanged.

## Reproduction before the diagnostic repair

On the current source plus the reviewed Scroll repair, the official producer, dependency metadata and locked graph succeeded. The complete official target returned exit 101: **8 passed, 1 failed, 0 ignored, 0 filtered**. The existing one_logical_participant_with_two_physical_views_cannot_name_or_activate case failed at tests/control_label.rs:53 with “a refused current pairing must retain its diagnostic”. This matches the hosted failure. No assertion, case selection, timer or budget was changed.

The red batch ran from 2026-11-23T21:12:40.933383+00:00 to 2026-11-23T21:13:06.087950+00:00 (25.155 seconds). Source snapshots match. Original failure evidence remains in the red directory of the archive.

## Validation after the repair

All 18 stages completed with exit 0 from 2026-11-23T21:16:37.313130+00:00 to 2026-11-23T21:19:21.866521+00:00 (164.553 seconds), within the unchanged 45-minute aggregate native job budget. Source snapshots match. The three standard producers, locked GPUI graph admissions and default published SDK check passed.

| Complete native target | Actual terminal result                                     |
| ---------------------- | ---------------------------------------------------------- |
| official-control-label | 9 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out  |
| ordinary               | 46 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out |
| ordinary-control-label | 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out |
| style-mapping          | 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out  |
| a11y-activation        | 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out  |
| scroll-pause           | 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out  |
| scroll-reader          | 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out  |
| numeric-a11y-value     | 9 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out  |
| native-sdk-controls    | 62 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out |

The nine test targets total **155 passed, 0 failed, 0 ignored, 0 filtered**, with separate denominators retained. The environment was Node v24.22.3, Cargo/Rust 1.98.1, Linux x64, exact GPUI revision 62e5991dd0f0c8a3af8d5e7e9c4652490d468db8, one Cargo build job and the original debug-profile settings. Standard producers generated Rust and lockfiles; generated outputs were not hand-edited. Owned build artifacts were reused without substituting earlier results for this run.

Normal repository Prettier preserved the reviewed ControlLabel bytes and TypeScript parsed them without diagnostics. This static result is separate from native execution. The private continuation note contained a directory transcription error for the Scroll contract; source/scope-reference-correction.json preserves the correction to spec/contracts/C-SCROLL-END-FOLLOW-0001.yaml. Source and test behavior were unaffected.

## Reviewable evidence and limits

[Executed validation archive](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-gpui-current-native-regression-closure/executed-validation.tar.gz), SHA-256 9fc40f0c3727d62be157553361e7b42aaa8af1dce53be6cc68c46ce45b5420aa, contains a per-file manifest and original red/green logs. Manifest source hashes bind the executed uncommitted candidate; normal commit and hook results are recorded separately after this record is authored.

These results establish the listed Linux native framework controls. They do not claim a new macOS run, physical OS input delivery, formal GitHub approval, or success of unrelated browser and package-budget lanes. Hosted validation remains necessary on the published commit.
