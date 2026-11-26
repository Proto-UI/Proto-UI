# Main native control merge with the seven-Sprint candidate

This is a normal merge of main `7f38b3372b5d13094000faf87930545ef2334ea4` into the candidate that retains integration `502693304fc8d7509402fdfb586b283681915231` and general repair `5cd005102d136ef3776f1bb02218c8e5e5d44e82`. Both histories remain ancestors. No force update or replacement of the original Sprint history is involved.

## Authority and resolution

The existing Compiler native owner, callable, ControlLabel, Scroll, Text Control and public-data contracts remain authoritative. The new main implementation and its original tests provide concrete native-control consumers; the seven-Sprint candidate retains its independently implemented UTF-16 ordinary values, action declaration leases, ControlLabel, explicit Scroll pause and actual reader displacement checks. The full 24-block resolution ledger records the compared blocks and decisions for all nine conflicted files.

- The GPUI workflow retains all five existing ControlLabel, style, accessibility activation, Scroll pause and Scroll reader consumers and adds main's emitted SDK lifecycle/control library command. Toolchain, locked dependency checks, features and assertion thresholds remain unchanged.
- The native owner retains both ordinary and renderer-wrapper callable identities, all UTF-16 string cases, distinct Def/Render owner capabilities, conditional accessibility states, declaration/view/window action leases, notification delivery and current-view hover. ControlLabel hover cancellation follows the accepted current-view leave observation.
- External Scroll engine leases attach the actual viewport while preserving explicit pause and current-epoch reader geometry observations. Input notification alone does not manufacture reader movement. Owned wheel handling still validates owner epoch, window, followed axis and physical displacement.
- Native DOM Text reset and selection share a retireable editor lease. Reset retires editing and selection callbacks, while selection observations and controlled candidate restoration retain their existing owner-value rules.
- Shared GPUI scalar admission and authored-hook renderer lowering preserve both main's scalar operations and the seven-Sprint bounded helper checks. Readonly JSON publication and accessor-preserving object spread remain distinct rules.

## Actual red-to-green result

The first merged-source run used the original 28 selected test files with one worker and no timeout or assertion-threshold changes. It executed 562 cases: 543 passed, 16 failed and 3 were already conditional skips. All 16 failures were the four exact snapshot assertions in `text-reset-native.test.ts` across the four Web profiles: main's two-field oracle omitted the independently governed `selection` member.

`C-TEXT-CONTROL-SELECTION-0001` requires snapshot selection to describe the current physical editor in UTF-16 offsets, with unknown facts reported as null. The test now retains exact `value` and `composing` assertions and additionally compares `start`, `end` and `direction` with that mounted input's actual selection properties. It does not infer a caret from value length, omit the new field, use a partial-object matcher, remove the reentrant-reset case or weaken controlled-value ownership.

The same 28-file command then passed **559 cases with 0 failures and 3 existing skips in 101.09 seconds**. These files include main's conditional accessibility, event notification, hook renderer, style selection, readonly text, scalar conversions, scalar rounding and terminating-flow tests, plus the existing ControlLabel, UTF-16, getter, Scroll and real Web text-selection consumer suites. The raw first-run failures and complete final results are retained in compressed evidence.

The three skips remain explicit: historical old-CLI corpus capture, and the two environment-enabled emitted Rust scalar execution cases. The executed native-support migration verification cases remain in the source run. This report does not convert skipped Rust execution into a pass.

Both unchanged original producer commands successfully emitted the numeric accessibility workspace and the complete ordinary GPUI consumer composition from this actual merged source. Generated Rust was not edited. The transferred Cargo inputs are individually hashed; checked IR artifacts remain in the complete local producer archive and are not needed by Cargo execution.

## Pending separate native evidence

The Linux emitted SDK control tests, numeric accessibility consumer, and the five original native consumers were started against these frozen emitted bytes. They are **pending in this merge receipt**. The same Cargo `--locked` tests and original assertions are retained. macOS execution, platform accessibility delivery and final integration CI require their own source-bound receipts; source emission and the 559 passing cases do not stand in for them.

Machine-readable evidence: [`validation.json`](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-main-native-merge/validation.json). The resolution ledger, both full test runs, both producer logs and the source/input hash manifest are retained beside it. Independent review of the actual merge remains separate from these execution records and from any GitHub approval.
