# Seven-Sprint candidate and current main integration

Commit `8fbeda8157a8d39654c08ea656a082869e870ce3` normally merges candidate `cde4963e767a91b311522b74ea8821c02025ca45` with `378441898b7840de31f8b80e6b46180c02cb874f`. Both current main `7f38b3372b5d13094000faf87930545ef2334ea4` and published candidate `502693304fc8d7509402fdfb586b283681915231` are verified real ancestors. No history or branch protection was bypassed.

## Resolution and review

The incoming compiler merge's nine-file resolution ledger and its complete 28-file result are retained in [the native merge record](2026-11-23-main-native-control-merge.md). Root integration had one additional conflict: the Context compiler-boundary test independently gained the same exact PUI1006 message and call-span checks. The resolution keeps the unsupported-input category, exact message, line and both def.context / run.context call spans, without duplicate assertions or removed cases.

Independent review checked callable identity and renderer unwrapping together; UTF-16 string comparison and ControlLabel identity branches; native view cleanup and hover-epoch guards; ControlLabel cancellation through the new hover-delivery path; scroll-engine ownership with reader motion; Text reset/selection ownership; and both the existing five native consumers and the added emitted-SDK workflow command.

## Fresh integrated verification

After the merge and the WC marker guard, Vue first-mount observation and accepted DatePicker completion fixes were integrated, clean source `555a69f9` ran the original Context boundary, scalar string-coercion, Text native reset, three WC ownership/admission files, Vue Dialog and Shadcn collection file. **8 files, 187 passed, 0 failed, 0 skipped**, 23.55 seconds. Before and after source identities are equal. [Exact command, JSON report and complete raw output](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-integrated-main-merge/manifest.json) are archived with byte hashes.

The earlier frozen merge had already reported 55 selected tests passing, but the local execution environment then restarted and cleared the temporary directory before that raw log was committed. The fresh 187-test run includes all three of those original files; it is new evidence on `555a69f9`, not a reconstruction of the lost stdout. Submitted Git commits and their archived evidence survived. The original general-CI artifact was downloaded again and independently checked against its original 4,673,465-byte SHA-256 `e6c0d3d12d0fa25b58334b9947623c19538513829ef5aeba503da2b747994748`.

These results do not certify the whole repository or the native SDK. A separate native Cargo run found a generated authored-hook test fixture missing the candidate's ordinary callable identity field; its source-generator follow-up and native rerun remain separate. A fresh full candidate workflow is required after the remaining source repairs are integrated.
