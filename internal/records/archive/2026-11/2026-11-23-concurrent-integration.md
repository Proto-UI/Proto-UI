# Preserve concurrent Sprint integration and verify the merged source

The published contributor branch advanced to `b8d20315ad028de77891071db0786b7350ee7d3c` while the continuation work was being prepared. The previous publication attempt detected that changed head and performed zero public writes. Codex retained both histories and completed ordinary merge `081e17b69aec1164c44ccb3e351b63587d781d99`, with parents `a791d1be14227ded9a4de7326bde2ecf8df8ffe4` and `b8d20315ad028de77891071db0786b7350ee7d3c`. No main-branch update or independent acceptance is represented by this contributor merge.

## Resolution and source preservation

A separate agent reviewed the five compiler conflicts and produced a complete file manifest. The integrating agent independently read the proposed resolutions and checked their hashes before applying them. The merged source retains current-epoch, window, owner and engine checks for native scrolling; the incoming external-scroll observation at the child paint boundary; the existing pending-native-event cleanup before propagating association errors; and one complete set of the original opaque-value, disposal and physical UTF-16 assertions. Equivalent helper implementations were reconciled without duplicating tests or dropping assertions.

The formatter exclusion remains the same ten exact immutable historical evidence paths. Maintained scripts remain subject to the normal formatter. Historical incoming native logs and their 14 authoring-source plus 73 Rust-source hashes were inspected independently; they continue to describe their original source revision rather than this merged source.

## Merged-source verification

Nine complete compiler test files ran against staged tree `9099601166f82ebc5f96dcd90ea06c5aa6bd707e`: string coercion, physical text reset, callable control-label context, control-label lowering, lifecycle disposal errors, native scroll reveal, scroll pause targets, scroll request outcomes and scroll position consumers. All **291 tests passed**, with zero failures and zero skipped cases. Source hashes were unchanged across the run. The ordinary pre-commit hook ran, and the committed tree is identical to the tested staged tree.

The [evidence manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-concurrent-integration/manifest.json) binds the full test report and output, exact source hashes, independent resolution review, incoming-native evidence review, applied-resolution receipt and ordinary merge receipt. Raw observations are compressed without modifying their bytes. This focused result does not replace full integration CI or native execution on the merged source. The earlier `ead42f5e` and incoming `b8d20315` native runs retain their own source boundaries.

A subsequent integrated run on merge `081e17b6` plus the bounded selector-cache repair passed another **165/165 tests in nine complete files**, with zero failures or skipped cases and identical before/after source hashes. This covers all four Shadow artifact/owner files, the three percentage/admission files, passive action profiles and website Select connected reactions together. Its complete report and source receipt are retained in the same manifest; this result is kept separate from the 291 compiler cases.
