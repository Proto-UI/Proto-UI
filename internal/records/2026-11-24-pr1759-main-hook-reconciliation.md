# PR #1759: main merge hook reconciliation

## Scope and observed mutation

The normal signed merge `9047f82ccefe6fab00344823ab9d89442e383991` integrates `d53664c2a78391f75cf26d9cd7c5b4da3ffa3a36` into the reviewed helper replay repair. The ordinary Husky/lint-staged hook formatted six inherited main records. The scanner and its changed regression file retained their reviewed SHA-256 values.

Two ordinary Markdown records remain semantically identical under a Markdown/GFM AST comparison that removes positions and normalizes only ordinary text whitespace: `2026-11-24-sprint5-native-direction-acceptance.md` and `2026-11-24-sprint5-native-integration.md`. Their code, inline code, and HTML values were not normalized by the comparison. No current plain-text binding to their prior byte digests was found in the repository source and governance paths.

## Restore the four manifest-bound receipts

The remaining four files also preserve JSON data or Markdown structure, but their unchanged manifests directly bind their exact byte counts and SHA-256 digests. Formatting breaks those bindings. Restore exactly the original main bytes and exclude only these four paths from formatting:

- `internal/records/evidence/2026-11-24-sprint5-browser-execution/owner-receipt.json`
- `internal/records/evidence/2026-11-24-sprint5-browser-execution/owner-receipt.md`
- `internal/records/evidence/2026-11-24-sprint5-browser-execution/production-setup-receipt.json`
- `internal/records/evidence/2026-11-24-sprint5-native-direction-acceptance/receipt.md`

The browser execution manifest binds six files. The native direction manifest binds eleven files and also the decompressed original preparation patch. All 18 byte/digest checks pass after restoration. Both manifest files and every historical hash remain unchanged. The three previously protected Dialog study inputs also retain their original bytes. This is evidence preservation, not a new browser or native acceptance run.

## Validation boundary

The full merge's whitespace check reports 158 warnings in three original Scroll Reveal log files inherited byte-for-byte from main. Those original logs remain unchanged under the existing evidence policy. The authored delta against the fixed main has no whitespace diagnostics. Normal hooks remain enabled.

The helper replay repair has a separate scanner gate. Before this main merge its controlled six-file run passed 331 of 332 tests; the original whole-tree assertion still failed with 1,204 blind reads. Combined source validation and its eventual head are reported separately. This record does not claim PR merge readiness.
