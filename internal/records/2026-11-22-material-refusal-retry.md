# Sink refusal retry correction

## Cause and authority

This is a bounded repair under the existing draft material ownership/safety/contact direction and the unchanged R2 controls. The effective-motion-frame change in b418, observed at e775, made failed contact shutdown contract paintOutset from 9 to 0. Because the refusal cache reused the complete transient paint lease, the already queued RAF interpreted that internal contraction as new admission conditions and rendered again. Matched read-only tracing on clean a8bf and e775 proves the extra attempt differs only in paintOutset; session, source/palette identity, geometry bounds and authored inputs are unchanged.

## Matched evidence and preserved history

- Original R2 pair isolated on a8bf: 2 passed / 132 skipped, exit 0.
- Same pair on e775: 2 failed / 145 skipped, exit 1, expected 2 render calls but got 3 before any author edit.
- Two added carrier/transport controls before repair: same extra-render failure; original plus added R2 total 4 failed.
- After repair: original R2 + new controls + original contact extent + original transport/preference guard, 18 passed / 131 skipped, exit 0.
- Complete sink file: 19 failed / 130 passed (149), exact same 19 failed identities as the preserved clean-main baseline 19 failed / 115 passed (134). The two historical complete-file R2 failures are back at the later author-edit expected 3/got 2 checkpoint; they are not overwritten by isolated green controls.

`trace-executions-node.json` contains exact commands, times, actual exits and unchanged worktree status for the matched replay. `matched-replay-differences.json` retains the real key differences. Original native and clean-main logs remain unchanged. Ambient pnpm11 engine refusal occurred before any test started; its receipt is retained separately. The first post-fix added-control attempt correctly rejected a repeated frame revision; the new fixture was corrected to strictly increasing revisions without changing the guard.

## Narrow implementation

Only sink.ts and its existing test file change. Stable paint conditions are shared; actual paint/pending leases still include current paintOutset, while refusal retry identity uses stable conditions plus session. Own failed-motion shutdown cannot repair a refused carrier or transport. Current source ownership, geometry/bounds, palette, effective motion, profile, fill/foreground, class/inline author inputs, style revision, tokens and semantic phase still govern retry. Same-source pixel revisions, same-session pointer moves and a view revision alone remain blocked. Source admission, complete opaque fallback and reentrancy checks are unchanged.

Two new behavior controls exercise carrier stylesheet refusal and image transport refusal, stopped-contact RAF, repeated pixel/source and move notifications, a placement change without a size change, a fresh session, and a real author edit. They inspect render attempts and committed output, not private cache keys. Every prior assertion and time limit remains unchanged; the new cases clean up in finally. This is mocked GPU/decode host-unit evidence, not browser optical acceptance.

Prettier and git diff --check passed. Source/test hashes and the minimal patch digest are in sink-retry-correction.json. The coordinating agent preserved these actual receipts and comparisons in [the machine-readable record](2026-11-22-material-refusal-retry.json). No budget ceiling or acceptance state changes here. The old eleven-probe report contains no sink.ts closure input; final source-bound strict measurement and the corrected candidate's own complete native cycle remain required.

The same e775 runtime case names also appeared in historical failures, but that does not exempt a changed first-error boundary. The general worker observed repeated render counts `[1,2,2,2,2,2]` where the original assertion requires `[1,1,1,1,1,1]`; the material worker reached the down-event count mismatch. Both native observations remain bound to e775. The new source correction is not relabeled as a passing native result until its own run executes.

The subsequent full local `check:types` completed against the frozen sink, sink-test and Toggle-test bytes: **1,259 files, zero errors, zero warnings and 31 hints**, exit 0, 217.397 seconds. The selected 8,557 tracked type-input hashes remained unchanged. This check preceded integration of the separately authored main compiler-fixture repair; the final native type job must validate that combined candidate. The machine-readable record contains the actual command and log digest.
