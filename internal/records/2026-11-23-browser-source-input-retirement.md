# Browser source input ownership and retirement

## Scope

Base: `03c5b45c07a225f2a80d42034bd7a4b619b63d5b`, Sprint 5 PR #1715.
The change ignores a textarea input notification only when the selected source
file already contains exactly the complete reported value. A real edit still
invalidates its source revision. Undo, supporting-file edits, and explicit Run
retry retain their existing behavior.

The parent still requires the real child disposal acknowledgement, validates its
source/token/revision, and applies the original 250 ms total cleanup deadline.
The debounce remains 250 ms. No sandbox, CSP, compiler, native artifact, or
readiness threshold is changed.

## Observed failure

The unmodified canonical browser run on clean 03c5, Chromium 145, reproduces the
hosted Chromium 157 failure from
[run 45204696433](https://github.com/Proto-UI/Proto-UI/actions/runs/45204696433):
edit/reject/recover fails disposal confirmation, then cancel/reopen fails while
the earlier retirement remains rejected. Source and generated-asset stability
checks pass; both original worktree status readings are empty.

A separate diagnostic observer preserves the same product and canonical script.
It adds passive listeners, geometry reads, a MutationObserver and a reporting
binding; it does not dispatch input or alter source values. Its results are
diagnostic, not a replacement for an uninstrumented acceptance run.

The observer records the prior Vue-to-WC disposal acknowledgement in about 13 ms.
The next textarea fill produces 331 input notifications and revisions 11 through
342 over roughly one second. The recorded lengths and prefixes repeat, but the
trace does not contain full content hashes for every event. The child receives
the disposal message after that event burst; the parent removes the retired
iframe before its acknowledgement is observed. This motivates exact-content
idempotency, while its effect on the full browser flow remains subject to the
unchanged canonical rerun.

## Regression evidence

The new tests mount the actual BrowserCompilerPanel and use its actual
CompiledRevisionSession. Only compiler transport is mocked, returning a normal
PUI1004 diagnostic. The Happy DOM Option shim creates real option nodes.

| Check | Result |
| --- | --- |
| Initial fixture attempt | 4 setup failures because Happy DOM lacks Option; excluded from product red evidence |
| Valid fixture against original product | 1 passed, 3 failed: duplicate notifications incorrectly advance revision |
| Guard plus source, panel/session/client and retirement regressions | 32 / 32 passed across five files |
| Formatting and git diff check | Passed |

The four new cases assert unchanged source/diagnostic ownership after 350 input
notifications; one real edit and duplicates compiling on the original 250 ms
deadline (including a duplicate at 249 ms); real edit, undo and explicit retry;
and selected supporting-file content ownership. The formal browser workflow's
explicit source-regression file list includes the new file.

These tests do not claim real WASM compilation, native acceptance, or successful
real iframe cleanup. Existing Vite ES2024 target warnings remain visible in the
raw logs. Independent peer review read the actual guard and all four tests and
found no blocking issue; this is not a GitHub APPROVED review.

## Retained evidence and next gate

Raw original/observed receipts, trace and observer source, frozen install,
fixture diagnostics, valid red and green logs, and formatting results are
retained losslessly under
`evidence/2026-11-23-browser-source-input/`. Its manifest records SHA-256 and
byte counts before and after deterministic gzip compression, the exact base,
and all three changed candidate-file hashes.

The combined candidate must next run the unchanged, uninstrumented canonical
browser command with the original sandbox and cleanup requirements. At this
commit that candidate run is pending; neither a Ready label nor these unit
results are represented as full browser success.
