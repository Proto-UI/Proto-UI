# Current compiler cleanup evidence

These receipts record actual source-worktree executions during the next #1809 capability and cleanup iteration after `59c18246275c9a5ed0ad313c6da2627956930597`. That HEAD is the starting revision; the files were being developed in the isolated worktree. The receipts do not claim an exact final installed-package pin, complete Base/family support, physical-browser behavior, or a real application migration.

## Recorded outcomes

| Receipt | Actual result and boundary |
| --- | --- |
| [CLI source safety](cli-source-safety.json) | Eight real command outcomes preserve fresh publication, collision refusal, directory/file symlink refusal, exactly one concurrent writer, manual consumer edits and explicit overwrite. The first harness's wrong expected I/O exit code remains in the archive alongside the corrected passing run; the safe refusal and unchanged foreign bytes were required in both. |
| [Admission controls and independent native consumer](controls-native-source.json) | 26 Node controls passed with zero failures, skips or cancellations. They retain source/target/denominator/failure/website history controls. The actual React artifact passed strict TypeScript checking and ran with copied ordinary React dependencies in Happy DOM. |
| [Full Base inventory](base-inventory-summary.json) | Both React and GPUI analyzed all 184 files: 212 prototypes and 214 authored Hooks, 2 emitted prototypes (Text/Surface), 210 unsupported, zero source errors and zero inventory execution claims. The 2 emitted, 177 unsupported and 5 Hook-only file outcomes retain the complete denominator. |
| [Additional current tools](additional-current-tools.json) | 35 retained Cargo source/graph controls passed, including actual temporary registry resolution. Two new source-audit controls passed after an import correction; the original combined run's failed exit remains preserved. The actual unchanged Base Text audit emitted one native component and claimed zero executions. Hook closeout received syntax checking only. |

The native consumer verified that a state write alone leaves the template unchanged, then an authored update publishes it. It also exercised created-before-render, props-watch and previous-valid/default behavior, root style composition, independent instances, native listener cleanup and ordinary source editing/rebuild. The original native attempt rejected the still-unlowered `run.update()`; its authored operation and failed receipt were preserved until implementation made the same consumer succeed.

The source inventory's registry report has current native component targets and separate retired-profile obligations. Hook analysis is not emission, unsupported is not a build/execution pass, and type/builder failures cannot be relabeled as capability gaps. The website controls retain all 142 immutable historical rejected obligations in their fixture rather than deleting them when a current source is missing or rejected.

## Raw records

- `cli-source-safety-receipts.tar.gz` preserves both CLI attempts, exact runner source, command output and exit records. Its byte count and SHA-256 are recorded in `cli-source-safety.json`.
- `controls-native-source-receipts.tar.gz` preserves the first controls/native attempt, the later 26-control and registry run, the actual successful native command, original failed native diagnostics, and authored/generated/edited consumer source and reports. Installed `node_modules` are excluded; actual dependency versions are recorded. Its byte count and SHA-256 are recorded in `controls-native-source.json`.
- `base-inventory-receipts.tar.gz` preserves both actual complete target reports and their summary; `base-inventory-receipt.json` records its bytes/hash. Separate Base behavior tests are not inferred from these emission counts.
- `additional-current-tools-receipts.tar.gz` preserves the Cargo/source-audit runs, initial import failure, corrected controls, actual Base Text HIR/artifact report and documentation/syntax command receipts. Its byte count and SHA-256 are recorded in `additional-current-tools.json`.

The [cleanup ledger](../../../../internal/compiler/legacy-cleanup.md) maps the removed old execution paths to current tests and still-missing product obligations. Historical receipts elsewhere in the repository remain unchanged. Further package, native target, browser, complete corpus and real-application evidence needs its own source identity and observed result.
