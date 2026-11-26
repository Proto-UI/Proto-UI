# Sprint 1 follow-up after concurrent integration

Date: 2026-11-24, Asia/Shanghai. This is a source and execution checkpoint, not a release or merge-acceptance declaration.

## Source and original scope

[PR #1711](https://github.com/Proto-UI/Proto-UI/pull/1711) was merged concurrently at 2026-11-24 00:14:31 +08:00. Its published head was `b111a26a69a5d73f8d6fa45ea7abdc00757525bc`, and its merge commit was `5a925927843fa4e45ed5fd8c9d030ad239924c45`. This continuation did not perform that Ready or merge operation. The final original PR run [45214115196](https://github.com/Proto-UI/Proto-UI/actions/runs/45214115196) failed its CI configuration audit; the complete GitHub reviews collection was empty when reconciled. Those facts are not retrospective technical acceptance.

The five runtime/source implementations already sealed locally in `aee9b00b83083cbc64e1b0472ed331e859426850` were absent from the merged source. They are carried onto main `824f7b12d828a179670e1d751f5f2c14d97d995d` with the bounded corrections below. The original seven commitments remain #1178, #848, #1488 H/F, #1098 Number Field, #1453 update-policy slice, #1156 legacy-slot negative control, and #1457 bounded Hook/diagnostic cleanup. This record does not close their remaining compound conditions.

The [earlier source/validation record](2026-11-24-sprint1-runtime-and-source-repairs.md) and its original archive are preserved byte for byte. Its observations were made before the final main integration and remain historical. The copied follow-up source tree before this new record is `10d59b5ffec0b3ea08ffe0305153e342bb17b72e`. Every copied file and the complete staged tree were verified equal to the reviewed working-tree composition; no older worktree was reset or discarded.

## Retained implementations and boundaries

- CLI projection proves only the current runtime's finite raw Result fields, ordered explicit re-exports and source-backed State accessors. Getters, coercions, computed calls, unknown effects and opaque spread remain unproved. SourceFile identity is part of module/declaration/member/recursion identities, preserving distinct ASTs for the same path without disabling caches.
- Anatomy stores primitive signature arrays in place of joined strings. It retains every live host getter, sort/comparator observation, version-before-dispatch behavior and reentrant notification semantics. Main's new later-recipient replacement-target control is preserved alongside the earlier reentry and lifetime controls. No native elapsed-time gain is inferred from this implementation.
- Shadow CSS memoizes only exact primitive text and immutable parse products: at most 32 selector-ABI entries / 1 Mi UTF-16 text units and 32 compiled-rule entries / 4 Mi text units. These are text-retention limits, not measured heap-byte claims. Every artifact read and validation, owner/generation decision, diagnostic, DOM effect and cleanup remains fresh.
- The additional token-map scanner proof accepts only lexically private const literal own-string data with whole-source no-write/no-escape checks. Imported mutable maps, exports, getters, spreads, unknown keys, dynamic lexical execution and escaping nested owners remain unresolved. Actual collector behavior and the pre-existing element-access path are unchanged. An earlier broader imported-map proposal was rejected during review and never applied.
- Ten old negative row fixtures now isolate the row they are testing; an independent checked-state rule is separately shown to survive an unresolved row. The whole shipped inventory and all provenance/attribute assertions remain intact. Main moved Textarea rules into a helper, so the real two-step witness now uses the actual Checkbox Group Item Result-to-stateHandles-to-rule path. Textarea helper-parameter gaps remain in the unresolved inventory.

Main's equivalent Bootstrap editor-wrapper fix, original 15 native cases, receipt validator, 20 negative receipt controls, independent Navbar/Button lanes, runtime ownership and source fingerprint are retained. The redundant local Bootstrap diagnostic chain/extra guard remains in the historical archive and is not imposed over main. Main's additional Menubar animation-settlement observation is also preserved.

The canonical generators produced nine additional tokens across the three manifests: direction variants in Shadcn, Brutalist and the two draft-family inventories, plus Brutalist focus-visible ring-black. Generated files were changed through their generators, and the complete generation check passed. The later token-map scanner-only correction has no dependency path into the actual collector/generators.

## Evidence and workflow corrections

The existing repair scope retains its three complete suites and adds the original eight-case Brutalist Input suite, its own evidence directory and a retained aggregate JSON report. The original focused-unit selection and all case deadlines are unchanged. Integration adds the two full Shadow CSS suites; it retains all eleven pre-existing files and the original 90-second owner. The twelve original Sprint 1 producers, Matrix's 60-second initialization limit, Search's 1000 ms predicate and serial owner budget remain unchanged.

Main added two manual-only, default-off Sprint 3 inputs. The controls now verify that actual boundary and both repair/Sprint 1 exclusions; reusable calls still admit only the original scope input. The compiler workflow retains its existing default-off browser acceptance entry. Five byte-identical repeated full native targets were removed only at their second occurrence, preventing overwritten logs while preserving every unique target, locked toolchain, manifest, SDK regression and execution argument. The original 31 CI controls now validate the actual input boundary and each unique complete target.

Matrix diagnostic capture is bounded by the existing 180-second case owner and can stop earlier through the unchanged caller's finally block. It records actual profiler acknowledgements, stop request, CDP sample duration and stop reason. `ownerStoppedCapture` describes a lifecycle fact; `phaseCoverage: requires-timestamp-reconciliation` explicitly withholds a complete-phase claim. Existing case, snapshot and CDP command deadlines are unchanged.

Search diagnostic retention runs after the original production owner terminates. It copies only the existing build's JS/mjs, already emitted maps, bundle graph and original two route HTML files, then reads each copy back and verifies size and SHA-256. The manifest binds clean before/after source identity and actual runner outcome. It states same-build output, no rebuild and no actual-served-byte or performance-acceptance claim. No I/O was added to the 1000 ms journey, and the original production-owner function body is unchanged.

The 77 source-wall failures introduced by main integration were reconciled by reviewing eight actual source deltas. The existing registry still contains the same 30 files and 61 literal import edges. Only the shared panel fingerprint and three stale compiler fingerprints were renewed; five Website fingerprints were renewed after review. The already inventoried client and worker now have exact-path, exact-byte, exact-digest and unique infrastructure-owner admission with leaf/ancestor symlink rejection. No directory-wide exception was added. Matrix Path, disposition and acceptance text remain unchanged; panel retains its three blocked UI owners, and the extra non-Path raw-adapter owner was removed.

## Actual local executions

These are retained working-tree executions with real command/timestamp receipts. They are not a substitute for native CI on the final published head.

| Execution | Actual result |
| --- | --- |
| Nine complete CLI-related files after main integration | 304/304 passed, zero skips |
| Thirteen complete integration files after isolated temporary-directory recovery | 496/496 passed, zero skips, 34.66 s under the original 90 s owner |
| Original seven Sprint 1 Node files, including new diagnostic controls | 228/228 passed, zero failures/cancellations/skips, 20.65 s |
| Complete Matrix diagnostic and observation control files | 42/42 passed, zero skips |
| Original CI configuration controls | Baseline 24/31 with seven real failures; corrected 31/31 |
| Final private-map collector/scanner controls | Old implementation 16 passed / 4 failed; candidate 20/20 passed |
| Exact client/worker binding controls on old checker | 0 passed / 2 failed; the old checker rejected both real registered paths |
| Complete affected compiler-boundary control groups | 43/43 passed, zero skips |
| Canonical generators and complete check | Both exit 0; all thirteen motion-palette controls passed |
| Complete coverage-matrix checker | Initial exit 1 with 77 issues; reviewed correction exit 0, two matrices, 288.58 s |
| Complete lowered-hook coverage file | 188 passed / 1 failed / 189, zero skips; whole-inventory assertion remains failed |
| Workspace TypeScript check on copied source tree | Incomplete: actual local 768 MiB heap exhaustion, exit 134; no completed type result |

The first integration attempt had three files fail to collect with ENOSPC because shared `/tmp` was a full 4 GiB tmpfs. It reported 340 executed passes, not a complete aggregate pass. Recovery used a task-owned temporary directory on the existing workspace filesystem; no shared files were deleted and no original test budget was raised. That failed attempt and all earlier intermediate control failures remain in the archive.

The complete lowered inventory is still **684 unresolved records in 109 files**: 504 subject, 83 comparison, 66 intent, 30 condition and one spec record. It is unchanged by the final private-map correction. These are diagnostic records, not 684 independently reproduced component bugs. The later declaration-provenance and shaped-attribute assertions in that same failing test were not reached. Imported Bootstrap token-map intents and helper-parameter provenance remain unaccepted; the record does not convert them into waivers.

## Remaining acceptance

Final-head repair, Sprint 1 and full CI are pending publication at this checkpoint. The previous e7 Sprint 1 run [45201408026](https://github.com/Proto-UI/Proto-UI/actions/runs/45201408026) remains a ten-of-twelve result: Matrix failed its original initialization deadline and Shadcn React production Search exceeded 1000 ms. Older successful startup captures and the d71 eleven-of-twelve run retain their own source identities. None is relabeled as acceptance of this tree.

The full lowered gate and workspace type result still require completion. Applicable independent platform approval, current-head CI/DCO, native outcomes, original scheduled recovery cycles, real application adoption and physical IME/AT boundaries remain under their original criteria. Local peer review does not supply GitHub approval, and the current user's continuation instruction does not waive these conditions.

## Retained evidence

The [manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint1-post-merge-followup/manifest.json) records exact commands, results, source hashes and the complete unresolved inventory. The [raw execution archive](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint1-post-merge-followup/executed-validation.tar.gz) contains 121 entries; every entry was read back byte for byte. Its SHA-256 is `d52996af4ca73243c8462064de53b4497572c30c80a8fc7c26d3aaa60905c5d5`. It includes unsuccessful and exploratory attempts as well as the final controls. No passing terminal is synthesized for an incomplete or failed attempt.
