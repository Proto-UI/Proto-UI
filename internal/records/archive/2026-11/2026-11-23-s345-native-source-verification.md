# Native SDK and consumer verification for the frozen integrated source

## Source identity and execution

The complete run is bound to source commit ead42f5e0bfd0661c4b9215306a47b2d8259ce8d. It used its own clean checkout and frozen pnpm installation on doesvm, with Node 24.22.3, pnpm 10.32.1, Rust 1.98.1 and the pinned GPUI revision 62e5991dd0f0c8a3af8d5e7e9c4652490d468db8. The ordinary and numeric producers both ran from that checked-out authoring source. Generated Rust was never edited. The complete driver finished at 2026-11-23T13:14:00.005345+00:00 with every command successful and all generated input hashes unchanged through execution.

The ordinary lockfile stayed at 6d6e7ad41957cdb5be429b719fa27c18b633ea4ac6c77ac02fc4802ed7019e32. The numeric producer's prescribed, one-time offline metadata preparation changed its copied lockfile to b445275f392b3073f13cacaca3828340021a7c5a0f42ec8db5d43f4ea7d62b59; both complete locked dependency graph gates passed afterward. This preparation is recorded separately from the locked native tests.

## Observed original gates

| Gate                                                                        | Result      |
| --------------------------------------------------------------------------- | ----------- |
| Actual emitted SDK library controls with test-support and gpui/test-support | 27 passed   |
| Ordinary source consumers                                                   | 39 passed   |
| ControlLabel native consumers                                               | 14 passed   |
| Style mapping consumer                                                      | 1 passed    |
| Accessibility activation consumers                                          | 4 passed    |
| Explicit pause consumers                                                    | 3 passed    |
| Real reader movement consumers                                              | 3 passed    |
| Numeric accessibility action consumers                                      | 9 passed    |
| Default-feature library check                                               | Exit 0      |
| Ordinary and numeric full locked graph admission                            | Exit 0 each |

All 100 native tests reported zero failed, ignored or filtered tests. The exact manifest paths, features and single-threaded test commands are preserved in the raw receipt. The six ordinary targets total 64 tests. A later incoming source adds a distinct external-engine reader case; its 65-test result must not be relabelled as this run.

## Retained failures and source repair

The earlier candidate generated from the 37844189 merge failed the SDK library build because its authored NativeCallable fixture omitted the ordinary field. The recovery source commit 0d32a7e16ec12e403f513efba67430a939c380eb, integrated as fad4c781, adds the missing fixture field and removes the redundant test import. This run's newly generated SDK is the actual native validation of that source repair. The original failure remains in the archive.

An earlier ControlLabel run also reported five missing-ABI errors while Cargo reused an SDK artifact. The saved cargo metadata, verbose invocation and source markers identify that original execution. Rebuilding only the SDK package in an independently copied task-owned target made all five originally pending consumer gates pass with identical generated sources. The raw earlier failure, probe, and isolated success are retained. This supports a stale compiled artifact explanation; it does not claim a separately proven internal Cargo cache defect.

The current run uses a different source-keyed target, copied from that owned target with independent files, then cleans only its SDK package before native compilation. No other task's target was cleaned. Copying the preparation target took 596 seconds during shared storage contention; it is not a runtime performance measurement.

## Evidence and limits

[Raw commands, logs, source manifests and prior failures](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-s345-native-source-verification/raw-commands-and-results.tar.gz) contain 53 members. The archive SHA-256 is 645056afb9a41bb75f4ae9e5928e49d945b6676bac29a14b5b53fda8653c9e04. Its internal manifest hashes each source byte sequence without formatting it.

These are Linux GPUI TestAppContext and source-consumer results. They do not supply macOS window, physical IME, screen-reader, browser image animation, production-site or all-Sprint Ready evidence. Current and historical candidates remain separately identified. The incoming external-scroll phase repair has its own source-bound record and native result.
